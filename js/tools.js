/* Tools: a metronome and one-minute chord changes. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const T = GT.theory, A = GT.audio;
  const { h, store } = GT;

  function metronome(main) {
    const saved = Object.assign({ bpm: 80, beats: 4 }, store.get('metronome', {}));
    const dots = h('div', { class: 'beats', 'aria-hidden': 'true' });
    const bpmOut = h('output', { class: 'bpm' }, saved.bpm);
    const slider = h('input', { type: 'range', min: 40, max: 220, value: saved.bpm, 'aria-label': 'Tempo in beats per minute' });
    const toggle = h('button', { type: 'button', class: 'btn btn-primary btn-big' }, 'Start', h('span', { class: 'kbd' }, 'Space'));
    const drawDots = active => dots.replaceChildren(...Array.from({ length: saved.beats }, (_, i) => h('i', { class: i === active ? (i === 0 ? 'on first' : 'on') : '' })));
    const save = () => store.set('metronome', saved);
    const setBpm = v => { saved.bpm = Math.max(40, Math.min(220, Math.round(v))); slider.value = saved.bpm; bpmOut.textContent = saved.bpm; A.setTempo(saved.bpm); save(); };
    slider.addEventListener('input', () => setBpm(Number(slider.value)));
    const start = () => { A.startMetronome(saved.bpm, saved.beats, drawDots); toggle.firstChild.textContent = 'Stop'; };
    const stop = () => { A.stopMetronome(); toggle.firstChild.textContent = 'Start'; drawDots(-1); };
    toggle.addEventListener('click', () => A.metronomeRunning ? stop() : start());
    let taps = [];
    const tap = () => {
      const now = performance.now();
      taps = taps.filter(t => now - t < 3000).concat(now);
      if (taps.length >= 3) { const gaps = taps.slice(1).map((t, i) => t - taps[i]); setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)); }
    };
    const onKey = e => {
      if (['INPUT', 'SELECT'].includes((document.activeElement || {}).tagName)) return;
      if (e.key === ' ') { e.preventDefault(); toggle.click(); }
      else if (e.key === 't' || e.key === 'T') tap();
      else if (e.key === 'ArrowUp' || e.key === '+') setBpm(saved.bpm + 1);
      else if (e.key === 'ArrowDown' || e.key === '-') setBpm(saved.bpm - 1);
    };
    document.addEventListener('keydown', onKey);
    drawDots(-1);
    main.append(h('div', { class: 'drill' },
      h('div', { class: 'crumb' }, h('a', { href: '#/train' }, 'Train'), ' / Tools'),
      h('h1', null, 'Metronome'),
      h('div', { class: 'prompt', style: 'margin-top:18px;display:grid;gap:18px;justify-items:center;text-align:center' },
        h('div', null, bpmOut, h('div', { class: 'muted small' }, 'beats per minute')),
        dots,
        h('div', { class: 'tempo-row' },
          h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Slower', onclick: () => setBpm(saved.bpm - 5) }, '−5'),
          slider,
          h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Faster', onclick: () => setBpm(saved.bpm + 5) }, '+5')),
        h('div', { class: 'row', style: 'justify-content:center' },
          GT.segmented('Beats per bar', [[2, '2'], [3, '3'], [4, '4'], [6, '6']], saved.beats, v => { saved.beats = v; save(); const was = A.metronomeRunning; stop(); GT.render(); if (was) setTimeout(() => document.querySelector('.btn-primary').click(), 0); }),
          h('button', { type: 'button', class: 'btn', onclick: tap }, 'Tap tempo', h('span', { class: 'kbd' }, 'T'))),
        toggle),
      h('p', { class: 'small muted drill-keys', style: 'margin-top:14px' }, 'Keys: ', h('span', { class: 'kbd' }, 'Space'), ' start or stop, ', h('span', { class: 'kbd' }, '↑'), h('span', { class: 'kbd' }, '↓'), ' tempo, ', h('span', { class: 'kbd' }, 'T'), ' tap the tempo.')));
    return () => { document.removeEventListener('keydown', onKey); A.stopMetronome(); };
  }

  // One-minute changes: switch between two chords for 60 seconds and count the changes.
  const CHANGE_CHORDS = ['C', 'A', 'G', 'E', 'D', 'Am', 'Em', 'Dm', 'F', 'A7', 'D7', 'E7', 'G7', 'C7', 'B7'];
  const chordFor = label => {
    const minor = label.endsWith('m'), seventh = label.endsWith('7');
    const rootName = label.replace(/m$|7$/, '');
    return T.OPEN_CHORDS.find(c => c.root === rootName && c.chord === (minor ? 'minor' : seventh ? '7' : 'major'));
  };
  function changes(main) {
    const saved = Object.assign({ a: 'C', b: 'G', best: {} }, store.get('changes', {}));
    const key = () => [saved.a, saved.b].sort().join('-');
    let timer = null, endAt = 0;
    const clock = h('output', { class: 'bpm' }, '60');
    const status = h('p', { class: 'muted', 'aria-live': 'polite' });
    const countInput = h('input', { type: 'number', min: 0, max: 200, inputmode: 'numeric', placeholder: 'Count', 'aria-label': 'Changes you made', style: 'width:90px;min-height:40px;padding:6px 10px;border-radius:8px;border:1px solid var(--line-strong);background:var(--surface-2)' });
    const saveBtn = h('button', { type: 'button', class: 'btn', onclick: () => {
      const n = Number(countInput.value);
      if (!Number.isFinite(n) || n <= 0) { status.textContent = 'Type how many changes you made.'; return; }
      const best = saved.best[key()] || 0;
      if (n > best) saved.best[key()] = n;
      store.set('changes', saved);
      status.textContent = n > best ? `New best for ${saved.a} and ${saved.b}: ${n} changes.` : `${n} changes. Your best for this pair is ${best}.`;
      countInput.value = '';
      redrawBest();
    } }, 'Save count');
    const bestList = h('div', { class: 'chips' });
    const redrawBest = () => bestList.replaceChildren(...Object.entries(saved.best).sort((x, y) => x[1] - y[1]).map(([pair, n]) => h('span', { class: 'chip', style: 'cursor:default' }, pair.replace('-', ' ↔ '), h('small', null, n))),
      Object.keys(saved.best).length ? '' : h('p', { class: 'muted small' }, 'No counts yet. Save your first count above.'));
    const startBtn = h('button', { type: 'button', class: 'btn btn-primary btn-big', onclick: () => {
      if (timer) { clearInterval(timer); timer = null; startBtn.textContent = 'Start one minute'; clock.textContent = '60'; return; }
      // A count-in of four clicks, then 60 seconds.
      A.startMetronome(60, 4, beat => { if (beat === 3) { A.stopMetronome(); } });
      status.textContent = 'Get ready: four clicks, then go.';
      endAt = performance.now() + 4000 + 60000;
      startBtn.textContent = 'Stop';
      timer = setInterval(() => {
        const left = Math.ceil((endAt - performance.now()) / 1000);
        if (left > 60) { clock.textContent = '60'; return; }
        if (left === 60) status.textContent = 'Go: change between the two chords, cleanly.';
        clock.textContent = Math.max(0, left);
        if (left <= 0) {
          clearInterval(timer); timer = null; startBtn.textContent = 'Start one minute';
          A.notes([64, 64], 'up', 0.2, 0.2);
          status.textContent = 'Time. How many changes did you make? Each switch counts as one.';
          countInput.focus();
        }
      }, 200);
    } }, 'Start one minute');
    const chordCard = which => {
      const label = saved[which], c = chordFor(label);
      const frets = c.frets.filter(f => f !== null);
      const tones = T.tonesOn(c.root, T.chordById(c.chord));
      const markers = c.frets.map((f, s) => f === null ? null : (() => { const t = tones.find(x => x.pc === T.mod(T.STANDARD[s] + f)); return { string: s, fret: f, kind: GT.fretboard.degreeKind(t.label), label: t.name }; })()).filter(Boolean);
      const box = h('div', { class: 'neck' });
      GT.fretboard.render(box, { from: 0, to: Math.max(4, Math.max(...frets)), markers, muted: c.frets.map((f, s) => f === null ? s : null).filter(s => s !== null), orientation: 'vertical', mini: true, label: label });
      const select = h('select', { 'aria-label': which === 'a' ? 'First chord' : 'Second chord' }, CHANGE_CHORDS.map(n => h('option', { value: n, selected: n === label }, n)));
      select.addEventListener('change', () => { saved[which] = select.value; store.set('changes', saved); GT.render(); });
      return h('div', { class: 'card', style: 'display:grid;gap:8px' }, select, h('button', { type: 'button', class: 'btn', onclick: () => A.notes(c.frets.map((f, s) => f === null ? null : T.STANDARD[s] + f).filter(m => m !== null), 'strum') }, '▶ Strum'), box);
    };
    redrawBest();
    main.append(h('div', { class: 'drill' },
      h('div', { class: 'crumb' }, h('a', { href: '#/train' }, 'Train'), ' / Tools'),
      h('h1', null, 'One-minute chord changes'),
      h('p', { class: 'muted', style: 'margin-top:6px;max-width:64ch' }, 'Pick two open chords. Switch between them for one minute, strumming once per chord, and count every switch. Clean changes count, rushed ones do not. Beat your best a little each day.'),
      h('div', { class: 'cards', style: 'margin-top:18px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))' }, chordCard('a'), chordCard('b')),
      h('div', { class: 'prompt', style: 'margin-top:16px;display:grid;gap:14px;justify-items:center;text-align:center' },
        clock, startBtn, status,
        h('div', { class: 'row', style: 'justify-content:center' }, countInput, saveBtn)),
      h('section', { class: 'lib-section' }, h('h2', null, 'Your best counts'), h('p', null, 'Slowest pairs first. Practice those.'), bestList)));
    return () => { if (timer) clearInterval(timer); A.stopMetronome(); };
  }

  let cleanup = null;
  GT.route('tools', {
    render(main, parts) {
      if (cleanup) { cleanup(); cleanup = null; }
      cleanup = parts[0] === 'changes' ? changes(main) : metronome(main);
    },
    leave() { if (cleanup) { cleanup(); cleanup = null; } }
  });
})(window);
