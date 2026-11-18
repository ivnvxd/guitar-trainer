// Run with: node tests/player.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const { DrumCut, DELAY, delayFor } = require(path.join(__dirname, '..', 'js', 'drumcut.js'));
let checks = 0;

const rate = 44100, n = rate * 4;
// Sound goes through in blocks of 128 samples, as in the browser.
function run(left, right, amount, speed = 1) {
  const cut = new DrumCut(), outL = new Float32Array(n), outR = new Float32Array(n);
  cut.amount = amount;
  cut.setRate(speed);
  for (let i = 0; i + 128 <= n; i += 128) cut.run(left.subarray(i, i + 128), right.subarray(i, i + 128), outL.subarray(i, i + 128), outR.subarray(i, i + 128));
  return [outL, outR];
}
// A note that rings (two sines, a little different on each side) and a short burst of noise four times a second.
const noteL = new Float32Array(n), noteR = new Float32Array(n), hits = new Float32Array(n);
let seed = 7;
const noise = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 1073741824 - 1; };
for (let i = 0; i < n; i++) {
  const t = i / rate, since = (t * 4) % 1 / 4;
  noteL[i] = 0.3 * Math.sin(2 * Math.PI * 220 * t) + 0.2 * Math.sin(2 * Math.PI * 330 * t);
  noteR[i] = 0.2 * Math.sin(2 * Math.PI * 220 * t) + 0.3 * Math.sin(2 * Math.PI * 330 * t);
  hits[i] = 0.6 * noise() * Math.exp(-since * 150);
}
const mixL = noteL.map((v, i) => v + hits[i]), mixR = noteR.map((v, i) => v + hits[i]);

// With the cut off, the sound comes out as it went in, late by DELAY samples, on both sides.
{
  const [outL, outR] = run(mixL, mixR, 0);
  let worst = 0;
  for (let i = 0; i < n - DELAY - 256; i++) worst = Math.max(worst, Math.abs(outL[i + DELAY] - mixL[i]), Math.abs(outR[i + DELAY] - mixR[i]));
  assert.ok(worst < 1e-4, `the sound passes unchanged when the cut is off (largest difference ${worst})`); checks++;
}

// With the cut on, the note stays and most of the hits go. How much of each is left: the best fit of
// out = a * note + b * hits, over the middle of the sound.
{
  const [outL] = run(mixL, mixR, 1);
  let nn = 0, hh = 0, nh = 0, ny = 0, hy = 0;
  for (let i = rate; i < n - DELAY - rate; i++) { const a = noteL[i], b = hits[i], y = outL[i + DELAY]; nn += a * a; hh += b * b; nh += a * b; ny += a * y; hy += b * y; }
  const det = nn * hh - nh * nh, note = (ny * hh - hy * nh) / det, hit = (hy * nn - ny * nh) / det;
  assert.ok(note > 0.85, `a ringing note stays (${note.toFixed(2)} of it is left)`); checks++;
  assert.ok(hit < 0.25, `short hits go (${hit.toFixed(2)} of them is left)`); checks++;
}

// A song at a quarter of its speed has hits that last four times as long. The cut then looks at a longer time,
// so these hits go too, and the sound is later.
{
  const slow = new Float32Array(n);
  for (let i = 0; i < n; i++) slow[i] = 0.6 * noise() * Math.exp(-((i / rate) % 1) * 37.5);
  const left = noteL.map((v, i) => v + slow[i]), right = noteR.map((v, i) => v + slow[i]);
  const left0 = (out, late) => {
    let nn = 0, hh = 0, nh = 0, ny = 0, hy = 0;
    for (let i = rate; i < n - late - rate; i++) { const a = noteL[i], b = slow[i], y = out[i + late]; nn += a * a; hh += b * b; nh += a * b; ny += a * y; hy += b * y; }
    const det = nn * hh - nh * nh;
    return { note: (ny * hh - hy * nh) / det, hit: (hy * nn - ny * nh) / det };
  };
  assert.ok(delayFor(0.25) > DELAY, 'a slow song comes out later'); checks++;
  const asFast = left0(run(left, right, 1, 1)[0], DELAY), asSlow = left0(run(left, right, 1, 0.25)[0], delayFor(0.25));
  assert.ok(asSlow.hit < 0.3 && asSlow.hit < asFast.hit, `slow hits go when the cut knows the speed (${asSlow.hit.toFixed(2)} left, ${asFast.hit.toFixed(2)} without the speed)`); checks++;
  assert.ok(asSlow.note > 0.85, `the note stays at a slow speed (${asSlow.note.toFixed(2)} of it is left)`); checks++;
  const [plain] = run(left, right, 0, 0.25);
  let worst = 0;
  for (let i = 0; i < n - delayFor(0.25) - 256; i++) worst = Math.max(worst, Math.abs(plain[i + delayFor(0.25)] - left[i]));
  assert.ok(worst < 1e-4, `at a slow speed the sound passes unchanged when the cut is off (largest difference ${worst})`); checks++;
}

// Silence in gives silence out, and no number that is not a number.
{
  const quiet = new Float32Array(n), [outL, outR] = run(quiet, quiet, 1);
  assert.ok(outL.every(v => v === 0) && outR.every(v => v === 0), 'silence stays silence'); checks++;
}

console.log(`player: ${checks} checks passed`);
