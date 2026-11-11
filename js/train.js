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

  // ---------- hub ----------
  function hub(main) {
    const day = P.day(), goal = settings.goal || 10;
    const minutes = Math.round(day.ms / 60000);
    const last = byId[store.get('lastDrill')] || byId['ear-intervals'];
    main.append(
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Train'), h('p', null, 'Short drills you repeat each day. The site asks again what you miss or answer slowly, and adds new material when you are ready.'))),
      h('div', { class: 'today' },
        h('div', { class: 'stat' }, h('b', null, `${minutes} of ${goal} min`), h('span', null, 'today')),
        h('div', { class: 'stat' }, h('b', null, day.q), h('span', null, 'answers today')),
        h('div', { class: 'stat' }, h('b', null, P.streak()), h('span', null, 'days in a row')),
        h('div', { class: 'grow' }, h('div', { class: 'meter' }, h('div', { class: 'meter-bar' }, h('i', { style: `width:${Math.min(100, minutes / goal * 100)}%` })))),
        h('a', { class: 'btn btn-primary btn-big', href: '#/train/' + last.id }, day.q ? `Continue: ${last.title}` : `Start: ${last.title}`)),
      ...TRACKS.map(t => h('section', { class: 'track' },
        h('div', { class: 'track-head' }, h('h2', null, t.name), h('p', null, t.intro)),
        h('div', { class: 'drills' }, list.filter(d => d.track === t.id).map(d => drillCard(d))))),
      h('section', { class: 'track' },
        h('div', { class: 'track-head' }, h('h2', null, 'Tools'), h('p', null, 'For practice with the guitar in your hands.')),
        h('div', { class: 'drills' },
          h('a', { class: 'drill-link', href: '#/tools/metronome' }, h('h3', null, 'Metronome'), h('p', null, 'Tempo, beats per bar and tap tempo.')),
          h('a', { class: 'drill-link', href: '#/tools/changes' }, h('h3', null, 'One-minute chord changes'), h('p', null, 'Switch between two open chords for a minute. Beat your count.')))));
  }
  function drillCard(d) {
    const config = loadConfig(d);
    const s = P.summary(statsId(d, config), d.pool(config));
    return h('a', { class: 'drill-link' + (d.featured ? ' featured' : ''), href: '#/train/' + d.id },
      h('h3', null, d.title), h('p', null, d.blurb),
      h('div', { class: 'meter' }, h('div', { class: 'meter-bar' }, h('i', { style: `width:${s.total ? s.mastered / s.total * 100 : 0}%` })),
        s.n ? `${Math.round(s.accuracy * 100)}% right, ${s.mastered} of ${s.total} solid` : 'Not started'));
  }

  // ---------- configuration ----------
  function loadConfig(d) { return Object.assign({}, d.defaults, store.get('config.' + d.id, {})); }
  function saveConfig(d, config) { store.set('config.' + d.id, config); }
  const statsId = (d, config) => d.statsKey ? `${d.id}:${d.statsKey(config)}` : d.id;

  // ---------- runner ----------
  function run(main, d) {
    const config = loadConfig(d);
    const session = { count: 0, correct: 0, times: [], missed: {}, requeue: [], last: null, q: null, answered: false, started: 0, done: false };
    let advanceTimer = null;

    const statLine = h('div', { class: 'drill-stats', 'aria-live': 'off' });
    const settingsPanel = h('div', { class: 'settings-panel', hidden: true });
    const settingsBtn = h('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', onclick: () => {
      settingsPanel.hidden = !settingsPanel.hidden;
      settingsBtn.setAttribute('aria-expanded', String(!settingsPanel.hidden));
    } }, 'Options');
    const title = h('h2', { id: 'q-title' });
    const sub = h('p', { class: 'sub' });
    const promptActions = h('div', { class: 'prompt-actions' });
    const board = h('div');
    const answers = h('div', { class: 'answers', role: 'group', 'aria-labelledby': 'q-title' });
    const feedback = h('div', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
    const stage = h('div');
    const timer = h('div', { class: 'timer', hidden: true }, h('i'));

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
        answers.replaceChildren(...items.map((c, i) => h('button', { type: 'button', class: 'answer', dataset: { value: String(c.value) }, onclick: () => submit(c.value) },
          h('b', null, c.main), c.sub ? h('span', null, c.sub) : null, KEYS[i] ? h('span', { class: 'kbd', 'aria-hidden': 'true' }, KEYS[i]) : null)));
      },
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
        GT.fretboard.render(box, Object.assign({ from: 0, to: 12, tuning: GT.tuning(), markers, leftHanded: settings.leftHanded, orientation: settings.orientation, compact: true }, opts));
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
        h('span', null, h('b', null, med ? (med / 1000).toFixed(1) + ' s' : '–'), 'typical time'));
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
      feedback.replaceChildren(h('p', { class: 'muted' }, d.hint || 'Choose an answer.'));
      board.replaceChildren();
      sub.textContent = '';
      ui.startClock(0);
      d.render(session.q, ui);
      updateStats();
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
      const ms = Math.max(0, performance.now() - session.started);
      const fast = typeof d.fastMs === 'function' ? d.fastMs(config) : d.fastMs || 4000;
      const id = statsId(d, config);
      P.record(id, q.item, correct, ms, fast);
      session.count++;
      if (correct) { session.correct++; session.times.push(ms); }
      else {
        session.missed[q.item] = (session.missed[q.item] || 0) + 1;
        session.requeue.push({ item: q.item, at: session.count + 3 + Math.floor(Math.random() * 3) });
      }
      // Mark the answer buttons.
      answers.querySelectorAll('.answer').forEach(b => {
        b.disabled = true;
        if (d.check(q, decode(b.dataset.value))) b.classList.add('is-correct');
        else if (b.dataset.value === String(value)) b.classList.add('is-wrong');
      });
      const fb = d.feedback(q, value, correct, ui) || {};
      let unlocked = null;
      if (d.stages && config.auto) unlocked = maybeUnlock(d, config);
      feedback.className = 'feedback ' + (correct ? 'ok' : 'bad');
      feedback.replaceChildren(
        h('p', null, h('b', null, correct ? (ms > fast ? 'Right, but slow. ' : 'Right. ') : 'Not quite. '), fb.text || '', unlocked ? h('span', null, ' ', h('b', null, unlocked)) : null),
        h('div', { class: 'actions' }, (fb.actions || []).map(([label, fn]) => h('button', { type: 'button', class: 'btn', onclick: fn }, label)),
          h('button', { type: 'button', class: 'btn btn-primary', onclick: next }, 'Next', h('span', { class: 'kbd' }, 'Space'))));
      updateStats();
      // On a phone the feedback can sit below a tall neck: bring it into view.
      if (feedback.getBoundingClientRect().bottom > root.innerHeight) {
        const still = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
        feedback.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
      }
      // Go on by itself after a right answer, once the feedback sound has finished.
      const wait = Math.max(d.advanceMs || 1100, (fb.hold || 0) * 1000 + 400);
      if (correct && settings.autoAdvance !== false && d.autoAdvance !== false && !unlocked) advanceTimer = setTimeout(next, wait);
      else feedback.querySelector('.btn-primary').focus({ preventScroll: true });
    }
    const decode = v => (v !== '' && !isNaN(Number(v)) && String(Number(v)) === v) ? Number(v) : v;
    function maybeUnlock(def, cfg) {
      const key = 'stage.' + def.id;
      const stageNow = store.get(key, 0);
      if (stageNow >= def.stages.length - 1) return null;
      if (!P.ready(statsId(def, cfg), def.pool(cfg))) return null;
      store.set(key, stageNow + 1);
      return def.unlockText ? def.unlockText(stageNow + 1) : 'New items added.';
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
      Object.assign(session, { count: 0, correct: 0, times: [], missed: {}, requeue: [], last: null, q: null, answered: false, done: false });
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
      } else if (e.key === 'r' || e.key === 'R') { ui.play(); }
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
        h('div', { class: 'row' },
          h('div', { class: 'field' }, h('span', null, 'Session length'), GT.segmented('Session length', [[10, '10'], [20, '20'], [40, '40'], [0, 'No end']], config.length, v => { config.length = v; saveConfig(d, config); buildSettings(); updateStats(); }))));
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
      h('p', { class: 'small muted', style: 'margin-top:14px' }, 'Keys: ', h('span', { class: 'kbd' }, '1'), '–', h('span', { class: 'kbd' }, '9'), ' answer, ', h('span', { class: 'kbd' }, 'Space'), ' replay or next, ', h('span', { class: 'kbd' }, 'R'), ' replay.')));
    document.addEventListener('keydown', onKey);
    next();
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(advanceTimer); };
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
    const box = h('div', { class: 'pickset', role: 'group', 'aria-label': label });
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

  GT.drills = Object.assign(drills, { pickset, field, statsId, loadConfig, TRACKS, KEYS });
})(window);
