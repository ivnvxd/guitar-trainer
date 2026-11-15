/* Rhythm drills: name the rhythm you hear, and tap in time. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const R = GT.rhythm, A = GT.audio;
  const { h, settings } = GT;
  const D = GT.drills;
  const SIG = [4, 4];
  const stageOf = bar => R.STAGES.find(s => s.bars.includes(bar));
  const STAGE_GROUPS = R.STAGES.map(s => [s.id]);
  const poolOf = c => R.STAGES.filter(s => c.set.includes(s.id)).flatMap(s => s.bars);
  // A bar in words, for the lists of missed items: "quarter, eighth rest, eighth, half".
  const describe = bar => R.parse(bar).map(e => `${e.dot ? 'dotted ' : ''}${R.VALUE_NAMES[e.value]}${e.rest ? ' rest' : ''}${e.tie ? ' tied to' : ''}`).join(', ').replace(/ tied to,/g, ' tied to');
  const stageNames = ids => ids.map(id => R.STAGES.find(s => s.id === id).name.toLowerCase()).join(', ');
  const stagePick = (c, set) => D.pickset('Rhythms', R.STAGES.map(s => ({ value: s.id, main: s.name })), c.set, v => set({ set: v }));
  const tempoPick = (c, set) => D.field('Tempo', GT.segmented('Tempo', [[60, '60'], [72, '72'], [90, '90']], c.tempo, v => set({ tempo: v })));
  // One bar of held tones after one bar of clicks (the count-in of Settings). The clicks go on under the bar.
  const countIn = () => settings.countIn === false ? 0 : 4;
  function playBar(bar, bpm, onEnd) {
    const events = R.toneEvents(R.parse(bar), bpm, SIG);
    return A.startRhythm({ beats: 4, barSeconds: R.barSeconds(bpm, SIG), bars: 1, countIn: countIn(), clicks: true, events: () => events, onEnd });
  }

  // ---------- name the rhythm ----------
  D.add({
    id: 'rhythm-name', track: 'rhythm',
    title: 'Name the rhythm',
    blurb: 'Hear one bar of rhythm. Pick the rhythm you heard.',
    hint: 'Count along with the clicks. Listen for where each note starts and how long it rings.',
    help: [
      'Four clicks count you in, unless the count-in is off in Settings. Then one bar plays: each note is a held tone, and the clicks go on under it. Pick the bar you heard. The notes are spaced by their length, so a long note takes more room.',
      'Start with whole, half and quarter notes. With automatic mode on, rests, eighths, dotted notes, sixteenths and triplets join when about 85 percent of your answers are right.',
      'After a miss, Compare plays your answer and then the right one.'
    ],
    defaults: { auto: true, set: ['quarters'], tempo: 72 },
    stages: STAGE_GROUPS,
    // The clock starts when the bar ends, so this is the time to choose.
    fastMs: 6000,
    pool: c => poolOf(c),
    unlockText: added => `New rhythms added: ${stageNames(added)}.`,
    itemName: describe,
    make(item, c) {
      // Three other bars to choose from: from the same group first, so they are close.
      const others = poolOf(c).filter(b => b !== item);
      const close = GT.shuffle(others.filter(b => stageOf(b) === stageOf(item))), far = GT.shuffle(others.filter(b => stageOf(b) !== stageOf(item)));
      return { bar: item, bpm: c.tempo, choices: GT.shuffle([item].concat(close.concat(far).slice(0, 3))) };
    },
    render(q, ui) {
      ui.title('Which rhythm did you hear?');
      ui.sub(`One bar of 4/4 after four clicks, at ${ui.config.tempo} beats per minute.`);
      ui.actions([['▶ Replay', () => ui.play(), 'R']]);
      ui.choices(q.choices.map(b => ({ value: b, main: R.notation(R.parse(b), SIG, { small: true, label: describe(b) }) })));
      ui.answers.classList.add('answers-rhythm');
    },
    play(q, how, ui) {
      if (!q) return 0;
      const bpm = q.bpm || 72;
      A.silence();
      playBar(q.bar, bpm);
      // The answer clock starts after the count-in and the bar.
      return (4 + countIn()) * 60 / bpm;
    },
    check: (q, v) => v === q.bar,
    feedback(q, v, correct, ui) {
      const bpm = ui.config.tempo;
      return {
        text: correct ? `Right: ${describe(q.bar)}.` : `You chose ${describe(v)}. It was ${describe(q.bar)}.`,
        visual: R.notation(R.parse(q.bar), SIG, { sig: true, count: true, label: describe(q.bar) }),
        actions: [['▶ Replay', () => { A.silence(); playBar(q.bar, bpm); }]].concat(correct ? [] : [['▶ Compare', () => {
          A.silence();
          playBar(v, bpm, () => playBar(q.bar, bpm));
        }]])
      };
    },
    stop() { A.stopRhythm(); },
    options(c, set) {
      return h('div', { class: 'opts' }, tempoPick(c, set), stagePick(c, set), D.autoRow(this, c, set, 'rhythms', id => R.STAGES.find(s => s.id === id).name.toLowerCase()));
    }
  });

  // ---------- tap in time ----------
  // Read and tap: the bar shows, one bar of clicks counts you in, and you tap the notes while the clicks go on.
  // Hear and tap back: the bar plays first, then you tap it in the next bar.
  // Keep the pulse: tap every beat. The click plays for two bars and stops for two, and the page checks those two.
  // Taps come from the pad or from the J and F keys, at the moment the finger goes down. The delay of the device
  // (sound out, touch in) is measured once with twelve taps on clicks and taken off every tap.
  const TAP_MODES = [['read', 'Read and tap'], ['echo', 'Hear and tap back'], ['pulse', 'Keep the pulse']];
  const tap = { q: null, taps: null, ui: null, running: false };
  // The moment the finger went down. An event time on another clock (some browsers) falls back to now.
  const nowOf = e => { const now = performance.now(); return e && e.timeStamp > 0 && Math.abs(e.timeStamp - now) < 1000 ? e.timeStamp : now; };
  function record(e) {
    if (!tap.taps || (e && e.repeat)) return;
    tap.taps.push(nowOf(e));
    const pad = document.querySelector('.tap-pad');
    if (pad) { pad.classList.remove('is-hit'); void pad.offsetWidth; pad.classList.add('is-hit'); }
  }
  function pad() {
    const b = h('button', { type: 'button', class: 'tap-pad', 'aria-label': 'Tap here in time. The J and F keys tap too.' }, 'Tap');
    b.addEventListener('pointerdown', e => { e.preventDefault(); record(e); });
    // A click from the keyboard (Enter or Space on the focused pad) is not a timed tap.
    b.addEventListener('click', e => e.preventDefault());
    return b;
  }
  // Runs one round: plays the clicks (and the bar, to tap back), collects the taps, and scores them against the
  // times the page expected. expect(start, beat, barSec) gives those times in seconds of the audio clock.
  function runRound(o, expect, done) {
    tap.taps = [];
    tap.running = true;
    const start = A.startRhythm(Object.assign({}, o, { onEnd: () => setTimeout(() => {
      // The drill stopped meanwhile (you left it, or changed an option).
      if (!tap.taps) return;
      tap.running = false;
      const taps = tap.taps.slice();
      tap.taps = null;
      done(expected, taps.map(t => (t - (settings.tapOffset || 0)) / 1000), barStart);
    }, 350) }));
    if (start === null) { tap.running = false; tap.taps = null; return false; }
    // The expected times on the page clock, taken now: the same moment the sounds were placed.
    // barStart: when bar 0 starts, after the count-in. Taps before a bar to tap do not count.
    const expected = expect(start, o.barSeconds / o.beats, o.barSeconds).map(t => A.heardAt(t) / 1000);
    const barStart = A.heardAt(start) / 1000;
    return true;
  }
  // Calibration: twelve clicks; the delay is the typical gap between a click and your tap.
  function calibrate(ui, onDone) {
    const say = h('p', { class: 'tap-say', 'aria-live': 'polite' }, 'Tap the pad on each click, twelve times. Look away from the screen and listen.');
    const startBtn = h('button', { type: 'button', class: 'btn btn-primary btn-big', onclick: () => {
      startBtn.disabled = true;
      say.textContent = 'Tap with each click…';
      const bpm = 90, beat = 60 / bpm;
      const ok = runRound({ beats: 4, barSeconds: 4 * beat, bars: 3, countIn: 0, clicks: true, events: () => [] },
        start => Array.from({ length: 12 }, (_, k) => start + k * beat),
        (expected, taps) => {
          startBtn.disabled = false;
          // Each click after the first two takes the nearest tap within 300 ms.
          const offsets = expected.slice(2).map(t => { const near = taps.reduce((b, x) => Math.abs(x - t) < Math.abs(b - t) ? x : b, Infinity); return Math.abs(near - t) <= 0.3 ? (near - t) * 1000 : null; }).filter(x => x !== null);
          if (offsets.length < 6) { say.textContent = 'Too few taps were near the clicks. Try again: tap on every click.'; return; }
          // Taps already lose the old delay: add it back.
          const ms = R.calibrate(offsets.map(x => x + (settings.tapOffset || 0)));
          GT.saveSettings({ tapOffset: ms });
          say.textContent = `The delay of this device is ${ms} ms. The drill takes it off every tap.`;
          setTimeout(onDone, 1200);
        });
      if (!ok) { startBtn.disabled = false; say.textContent = 'The sound did not start. Tap Start again.'; }
    } }, 'Start');
    ui.title('First, measure the delay');
    ui.sub('Phones and Bluetooth headphones play sound late, and touch screens report taps late. Twelve taps measure it once.');
    ui.actions([]);
    ui.board.replaceChildren(h('div', { class: 'tap-box' }, say, startBtn, pad()));
  }
  const PULSE = ['60', '80', '100'];
  D.add({
    id: 'rhythm-tap', track: 'rhythm',
    title: 'Tap in time',
    blurb: 'Read a bar and tap it, tap back a bar you hear, or keep the beat when the click stops.',
    hint: 'Tap the pad, or press J or F. Space starts the round.',
    help: [
      'Read and tap: the bar shows, four clicks count you in, and you tap each note while the clicks go on. Hear and tap back: the bar plays first, and you tap it in the bar after it. Keep the pulse: tap every beat; the click stops after two bars, and the page checks the two silent bars.',
      'A tap counts when it is within about an eighth of a second of its note. Under each note the result shows how early (−) or late (+) you were, in milliseconds.',
      'The drill measures the delay of your device once, with twelve taps on clicks. Measure again after you change headphones or speakers: Bluetooth adds a lot. Options also let you set the delay by hand.'
    ],
    defaults: { mode: 'read', auto: true, set: ['quarters'], tempo: 72 },
    stages: STAGE_GROUPS,
    statsKey: c => c.mode,
    // Keeping the pulse has no groups of rhythms: a good round there adds none.
    canUnlock: c => c.mode !== 'pulse',
    fastMs: 60000,
    autoPlay: false,
    advanceMs: 2200,
    pool: c => c.mode === 'pulse' ? PULSE : poolOf(c),
    unlockText: added => `New rhythms added: ${stageNames(added)}.`,
    itemName: item => PULSE.includes(item) ? `${item} beats per minute` : describe(item),
    make(item, c) { return c.mode === 'pulse' ? { mode: 'pulse', bpm: Number(item) } : { mode: c.mode, bar: item, bpm: c.tempo }; },
    render(q, ui) {
      tap.q = q; tap.ui = ui;
      // An option change can stop the sound in the middle of a round: then no round runs any more.
      if (!A.rhythmRunning) { tap.running = false; tap.taps = null; }
      ui.noChoices();
      if (q.mode !== 'pulse' && settings.tapOffset === undefined) { calibrate(ui, () => this.render(q, ui)); return; }
      const say = h('p', { class: 'tap-say', 'aria-live': 'polite' }, 'Press Start, or Space. Clicks give you the tempo first.');
      q.say = t => { say.textContent = t; };
      ui.title(q.mode === 'read' ? 'Tap this rhythm' : q.mode === 'echo' ? 'Listen, then tap it back' : `Keep the pulse at ${q.bpm}`);
      ui.sub(q.mode === 'read' ? 'Tap each note while the clicks go on.' : q.mode === 'echo' ? 'The bar plays once. Tap it in the bar after it, with the clicks.' : 'Tap every beat. The click stops after two bars: keep going for two more.');
      ui.actions([['▶ Start', () => ui.play()]]);
      const sheet = q.mode === 'read' ? R.notation(R.parse(q.bar), SIG, { sig: true, count: true, label: describe(q.bar) }) : null;
      ui.board.replaceChildren(h('div', { class: 'tap-box' }, sheet, say, pad()));
    },
    // Start a round. It runs from Start, from Space, and from the runner.
    play(q, how, ui) {
      if (!q || tap.running || q.over) return 0;
      ui = ui || tap.ui;
      A.silence();
      const bpm = q.bpm, beat = 60 / bpm, barSec = 4 * beat;
      const finish = result => { q.result = result; q.over = true; q.say(''); ui.submit(result.ok ? 'ok' : 'miss'); };
      if (q.mode === 'pulse') {
        q.say('Tap every beat with the clicks…');
        runRound({ beats: 4, barSeconds: barSec, bars: 4, countIn: 0, clicks: n => n < 2, events: () => [] },
          start => Array.from({ length: 16 }, (_, k) => start + k * beat),
          (all, taps) => {
            // The two bars with the click show how late you tap anyway (the delay of the device, and your habit).
            // That lag is taken off the taps of the two silent bars, which are the ones that count.
            const clicked = all.slice(0, 8), silentBeats = all.slice(8), from = silentBeats[0] - beat / 2;
            const lead = R.scoreTaps(clicked, taps.filter(t => t < from), 0.3).hits.map(x => x.offset).sort((a, b) => a - b);
            const lag = lead.length ? lead[lead.length >> 1] : 0;
            const silent = taps.filter(t => t >= from).map(t => t - lag);
            const s = R.scoreTaps(silentBeats, silent, 0.15);
            finish(Object.assign(s, { pulse: R.pulse(silent, beat), beats: silentBeats.length }));
          });
        setTimeout(() => q.mode === 'pulse' && tap.running && q.say('The click stopped. Keep tapping the beat.'), (2 * barSec + 0.12) * 1000);
        return 0;
      }
      const ons = R.onsets(R.parse(q.bar)).map(t => R.seconds(t, bpm, SIG));
      if (q.mode === 'read') {
        q.say('Count in… then tap the notes.');
        runRound({ beats: 4, barSeconds: barSec, bars: 1, countIn: 4, clicks: true, events: () => [] },
          start => ons.map(t => start + t), (expected, taps, barStart) => finish(R.scoreTaps(expected, taps.filter(t => t >= barStart - 0.15), 0.12)));
      } else {
        q.say('Listen…');
        const tones = R.toneEvents(R.parse(q.bar), bpm, SIG);
        runRound({ beats: 4, barSeconds: barSec, bars: 2, countIn: countIn(), clicks: true, events: n => n === 0 ? tones : [] },
          start => ons.map(t => start + barSec + t),
          (expected, taps, barStart) => finish(R.scoreTaps(expected, taps.filter(t => t >= barStart + barSec - 0.15), 0.12)));
        setTimeout(() => q.mode === 'echo' && tap.running && q.say('Now tap it back.'), ((4 + countIn()) * beat + 0.12) * 1000);
      }
      return 0;
    },
    onKey(e) { if (/^[jfJF]$/.test(e.key) && tap.running) { e.preventDefault(); record(e); } },
    check: (q, v) => v === 'ok',
    feedback(q, v, correct) {
      const s = q.result;
      if (q.mode === 'pulse') {
        const p = s.pulse;
        const tempoText = !p ? '' : Math.abs(p.drift) < 2 ? ' Your tempo held.' : ` You got ${Math.abs(p.drift)} percent ${p.drift > 0 ? 'faster' : 'slower'}.`;
        return { text: `${s.hits.length} of ${s.beats} silent beats on time.${tempoText}${p ? ` The gaps between your taps varied by ${p.spread} ms.` : ''}${s.extra.length ? ` ${s.extra.length} extra tap${s.extra.length > 1 ? 's' : ''}.` : ''}` };
      }
      // Under each note: how early or late the tap was, or a cross for a missed note. The notes that sound are the
      // events that are no rest and do not go on from a tie, in the order of the expected times.
      const events = R.parse(q.bar), marks = {}, sounding = [];
      let tied = false;
      events.forEach((e, i) => { if (!e.rest && !tied) sounding.push(i); tied = e.tie && !e.rest; });
      sounding.forEach((i, k) => {
        const r = s.each[k];
        if (!r || r.offset === null) marks[i] = { text: '×', kind: 'miss' };
        else { const ms = Math.round(r.offset * 1000); marks[i] = { text: `${ms > 0 ? '+' : ms < 0 ? '−' : ''}${Math.abs(ms)}`, kind: Math.abs(ms) <= 60 ? 'good' : 'loose' }; }
      });
      const offs = s.hits.map(x => x.offset * 1000), mean = offs.length ? Math.round(offs.reduce((a, b) => a + b, 0) / offs.length) : 0;
      return {
        text: correct ? `Every note on time. On average ${Math.abs(mean)} ms ${mean > 0 ? 'late' : mean < 0 ? 'early' : 'off'}.`
          : `${s.missed.length ? `${s.missed.length} note${s.missed.length > 1 ? 's' : ''} without a tap in time. ` : ''}${s.extra.length ? `${s.extra.length} extra tap${s.extra.length > 1 ? 's' : ''}. ` : ''}The numbers show how early (−) or late (+) each tap was, in ms.`,
        visual: R.notation(events, SIG, { sig: true, marks, label: describe(q.bar) })
      };
    },
    stop() { A.stopRhythm(); tap.taps = null; tap.running = false; },
    options(c, set) {
      const delay = settings.tapOffset;
      return h('div', { class: 'opts' },
        D.field('Mode', GT.segmented('Mode', TAP_MODES, c.mode, v => set({ mode: v }))),
        c.mode === 'pulse' ? null : tempoPick(c, set),
        c.mode === 'pulse' ? null : stagePick(c, set),
        c.mode === 'pulse' ? null : D.autoRow(this, c, set, 'rhythms', id => R.STAGES.find(s => s.id === id).name.toLowerCase()),
        D.field('Delay of this device', h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': '10 ms less', onclick: () => { GT.saveSettings({ tapOffset: (settings.tapOffset || 0) - 10 }); set({}); } }, '−'),
          h('output', null, delay === undefined ? 'not measured' : `${delay} ms`),
          h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': '10 ms more', onclick: () => { GT.saveSettings({ tapOffset: (settings.tapOffset || 0) + 10 }); set({}); } }, '+'),
          h('button', { type: 'button', class: 'btn', onclick: () => { GT.saveSettings({ tapOffset: undefined }); set({}); } }, 'Measure again'))));
    }
  });
})(window);
