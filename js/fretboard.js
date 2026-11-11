/* One fretboard for the whole site, drawn as SVG.
   Wide screens show it flat (high e on top, like tab). Narrow screens show it upright
   (nut on top, low E on the left, like a chord chart), so frets stay large enough to tap. */
(function (root) {
  'use strict';
  const GT = root.GT = root.GT || {};
  const NS = 'http://www.w3.org/2000/svg';
  const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
  const DOUBLE = [12, 24];

  function el(name, attrs = {}, parent) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');

  // Fret widths shrink up the neck, a little less than on a real guitar.
  function fretWidths(from, to, base) {
    const widths = [];
    for (let f = from; f <= to; f++) widths.push(f === 0 ? base * 0.62 : base * Math.pow(0.972, f - 1));
    return widths;
  }

  /**
   * render(container, options)
   * options.from, options.to   fret range (0 = open strings)
   * options.tuning             MIDI numbers, low string first
   * options.markers            [{ string, fret, label, kind, title }]; kind sets the color
   * options.onPress(string, fret, midi)   makes every fret position a button
   * options.pressMarkersOnly   only marked positions are buttons
   * options.orientation        'auto' | 'horizontal' | 'vertical'
   * options.leftHanded         mirror the neck
   * options.dimOutside         [low, high]: shade the frets outside this range
   * options.label              accessible name of the board
   */
  function render(container, options) {
    const o = Object.assign({ from: 0, to: 15, tuning: GT.theory.STANDARD, markers: [], orientation: 'auto', leftHanded: false }, options);
    const strings = o.tuning.length;
    const width = container.clientWidth || root.innerWidth;
    const vertical = o.orientation === 'vertical' || (o.orientation === 'auto' && width < 600);
    const base = vertical ? (o.compact ? 40 : 50) : 66;
    const widths = fretWidths(o.from, o.to, base);
    const gap = vertical ? 50 : 36;            // distance between strings
    const pad = { along: vertical ? 46 : 30, across: vertical ? 44 : 26 }; // room for fret numbers, string names and mute marks
    const neckLength = widths.reduce((a, b) => a + b, 0);
    const neckWidth = gap * (strings - 1);
    const W = vertical ? neckWidth + pad.across * 2 : neckLength + pad.along + 8;
    const H = vertical ? neckLength + pad.along + 8 : neckWidth + pad.across * 2 + 16;

    // Position along the neck (fret centre) and across it (string), mapped to x/y.
    const starts = [];
    widths.reduce((acc, w, i) => { starts[i] = acc; return acc + w; }, 0);
    const along = f => pad.along + starts[f - o.from] + widths[f - o.from] / 2;
    const fretLine = f => pad.along + starts[f - o.from] + widths[f - o.from]; // the fret wire after fret f
    const across = s => {
      // Flat: high e on top. Upright: low E on the left.
      const i = vertical ? s : strings - 1 - s;
      const k = o.leftHanded && vertical ? strings - 1 - i : i;
      return pad.across + k * gap;
    };
    const flipAlong = v => (o.leftHanded && !vertical ? (pad.along + neckLength) - (v - pad.along) + 0 : v);
    const xy = (a, c) => vertical ? { x: c, y: a } : { x: flipAlong(a), y: c };

    container.replaceChildren();
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: `fb ${vertical ? 'fb-vertical' : 'fb-horizontal'}`, role: 'group', 'aria-label': o.label || 'Fretboard' });
    container.appendChild(svg);

    // The board, starting after the open-string column when fret 0 is shown.
    const boardStart = o.from === 0 ? fretLine(0) : pad.along;
    const boardEnd = pad.along + neckLength;
    const rect = (a1, a2, c1, c2, attrs) => {
      const p1 = xy(Math.min(a1, a2), c1), p2 = xy(Math.max(a1, a2), c2);
      return el('rect', Object.assign({ x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y) }, attrs), svg);
    };
    const c1 = pad.across - gap * 0.42, c2 = pad.across + neckWidth + gap * 0.42;
    rect(boardStart, boardEnd, c1, c2, { class: 'fb-board', rx: 3 });
    if (o.dimOutside) {
      const [lo, hi] = o.dimOutside;
      if (lo > o.from) rect(o.from === 0 ? boardStart : pad.along, fretLine(Math.max(o.from, lo - 1)), c1, c2, { class: 'fb-shade' });
      if (hi < o.to) rect(fretLine(hi), boardEnd, c1, c2, { class: 'fb-shade' });
    }

    // Position dots.
    const mid = pad.across + neckWidth / 2;
    for (let f = Math.max(1, o.from); f <= o.to; f++) {
      if (INLAYS.includes(f)) { const p = xy(along(f), mid); el('circle', { cx: p.x, cy: p.y, r: 5.5, class: 'fb-inlay' }, svg); }
      if (DOUBLE.includes(f)) for (const d of [-gap, gap]) { const p = xy(along(f), mid + d); el('circle', { cx: p.x, cy: p.y, r: 5.5, class: 'fb-inlay' }, svg); }
    }
    // Frets and nut.
    for (let f = o.from; f <= o.to; f++) {
      const a = fretLine(f);
      const p1 = xy(a, c1), p2 = xy(a, c2);
      el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: f === 0 ? 'fb-nut' : 'fb-fret' }, svg);
    }
    // Strings: wound strings are thicker.
    for (let s = 0; s < strings; s++) {
      const p1 = xy(boardStart - (o.from === 0 ? widths[0] * 0.8 : 0), across(s)), p2 = xy(boardEnd, across(s));
      el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: `fb-string${s < 3 ? ' fb-wound' : ''}`, 'stroke-width': (2.2 - s * 0.28).toFixed(2) }, svg);
    }
    // Fret numbers and string names.
    const names = o.tuning.map(m => GT.theory.PC_PLAIN[m % 12]);
    for (let f = o.from; f <= o.to; f++) {
      const p = vertical ? { x: pad.across - gap * 0.42 - 12, y: along(f) + 4 } : xy(along(f), pad.across + neckWidth + gap * 0.42 + 17);
      if (vertical && o.leftHanded) p.x = pad.across + neckWidth + gap * 0.42 + 12;
      const t = el('text', { x: p.x, y: p.y, class: `fb-num${INLAYS.includes(f) || DOUBLE.includes(f) ? ' fb-num-strong' : ''}`, 'text-anchor': 'middle' }, svg);
      t.textContent = f;
    }
    for (let s = 0; s < strings; s++) {
      const p = vertical ? { x: across(s), y: 14 } : xy(flipAlong(14) === 14 ? 12 : 12, across(s));
      if (!vertical) { p.x = o.leftHanded ? W - 9 : 9; p.y = across(s) + 4; }
      const t = el('text', { x: p.x, y: p.y, class: 'fb-strname', 'text-anchor': 'middle' }, svg);
      t.textContent = s === strings - 1 && names[s] === 'E' ? 'e' : names[s];
    }

    // Muted strings: an × beside the string name, outside the frets.
    for (const s of o.muted || []) {
      const p = vertical ? { x: across(s), y: 36 } : { x: o.leftHanded ? W - 24 : 24, y: across(s) + 5 };
      const t = el('text', { x: p.x, y: p.y, class: 'fb-mute', 'text-anchor': 'middle' }, svg);
      t.textContent = '×';
    }

    // Press targets, then markers on top.
    const markerAt = new Map(o.markers.map(m => [`${m.string}:${m.fret}`, m]));
    for (let s = 0; s < strings; s++) {
      for (let f = o.from; f <= o.to; f++) {
        const m = markerAt.get(`${s}:${f}`);
        const pressable = o.onPress && (!o.pressMarkersOnly || m);
        if (!m && !pressable) continue;
        const p = xy(along(f), across(s));
        const g = el('g', { class: `fb-pos${m ? ' fb-' + (m.kind || 'tone') : ''}${m && m.dim ? ' fb-dim' : ''}`, transform: `translate(${p.x} ${p.y})` }, svg);
        const midi = o.tuning[s] + f;
        if (pressable) {
          g.setAttribute('role', 'button');
          g.setAttribute('tabindex', '0');
          const stringNo = strings - s;
          g.setAttribute('aria-label', `${m && m.label ? m.label + ', ' : ''}${ordinal(stringNo)} string, ${f === 0 ? 'open' : 'fret ' + f}`);
          g.dataset.string = s; g.dataset.fret = f;
          el('rect', { x: -widths[f - o.from] / 2, y: -gap / 2, width: widths[f - o.from], height: gap, class: 'fb-hit', ...(vertical ? { x: -gap / 2, y: -widths[f - o.from] / 2, width: gap, height: widths[f - o.from] } : {}) }, g);
        }
        if (m) {
          if (m.title) el('title', {}, g).textContent = m.title;
          if (m.kind === 'muted') { const t = el('text', { class: 'fb-mute', 'text-anchor': 'middle', y: 5 }, g); t.textContent = '×'; continue; }
          el('circle', { r: m.small ? 9 : 14, class: 'fb-dot' }, g);
          if (m.label) { const t = el('text', { class: 'fb-label', 'text-anchor': 'middle', y: 4.5 }, g); t.textContent = m.label; if (m.label.length > 2) t.classList.add('fb-label-long'); }
        }
      }
    }
    if (o.onPress) {
      const handler = target => {
        const g = target.closest('.fb-pos[role="button"]');
        if (!g) return;
        const s = Number(g.dataset.string), f = Number(g.dataset.fret);
        o.onPress(s, f, o.tuning[s] + f, g);
      };
      svg.addEventListener('click', e => handler(e.target));
      svg.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest) { e.preventDefault(); handler(e.target); } });
    }
    return { svg, vertical };
  }

  // Color family of a degree label: root, third, fifth, seventh or other.
  function degreeKind(label) {
    const num = Number(String(label).replace(/[♭♯]/g, ''));
    if (num === 1 || num === 8) return 'root';
    if (num === 3 || num === 10) return 'third';
    if (num === 5 || num === 12) return 'fifth';
    if (num === 7) return 'seventh';
    return 'other';
  }

  GT.fretboard = { render, degreeKind, ordinal };
})(window);
