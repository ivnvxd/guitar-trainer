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
      return { app: 'guitar-trainer', version: 1, saved: new Date().toISOString(), data };
    },
    importAll(json) {
      if (!json || json.app !== 'guitar-trainer' || typeof json.data !== 'object') throw new Error('This file is not a progress file from this site.');
      for (const [k, v] of Object.entries(json.data)) store.set(k, v);
    }
  };

  const DEFAULTS = { leftHanded: false, frets: 15, voice: 'pluck', volume: 0.8, tuning: 'standard', orientation: 'auto', theme: 'auto' };
  const settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
  function saveSettings(patch) {
    Object.assign(settings, patch);
    store.set('settings', settings);
    GT.audio.setVoice(settings.voice);
    GT.audio.setVolume(settings.volume);
    applyTheme();
  }
  // Theme: 'auto' follows the device. index.html sets it once before the first paint.
  const lightQuery = root.matchMedia ? root.matchMedia('(prefers-color-scheme: light)') : null;
  function applyTheme() {
    const theme = settings.theme === 'auto' ? (lightQuery && lightQuery.matches ? 'light' : 'dark') : settings.theme;
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f4f6f9' : '#0f1218';
  }
  if (lightQuery) lightQuery.addEventListener('change', () => { if (settings.theme === 'auto') applyTheme(); });
  const tuning = () => (T.TUNINGS.find(t => t.id === settings.tuning) || T.TUNINGS[0]).midi;

  // Root names in links: "a", "c-sharp", "e-flat".
  const rootSlug = name => name[0].toLowerCase() + (name.includes('♯') ? '-sharp' : name.includes('♭') ? '-flat' : '');
  const rootFromSlug = slug => {
    if (!slug) return null;
    const [l, acc] = slug.split('-');
    const name = l.toUpperCase() + (acc === 'sharp' ? '♯' : acc === 'flat' ? '♭' : '');
    return T.ROOTS.includes(name) ? name : null;
  };

  // Router: "#/library/scales/blues/a" calls the view registered for "library" with the rest.
  const views = {};
  let current = null;
  function route(name, view) { views[name] = view; }
  // Open a page. "replace" changes the link without a new history entry (for option changes).
  function go(path, replace) {
    const hash = '#/' + path.replace(/^#?\/?/, '');
    if (replace) { const y = root.scrollY; history.replaceState(null, '', hash); render(); root.scrollTo(0, y); }
    else if (location.hash === hash) render();
    else location.hash = hash;
  }
  function render() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const name = views[parts[0]] ? parts[0] : 'train';
    const rest = views[parts[0]] ? parts.slice(1) : [];
    if (current && current.leave) current.leave();
    GT.audio.stopMetronome();
    GT.audio.silence();
    const main = document.getElementById('main');
    main.replaceChildren();
    current = views[name];
    document.querySelectorAll('[data-nav]').forEach(a => a.setAttribute('aria-current', String(a.dataset.nav === name)));
    current.render(main, rest);
    const title = main.querySelector('h1');
    document.title = (title ? title.textContent + ' · ' : '') + GT.siteName;
    if (!render.first) main.focus({ preventScroll: true });
    render.first = false;
    window.scrollTo(0, 0);
  }
  render.first = true;

  // Re-render the current fretboards when the window changes between narrow and wide.
  let lastNarrow = null;
  root.addEventListener('resize', () => {
    const narrow = root.innerWidth < 660;
    if (lastNarrow !== null && narrow !== lastNarrow && current && current.resize) current.resize();
    lastNarrow = narrow;
  });

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pick = list => list[Math.floor(Math.random() * list.length)];

  // A segmented control: one choice of several. Arrow keys move the choice, as in a radio group.
  function segmented(label, options, value, onChange, cls = '') {
    const at = options.findIndex(([v]) => v === value);
    const choose = v => { if (v !== value) onChange(v); };
    const onKey = e => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      e.stopPropagation();
      choose(options[(Math.max(at, 0) + step + options.length) % options.length][0]);
      // A change often redraws the page. Put the focus back on the new choice, so the arrow keys go on.
      const now = document.querySelector(`[role="radiogroup"][aria-label="${label}"] [aria-checked="true"]`);
      if (now) now.focus({ preventScroll: true });
    };
    return h('div', { class: 'seg ' + cls, role: 'radiogroup', 'aria-label': label, onkeydown: onKey },
      options.map(([v, text], i) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(v === value), tabindex: i === Math.max(at, 0) ? '0' : '-1',
        onclick: () => choose(v)
      }, text)));
  }

  GT.siteName = 'Guitar Trainer';
  Object.assign(GT, { h, store, settings, saveSettings, applyTheme, tuning, rootSlug, rootFromSlug, route, go, render, shuffle, pick, segmented });
})(window);
