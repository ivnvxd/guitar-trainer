/* Tools: the Tools tab, its row of tools, and the metronome. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const A = GT.audio;
  const { h, store } = GT;

  // The metronome. Besides the tempo and the beats it has practice modes for your time: clicks between the beats,
  // a click on 2 and 4 only, bars without a click, random silent beats and a tempo that rises by itself.
  function metronome(main) {
    const saved = Object.assign({ bpm: 80, beats: 4, sub: 1, backbeat: false, gap: 'off', mute: 0, ramp: 0, accent: true }, store.get('metronome', {}));
    const R = GT.rhythm, D = GT.drills;
    const GAPS = { off: null, '3-1': [3, 1], '2-2': [2, 2], '1-3': [1, 3] };
    const opts = () => ({
      sub: saved.sub,
      plan: bar => R.clickPlan(bar, { beats: saved.beats, sub: saved.sub, accent: saved.accent, backbeat: saved.backbeat, gap: GAPS[saved.gap], mute: saved.mute }),
      ramp: saved.ramp ? { step: saved.ramp, every: 4, max: 220 } : null,
      onBar: (bar, bpm) => { bpmOut.textContent = bpm; }
    });
    const dots = h('div', { class: 'beats', 'aria-hidden': 'true' });
    const bpmOut = h('output', { class: 'bpm' }, saved.bpm);
    const slider = h('input', { type: 'range', min: 40, max: 220, value: saved.bpm, 'aria-label': 'Tempo in beats per minute' });
    const toggle = h('button', { type: 'button', class: 'btn btn-primary btn-big' }, 'Start', h('span', { class: 'kbd' }, 'Space'));
    // A silent beat still moves the dots, as a hollow dot, so you can follow the time through a gap.
    const drawDots = (active, silent) => dots.replaceChildren(...Array.from({ length: saved.beats }, (_, i) => h('i', { class: i === active ? (silent ? 'on is-silent' : i === 0 ? 'on first' : 'on') : '' })));
    const save = () => store.set('metronome', saved);
    const setBpm = v => { saved.bpm = Math.max(40, Math.min(220, Math.round(v))); slider.value = saved.bpm; bpmOut.textContent = saved.bpm; A.setTempo(saved.bpm); save(); };
    slider.addEventListener('input', () => setBpm(Number(slider.value)));
    const start = () => { A.startMetronome(saved.bpm, saved.beats, drawDots, opts()); toggle.firstChild.textContent = 'Stop'; };
    const stop = () => { A.stopMetronome(); toggle.firstChild.textContent = 'Start'; drawDots(-1); bpmOut.textContent = saved.bpm; };
    // A new mode applies at once: a running metronome starts again with it.
    const setMode = patch => { Object.assign(saved, patch); save(); if (A.metronomeRunning) start(); };
    const seg = (label, options, key) => D.field(label, GT.segmented(label, options, saved[key], v => setMode({ [key]: v })));
    const modes = h('div', { class: 'opts metro-modes' },
      seg('Clicks', [[1, 'Beats'], [2, '8ths'], [3, 'Triplets'], [4, '16ths']], 'sub'),
      seg('Accent', [[true, 'Beat 1'], [false, 'None']], 'accent'),
      seg('Click on', [[false, 'Every beat'], [true, '2 and 4']], 'backbeat'),
      seg('Silent bars', [['off', 'Off'], ['3-1', '3 + 1'], ['2-2', '2 + 2'], ['1-3', '1 + 3']], 'gap'),
      seg('Random gaps', [[0, 'Off'], [0.2, '1 in 5'], [0.4, '2 in 5']], 'mute'),
      seg('Speed up', [[0, 'Off'], [2, '+2'], [5, '+5']], 'ramp'),
      h('p', { class: 'small muted' }, 'Silent bars: 3 + 1 is three bars with the click, then one without. Random gaps leave out single beats. Keep playing through the silence, and check that you land with the click when it comes back. Speed up adds beats per minute every four bars.'));
    toggle.addEventListener('click', () => A.metronomeRunning ? stop() : start());
    let taps = [];
    const tap = () => {
      const now = performance.now();
      taps = taps.filter(t => now - t < 3000).concat(now);
      if (taps.length >= 3) { const gaps = taps.slice(1).map((t, i) => t - taps[i]); setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)); }
    };
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement || {};
      if (['INPUT', 'SELECT'].includes(el.tagName)) return;
      // Space on a button you reached with the keyboard, or on a link, does that button or link.
      if (e.key === ' ' && el !== toggle && el.matches && el.matches('a, summary, button:focus-visible')) return;
      if (e.key === ' ') { e.preventDefault(); toggle.click(); }
      else if (e.key === 't' || e.key === 'T') tap();
      else if (e.key === 'ArrowUp' || e.key === '+') { e.preventDefault(); setBpm(saved.bpm + 1); }
      else if (e.key === 'ArrowDown' || e.key === '-') { e.preventDefault(); setBpm(saved.bpm - 1); }
    };
    document.addEventListener('keydown', onKey);
    drawDots(-1);
    main.append(h('div', { class: 'drill' },
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
      h('section', { class: 'lib-section' }, h('h2', null, 'Practice your time'), modes),
      h('p', { class: 'small muted drill-keys', style: 'margin-top:14px' }, 'Keys: ', h('span', { class: 'kbd' }, 'Space'), ' start or stop, ', h('span', { class: 'kbd' }, '↑'), h('span', { class: 'kbd' }, '↓'), ' tempo, ', h('span', { class: 'kbd' }, 'T'), ' tap the tempo.')));
    return () => { document.removeEventListener('keydown', onKey); A.stopMetronome(); };
  }

  // The Tools tab: the tools you use with the guitar in your hands.
  const TOOLS = [
    { id: 'tune', title: 'Tuner', line: 'Tune your guitar with the microphone.', icon: 'M4 16a8 8 0 0 1 16 0M12 16l4-6M3 20h18' },
    { id: 'metronome', title: 'Metronome', line: 'Tempo, accents, silent bars and a rising tempo.', icon: 'M8.5 20h7l-2.4-15h-2.2zM12 15l5-8' },
    { id: 'play', title: 'Slow down', line: 'Slow down a song or a YouTube video, loop a part and play along.', icon: 'M3 12h1.5M7 8v8M11 5v14M15 9v6M19 10.5v3' }
  ];
  function toolsHome(main) {
    const el = GT.fretboard.el;
    main.append(
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Tools'), h('p', null, 'For practice with the guitar in your hands.'))),
      h('div', { class: 'tool-cards' }, TOOLS.map((t, i) => {
        const svg = el('svg', { viewBox: '0 0 24 24', class: 'tool-icon', 'aria-hidden': 'true' });
        el('path', { d: t.icon }, svg);
        return h('a', { class: 'tool-card', href: `#/tools/${t.id}` }, svg, h('h2', null, h('span', { class: 'topic-no' }, i + 1), h('span', null, t.title)), h('p', null, t.line));
      })));
  }
  // The submenu of the Tools tab, on each tool page: the tools in a row, as in the Library.
  const toolsNav = id => {
    const nav = GT.subnav('Tools', { href: '#/tools', label: 'All tools', icon: 'grid' }, TOOLS.map(t => ({ href: `#/tools/${t.id}`, text: t.title, current: t.id === id })));
    nav.classList.add('tools-subnav');
    return nav;
  };
  // The Tuner and Slow down are drawn by the Library and the player.
  function libraryTool(main, view) {
    main.append(...view.render(view.parse([])));
  }

  let cleanup = null;
  GT.route('tools', {
    render(main, parts) {
      if (cleanup) { cleanup(); cleanup = null; }
      const id = parts[0];
      // A tool page starts with the submenu row; the page of the tool goes under it.
      if (TOOLS.some(t => t.id === id)) { const page = h('div', { class: 'lib-main' }); main.append(h('div', { class: 'lib' }, toolsNav(id), page)); main = page; }
      if (id === 'metronome') cleanup = metronome(main);
      else if (id === 'tune') { libraryTool(main, GT.tuner.view); cleanup = GT.tuner.stop; }
      else if (id === 'play') { libraryTool(main, GT.player.view); cleanup = GT.player.leave; }
      else toolsHome(main);
    },
    leave() { if (cleanup) { cleanup(); cleanup = null; } }
  });
})(window);
