/* Sound: a plucked-string voice (Karplus-Strong), a soft tone, chords, sequences and a metronome.
   Browsers start audio only after a click or a key press, so the context opens on first use. */
(function (root) {
  'use strict';
  const GT = root.GT = root.GT || {};
  let ctx = null, master = null;
  const cache = new Map();
  let voice = 'pluck';
  const active = new Set();   // sources that are playing or scheduled
  const pending = new Set();  // timers that start sounds later
  const track = node => { active.add(node); node.onended = () => active.delete(node); };
  let volume = 0.8;

  function context() {
    const Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return null;
    if (!ctx) {
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = volume;
      // A gentle low-pass takes the edge off the plucked noise.
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass'; tone.frequency.value = 5200; tone.Q.value = 0.4;
      // A limiter keeps strums and chords below clipping.
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -8; limit.knee.value = 4; limit.ratio.value = 12; limit.attack.value = 0.003; limit.release.value = 0.2;
      master.connect(tone); tone.connect(limit); limit.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const freq = midi => 440 * Math.pow(2, (midi - 69) / 12);

  // Karplus-Strong. The averaging filter delays by half a sample, so the period is N + 0.5.
  // The playback rate then corrects the pitch exactly, which matters for ear training.
  function pluckBuffer(midi) {
    if (cache.has(midi)) return cache.get(midi);
    const sr = ctx.sampleRate, f = freq(midi);
    const N = Math.max(2, Math.floor(sr / f - 0.5));
    const seconds = midi < 52 ? 3.2 : midi < 64 ? 2.6 : 2.0;
    const out = new Float32Array(Math.floor(sr * seconds));
    const line = new Float32Array(N);
    // Excitation: noise smoothed once, so the attack sounds like a pick, not a hiss.
    let prev = 0;
    for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; line[i] = (r + prev) * 0.5; prev = r; }
    const decay = 0.996 + Math.min(0.0035, (64 - Math.min(64, midi)) * 0.00008);
    let idx = 0, last = line[N - 1];
    for (let n = 0; n < out.length; n++) {
      const cur = line[idx];
      const next = (cur + last) * 0.5 * decay;
      last = cur;
      line[idx] = next;
      out[n] = cur;
      idx = idx + 1 === N ? 0 : idx + 1;
    }
    // Fade the last quarter to zero, so a long bass note does not stop with a click.
    const fade = Math.floor(out.length / 4);
    for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
    const buffer = ctx.createBuffer(1, out.length, sr);
    buffer.copyToChannel(out, 0);
    const item = { buffer, rate: f / (sr / (N + 0.5)) };
    cache.set(midi, item);
    return item;
  }

  function playPluck(midi, at, duration, gainValue) {
    const { buffer, rate } = pluckBuffer(midi);
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainValue, at);
    if (duration) {
      g.gain.setValueAtTime(gainValue, at + duration);
      g.gain.exponentialRampToValueAtTime(0.0001, at + duration + 0.12);
    }
    src.connect(g); g.connect(master);
    track(src);
    src.start(at);
    src.stop(at + (duration ? duration + 0.15 : buffer.duration));
  }
  function playSoft(midi, at, duration, gainValue) {
    const len = duration || 0.9;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o1.type = 'triangle'; o2.type = 'sine';
    o1.frequency.value = freq(midi); o2.frequency.value = freq(midi) * 2;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gainValue * 0.5, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o1.connect(g); o2.connect(g); g.connect(master);
    track(o1); track(o2);
    o1.start(at); o2.start(at); o1.stop(at + len + 0.02); o2.stop(at + len + 0.02);
  }

  // Play one note. "at" is seconds from now. Returns false when the browser has no audio.
  function note(midi, at = 0, duration = 0, gainValue = 0.5) {
    if (!context()) return false;
    const when = ctx.currentTime + 0.03 + at;
    (voice === 'soft' ? playSoft : playPluck)(midi, when, duration, gainValue);
    return true;
  }
  // Notes one after another ("up", "down") or together ("together"); "strum" spreads them slightly.
  function notes(midis, mode = 'up', gap = 0.6, duration = 0) {
    if (!context()) return false;
    const list = mode === 'down' ? [...midis].reverse() : midis;
    const each = mode === 'together' ? 0 : mode === 'strum' ? 0.035 : gap;
    const gainValue = mode === 'together' || mode === 'strum' ? 0.38 : 0.5;
    list.forEach((m, i) => note(m, i * each, duration, gainValue));
    return true;
  }
  // A sequence of chords: [[midis], [midis], ...], one per beat at the given tempo.
  function chordSequence(chords, bpm = 80, beatsEach = 2) {
    if (!context()) return false;
    const beat = 60 / bpm;
    chords.forEach((midis, i) => midis.forEach((m, j) => note(m, i * beat * beatsEach + j * 0.03, beat * beatsEach * 0.95, 0.32)));
    return chords.length * beat * beatsEach;
  }
  // Stop every note that plays or waits to play, and every delayed sound. The metronome goes on.
  function silence() {
    for (const id of pending) clearTimeout(id);
    pending.clear();
    for (const node of active) { try { node.stop(); } catch { /* already stopped */ } }
    active.clear();
  }
  // Run a sound later; silence() cancels it.
  function later(fn, ms) {
    const id = setTimeout(() => { pending.delete(id); fn(); }, ms);
    pending.add(id);
  }

  // Metronome with a look-ahead scheduler, so the clicks stay in time while the page works.
  const metronome = { running: false, bpm: 80, beats: 4, beat: 0, nextTime: 0, timer: null, onBeat: null };
  function click(at, accent) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.06);
  }
  function schedule() {
    while (metronome.nextTime < ctx.currentTime + 0.12) {
      const beat = metronome.beat, at = metronome.nextTime;
      click(at, beat === 0);
      if (metronome.onBeat) {
        const delay = Math.max(0, (at - ctx.currentTime) * 1000);
        setTimeout(() => metronome.running && metronome.onBeat(beat), delay);
      }
      metronome.beat = (beat + 1) % metronome.beats;
      metronome.nextTime += 60 / metronome.bpm;
    }
  }
  function startMetronome(bpm, beats, onBeat) {
    if (!context()) return false;
    stopMetronome();
    Object.assign(metronome, { running: true, bpm, beats, beat: 0, nextTime: ctx.currentTime + 0.08, onBeat });
    schedule();
    metronome.timer = setInterval(schedule, 25);
    return true;
  }
  function stopMetronome() {
    metronome.running = false;
    clearInterval(metronome.timer);
    metronome.timer = null;
  }
  function setTempo(bpm) { metronome.bpm = bpm; }

  GT.audio = {
    note, notes, chordSequence, silence, later, startMetronome, stopMetronome, setTempo,
    get metronomeRunning() { return metronome.running; },
    setVoice(v) { voice = v; },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    available: () => !!(root.AudioContext || root.webkitAudioContext),
    running: () => !!ctx && ctx.state === 'running'
  };
})(window);
