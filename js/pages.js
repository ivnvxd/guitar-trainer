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
    const head = h('div', null, GT.trainNav('progress'), h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Progress'), h('p', null, 'Your results stay in this browser. Save them to a file to keep a copy or to move them to another device.'))));
    if (!Object.keys(days).length) {
      main.append(head,
        h('div', { class: 'empty' }, h('p', null, 'No practice yet. After your first drill, this page shows your minutes per day, your right answers and your times.'),
          h('a', { class: 'btn btn-primary', href: '#/train' }, 'Choose a drill')),
        backup());
      return;
    }
    // Drills you have used get a row. The others share one line, so the page stays short.
    const used = [], unused = [];
    for (const d of D.list) {
      const config = D.loadConfig(d);
      const s = P.summary(D.statsId(d, config), d.pool(config));
      (s.n ? used : unused).push({ d, s });
    }
    // On a phone a row is the drill name over its four numbers, each with its label.
    const cell = (label, value) => h('td', { dataset: { label } }, value);
    const rows = used.map(({ d, s }) => h('tr', null, h('td', null, h('a', { href: '#/train/' + d.id }, d.title)), cell('Answers', s.n), cell('Right', pct(s.ok, s.n)), cell('Typical time', secs(s.median)), cell('Solid', `${s.mastered} of ${s.total}`)));
    const goal = settings.goal || 10;
    main.append(
      head,
      h('section', { class: 'lib-section', style: 'margin-top:0' }, h('h2', null, 'Last 14 days'),
        // A bar per day with its minutes on top. A day with practice is never thinner than 8 px.
        h('div', { class: 'day-bars' }, last14.map(d => h('div', { class: 'day-bar' + (d.min >= goal ? ' is-goal' : d.min ? ' is-some' : ''), title: `${d.key}: ${Math.round(d.min)} min` },
          h('span', { class: 'day-min' }, d.min ? String(Math.max(1, Math.round(d.min))) : ''),
          h('i', { style: `height:${d.min ? Math.max(8, d.min / maxMin * 90) : 3}px` }),
          h('span', { class: 'small muted' }, d.label)))),
        h('p', { class: 'small muted', style: 'margin-top:8px' }, `Minutes of practice per day. A bar turns green on a day you reach your goal of ${goal} minutes. ${P.streak()} ${P.streak() === 1 ? 'day' : 'days'} in a row.`)),
      h('section', { class: 'lib-section' }, h('h2', null, 'Drills'),
        rows.length ? h('div', { style: 'overflow-x:auto' }, h('table', { class: 'table table-stack' }, h('thead', null, h('tr', null, ['Drill', 'Answers', 'Right', 'Typical time', 'Solid'].map(t => h('th', null, t)))), h('tbody', null, rows))) : null,
        rows.length ? h('p', { class: 'small muted', style: 'margin-top:8px' }, 'Solid: answered right and fast at least three times in a row. Counts are for the current options of each drill.') : null,
        unused.length ? h('p', { class: 'small', style: 'margin-top:10px' }, h('span', { class: 'muted' }, 'Not started: '), unused.map(({ d }, i) => [i ? ', ' : '', h('a', { href: '#/train/' + d.id }, d.title)])) : null),
      ...[intervalTable(), noteMap(), backup()].filter(Boolean));
  }
  function intervalTable() {
    const stats = P.stats('ear-intervals:identify');
    const dirs = [['up', 'Ascending'], ['down', 'Descending'], ['harmonic', 'Together']];
    const cell = item => { const s = stats[item]; return s ? `${pct(s.ok, s.n)} (${s.n})` : '–'; };
    if (!Object.keys(stats).length) return null;
    return h('section', { class: 'lib-section' }, h('h2', null, 'Intervals by ear'),
      h('div', { style: 'overflow-x:auto' }, h('table', { class: 'table table-stack' },
        h('thead', null, h('tr', null, h('th', null, 'Interval'), dirs.map(([, t]) => h('th', null, t)), h('th', null, 'Typical time'))),
        h('tbody', null, T.INTERVALS.map(iv => {
          const items = dirs.map(([d]) => `${iv.semi}:${d}`);
          if (!items.some(i => stats[i])) return null;
          const times = items.flatMap(i => (stats[i] && stats[i].times) || []);
          return h('tr', null, h('td', null, `${iv.short} ${iv.name}`), items.map((i, k) => h('td', { dataset: { label: dirs[k][1] } }, cell(i))), h('td', { dataset: { label: 'Typical time' } }, secs(P.median(times))));
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
      const kind = recentMiss || !med ? 'wrong' : med <= 2500 ? 'correct' : 'slow';
      return { string, fret, kind, label: T.PC_PLAIN[T.mod(GT.openStrings()[string] + fret)], title: `${secs(med)}, ${pct(s.ok, s.n)} right` };
    });
    const box = h('div', { class: 'neck' });
    GT.fretboard.render(box, { from: 0, to: 15, tuning: GT.openStrings(), capo: GT.capo(), markers, leftHanded: settings.leftHanded, orientation: settings.orientation, turn: true, label: 'Note speed map' });
    return h('section', { class: 'lib-section' }, h('h2', null, 'Note names: speed map'),
      h('p', null, 'Green: under 2.5 seconds. Yellow: slower. Red: missed in the last three answers. Positions you have not practiced stay empty.'), box);
  }
  function backup() {
    const status = h('p', { class: 'small muted', role: 'status', style: 'margin-top:8px' });
    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0]; if (!f) return;
      // The page loads again, so the settings and the Library choices in memory come from the file too.
      try { store.importAll(JSON.parse(await f.text())); status.textContent = 'Progress loaded from the file.'; setTimeout(() => location.reload(), 600); }
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
      // A set that the automatic mode grew goes back to the first group.
      for (const d of D.list) {
        const config = d.stages && store.get('config.' + d.id);
        if (config && config.auto !== false) store.set('config.' + d.id, Object.assign(config, { set: d.defaults.set }));
      }
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

  function settingsPage(main, rest) {
    const redraw = () => GT.render();
    // A change redraws the page. Keep the place on it.
    const set = patch => { const y = root.scrollY; GT.saveSettings(patch); redraw(); root.scrollTo(0, y); };
    const volume = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings.volume, 'aria-label': 'Volume' });
    volume.addEventListener('change', () => { GT.saveSettings({ volume: Number(volume.value) }); A.note(57, 0, 0.8); });
    const tuning = h('select', { 'aria-label': 'Tuning' }, T.TUNINGS.map(t => h('option', { value: t.id, selected: t.id === settings.tuning }, t.name)),
      h('option', { value: 'custom', selected: settings.tuning === 'custom' }, 'Custom'));
    // A custom tuning starts from the tuning you had. Each string goes up to five semitones down or four up.
    tuning.addEventListener('change', () => set(tuning.value === 'custom' ? { tuning: 'custom', customTuning: settings.customTuning || GT.tuning().slice() } : { tuning: tuning.value }));
    const midiName = m => `${T.PC_SHARP[m % 12]}${Math.floor(m / 12) - 1}`;
    const custom = settings.tuning === 'custom' ? h('div', { class: 'tuning-edit', role: 'group', 'aria-label': 'Custom tuning, low string first' }, GT.tuning().map((m, s) => {
      const pick = h('select', { 'aria-label': `${6 - s}${['th', 'th', 'th', 'rd', 'nd', 'st'][s]} string` }, Array.from({ length: 10 }, (_, k) => T.STANDARD[s] - 5 + k).map(v => h('option', { value: v, selected: v === m }, midiName(v))));
      pick.addEventListener('change', () => { const next = GT.tuning().slice(); next[s] = Number(pick.value); set({ customTuning: next }); });
      return h('label', null, h('span', { class: 'small muted' }, `${6 - s}`), pick);
    })) : null;
    const capo = h('select', { 'aria-label': 'Capo' }, Array.from({ length: 10 }, (_, k) => h('option', { value: k, selected: k === (settings.capo || 0) }, k ? `Fret ${k}` : 'No capo')));
    capo.addEventListener('change', () => set({ capo: Number(capo.value) }));
    const pitch = h('select', { 'aria-label': 'Pitch of A' }, [432, 435, 438, 440, 441, 442, 443, 444, 446].map(v => h('option', { value: v, selected: v === GT.a4() }, `${v} Hz`)));
    pitch.addEventListener('change', () => { set({ a4: Number(pitch.value) }); A.note(69, 0, 1.2); });
    const preview = h('div', { class: 'neck' });
    // The shape of an open G chord, on all six strings, with the notes it gives in your tuning and at your capo.
    // The lowest note is the square.
    const open = GT.openStrings(), low = open[0] + 3;
    const shape = [[0, 3], [1, 2], [2, 0], [3, 0], [4, 0], [5, 3]].map(([string, fret]) => {
      const semi = T.mod(open[string] + fret - low);
      return { string, fret, kind: semi === 0 ? 'root' : semi === 3 || semi === 4 ? 'third' : semi === 7 ? 'fifth' : 'other', label: T.PC_PLAIN[T.mod(open[string] + fret)] };
    });
    GT.fretboard.render(preview, { from: 0, to: 7, tuning: open, capo: GT.capo(), leftHanded: settings.leftHanded, orientation: settings.orientation, markers: shape, label: 'Preview' });
    // The download service of Slow down is for the owner of a server, not for every visitor: its block shows at the
    // address #settings/service, and after that for as long as an address or a key is set.
    const service = (rest && rest[0] === 'service') || !!settings.dlUrl || !!settings.dlKey;
    // No redraw: the fields keep their focus while you type.
    const dlUrl = h('input', { type: 'url', class: 'player-link', value: settings.dlUrl || '', placeholder: 'https://…', 'aria-label': 'Address of the download service', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', onchange: e => GT.saveSettings({ dlUrl: e.target.value.trim() }) });
    const dlKey = h('input', { type: 'password', class: 'player-link', value: settings.dlKey || '', 'aria-label': 'Key of the download service', autocomplete: 'off', onchange: e => GT.saveSettings({ dlKey: e.target.value.trim() }) });
    const block = (title, ...rows) => h('section', { class: 'lib-section' }, h('h2', null, title), h('div', { style: 'display:grid;gap:16px' }, rows));
    main.append(h('div', { class: 'settings' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Settings'), h('p', null, 'Saved in this browser. They apply to the library and to every drill.'))),
      block('Look',
        D.field('Theme', GT.segmented('Theme', [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']], settings.theme, v => set({ theme: v }))),
        h('p', { class: 'small muted' }, 'Automatic follows the light or dark setting of your device.')),
      block('Neck',
        D.field('Hand', GT.segmented('Hand', [[false, 'Right-handed'], [true, 'Left-handed']], settings.leftHanded, v => set({ leftHanded: v }))),
        D.field('Direction', GT.segmented('Direction', [['horizontal', 'Horizontal'], ['vertical', 'Vertical']], GT.fretboard.isUpright(settings.orientation) ? 'vertical' : 'horizontal', v => set({ orientation: v }))),
        h('p', { class: 'small muted' }, 'Horizontal: the nut on the left and the high e on top, like tab. On a phone a long neck scrolls sideways. Vertical: the nut on top and the low E on the left, like a chord chart. On a phone, a switch beside each neck changes this too.'),
        D.field('Frets in the library', GT.segmented('Frets', [[12, '12'], [15, '15'], [24, '24']], settings.frets, v => set({ frets: v }))),
        D.field('Tuning', tuning),
        custom,
        D.field('Capo', capo),
        preview,
        h('p', { class: 'small muted' }, 'With a capo, the open strings sound at the capo, in the Library and in the drills. The colored bar on a neck is the capo, and the fret numbers still count from the nut. Chords keep the names of their sound. The tuner and the CAGED drill ignore the capo.')),
      block('Sound',
        D.field('Sound', GT.segmented('Sound', [[false, 'On'], [true, 'Off']], !!settings.muted, v => set({ muted: v }))),
        D.field('Voice', GT.segmented('Voice', [['pluck', 'Plucked string'], ['soft', 'Soft tone']], settings.voice, v => { set({ voice: v }); A.notes([48, 52, 55, 60], 'strum'); })),
        D.field('Volume', volume),
        D.field('Pitch of A', pitch),
        h('p', { class: 'small muted' }, 'The pitch that the tuner, the listening drill and the sounds of the site take for the note A. Most music uses 440 Hz. Slow down does not change the pitch of a song.'),
        h('div', null, h('button', { type: 'button', class: 'btn', disabled: !!settings.muted, onclick: () => A.notes([40, 47, 52, 56, 59, 64], 'strum') }, '▶ Test sound'))),
      block('Practice',
        D.field('Daily goal', GT.segmented('Daily goal', [[5, '5 min'], [10, '10 min'], [15, '15 min'], [20, '20 min']], settings.goal || 10, v => set({ goal: v }))),
        D.field('After a right answer', GT.segmented('After a right answer', [[true, 'Go on by itself'], [false, 'Wait for me']], settings.autoAdvance !== false, v => set({ autoAdvance: v }))),
        D.field('Count-in', GT.segmented('Count-in', [[true, 'One bar'], [false, 'Off']], settings.countIn !== false, v => set({ countIn: v }))),
        h('p', { class: 'small muted' }, 'One bar of clicks before a strumming pattern or a rhythm starts. Read mode of Tap in time always counts in: you need the tempo before the first note.')),
      service && block('Download service',
        h('p', { class: 'small muted' }, 'Optional, for Slow down. A YouTube video has only YouTube\'s own speeds. If you run the download service of this site on your own server, enter its address and key here. Slow down then gets a Download button, and a downloaded song gets every tool. The address and the key stay in this browser. The server gets the link of each video you download.'),
        D.field('Address', dlUrl),
        D.field('Key', dlKey),
        h('p', { class: 'small muted' }, h('a', { href: `${REPO}/tree/main/server`, target: '_blank', rel: 'noopener' }, 'How to set up the service'))),
      block('About',
        h('p', { class: 'muted' }, service
          ? 'Everything runs in your browser. Nothing is sent anywhere, with two exceptions in Slow down: YouTube sees which video you open, and a download service that you set above gets the link of each video you download. The sound is made by the browser, so the site works offline after the first visit.'
          : 'Everything runs in your browser. Nothing is sent anywhere, except that YouTube sees which video you open in Slow down. The sound is made by the browser, so the site works offline after the first visit.'),
        h('p', { class: 'muted' }, 'Found a wrong note or a bug, or have an idea? Report it on GitHub. The code of the site is there too.'),
        h('div', { class: 'row about-links' },
          h('a', { class: 'btn', href: `${REPO}/issues/new`, target: '_blank', rel: 'noopener' }, 'Report a problem'),
          h('a', { class: 'btn', href: REPO, target: '_blank', rel: 'noopener' }, 'Code on GitHub')),
        h('p', { class: 'small faint site-version' }, h('a', { href: `${REPO}/releases/tag/v${GT.version}`, target: '_blank', rel: 'noopener', title: 'What changed in this version' }, `Version ${GT.version}`)))));
  }
  const REPO = 'https://github.com/ivnvxd/guitar-trainer';

  GT.route('progress', { render: progressPage });
  GT.route('settings', { render: settingsPage });
})(window);
