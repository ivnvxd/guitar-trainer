/* Progress and Settings pages. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const T = GT.theory, P = GT.progress, A = GT.audio, D = GT.drills;
  const { h, store, settings } = GT;
  const secs = ms => ms ? (ms / 1000).toFixed(1) + ' s' : '–';
  const pct = (ok, n) => n ? Math.round(ok / n * 100) + '%' : '–';

  function progressPage(main) {
    const days = store.get('days', {});
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      last14.push({ key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), min: (days[key] ? days[key].ms : 0) / 60000 });
    }
    const maxMin = Math.max(settings.goal || 10, ...last14.map(d => d.min));
    const rows = D.list.map(d => {
      const config = D.loadConfig(d);
      const s = P.summary(D.statsId(d, config), d.pool(config));
      return h('tr', null, h('td', null, h('a', { href: '#/train/' + d.id }, d.title)), h('td', null, s.n), h('td', null, pct(s.ok, s.n)), h('td', null, secs(s.median)), h('td', null, `${s.mastered} of ${s.total}`));
    });
    main.append(
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Progress'), h('p', null, 'Your results stay in this browser. Save them to a file to keep a copy or to move them to another device.'))),
      h('section', { class: 'lib-section', style: 'margin-top:0' }, h('h2', null, 'Last 14 days'),
        h('div', { class: 'today', style: 'align-items:flex-end;gap:6px' }, last14.map(d => h('div', { style: 'flex:1;display:grid;justify-items:center;gap:6px', title: `${d.key}: ${Math.round(d.min)} min` },
          h('div', { style: `width:100%;max-width:28px;height:${Math.max(3, d.min / maxMin * 90)}px;border-radius:4px;background:${d.min >= (settings.goal || 10) ? 'var(--fifth)' : d.min ? 'var(--accent)' : 'var(--surface-3)'}` }),
          h('span', { class: 'small muted' }, d.label)))),
        h('p', { class: 'small muted', style: 'margin-top:8px' }, `Green: daily goal of ${settings.goal || 10} minutes reached. ${P.streak()} ${P.streak() === 1 ? 'day' : 'days'} in a row.`)),
      h('section', { class: 'lib-section' }, h('h2', null, 'Drills'),
        h('div', { style: 'overflow-x:auto' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, ['Drill', 'Answers', 'Right', 'Typical time', 'Solid'].map(t => h('th', null, t)))), h('tbody', null, rows))),
        h('p', { class: 'small muted', style: 'margin-top:8px' }, 'Solid: answered right and fast at least three times in a row. Counts are for the current options of each drill.')),
      ...[intervalTable(), noteMap(), backup()].filter(Boolean));
  }
  function intervalTable() {
    const stats = P.stats('ear-intervals:identify');
    const dirs = [['up', 'Ascending'], ['down', 'Descending'], ['harmonic', 'Together']];
    const cell = item => { const s = stats[item]; return s ? `${pct(s.ok, s.n)} (${s.n})` : '–'; };
    if (!Object.keys(stats).length) return null;
    return h('section', { class: 'lib-section' }, h('h2', null, 'Intervals by ear'),
      h('div', { style: 'overflow-x:auto' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, h('th', null, 'Interval'), dirs.map(([, t]) => h('th', null, t)), h('th', null, 'Typical time'))),
        h('tbody', null, T.INTERVALS.map(iv => {
          const items = dirs.map(([d]) => `${iv.semi}:${d}`);
          if (!items.some(i => stats[i])) return null;
          const times = items.flatMap(i => (stats[i] && stats[i].times) || []);
          return h('tr', null, h('td', null, `${iv.short} ${iv.name}`), items.map(i => h('td', null, cell(i))), h('td', null, secs(P.median(times))));
        })))),
      h('p', { class: 'small muted', style: 'margin-top:8px' }, 'Right answers and, in brackets, how often you heard each one in "Name it" mode.'));
  }
  function noteMap() {
    const stats = P.stats('neck-notes');
    if (!Object.keys(stats).length) return null;
    const markers = Object.entries(stats).map(([item, s]) => {
      const [string, fret] = item.split(':').map(Number);
      const med = P.median(s.times);
      const recentMiss = (s.recent || []).slice(-3).includes(0);
      const kind = recentMiss || !med ? 'wrong' : med <= 2500 ? 'correct' : 'third';
      return { string, fret, kind, label: T.PC_PLAIN[T.mod(GT.tuning()[string] + fret)], title: `${secs(med)}, ${pct(s.ok, s.n)} right` };
    });
    const box = h('div', { class: 'neck' });
    GT.fretboard.render(box, { from: 0, to: 15, tuning: GT.tuning(), markers, leftHanded: settings.leftHanded, orientation: settings.orientation, label: 'Note speed map' });
    return h('section', { class: 'lib-section' }, h('h2', null, 'Note names: speed map'),
      h('p', null, 'Green: under 2.5 seconds. Yellow: slower. Red: missed in the last three answers. Positions you have not practiced stay empty.'), box);
  }
  function backup() {
    const status = h('p', { class: 'small muted', role: 'status', style: 'margin-top:8px' });
    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0]; if (!f) return;
      try { store.importAll(JSON.parse(await f.text())); status.textContent = 'Progress loaded from the file.'; setTimeout(() => GT.render(), 600); }
      catch (e) { status.textContent = e.message || 'The file could not be read.'; }
      file.value = '';
    });
    const save = () => {
      const blob = new Blob([JSON.stringify(store.exportAll(), null, 1)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `guitar-progress-${P.today()}.json` });
      document.body.append(a); a.click(); a.remove();
      status.textContent = 'Progress saved to your downloads.';
    };
    const reset = () => {
      if (!confirm('Delete all progress in this browser? Your settings stay. This cannot be undone unless you saved a file.')) return;
      for (const k of store.keys()) if (k.startsWith('stats.') || k.startsWith('stage.') || k === 'days' || k === 'lastDrill') { try { localStorage.removeItem('gt.' + k); } catch { /* storage blocked */ } }
      status.textContent = 'Progress deleted.';
      setTimeout(() => GT.render(), 600);
    };
    return h('section', { class: 'lib-section' }, h('h2', null, 'Backup'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: save }, 'Save progress to a file'),
        h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, 'Load progress from a file'),
        h('button', { type: 'button', class: 'btn', onclick: reset }, 'Delete all progress')),
      file, status);
  }

  function settingsPage(main) {
    const redraw = () => GT.render();
    const set = patch => { GT.saveSettings(patch); redraw(); };
    const volume = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings.volume, 'aria-label': 'Volume' });
    volume.addEventListener('change', () => { GT.saveSettings({ volume: Number(volume.value) }); A.note(57, 0, 0.8); });
    const tuning = h('select', { 'aria-label': 'Tuning' }, T.TUNINGS.map(t => h('option', { value: t.id, selected: t.id === settings.tuning }, t.name)));
    tuning.addEventListener('change', () => set({ tuning: tuning.value }));
    const preview = h('div', { class: 'neck' });
    GT.fretboard.render(preview, { from: 0, to: 7, tuning: GT.tuning(), leftHanded: settings.leftHanded, orientation: settings.orientation, markers: [{ string: 1, fret: 3, kind: 'root', label: 'C' }, { string: 2, fret: 2, kind: 'third', label: 'E' }, { string: 4, fret: 1, kind: 'root', label: 'C' }], label: 'Preview' });
    const block = (title, ...rows) => h('section', { class: 'lib-section' }, h('h2', null, title), h('div', { style: 'display:grid;gap:16px' }, rows));
    main.append(
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Settings'), h('p', null, 'Saved in this browser. They apply to the library and to every drill.'))),
      block('Look',
        D.field('Theme', GT.segmented('Theme', [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']], settings.theme, v => set({ theme: v }))),
        h('p', { class: 'small muted' }, 'Automatic follows the light or dark setting of your device.')),
      block('Neck',
        D.field('Hand', GT.segmented('Hand', [[false, 'Right-handed'], [true, 'Left-handed']], settings.leftHanded, v => set({ leftHanded: v }))),
        D.field('Direction', GT.segmented('Direction', [['auto', 'Automatic'], ['horizontal', 'Flat'], ['vertical', 'Upright']], settings.orientation, v => set({ orientation: v }))),
        h('p', { class: 'small muted' }, 'Automatic shows the neck flat on wide screens and upright on phones.'),
        D.field('Frets in the library', GT.segmented('Frets', [[12, '12'], [15, '15'], [24, '24']], settings.frets, v => set({ frets: v }))),
        D.field('Tuning', tuning),
        preview),
      block('Sound',
        D.field('Voice', GT.segmented('Voice', [['pluck', 'Plucked string'], ['soft', 'Soft tone']], settings.voice, v => { set({ voice: v }); A.notes([48, 52, 55, 60], 'strum'); })),
        D.field('Volume', volume),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: () => A.notes([40, 47, 52, 56, 59, 64], 'strum') }, '▶ Test sound'))),
      block('Practice',
        D.field('Daily goal', GT.segmented('Daily goal', [[5, '5 min'], [10, '10 min'], [15, '15 min'], [20, '20 min']], settings.goal || 10, v => set({ goal: v }))),
        D.field('After a right answer', GT.segmented('After a right answer', [[true, 'Go on by itself'], [false, 'Wait for me']], settings.autoAdvance !== false, v => set({ autoAdvance: v })))),
      block('About',
        h('p', { class: 'muted' }, 'Everything runs in your browser. Nothing is sent anywhere. The sound is made by the browser, so the site works offline after the first visit.'),
        h('p', { class: 'muted' }, 'The drills follow published ear-training and practice research. The sources are listed in docs/research.md in the project.')));
  }

  GT.route('progress', { render: progressPage });
  GT.route('settings', { render: settingsPage });
})(window);
