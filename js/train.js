/* Train: the hub page and one runner for every drill.
   A drill is registered with GT.drills.add({ id, track, title, ... }) in the drills-*.js files. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const { h, store, settings } = GT;
  const P = GT.progress, A = GT.audio;

  const TRACKS = [
    { id: 'ear', name: 'Ear', intro: 'Hear it, name it, find it on the guitar.' },
    { id: 'neck', name: 'Neck', intro: 'Find notes, triads and shapes without counting frets.' },
    { id: 'keys', name: 'Keys and progressions', intro: 'Recall keys and chord numbers without working them out.' }
  ];
  const list = [];
  const byId = {};
  const drills = { add(def) { list.push(def); byId[def.id] = def; }, list, byId };
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  // Small line icons, drawn in the current text color.
  const ICONS = {
    check: 'M5 12.5l4.5 4.5L19 7.5',
    cross: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    plus: 'M12 5v14M5 12h14',
    sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
    grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z'
  };
  function icon(name, cls = '') {
    const el = GT.fretboard.el;
    const svg = el('svg', { viewBox: '0 0 24 24', class: 'icon ' + cls, 'aria-hidden': 'true' });
    el('path', { d: ICONS[name] }, svg);
    return svg;
  }

  // Answer tiles in even rows: five tiles are three and two, not four and one.
  // Fewer rows first, then the fewest columns that keep that number of rows.
  function even(box) {
    const n = box.children.length;
    if (!n || !box.clientWidth) return;
    const style = getComputedStyle(box);
    const min = parseFloat(style.getPropertyValue('--min')) || 124, gap = parseFloat(style.columnGap) || 8;
    const fit = Math.max(1, Math.floor((box.clientWidth + gap) / (min + gap)));
    const rows = Math.ceil(n / fit);
    box.style.setProperty('--cols', rows === 1 ? fit : Math.ceil(n / rows));
    box.dataset.rows = rows === 1 ? 'one' : 'many';
  }

  // ---------- hub ----------
  function hub(main) {
    const day = P.day(), goal = settings.goal || 10;
    const minutes = Math.round(day.ms / 60000);
    const streak = P.streak();
    const last = byId[store.get('lastDrill')] || byId['ear-intervals'];
    const track = (name, intro, rows) => h('section', { class: 'track' },
      h('h2', null, name), h('p', { class: 'track-intro' }, intro), h('div', { class: 'drill-list' }, rows));
    const tools = track('Tools', 'For practice with the guitar in your hands.', [
      h('a', { class: 'drill-row', href: '#/tools/metronome' }, h('h3', null, 'Metronome'), h('p', null, 'Tempo, beats per bar and tap tempo.')),
      h('a', { class: 'drill-row', href: '#/tools/changes' }, h('h3', null, 'One-minute chord changes'), h('p', null, 'Switch between two open chords for a minute. Beat your count.'))]);
    main.append(
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Train'), h('p', null, 'Short drills you repeat each day. The site asks again what you miss or answer slowly, and adds new material when you are ready.'))),
      h('div', { class: 'today' },
        h('div', { class: 'today-goal' }, h('p', null, h('b', null, `${minutes} of ${goal} min`), h('span', null, 'today')), goalNeck(minutes, goal)),
        h('div', { class: 'stat' }, h('b', null, day.q), h('span', null, 'answers today')),
        h('div', { class: 'stat' }, h('b', null, streak), h('span', null, streak === 1 ? 'day in a row' : 'days in a row')),
        h('a', { class: 'btn btn-primary btn-big', href: '#/train/' + last.id }, day.q ? `Continue: ${last.title}` : `Start: ${last.title}`)),
      // Three columns on a wide screen. Tools share the last one, so the columns end level.
      h('div', { class: 'tracks' }, TRACKS.map((t, i) => h('div', { class: 'track-col' },
        track(t.name, t.intro, list.filter(d => d.track === t.id).map(drillRow)),
        i === TRACKS.length - 1 ? tools : null))));
  }
  // Today's goal as a short neck: one fret for each minute of the goal, one dot for each minute done.
  function goalNeck(minutes, goal) {
    const W = 44, H = 34, el = GT.fretboard.el;
    const svg = el('svg', { viewBox: `-4 0 ${goal * W + 6} ${H}`, class: 'goal-neck' + (minutes >= goal ? ' is-done' : ''), style: `max-width:${goal * W + 6}px`, role: 'img', 'aria-label': `${Math.min(minutes, goal)} of ${goal} minutes done today` });
    el('rect', { x: 0, y: 2, width: goal * W, height: H - 4, rx: 3, class: 'fb-board' }, svg);
    for (let f = 0; f <= goal; f++) el('line', { x1: f * W, y1: 3, x2: f * W, y2: H - 3, class: f === 0 ? 'fb-nut' : 'fb-fret' }, svg);
    el('line', { x1: 0, y1: H / 2, x2: goal * W, y2: H / 2, class: 'fb-string', 'stroke-width': 2 }, svg);
    for (let m = 0; m < Math.min(minutes, goal); m++) el('circle', { cx: m * W + W / 2, cy: H / 2, r: 9, class: 'goal-dot' }, svg);
    return svg;
  }
  function drillRow(d) {
    const config = loadConfig(d);
    const s = P.summary(statsId(d, config), d.pool(config));
    return h('a', { class: 'drill-row', href: '#/train/' + d.id },
      h('h3', null, d.title), h('p', null, d.blurb),
      s.n ? h('div', { class: 'meter' }, h('div', { class: 'meter-bar' }, h('i', { style: `width:${s.mastered / s.total * 100}%` })),
        `${Math.round(s.accuracy * 100)}% right, ${s.mastered} of ${s.total} solid`) : null);
  }

  // ---------- configuration ----------
  // A drill with stages keeps the items you practice in config.set, and the automatic mode adds to it.
  // Before, that mode counted stages in 'stage.<id>'. The count becomes the set once, so nothing you unlocked is lost.
  function loadConfig(d) {
    const saved = store.get('config.' + d.id, {});
    const config = Object.assign({}, d.defaults, saved);
    if (d.stages && !saved.grows) {
      const stage = store.get('stage.' + d.id, 0);
      if (config.auto) config.set = d.stages.slice(0, stage + 1).flat();
      config.grows = true;
      if (stage || Object.keys(saved).length) saveConfig(d, config);
    }
    return config;
  }
  // The items the automatic mode adds next: what is missing from the first group that is not complete.
  function nextGroup(d, config) {
    for (const group of d.stages || []) {
      const missing = group.filter(item => !config.set.includes(item));
      if (missing.length) return missing;
    }
    return [];
  }
  function saveConfig(d, config) { store.set('config.' + d.id, config); }
  const statsId = (d, config) => d.statsKey ? `${d.id}:${d.statsKey(config)}` : d.id;

  // ---------- runner ----------
  function run(main, d) {
    const config = loadConfig(d);
    const session = { count: 0, correct: 0, streak: 0, times: [], missed: {}, requeue: [], last: null, q: null, answered: false, started: 0, done: false };
    let advanceTimer = null;

    const statLine = h('div', { class: 'drill-stats', 'aria-live': 'off' });
    // The options stay open on a wide screen, so a change is one click away. The choice is remembered.
    const optionsOpen = store.get('drillOptions', root.innerWidth >= 900);
    const settingsPanel = h('div', { class: 'settings-panel', id: 'drill-options', hidden: !optionsOpen });
    const settingsBtn = h('button', { type: 'button', class: 'btn', 'aria-expanded': String(optionsOpen), 'aria-controls': 'drill-options', onclick: () => {
      settingsPanel.hidden = !settingsPanel.hidden;
      settingsPanel.querySelectorAll('.pickset').forEach(even);
      settingsBtn.setAttribute('aria-expanded', String(!settingsPanel.hidden));
      store.set('drillOptions', !settingsPanel.hidden);
    } }, icon('sliders'), 'Options');
    const title = h('h2', { id: 'q-title' });
    const sub = h('p', { class: 'sub' });
    const promptActions = h('div', { class: 'prompt-actions' });
    const board = h('div');
    const answers = h('div', { class: 'answers', role: 'group', 'aria-labelledby': 'q-title' });
    const feedback = h('div', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
    const stage = h('div');
    const timer = h('div', { class: 'timer', hidden: true }, h('i'));
    const keysLine = h('p', { class: 'small muted drill-keys', style: 'margin-top:14px' });

    const ui = {
      config, session, board, answers,
      title: t => { title.textContent = t; },
      sub: t => { sub.textContent = t || ''; },
      actions(buttons) {
        promptActions.replaceChildren(...buttons.map(([label, fn, key]) => h('button', { type: 'button', class: 'btn' + (label.startsWith('▶') ? '' : ''), onclick: fn }, label, key ? h('span', { class: 'kbd' }, key) : null)));
      },
      // Answer buttons: [{ value, main, sub }]
      choices(items) {
        answers.hidden = false;
        answers.dataset.long = String(items.some(c => String(c.main).length > 3));
        answers.replaceChildren(...items.map((c, i) => h('button', { type: 'button', class: 'answer', dataset: { value: String(c.value) }, onclick: () => submit(c.value) },
          h('b', null, c.main), c.sub ? h('span', null, c.sub) : null, KEYS[i] ? h('span', { class: 'kbd', 'aria-hidden': 'true' }, KEYS[i]) : null)));
        even(answers);
      },
      even,
      noChoices() { answers.hidden = true; answers.replaceChildren(); },
      submit: v => submit(v),
      // Play the question. The answer clock starts at the first sound.
      play() {
        if (!d.play || !session.q) return;
        const seconds = d.play(session.q, 'replay') || 0;
        if (!session.heard) { session.heard = true; ui.startClock(seconds); }
      },
      startClock(delaySeconds = 0) { session.started = performance.now() + delaySeconds * 1000; },
      neck(markers, opts = {}) {
        const box = h('div', { class: 'neck' });
        GT.fretboard.render(box, Object.assign({ from: 0, to: 12, tuning: GT.tuning(), markers, leftHanded: settings.leftHanded, orientation: settings.orientation, compact: true, turn: true }, opts));
        return box;
      },
      rebuild: () => restart(),
      narrow: () => root.innerWidth < 600
    };

    function updateStats() {
      const acc = session.count ? Math.round(session.correct / session.count * 100) : 0;
      const med = P.median(session.times);
      const length = config.length || 0;
      statLine.replaceChildren(
        h('span', null, h('b', null, length ? `${Math.min(session.count + (session.answered ? 0 : 1), length)} / ${length}` : session.count + 1), 'question'),
        h('span', null, h('b', null, session.count ? acc + '%' : '–'), 'right'),
        h('span', null, h('b', null, med ? (med / 1000).toFixed(1) + ' s' : '–'), 'typical time'),
        h('span', { class: session.streak >= 3 ? 'is-hot' : '' }, h('b', null, session.streak), 'in a row'));
    }
    function pool() { return d.pool(config); }
    function nextItem() {
      const due = session.requeue.findIndex(r => r.at <= session.count);
      if (due >= 0) { const [r] = session.requeue.splice(due, 1); if (pool().includes(r.item)) return r.item; }
      return P.choose(statsId(d, config), pool(), session.last);
    }
    function next() {
      clearTimeout(advanceTimer);
      A.silence();
      if (config.length && session.count >= config.length) return finish();
      const item = nextItem();
      if (item === null) { stage.replaceChildren(h('p', null, 'Choose at least one item in Options.')); return; }
      session.q = d.make(item, config, session);
      session.q.item = item;
      session.answered = false;
      session.last = item;
      feedback.className = 'feedback';
      feedback.onpointerdown = null;
      session.stay = null;
      feedback.replaceChildren(h('p', { class: 'muted' }, d.hint || 'Choose an answer.'));
      board.replaceChildren();
      sub.textContent = '';
      ui.startClock(0);
      d.render(session.q, ui);
      updateStats();
      drawKeys();
      // Drills without a sound question start the clock when the question shows.
      session.heard = d.autoPlay === false || !d.play;
      if (d.autoPlay !== false && d.play) {
        ui.play();
        // Without a click first, browsers keep the sound off. Then the first Replay starts it.
        setTimeout(() => {
          if (!A.running() && !session.answered) {
            session.heard = false;
            feedback.replaceChildren(h('p', null, 'Your browser waits for a click before it plays sound. Press ', h('b', null, 'Replay'), ' or ', h('span', { class: 'kbd' }, 'Space'), ' to hear the question.'));
          }
        }, 250);
      }
    }
    function submit(value) {
      if (session.answered || !session.q) return;
      session.answered = true;
      const q = session.q;
      const correct = d.check(q, value);
      const fast = typeof d.fastMs === 'function' ? d.fastMs(config) : d.fastMs || 4000;
      // After help such as Hear all, a right answer still counts, but as slow: it is not learned yet.
      const ms = Math.max(0, performance.now() - session.started, q.assisted ? fast * 2 : 0);
      const id = statsId(d, config);
      P.record(id, q.item, correct, ms, fast);
      session.count++;
      if (correct) { session.correct++; session.streak++; if (!q.assisted) session.times.push(ms); }
      else {
        session.streak = 0;
        session.missed[q.item] = (session.missed[q.item] || 0) + 1;
        session.requeue.push({ item: q.item, at: session.count + 3 + Math.floor(Math.random() * 3) });
      }
      // Mark the answer buttons: a check on the right one, a cross on a wrong choice.
      answers.querySelectorAll('.answer').forEach(b => {
        b.disabled = true;
        if (d.check(q, decode(b.dataset.value))) { b.classList.add('is-correct'); b.append(icon('check', 'answer-mark')); }
        else if (b.dataset.value === String(value)) { b.classList.add('is-wrong'); b.append(icon('cross', 'answer-mark')); }
      });
      const fb = d.feedback(q, value, correct, ui) || {};
      // A mixed-up item, such as the interval you chose instead, comes back sooner too.
      for (const item of fb.requeue || []) if (item !== q.item && pool().includes(item)) session.requeue.push({ item, at: session.count + 2 + Math.floor(Math.random() * 3) });
      let unlocked = null;
      // New items join after a right answer, not after a miss.
      if (d.stages && config.auto && correct) unlocked = maybeUnlock(d, config);
      // Go on by itself after a right answer, once the feedback sound has finished. A picture gets more time.
      const wait = Math.max(d.advanceMs || 1100, (fb.hold || 0) * 1000 + 400, fb.visual ? 2600 : 0);
      const auto = correct && settings.autoAdvance !== false && d.autoAdvance !== false && !unlocked;
      const timerBar = auto ? h('div', { class: 'result-timer', 'aria-hidden': 'true' }, h('i', { style: `animation-duration:${wait}ms` })) : null;
      // Any touch inside the result box stops the countdown, so you can replay and look.
      const stay = () => { clearTimeout(advanceTimer); if (timerBar) timerBar.remove(); };
      const verdict = correct ? (q.assisted ? 'Right, with help' : ms > fast ? 'Right, but slow' : 'Right') : 'Not quite';
      feedback.className = 'feedback result ' + (correct ? 'ok' : 'bad');
      feedback.onpointerdown = e => { if (!e.target.closest('.btn-primary')) stay(); };
      feedback.replaceChildren(...[
        h('div', { class: 'result-head' },
          h('span', { class: 'result-icon' }, icon(correct ? 'check' : 'cross')),
          h('div', { class: 'result-say' },
            h('span', { class: 'result-verdict' }, verdict),
            fb.title ? h('b', { class: 'result-answer' }, fb.title) : null,
            fb.sub ? h('span', { class: 'result-sub' }, fb.sub) : null)),
        fb.text ? h('p', { class: 'result-text' }, fb.text) : null,
        unlocked ? h('p', { class: 'result-new' }, icon('plus'), unlocked) : null,
        fb.visual ? h('div', { class: 'result-visual' }, fb.visual) : null,
        h('div', { class: 'actions' }, (fb.actions || []).map(([label, fn]) => h('button', { type: 'button', class: 'btn', onclick: () => { stay(); fn(); } }, label)),
          h('button', { type: 'button', class: 'btn btn-primary', onclick: next }, 'Next', h('span', { class: 'kbd' }, 'Space'))),
        timerBar].filter(Boolean));
      session.stay = stay;
      updateStats();
      // On a phone the feedback can sit below a tall neck or under the tab bar: bring it into view.
      const bar = document.querySelector('.topbar nav');
      const covered = bar && getComputedStyle(bar).position === 'fixed' ? bar.offsetHeight : 0;
      if (feedback.getBoundingClientRect().bottom > root.innerHeight - covered) {
        const still = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
        feedback.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
      }
      if (auto) advanceTimer = setTimeout(next, wait);
      else feedback.querySelector('.btn-primary').focus({ preventScroll: true });
    }
    // The key hints name only the keys that work in this drill and mode.
    function drawKeys() {
      const kbd = k => h('span', { class: 'kbd' }, k);
      keysLine.replaceChildren('Keys: ', ...((!answers.hidden || d.onKey) ? [kbd('1'), '–', kbd('9'), ' answer, '] : []),
        kbd('Space'), d.play ? ' replay or next' : ' next', ...(d.play ? [', ', kbd('R'), ' replay'] : []), '.');
    }
    const decode = v => (v !== '' && !isNaN(Number(v)) && String(Number(v)) === v) ? Number(v) : v;
    // The automatic mode: when your set is solid, the next group joins it, whatever set you started with.
    function maybeUnlock(def, cfg) {
      const added = nextGroup(def, cfg);
      if (!added.length || !P.ready(statsId(def, cfg), def.pool(cfg))) return null;
      cfg.set = cfg.set.concat(added);
      saveConfig(def, cfg);
      buildSettings();
      return def.unlockText ? def.unlockText(added) : 'New items added.';
    }
    function finish() {
      session.done = true;
      const acc = session.count ? Math.round(session.correct / session.count * 100) : 0;
      const missed = Object.entries(session.missed).sort((a, b) => b[1] - a[1]);
      stage.replaceChildren(h('div', { class: 'prompt done-panel' },
        h('h2', null, acc >= 85 ? 'Good session' : 'Session done'),
        h('p', { class: 'muted' }, acc >= 85 ? 'Most answers were right. Slow answers still come back more often.' : 'The items you missed come back more often next time.'),
        h('div', { class: 'stats-row' },
          h('div', null, h('b', null, `${acc}%`), h('span', null, 'right')),
          h('div', null, h('b', null, session.count), h('span', null, 'answers')),
          h('div', null, h('b', null, P.median(session.times) ? (P.median(session.times) / 1000).toFixed(1) + ' s' : '–'), h('span', null, 'typical time'))),
        missed.length ? h('div', null, h('p', { class: 'small muted' }, 'Missed'), h('div', { class: 'missed' }, missed.map(([item, n]) => h('span', { class: 'chip' }, d.itemName ? d.itemName(item, config) : item, n > 1 ? h('small', null, '×' + n) : null)))) : null,
        h('div', { class: 'row', style: 'justify-content:center' },
          h('button', { type: 'button', class: 'btn btn-primary btn-big', onclick: restart }, 'Practice again'),
          h('a', { class: 'btn btn-big', href: '#/train' }, 'Back to Train'))));
      stage.querySelector('.btn-primary').focus();
    }
    function restart() {
      clearTimeout(advanceTimer);
      Object.assign(session, { count: 0, correct: 0, streak: 0, times: [], missed: {}, requeue: [], last: null, q: null, answered: false, done: false });
      stage.replaceChildren(promptBox);
      next();
    }
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || settingsPanel.contains(document.activeElement)) return;
      if (session.done) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (tag === 'BUTTON' && e.key === 'Enter') return;
        e.preventDefault();
        if (session.answered) next(); else ui.play();
      } else if (e.key === 'r' || e.key === 'R') { if (session.stay) session.stay(); ui.play(); }
      else {
        const i = KEYS.indexOf(e.key);
        const btn = i >= 0 ? answers.querySelectorAll('.answer')[i] : null;
        if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
        else if (d.onKey) d.onKey(e, session.q, ui);
      }
    }

    // Options panel. Changing an option starts a new session.
    function buildSettings() {
      settingsPanel.replaceChildren(
        d.options ? d.options(config, patch => { Object.assign(config, patch); saveConfig(d, config); buildSettings(); restart(); }) : null,
        h('div', { class: 'opts' },
          h('div', { class: 'field' }, h('span', null, 'Session length'), GT.segmented('Session length', [[10, '10'], [20, '20'], [40, '40'], [0, 'No end']], config.length, v => { config.length = v; saveConfig(d, config); buildSettings(); updateStats(); }))));
      settingsPanel.querySelectorAll('.pickset').forEach(even);
    }
    if (config.length === undefined) config.length = 20;
    buildSettings();

    const promptBox = h('div', null,
      h('div', { class: 'prompt' },
        h('div', { class: 'prompt-top' }, h('div', null, title, sub), promptActions),
        board, answers, timer),
      feedback);
    stage.append(promptBox);
    main.append(h('div', { class: 'drill' },
      h('div', { class: 'crumb' }, h('a', { href: '#/train' }, 'Train'), ` / ${TRACKS.find(t => t.id === d.track).name}`),
      h('div', { class: 'drill-bar' }, h('h1', null, d.title), h('div', { class: 'row' }, statLine, settingsBtn)),
      settingsPanel,
      stage,
      d.help ? h('details', { class: 'drill-help' }, h('summary', null, 'How this drill works'), d.help.map(p => h('p', null, p))) : null,
      keysLine));
    document.addEventListener('keydown', onKey);
    const onResize = () => document.querySelectorAll('.answers, .pickset').forEach(even);
    root.addEventListener('resize', onResize);
    next();
    onResize();
    return () => { document.removeEventListener('keydown', onKey); root.removeEventListener('resize', onResize); clearTimeout(advanceTimer); };
  }

  let cleanup = null;
  GT.route('train', {
    render(main, parts) {
      if (cleanup) { cleanup(); cleanup = null; }
      const d = byId[parts[0]];
      if (d) cleanup = run(main, d); else hub(main);
    },
    leave() { if (cleanup) { cleanup(); cleanup = null; } }
  });

  // Shared option pieces for drills.
  function pickset(label, items, selected, onChange, min = 1) {
    const box = h('div', { class: 'pickset', role: 'group', 'aria-label': label, dataset: { long: String(items.some(it => String(it.main).length > 4)), wide: String(items.some(it => (String(it.main) + (it.sub || '')).length > 15)) } });
    for (const it of items) {
      const input = h('input', { type: 'checkbox', checked: selected.includes(it.value) });
      input.addEventListener('change', () => {
        const nextSel = items.filter(x => x.value === it.value ? input.checked : selected.includes(x.value)).map(x => x.value);
        if (nextSel.length < min) { input.checked = true; return; }
        onChange(nextSel);
      });
      box.append(h('label', null, input, h('b', null, it.main), it.sub ? h('span', { class: 'muted' }, it.sub) : null));
    }
    return h('div', { class: 'field' }, h('span', null, label), box);
  }
  function field(label, control) { return h('div', { class: 'field' }, h('span', null, label), control); }
  // The switch of the automatic mode, with the names of the items that join next.
  function autoRow(d, config, set, noun, nameOf = x => x) {
    const next = nextGroup(d, config).map(nameOf);
    return [
      h('label', { class: 'row', style: 'gap:8px' }, h('input', { type: 'checkbox', checked: config.auto, onchange: e => set({ auto: e.target.checked }) }), `Add ${noun} for me as I improve`),
      h('p', { class: 'small muted' }, !config.auto ? 'Your set changes only when you change it.'
        : next.length ? `Start with any set. When about 85 percent of your answers are right, the next ones join: ${next.join(', ')}.`
          : `Your set has all the ${noun} of this drill.`)];
  }

  GT.drills = Object.assign(drills, { pickset, field, autoRow, nextGroup, statsId, loadConfig, TRACKS, KEYS, icon });
})(window);
