/* Shared helpers: DOM building, saved data, settings, links and the page router. */
(function (root) {
  'use strict';
  const GT = root.GT = root.GT || {};
  const T = GT.theory;

  // h('button', { class: 'x', onclick }, 'text', child) builds an element.
  function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return node;
  }

  // Saved data. Every read and write survives a browser that blocks storage.
  const PREFIX = 'gt.';
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(PREFIX + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* practice still works */ }
    },
    keys() {
      try { return Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length)); } catch { return []; }
    },
    exportAll() {
      const data = {};
      for (const k of store.keys()) data[k] = store.get(k);
      // The download service belongs to this browser. Its address and its key do not go into a file.
      if (data.settings) { delete data.settings.dlUrl; delete data.settings.dlKey; }
      return { app: 'guitar-trainer', version: 1, saved: new Date().toISOString(), data };
    },
    importAll(json) {
      if (!json || json.app !== 'guitar-trainer' || typeof json.data !== 'object') throw new Error('This file is not a progress file from this site.');
      // A file never sets the download service: an address from a file would get the key of this browser.
      const now = store.get('settings', {}) || {};
      for (const [k, v] of Object.entries(json.data)) {
        if (k !== 'settings' || !v || typeof v !== 'object') { store.set(k, v); continue; }
        const next = Object.assign({}, v);
        delete next.dlUrl; delete next.dlKey;
        if (now.dlUrl) next.dlUrl = now.dlUrl;
        if (now.dlKey) next.dlKey = now.dlKey;
        store.set(k, next);
      }
    }
  };

  const DEFAULTS = { leftHanded: false, frets: 15, voice: 'pluck', volume: 0.8, muted: false, tuning: 'standard', customTuning: null, capo: 0, orientation: 'auto', theme: 'auto', micId: '', a4: 440 };
  const settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
  function saveSettings(patch) {
    Object.assign(settings, patch);
    store.set('settings', settings);
    GT.audio.setVoice(settings.voice);
    GT.audio.setVolume(settings.volume);
    applySound();
    applyTheme();
  }
  // The sound switch in the top bar shows the setting, and so does every other place that asks.
  function applySound() {
    GT.audio.setMuted(settings.muted);
    for (const b of document.querySelectorAll('.sound-btn')) {
      b.setAttribute('aria-pressed', String(!!settings.muted));
      b.title = settings.muted ? 'The sound is off' : 'The sound is on';
      b.setAttribute('aria-label', settings.muted ? 'Turn the sound on' : 'Turn the sound off');
    }
  }
  const setMuted = v => saveSettings({ muted: !!v });
  // A tap that asks for a sound while the sound is off: the switch pulses, so you see why it is quiet.
  // On a phone the switch can be out of view, far up the page. Then a note at the top says it for four seconds,
  // and a tap on the note turns the sound on.
  let soundNote = null;
  GT.audio.onMuted = () => {
    for (const b of document.querySelectorAll('.sound-btn')) { b.classList.remove('is-asked'); void b.offsetWidth; b.classList.add('is-asked'); }
    const btn = document.querySelector('.sound-btn');
    if (soundNote || !btn || btn.getBoundingClientRect().bottom > 0) return;
    const done = () => { if (soundNote) soundNote.remove(); soundNote = null; };
    soundNote = h('button', { type: 'button', class: 'sound-note', onclick: () => { setMuted(false); done(); } }, 'The sound is off. Tap to turn it on.');
    document.body.append(soundNote);
    setTimeout(done, 4000);
  };
  // A printout is light, whatever the theme on screen.
  root.addEventListener('beforeprint', () => document.documentElement.setAttribute('data-theme', 'light'));
  root.addEventListener('afterprint', () => applyTheme());
  // Theme: 'auto' follows the device. index.html sets it once before the first paint.
  const lightQuery = root.matchMedia ? root.matchMedia('(prefers-color-scheme: light)') : null;
  function applyTheme() {
    const theme = settings.theme === 'auto' ? (lightQuery && lightQuery.matches ? 'light' : 'dark') : settings.theme;
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#eff1f5' : '#1e1e2e';
  }
  if (lightQuery) lightQuery.addEventListener('change', () => { if (settings.theme === 'auto') applyTheme(); });
  // A custom tuning is six MIDI numbers, low string first. The capo is not part of it.
  const tuning = () => settings.tuning === 'custom' && Array.isArray(settings.customTuning) && settings.customTuning.length === 6
    ? settings.customTuning : (T.TUNINGS.find(t => t.id === settings.tuning) || T.TUNINGS[0]).midi;
  // With a capo, the open strings sound at the capo. The Library and the drills play from there: fret 0 is the capo.
  const capo = () => settings.capo || 0;
  // The pitch of the A above middle C, in Hz. The sounds of the site, the tuner and the drill that listens use it.
  const a4 = () => Number(settings.a4) || 440;
  const openStrings = () => tuning().map(m => m + capo());

  // Root names in links: "a", "c-sharp", "e-flat".
  const rootSlug = name => name[0].toLowerCase() + (name.includes('♯') ? '-sharp' : name.includes('♭') ? '-flat' : '');
  const rootFromSlug = slug => {
    if (!slug) return null;
    const [l, acc] = slug.split('-');
    const name = l.toUpperCase() + (acc === 'sharp' ? '♯' : acc === 'flat' ? '♭' : '');
    return T.ROOTS.includes(name) ? name : null;
  };

  // Router: "#/library/scales/blues/a" calls the view registered for "library" with the rest.
  // The Library is the home page.
  const views = {};
  let current = null;
  function route(name, view) { views[name] = view; }
  // A choice on a page draws the page again. The control you tapped then stays where it was on the screen,
  // also when a part above it gets taller or shorter. The page remembers the last tap to find the control again.
  let lastTap = null;
  const tapKey = el => `${el.tagName}|${el.getAttribute('aria-label') || ''}|${el.textContent.trim().slice(0, 60)}`;
  const twins = (tag, key) => [...document.querySelectorAll(`#main ${tag}`)].filter(x => tapKey(x) === key);
  function remember(e) {
    const el = e.target && e.target.closest ? e.target.closest('button, a, summary, select, input, [role="button"], [role="link"]') : null;
    if (!el || !el.closest('#main')) return;
    const key = tapKey(el), box = el.getBoundingClientRect();
    // A row of cards that scrolls sideways keeps its place as well.
    let row = el.parentElement;
    while (row && row.id !== 'main' && !(row.scrollWidth > row.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(row).overflowX))) row = row.parentElement;
    if (row && row.id === 'main') row = null;
    lastTap = { key, tag: el.tagName.toLowerCase(), nth: twins(el.tagName.toLowerCase(), key).indexOf(el), top: box.top, left: box.left, row: row && row.className, at: Date.now() };
  }
  for (const type of ['pointerdown', 'click', 'change']) root.addEventListener(type, remember, true);
  function keepPlace(draw) {
    const y = root.scrollY, tap = lastTap && Date.now() - lastTap.at < 2000 ? lastTap : null;
    // The keyboard focus goes back to the same control, so Tab goes on from there and not from the top.
    const focused = document.activeElement, hadFocus = !!(focused && focused !== document.body && focused.closest && focused.closest('#main'));
    lastTap = null;
    draw();
    root.scrollTo(0, y);
    if (!tap) return;
    const same = twins(tap.tag, tap.key), el = same[tap.nth] || (same.length === 1 ? same[0] : null);
    if (!el || !el.getClientRects().length) return;
    // Only with a mouse and keys: on a touch screen, focus on a new list could open it again.
    if (hadFocus && el.focus && !matchMedia('(pointer: coarse)').matches) el.focus({ preventScroll: true });
    if (tap.row) {
      const row = el.closest(`[class="${tap.row}"]`);
      if (row) row.scrollLeft += el.getBoundingClientRect().left - tap.left;
    }
    root.scrollBy(0, el.getBoundingClientRect().top - tap.top);
  }
  // Open a page. "replace" changes the link without a new history entry (for option changes).
  function go(path, replace) {
    const hash = '#/' + path.replace(/^#?\/?/, '');
    if (replace) keepPlace(() => { history.replaceState(history.state, '', hash); render(); });
    else if (location.hash === hash) render();
    else location.hash = hash;
  }
  // Back and Forward open a page where you left it. Each history entry gets a mark, and the page remembers the
  // scroll place of each mark. A tapped link is a new entry: it opens at the top.
  const places = new Map();
  let marks = 0, traversed = false;
  root.addEventListener('popstate', () => { traversed = true; });
  root.addEventListener('scroll', () => { const st = history.state; if (st && st.gt) places.set(st.gt, root.scrollY); }, { passive: true });
  function render() {
    const came = traversed && history.state && history.state.gt;
    traversed = false;
    if (!history.state || !history.state.gt) history.replaceState({ gt: `${Date.now()}:${++marks}` }, '');
    // A broken link (for example a lone %) opens what it can, not a blank page.
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch (e) { return p; } });
    const name = views[parts[0]] ? parts[0] : 'library';
    const rest = views[parts[0]] ? parts.slice(1) : [];
    if (current && current.leave) current.leave();
    GT.audio.stopMetronome();
    GT.audio.silence();
    // A backing belongs to the Library page that started it.
    if (name !== 'library') { GT.audio.stopLoop(); GT.audio.stopDrone(); }
    const main = document.getElementById('main');
    main.replaceChildren();
    // The top bar holds the tools of one page, such as Share. A page puts them back when it draws.
    const tools = document.getElementById('page-tools');
    if (tools) tools.replaceChildren();
    current = views[name];
    // Progress belongs to Train: the Train tab stays lit on it.
    const tab = name === 'progress' ? 'train' : name;
    document.querySelectorAll('[data-nav]').forEach(a => a.setAttribute('aria-current', String(a.dataset.nav === tab)));
    current.render(main, rest);
    const title = main.querySelector('h1');
    document.title = (title ? title.textContent + ' · ' : '') + GT.siteName;
    if (!render.first) main.focus({ preventScroll: true });
    render.first = false;
    window.scrollTo(0, came ? places.get(came) || 0 : 0);
  }
  render.first = true;

  // Re-render the current fretboards when the window changes between narrow and wide.
  // A phone turned sideways counts as a change as well.
  const shapeNow = () => `${root.innerWidth < 660}:${GT.fretboard.sideways()}`;
  let lastShape = shapeNow();
  root.addEventListener('resize', () => {
    const shape = shapeNow();
    if (shape !== lastShape && current && current.resize) current.resize();
    lastShape = shape;
  });

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pick = list => list[Math.floor(Math.random() * list.length)];

  // A segmented control: one choice of several. Arrow keys move the choice, as in a radio group.
  // It shows the new choice itself, so it is right also on a page that does not draw again after a change.
  function segmented(label, options, value, onChange, cls = '') {
    let now = value;
    const at = () => Math.max(0, options.findIndex(([v]) => v === now));
    const show = () => buttons.forEach((b, i) => { b.setAttribute('aria-checked', String(options[i][0] === now)); b.tabIndex = i === at() ? 0 : -1; });
    const choose = v => { if (v === now) return; now = v; show(); onChange(v); };
    const onKey = e => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      e.stopPropagation();
      const i = (at() + step + options.length) % options.length;
      choose(options[i][0]);
      // A change often draws the page again. Put the focus on the new choice, so the arrow keys go on.
      const there = document.querySelector(`[role="radiogroup"][aria-label="${label}"] [aria-checked="true"]`);
      (there || buttons[i]).focus({ preventScroll: true });
    };
    const buttons = options.map(([v, text]) => h('button', { type: 'button', role: 'radio', onclick: () => choose(v) }, text));
    show();
    const box = h('div', { class: 'seg ' + cls, role: 'radiogroup', 'aria-label': label, onkeydown: onKey }, buttons);
    if (rows) rows.observe(box);
    return box;
  }
  // Choices that do not fit one line become a grid of even rows, so no choice stands alone. The check runs when the
  // control gets its size, before it is painted.
  function evenRows(box) {
    box.classList.remove('is-grid');
    box.style.gridTemplateColumns = '';
    const kids = [...box.children], n = kids.length;
    if (n < 3 || !box.clientWidth) return;
    const lines = new Set(kids.map(k => k.offsetTop)).size;
    if (lines < 2) return;
    let cols = Math.ceil(n / lines);
    while (cols > 1 && n % cols === 1) cols--;
    box.classList.add('is-grid');
    box.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  }
  const rows = root.ResizeObserver ? new ResizeObserver(list => { for (const e of list) evenRows(e.target); }) : null;

  GT.siteName = 'Guitar Trainer';
  // The version of the files in use. It must match VERSION in sw.js, which a new upload changes.
  // The version of the site: major.minor.patch. The first number goes up for a redesign, the middle one for new
  // features, the last one for fixes only. Give VERSION in sw.js the same version when you publish new files.
  // Each version has a release with its notes on GitHub, tagged v and the version.
  GT.version = '2.3.1';
  // A submenu row as in the Library: a round button to the start page of the section (or none), then its pages.
  // items: [{ href, text, current, apart }]. An item with apart: true stands after a thin line.
  // The chosen page scrolls to the middle of the row when the row is wider than the screen.
  function subnav(label, home, items) {
    const tabs = h('div', { class: 'lib-tabs' }, items.map(it => h('a', { href: it.href, class: it.apart ? 'lib-tool-link' : null, 'aria-current': String(!!it.current) }, it.text)));
    const nav = h('nav', { class: 'lib-nav', 'aria-label': label },
      home ? h('a', { href: home.href, class: 'lib-home-link', 'aria-label': home.label, title: home.label, 'aria-current': String(!!home.current) }, GT.drills.icon(home.icon)) : null, tabs);
    requestAnimationFrame(() => {
      const chosen = tabs.querySelector('[aria-current="true"]');
      if (chosen) tabs.scrollLeft += chosen.getBoundingClientRect().left - tabs.getBoundingClientRect().left - (tabs.clientWidth - chosen.offsetWidth) / 2;
    });
    fadeEdges(tabs);
    return nav;
  }
  // A row that scrolls sideways fades at the side where more items hide (classes fade-left and fade-right).
  function fadeEdges(row) {
    const mark = () => {
      row.classList.toggle('fade-left', row.scrollLeft > 2);
      row.classList.toggle('fade-right', row.scrollWidth - row.clientWidth - row.scrollLeft > 2);
    };
    row.addEventListener('scroll', mark, { passive: true });
    if (root.ResizeObserver) new ResizeObserver(mark).observe(row);
    requestAnimationFrame(mark);
  }

  Object.assign(GT, { h, store, settings, saveSettings, applyTheme, applySound, setMuted, tuning, capo, a4, openStrings, rootSlug, rootFromSlug, route, go, render, keepPlace, shuffle, pick, segmented, subnav, fadeEdges });
})(window);
