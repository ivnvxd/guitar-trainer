/* One fretboard for the whole site, drawn as SVG. It is a diagram, not a picture of a guitar:
   a plain board, thin frets, a thick nut, and strings that get thicker toward the low E.
   Flat: the nut on the left and the high e on top, like tab. A long neck keeps its size on a phone and scrolls sideways.
   Upright: the nut on top and the low E on the left, like a chord chart.
   The root is a square and every other note is a circle, so the roots stand out without color. */
(function (root) {
  'use strict';
  const GT = root.GT = root.GT || {};
  const NS = 'http://www.w3.org/2000/svg';
  const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
  const DOUBLE = [12, 24];
  // Where you scrolled a flat neck, so the next drawing of the same frets opens at the same place.
  let seen = null;

  function el(name, attrs = {}, parent) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  // 'auto' is the flat neck. Upright is a choice: the switch on a neck, or Settings.
  const isUpright = orientation => orientation === 'vertical';

  /**
   * render(container, options)
   * options.from, options.to   fret range (0 = open strings)
   * options.tuning             MIDI numbers, low string first
   * options.markers            [{ string, fret, label, kind, title }]; kind sets the color, 'root' is a square
   * options.onPress(string, fret, midi)   makes every fret position a button
   * options.pressMarkersOnly   only marked positions are buttons
   * options.orientation        'auto' | 'horizontal' | 'vertical'
   * options.turn               show the switch between flat and upright on a narrow screen; it saves the setting
   * options.leftHanded         mirror the neck
   * options.dimOutside         [low, high]: shade the frets outside this range
   * options.label              accessible name of the board
   * options.links              [{ points: [{ string, fret }], cls }]: lines that join notes, under the dots
   * options.regions            [{ points: [{ string, fret }], label, cls }]: an outline around a group of notes,
   *                            with its label beside the neck (CAGED shapes)
   * options.lane               keep the room for region letters, so the neck does not grow when they appear
   * options.bare               no fret numbers and no string names (small pictures)
   * A marker with ring: true gets a second ring, for a note that two shapes share.
   */
  function render(container, options) {
    const o = Object.assign({ from: 0, to: 15, tuning: GT.theory.STANDARD, markers: [], orientation: 'auto', leftHanded: false }, options);
    const strings = o.tuning.length;
    const vertical = isUpright(o.orientation);
    const narrow = root.innerWidth < 660;
    // Every fret has the same length. The open strings get a shorter column before the nut.
    const fret = vertical ? (o.compact ? 42 : 50) : (narrow ? 54 : 58);
    const widths = [];
    for (let f = o.from; f <= o.to; f++) widths.push(f === 0 ? fret * 0.72 : fret);
    const gap = vertical ? 48 : (narrow ? 40 : 36);   // distance between strings
    const edge = gap * 0.5;                            // board beyond the outer strings
    // Room for fret numbers, string names and mute marks.
    const pad = o.bare ? { along: 6, across: edge + 4 } : { along: vertical ? 46 : 34, across: vertical ? 46 : 26 };
    const neckLength = widths.reduce((a, b) => a + b, 0);
    const neckWidth = gap * (strings - 1);
    // Outlines and lines keep only the notes inside the frets shown.
    const inView = p => p.fret >= o.from && p.fret <= o.to && p.string >= 0 && p.string < strings;
    const regions = (o.regions || []).map(r => Object.assign({}, r, { points: r.points.filter(inView) })).filter(r => r.points.length);
    // Region letters sit in a lane under a flat neck. An upright neck has room beside it.
    const lane = !vertical && (o.lane || regions.some(r => r.label)) ? 32 : 0;
    const W = vertical ? neckWidth + pad.across * 2 : neckLength + pad.along + 8;
    const H = vertical ? neckLength + pad.along + 8 : neckWidth + pad.across * 2 + (o.bare ? 0 : 16) + lane;

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
    // Left-handed and flat: the whole picture is mirrored, so the room for the string names is on the right.
    const flipAlong = v => (o.leftHanded && !vertical ? W - v : v);
    const xy = (a, c) => vertical ? { x: c, y: a } : { x: flipAlong(a), y: c };

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: `fb ${vertical ? 'fb-vertical' : 'fb-horizontal'}`, role: 'group', 'aria-label': o.label || 'Fretboard' });
    // A flat neck may shrink a little to fit. Below that it keeps its size and the box scrolls.
    if (!vertical) svg.style.minWidth = Math.round(W * (o.bare ? 0.2 : 0.86)) + 'px';
    const scroll = document.createElement('div');
    scroll.className = 'neck-scroll';
    scroll.appendChild(svg);
    container.replaceChildren(scroll);
    if (o.turn && narrow) {
      const turn = document.createElement('button');
      turn.type = 'button';
      turn.className = 'neck-turn';
      turn.textContent = vertical ? 'Show flat' : 'Show upright';
      turn.title = vertical ? 'Nut on the left, the neck scrolls sideways' : 'Nut on top, like a chord chart';
      const icon = el('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true' });
      el('path', { d: 'M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5' }, icon);
      turn.prepend(icon);
      turn.addEventListener('click', () => {
        const next = vertical ? 'horizontal' : 'vertical';
        GT.saveSettings({ orientation: next });
        render(container, Object.assign({}, options, { orientation: next }));
      });
      container.append(turn);
    }
    // String names that stay in view while a flat neck scrolls, so you always see which string is which.
    const pinned = document.createElement('div');
    if (!vertical && !o.bare) {
      pinned.className = 'neck-names';
      pinned.setAttribute('aria-hidden', 'true');
      for (let s = 0; s < strings; s++) {
        const name = GT.theory.PC_PLAIN[o.tuning[s] % 12];
        const tag = document.createElement('span');
        tag.textContent = s === strings - 1 && name === 'E' ? 'e' : name;
        pinned.appendChild(tag);
      }
      container.append(pinned);
      container.classList.toggle('is-left', !!o.leftHanded);
    }

    // The board starts at the nut. Open strings sit before it.
    const boardStart = o.from === 0 ? fretLine(0) : pad.along;
    const boardEnd = pad.along + neckLength;
    const rect = (a1, a2, c1, c2, attrs) => {
      const p1 = xy(Math.min(a1, a2), c1), p2 = xy(Math.max(a1, a2), c2);
      return el('rect', Object.assign({ x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y) }, attrs), svg);
    };
    const c1 = pad.across - edge, c2 = pad.across + neckWidth + edge;
    rect(boardStart, boardEnd, c1, c2, { class: 'fb-board', rx: 9 });
    if (o.dimOutside) {
      const [lo, hi] = o.dimOutside;
      if (lo > o.from) rect(o.from === 0 ? boardStart : pad.along, fretLine(Math.max(o.from, lo - 1)), c1, c2, { class: 'fb-shade', rx: 9 });
      if (hi < o.to) rect(fretLine(hi), boardEnd, c1, c2, { class: 'fb-shade', rx: 9 });
    }

    // Position dots.
    const mid = pad.across + neckWidth / 2;
    for (let f = Math.max(1, o.from); f <= o.to; f++) {
      if (INLAYS.includes(f)) { const p = xy(along(f), mid); el('circle', { cx: p.x, cy: p.y, r: 5, class: 'fb-inlay' }, svg); }
      if (DOUBLE.includes(f)) for (const d of [-gap, gap]) { const p = xy(along(f), mid + d); el('circle', { cx: p.x, cy: p.y, r: 5, class: 'fb-inlay' }, svg); }
    }
    // Shape outlines, under the frets and strings.
    const pos = p => xy(along(p.fret), across(p.string));
    const regionLayer = el('g', { class: 'fb-regions' }, svg);
    for (const r of regions) el('path', { d: hullPath(r.points.map(pos), vertical ? 21 : 19), class: 'fb-region ' + (r.cls || '') }, regionLayer);
    // Frets and nut. The last fret is the end of the board.
    for (let f = o.from; f < o.to; f++) {
      const a = fretLine(f);
      const p1 = xy(a, f === 0 ? c1 : c1 + 1), p2 = xy(a, f === 0 ? c2 : c2 - 1);
      el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: f === 0 ? 'fb-nut' : 'fb-fret' }, svg);
    }
    // Strings: thicker toward the low E, so you see which side is which.
    for (let s = 0; s < strings; s++) {
      const p1 = xy(boardStart, across(s)), p2 = xy(boardEnd, across(s));
      el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'fb-string', 'stroke-width': (3.3 - s * 0.44).toFixed(2) }, svg);
    }
    // Lines that join notes, for example the notes of one chord shape.
    for (const l of o.links || []) {
      if (l.points.length < 2 || !l.points.every(inView)) continue;
      el('polyline', { points: l.points.map(pos).map(p => `${p.x},${p.y}`).join(' '), class: 'fb-link ' + (l.cls || '') }, svg);
    }
    // Fret numbers and string names.
    const names = o.tuning.map(m => GT.theory.PC_PLAIN[m % 12]);
    if (!o.bare) {
      for (let f = Math.max(1, o.from); f <= o.to; f++) {
        const p = vertical ? { x: c1 - 13, y: along(f) + 4 } : xy(along(f), c2 + 17);
        if (vertical && o.leftHanded) p.x = c2 + 13;
        const t = el('text', { x: p.x, y: p.y, class: `fb-num${INLAYS.includes(f) || DOUBLE.includes(f) ? ' fb-num-strong' : ''}`, 'text-anchor': 'middle' }, svg);
        t.textContent = f;
      }
      for (let s = 0; s < strings; s++) {
        const p = vertical ? { x: across(s), y: 14 } : { x: o.leftHanded ? W - 9 : 9, y: across(s) + 4.5 };
        const t = el('text', { x: p.x, y: p.y, class: 'fb-strname', 'text-anchor': 'middle' }, svg);
        t.textContent = s === strings - 1 && names[s] === 'E' ? 'e' : names[s];
      }
    }

    // Muted strings: an × beside the string name, outside the frets.
    for (const s of o.muted || []) {
      const p = vertical ? { x: across(s), y: o.bare ? 6 : 36 } : { x: o.leftHanded ? W - 25 : 25, y: across(s) + 5 };
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
          const r = m.small ? 9 : 13.5;
          // The root is a square with round corners. Every other note is a circle.
          const shape = (size, cls) => m.kind === 'root'
            ? el('rect', { x: -size * 0.94, y: -size * 0.94, width: size * 1.88, height: size * 1.88, rx: size * 0.42, class: cls }, g)
            : el('circle', { r: size, class: cls }, g);
          if (m.ring) shape(r + 5, 'fb-ring');
          shape(r, 'fb-dot');
          if (m.label) { const t = el('text', { class: 'fb-label', 'text-anchor': 'middle', y: 4.5 }, g); t.textContent = m.label; if (m.label.length > 2) t.classList.add('fb-label-long'); }
        }
      }
    }
    // Region letters, beside the neck at the middle of each outline.
    for (const r of regions) {
      if (!r.label || !r.points.length) continue;
      const ps = r.points.map(pos);
      const mx = ps.reduce((a, p) => a + p.x, 0) / ps.length, my = ps.reduce((a, p) => a + p.y, 0) / ps.length;
      const p = vertical ? { x: o.leftHanded ? c1 - 11 : c2 + 11, y: my } : { x: mx, y: c2 + 40 };
      const g = el('g', { class: 'fb-region-label ' + (r.cls || ''), transform: `translate(${p.x} ${p.y})` }, svg);
      el('circle', { r: 10 }, g);
      el('text', { y: 4, 'text-anchor': 'middle' }, g).textContent = r.label;
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

    // A flat neck that is longer than its box scrolls. Open it where the notes in question are.
    if (!vertical && !o.bare) {
      const key = `${o.from}:${o.to}`;
      const place = () => {
        const max = scroll.scrollWidth - scroll.clientWidth;
        container.classList.toggle('is-scrolling', max > 2);
        if (max <= 2) return;
        const k = svg.getBoundingClientRect().width / W, view = scroll.clientWidth;
        pinned.style.top = scroll.offsetTop + 'px';
        [...pinned.children].forEach((tag, s) => { tag.style.top = (across(s) * k).toFixed(1) + 'px'; });
        const lit = o.markers.filter(m => !m.dim && m.kind !== 'ghost');
        const range = (o.dimOutside ? [fretLine(Math.max(o.from, o.dimOutside[0] - 1)) - fret, fretLine(Math.min(o.to, o.dimOutside[1]))] : lit.map(m => along(m.fret)))
          .map(a => flipAlong(a) * k);
        const lo = Math.min(...range) - 28, hi = Math.max(...range) + 28;
        let left = seen && seen.key === key ? seen.left : (o.leftHanded ? max : 0);
        // The notes fit in the box but are not all in view: bring them to the middle.
        if (range.length && hi - lo <= view && (lo < left || hi > left + view)) left = (lo + hi - view) / 2;
        scroll.scrollLeft = Math.max(0, Math.min(max, left));
        edges();
      };
      const edges = () => {
        const max = scroll.scrollWidth - scroll.clientWidth;
        container.classList.toggle('at-start', scroll.scrollLeft <= 2);
        container.classList.toggle('at-end', scroll.scrollLeft >= max - 2);
      };
      scroll.addEventListener('scroll', () => { seen = { key, left: scroll.scrollLeft }; edges(); }, { passive: true });
      // The box often joins the page after this call, so wait for the layout.
      if (container.isConnected) place();
      requestAnimationFrame(place);
    } else container.classList.remove('is-scrolling');
    return { svg, vertical };
  }

  // The outline of a group of points, grown by r: the convex hull with round corners.
  function hullPath(points, r) {
    const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y)
      .filter((q, i, list) => i === 0 || q.x !== list[i - 1].x || q.y !== list[i - 1].y);
    if (!p.length) return '';
    if (p.length === 1) { const { x, y } = p[0]; return `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`; }
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [], upper = [];
    for (const q of p) { while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
    for (const q of p.slice().reverse()) { while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    const n = hull.length;
    // The outward normal of each edge; the path runs along the edges, moved out by r, with an arc at each corner.
    const normal = hull.map((a, i) => { const b = hull[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1; return { x: dy / len, y: -dx / len }; });
    const at = (q, nv) => `${(q.x + nv.x * r).toFixed(1)} ${(q.y + nv.y * r).toFixed(1)}`;
    let d = `M ${at(hull[0], normal[n - 1])}`;
    hull.forEach((q, i) => { d += ` A ${r} ${r} 0 0 1 ${at(q, normal[i])} L ${at(hull[(i + 1) % n], normal[i])}`; });
    return d + ' Z';
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

  GT.fretboard = { render, degreeKind, ordinal, el, isUpright };
})(window);
