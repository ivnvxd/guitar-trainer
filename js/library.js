/* Library: scales, chords, intervals, triads, keys and notes. Every view has its own link,
   for example #/library/scales/blues/a or #/library/chords/maj7/c/caged-e. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const T = GT.theory, FB = GT.fretboard, A = GT.audio;
  const { h, store, settings, rootSlug, rootFromSlug } = GT;

  const lib = Object.assign({ labels: 'notes' }, store.get('library', {}));
  const saveLib = patch => { Object.assign(lib, patch); store.set('library', lib); };
  const TABS = [['scales', 'Scales'], ['chords', 'Chords'], ['intervals', 'Intervals'], ['triads', 'Triads'], ['keys', 'Keys'], ['notes', 'Notes']];
  const PROPER = /^(Dorian|Phrygian|Lydian|Mixolydian|Locrian|Hungarian|Ionian|Aeolian)/;
  const lowerName = name => PROPER.test(name) ? name : name[0].toLowerCase() + name.slice(1);
  const stringOrdinal = s => FB.ordinal(6 - s);
  let lastRender = null;

  // ---------- shared pieces ----------
  function rootRow(current, hrefFor, roots = T.ROOTS) {
    return h('nav', { class: 'chips roots', 'aria-label': 'Root note' },
      roots.map(r => h('a', { class: 'chip', href: '#/' + hrefFor(r), 'aria-current': String(r === current) }, r)));
  }
  // The control panel above the neck: every choice of a page in one place.
  function ctl(label, control, cls = '') { return h('div', { class: 'ctl ' + cls }, h('span', { class: 'ctl-label' }, label), control); }
  function controls(...items) { return h('div', { class: 'controls', role: 'group', 'aria-label': 'Choices' }, items.flat().filter(Boolean)); }
  function rootCtl(state, view) { return ctl('Root', rootRow(state.root, r => view.link(Object.assign({}, state, { root: r, pos: null }))), 'ctl-wide'); }
  // A drop-down list with groups: [{ name, items: [[value, text]] }].
  function pickList(label, groups, value, onChange) {
    return h('select', { 'aria-label': label, onchange: e => onChange(e.target.value) },
      groups.map(g => h('optgroup', { label: g.name }, g.items.map(([v, t]) => h('option', { value: v, selected: v === value }, t)))));
  }
  function labelsSeg(onChange) {
    return ctl('Labels', GT.segmented('Labels', [['notes', 'Notes'], ['degrees', 'Degrees']], lib.labels, v => { saveLib({ labels: v }); onChange(); }));
  }
  function fretsSeg(onChange) {
    return ctl('Frets', GT.segmented('Frets shown', [[12, '12'], [15, '15'], [24, '24']], settings.frets, v => { GT.saveSettings({ frets: v }); onChange(); }));
  }
  function legend(kinds) {
    const names = { root: 'Root', third: 'Third', fifth: 'Fifth', seventh: 'Seventh', other: 'Other tones' };
    const colors = { root: 'var(--root)', third: 'var(--third)', fifth: 'var(--fifth)', seventh: 'var(--seventh)', other: 'var(--other)' };
    return h('div', { class: 'legend', 'aria-hidden': 'true' }, kinds.map(k => h('span', null, h('i', { style: `background:${colors[k]}` }), names[k])));
  }
  function kindsOf(tones) {
    const order = ['root', 'third', 'fifth', 'seventh', 'other'];
    const set = new Set(tones.map(t => FB.degreeKind(t.label)));
    return order.filter(k => set.has(k));
  }
  // A caption under the neck that names the note you pressed.
  function caption() { return h('p', { class: 'small muted', 'aria-live': 'polite', style: 'min-height:1.5em;margin-top:6px' }, 'Tap a note on the neck to hear it.'); }
  function pressPlayer(capEl, describe) {
    return (s, f, midi, g) => {
      A.note(midi, 0, 0, 0.55);
      if (capEl) capEl.textContent = describe(s, f, midi);
      g.classList.remove('fb-flash'); void g.getBBox(); g.classList.add('fb-flash');
    };
  }
  // Markers for every place of the given tones on the neck.
  function toneMarkers(tones, opts = {}) {
    const tuning = GT.tuning(), to = opts.to ?? settings.frets, from = opts.from ?? 0;
    const out = [];
    for (let s = 0; s < tuning.length; s++) for (let f = from; f <= to; f++) {
      const t = tones.find(x => x.pc === T.mod(tuning[s] + f));
      if (!t) continue;
      if (opts.only && !opts.only(s, f)) continue;
      out.push({ string: s, fret: f, label: lib.labels === 'notes' ? t.name : t.label, kind: opts.kind || FB.degreeKind(t.label), dim: opts.focus && t.label !== opts.focus, title: `${t.name}, ${t.label}` });
    }
    return out;
  }
  function neck(markers, extra = {}) {
    const box = h('div', { class: 'neck' });
    FB.render(box, Object.assign({ from: 0, to: settings.frets, tuning: GT.tuning(), markers, leftHanded: settings.leftHanded, orientation: settings.orientation }, extra));
    return box;
  }
  function miniNeck(markers, low, high, label, muted, extra = {}) {
    const from = low <= 1 ? 0 : low - 1;
    const to = Math.max(from + 4, high);
    const box = h('div', { class: 'neck' });
    FB.render(box, Object.assign({ from, to, tuning: GT.tuning(), markers, muted, orientation: 'vertical', leftHanded: settings.leftHanded, label }, extra));
    return box;
  }
  function describeNote(tones) {
    return (s, f, midi) => {
      const t = tones && tones.find(x => x.pc === T.mod(midi));
      const name = t ? t.name : T.PC_PLAIN[T.mod(midi)];
      return `${name}${t ? ', ' + t.label : ''}: ${stringOrdinal(s)} string, ${f === 0 ? 'open' : 'fret ' + f}`;
    };
  }
  const chordMidis = (rootName, chord, base = 48) => {
    const r = base + T.mod(T.pcOf(rootName) - base);
    return chord.toneList.map(t => r + t.semi);
  };
  const shapeMidis = frets => frets.map((f, s) => f === null ? null : GT.tuning()[s] + f).filter(m => m !== null);
  function playButton(text, fn) { return h('button', { type: 'button', class: 'btn', onclick: fn }, '▶ ', text); }
  function section(title, intro, ...content) {
    return h('section', { class: 'lib-section' }, h('h2', null, title), intro ? h('p', null, intro) : null, content);
  }

  // ---------- scales ----------
  const scalesView = {
    parse(p) {
      const scale = T.scaleById(p[0]) || T.scaleById('major');
      return { scale, root: rootFromSlug(p[1]) || 'C', pos: p[2] && p[2].startsWith('position-') ? Number(p[2].slice(9)) : null };
    },
    link: s => `library/scales/${s.scale.id}/${rootSlug(s.root)}${s.pos ? '/position-' + s.pos : ''}`,
    title: s => `${s.root} ${lowerName(s.scale.name)}`,
    render(state) {
      const { scale, root: r } = state;
      const tones = T.tonesOn(r, scale);
      const positions = scalePositions(r, scale);
      const pos = positions.find(p => p.index === state.pos) || null;
      let focus = null;
      const cap = caption();
      const neckSlot = h('div');
      const drawNeck = () => {
        let markers;
        if (pos) {
          const inPos = new Set(pos.notes.map(n => `${n.string}:${n.fret}`));
          markers = toneMarkers(tones, { focus }).map(m => inPos.has(`${m.string}:${m.fret}`) ? m : Object.assign(m, { kind: 'ghost', label: m.label }));
        } else markers = toneMarkers(tones, { focus });
        neckSlot.replaceChildren(neck(markers, { onPress: pressPlayer(cap, describeNote(tones)), pressMarkersOnly: false, dimOutside: pos ? [pos.low, pos.high] : null, label: `${scalesView.title(state)} on the neck` }));
      };
      const formula = h('div', { class: 'formula', role: 'group', 'aria-label': 'Scale tones. Select one to highlight it.' }, tones.map(t => {
        const b = h('button', { type: 'button', class: 'tone', 'aria-pressed': 'false', onclick: () => {
          focus = focus === t.label ? null : t.label;
          formula.querySelectorAll('.tone').forEach(x => x.setAttribute('aria-pressed', String(x === b && focus !== null)));
          A.note(48 + T.mod(T.pcOf(r) - 48) + t.semi);
          drawNeck();
        } }, h('i', { class: 'swatch', style: `background:var(--${FB.degreeKind(t.label)})` }), h('b', null, lib.labels === 'notes' ? t.name : t.label), h('span', null, lib.labels === 'notes' ? t.label : t.name));
        return b;
      }));
      const play = () => {
        const base = 48 + T.mod(T.pcOf(r) - 48);
        const up = tones.map(t => base + t.semi).concat(base + 12);
        A.notes(up.concat(up.slice(0, -1).reverse()), 'up', 0.32, 0.4);
      };
      drawNeck();
      const posOptions = [[0, 'Whole neck']].concat(positions.map(p => [p.index, `${p.index}`]));
      const out = [
        h('div', { class: 'lib-title' }, h('div', null, h('h1', null, scalesView.title(state)), h('p', { class: 'muted lib-sub' }, T.SCALE_GROUPS.find(g => g.id === scale.group).name)), h('div', { class: 'row' }, playButton('Play', play))),
        formula,
        controls(
          rootCtl(state, scalesView),
          ctl('Scale', pickList('Scale', T.SCALE_GROUPS.map(g => ({ name: g.name, items: g.items.map(i => [i.id, i.name]) })), scale.id, v => GT.go(scalesView.link(Object.assign({}, state, { scale: T.scaleById(v), pos: null })), true))),
          positions.length ? ctl('Position', GT.segmented('Position', posOptions, pos ? pos.index : 0, v => GT.go(scalesView.link(Object.assign({}, state, { pos: v || null })), true))) : null,
          labelsSeg(rerender),
          fretsSeg(rerender)),
        neckSlot, cap,
        h('div', { class: 'row', style: 'justify-content:space-between' }, legend(kindsOf(tones)), pos ? h('span', { class: 'small muted' }, `Position ${pos.index} starts on the ${pos.startLabel} on the 6th string, frets ${pos.low}–${pos.high}.`) : null)
      ];
      out.push(section('Steps', 'W is a whole step (2 frets), H is a half step (1 fret).', h('div', { class: 'chips' }, stepNames(scale).map(s => h('span', { class: 'chip', style: 'cursor:default' }, s)))));
      if (scale.toneList.length === 7) {
        const triads = T.scaleChords(r, scale), sevenths = T.scaleChords(r, scale, true);
        out.push(section('Chords in this scale', 'Built by stacking every other note of the scale. Open one to see its shapes.',
          h('div', { class: 'chord-row' }, triads.map(c => chordLink(c))),
          h('div', { class: 'chord-row', style: 'margin-top:8px' }, sevenths.map(c => chordLink(c)))));
      }
      const related = relatedScales(r, scale);
      if (related.length) out.push(section('Related', null, h('div', { class: 'chips' }, related.map(x => h('a', { class: 'chip', href: '#/' + x.href }, x.text)))));
      return out;
    }
  };
  function chordLink(c) {
    const href = c.chord ? `#/library/chords/${c.chord.id}/${rootSlug(rootForLink(c.root))}` : null;
    return h(href ? 'a' : 'span', { class: 'chord-btn', href, style: 'text-decoration:none;color:inherit' }, h('small', null, c.label), h('b', null, c.name));
  }
  // Links use the 17 picker roots; a rare spelling such as E♯ falls back to its plain name.
  const rootForLink = name => T.ROOTS.includes(name) ? name : T.PC_PLAIN[T.pcOf(name)];
  function stepNames(scale) {
    const semis = scale.toneList.map(t => t.semi).concat(12);
    return semis.slice(1).map((s, i) => ({ 1: 'H', 2: 'W', 3: 'W+H', 4: '2W' })[s - semis[i]] || `${s - semis[i]}`);
  }
  // Positions: pentatonic boxes and 3-notes-per-string. Blues scales use the pentatonic boxes plus the added note.
  function scalePositions(r, scale) {
    const extra = { blues: 'minor-pentatonic', 'major-blues': 'major-pentatonic' }[scale.id];
    if (!extra) return T.positions(r, scale, GT.tuning(), settings.frets);
    const base = T.positions(r, T.scaleById(extra), GT.tuning(), settings.frets);
    const blue = T.tonesOn(r, scale).find(t => !T.scaleById(extra).toneList.some(x => x.label === t.label));
    return base.map(p => {
      const notes = p.notes.slice();
      for (let s = 0; s < 6; s++) for (let f = p.low; f <= p.high; f++) if (T.mod(GT.tuning()[s] + f) === blue.pc) notes.push({ string: s, fret: f, midi: GT.tuning()[s] + f });
      return Object.assign({}, p, { notes });
    });
  }
  function relatedScales(r, scale) {
    const out = [];
    const link = (id, rootName, text) => out.push({ href: `library/scales/${id}/${rootSlug(rootForLink(rootName))}`, text });
    const parent = T.parentMajor(r, scale.id);
    if (parent && scale.id !== 'major') link('major', parent, `Same notes as ${parent} major`);
    if (parent) {
      const modes = T.SCALE_GROUPS[0].items.filter(m => m.id !== scale.id && m.id !== 'major');
      for (const m of modes) {
        const idx = T.MODE_INDEX[m.id];
        const modeRoot = T.spell(parent, T.scaleById('major').toneList[idx].label);
        link(m.id, modeRoot, `${modeRoot} ${lowerName(m.name)}`);
      }
    }
    if (scale.id === 'minor-pentatonic') { const rel = T.spell(r, '♭3'); link('major-pentatonic', rel, `Same notes as ${rel} major pentatonic`); link('blues', r, `${r} blues`); }
    if (scale.id === 'major-pentatonic') { const rel = T.spell(r, '6'); link('minor-pentatonic', rel, `Same notes as ${rel} minor pentatonic`); link('major-blues', r, `${r} major blues`); }
    if (scale.id === 'blues') link('minor-pentatonic', r, `${r} minor pentatonic without the ♭5`);
    if (['minor', 'harmonic-minor', 'melodic-minor'].includes(scale.id)) for (const id of ['minor', 'harmonic-minor', 'melodic-minor'].filter(x => x !== scale.id)) link(id, r, `${r} ${lowerName(T.scaleById(id).name)}`);
    // The key on the circle: a mode of the major scale points to its parent key, any other scale to the key that its third names.
    const keyRoot = parent && scale.id !== 'minor' ? parent : r;
    const keyMode = keyRoot === parent || scale.toneList.some(t => t.label === '3') ? 'major' : 'minor';
    out.push({ href: `library/keys/${rootSlug(rootForLink(keyRoot))}/${keyMode}`, text: `${keyRoot} ${keyMode} on the circle of fifths` });
    return out;
  }

  // ---------- chords ----------
  const chordsView = {
    parse(p) {
      const chord = T.chordById(p[0]) || T.chordById('major');
      return { chord, root: rootFromSlug(p[1]) || 'C', shape: p[2] || null };
    },
    link: s => `library/chords/${s.chord.id}/${rootSlug(s.root)}${s.shape ? '/' + s.shape : ''}`,
    // Open chords link to their shape: open C is the C shape, open Cmaj7 is the open shape.
    openChords() {
      const openLink = c => {
        const shapes = T.chordShapes(c.root, c.chord);
        const match = shapes.find(s => s.frets.every((f, i) => f === c.frets[i]));
        return '#/' + chordsView.link({ chord: T.chordById(c.chord), root: c.root, shape: match ? match.id : null });
      };
      return h('div', { class: 'chips' }, T.OPEN_CHORDS.filter(c => c.chord !== 'power').map(c => h('a', { class: 'chip', href: openLink(c) }, T.chordName(c.root, T.chordById(c.chord)))));
    },
    title: s => T.chordName(s.root, s.chord),
    render(state) {
      const { chord, root: r } = state;
      const tones = T.tonesOn(r, chord);
      const shapes = T.chordShapes(r, chord.id, GT.tuning());
      // Major and minor chords open on the CAGED map: the five shapes over the whole neck.
      const caged = shapes.some(s => s.id.startsWith('caged-'));
      const want = state.shape || (caged ? 'caged' : null);
      const shape = want === 'neck' || want === 'caged' ? null : shapes.find(s => s.id.toLowerCase() === String(want).toLowerCase()) || shapes[0] || null;
      const showMap = caged && want === 'caged';
      const map = caged ? T.cagedMap(r, chord.id, settings.frets) : [];
      const placesOf = sh => sh.frets.map((f, s) => f === null ? null : { string: s, fret: f }).filter(Boolean);
      const cap = caption();
      let markers;
      const extra = {};
      if (showMap) {
        // A note that two shapes use gets a ring: that is where the shapes join.
        const uses = new Map();
        for (const sh of map) for (const p of placesOf(sh)) uses.set(`${p.string}:${p.fret}`, (uses.get(`${p.string}:${p.fret}`) || 0) + 1);
        markers = toneMarkers(tones).map(m => { const n = uses.get(`${m.string}:${m.fret}`); return n ? Object.assign(m, { ring: n > 1 }) : Object.assign(m, { kind: 'ghost' }); });
        extra.regions = map.map(sh => ({ points: placesOf(sh), label: sh.shape, cls: 'shape-' + sh.shape }));
      } else if (shape) {
        // One shape: lines join its notes, and the outlines of the shapes before and after it show where it connects.
        const at = map.findIndex(sh => sh.frets.every((f, k) => f === shape.frets[k]));
        const near = at < 0 ? [] : [map[at - 1], map[at + 1]].filter(Boolean);
        const shared = new Set(near.flatMap(n => T.sharedPlaces(shape, n)));
        markers = toneMarkers(tones).map(m => shape.frets[m.string] === m.fret ? Object.assign(m, { ring: shared.has(`${m.string}:${m.fret}`) }) : Object.assign(m, { kind: 'ghost' }));
        extra.links = [{ points: placesOf(shape), cls: 'is-shape' }];
        if (at >= 0) extra.regions = near.map(n => ({ points: placesOf(n), label: n.shape, cls: 'is-near shape-' + n.shape })).concat({ points: placesOf(shape), label: map[at].shape, cls: 'is-current shape-' + map[at].shape });
        if (shape.low > 0) extra.dimOutside = [shape.low, shape.high];
        extra.muted = shape.frets.map((f, s) => f === null ? s : null).filter(s => s !== null);
      } else markers = toneMarkers(tones);
      const strum = () => A.notes(shape ? shapeMidis(shape.frets) : chordMidis(r, chord), 'strum');
      const arpeggio = () => A.notes(shape ? shapeMidis(shape.frets) : chordMidis(r, chord), 'up', 0.28, 0.5);
      const shapeOptions = (caged ? [['caged', 'All five']] : []).concat([['neck', 'Whole neck']], shapes.map(s => [s.id, s.name]));
      const current = showMap ? 'caged' : shape ? shape.id : 'neck';
      const atShape = shape && map.findIndex(sh => sh.frets.every((f, k) => f === shape.frets[k]));
      const mapNote = showMap ? 'Five shapes cover the neck, and each one overlaps the next. A ringed note belongs to two shapes: that is where they join. Pick a shape to see it alone.'
        : shape && caged && atShape >= 0 ? `Lines join the notes of the ${shape.name}. The outlines beside it are the ${[map[atShape - 1], map[atShape + 1]].filter(Boolean).map(n => n.shape + ' shape').join(' and the ')}, and the ringed notes are the ones they share.` : null;
      const out = [
        h('div', { class: 'lib-title' }, h('div', null, h('h1', null, chordsView.title(state)), h('p', { class: 'muted lib-sub' }, `${r} ${lowerName(chord.name)}`)),
          h('div', { class: 'row' }, playButton('Strum', strum), playButton('Arpeggio', arpeggio))),
        h('div', { class: 'formula' }, tones.map(t => h('div', { class: 'tone', style: 'cursor:default' }, h('i', { class: 'swatch', style: `background:var(--${FB.degreeKind(t.label)})` }), h('b', null, lib.labels === 'notes' ? t.name : t.label), h('span', null, lib.labels === 'notes' ? t.label : t.name)))),
        controls(
          rootCtl(state, chordsView),
          ctl('Chord', pickList('Chord', T.CHORD_GROUPS.map(g => ({ name: g.name, items: g.items.map(i => [i.id, `${i.name} (${r}${i.symbol})`]) })), chord.id, v => GT.go(chordsView.link({ chord: T.chordById(v), root: r }), true))),
          shapes.length ? ctl('Shape', GT.segmented('Shape', shapeOptions, current, v => GT.go(chordsView.link(Object.assign({}, state, { shape: v })), true))) : null,
          labelsSeg(rerender),
          fretsSeg(rerender)),
        neck(markers, Object.assign({ onPress: pressPlayer(cap, describeNote(tones)), label: `${chordsView.title(state)} on the neck` }, extra)),
        cap,
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' }, legend(kindsOf(tones)), mapNote ? h('p', { class: 'small muted', style: 'max-width:60ch' }, mapNote) : null)
      ];
      if (shapes.length) {
        out.push(section(CAGEDnote(chord) ? 'The five CAGED shapes' : 'Shapes', CAGEDnote(chord),
          h('div', { class: 'cards' }, shapes.map(s => {
            const m = s.frets.map((f, i) => f === null ? null : (() => {
              const t = tones.find(x => x.pc === T.mod(GT.tuning()[i] + f));
              return { string: i, fret: f, label: lib.labels === 'notes' ? t.name : t.label, kind: FB.degreeKind(t.label) };
            })()).filter(Boolean);
            const mutedStrings = s.frets.map((f, i) => f === null ? i : null).filter(i => i !== null);
            return h('a', { class: 'card', href: '#/' + chordsView.link(Object.assign({}, state, { shape: s.id })), style: 'text-decoration:none;color:inherit', 'aria-current': String(!!shape && shape.id === s.id) },
              h('h3', null, s.name), h('p', null, s.low === 0 ? 'Open position' : `Frets ${s.low}–${s.high}`),
              miniNeck(m, s.low, s.high, `${s.name} of ${chordsView.title(state)}`, mutedStrings, { links: [{ points: placesOf(s), cls: 'is-shape' }] }));
          }))));
      }
      out.push(section('Open chords', 'The chords in the first frets. A chord that is also a CAGED shape opens as that shape.', chordsView.openChords()));
      return out;
    }
  };
  const CAGEDnote = chord => ['major', 'minor'].includes(chord.id) ? 'Each shape is an open chord moved up the neck. In order up the neck they repeat C, A, G, E, D. Neighbor shapes share notes, so the five join into one map of the neck.' : null;

  // ---------- intervals ----------
  const intervalsView = {
    parse(p) {
      const interval = T.INTERVALS.find(i => i.id === p[0]) || T.INTERVALS.find(i => i.id === 'P5');
      return { interval, root: rootFromSlug(p[1]) || 'C' };
    },
    link: s => `library/intervals/${s.interval.id}/${rootSlug(s.root)}`,
    title: s => s.interval.name,
    render(state) {
      const { interval, root: r } = state;
      const label = interval.semi === 12 ? '8' : interval.label;
      const target = T.spell(r, interval.semi === 12 ? '8' : interval.semi === 6 ? '♭5' : label);
      const tones = [{ label: '1', name: r, pc: T.pcOf(r) }, { label, name: target, pc: T.mod(T.pcOf(r) + interval.semi) }];
      if (interval.semi === 0 || interval.semi === 12) tones.pop();
      const cap = caption();
      const base = 48 + T.mod(T.pcOf(r) - 48);
      const inv = T.INTERVALS.find(i => i.semi === 12 - interval.semi);
      const songs = T.INTERVAL_SONGS[interval.semi] || {};
      const out = [
        h('div', { class: 'lib-title' }, h('div', null, h('h1', null, interval.name), h('p', { class: 'muted lib-sub' }, `${r} to ${target}: ${interval.semi} ${interval.semi === 1 ? 'semitone' : 'semitones'} (frets on one string). Turned upside down it is ${inv ? (/^[aeiou]/i.test(inv.name) ? 'an ' : 'a ') + inv.name.toLowerCase() : 'a unison'}.`)),
          h('div', { class: 'row' }, playButton('Up', () => A.notes([base, base + interval.semi], 'up')), playButton('Down', () => A.notes([base, base + interval.semi], 'down')), playButton('Together', () => A.notes([base, base + interval.semi], 'together')))),
        controls(
          rootCtl(state, intervalsView),
          ctl('Interval', h('nav', { class: 'chips', 'aria-label': 'Interval' }, T.INTERVALS.map(i => h('a', { class: 'chip', href: '#/' + intervalsView.link({ interval: i, root: r }), 'aria-current': String(i.id === interval.id), title: i.name }, i.short))), 'ctl-wide'),
          labelsSeg(rerender), fretsSeg(rerender)),
        neck(toneMarkers(tones), { onPress: pressPlayer(cap, describeNote(tones)), label: `${interval.name} from ${r}` }),
        cap,
        songs.up || songs.down ? section('Songs that start with it', 'A song you know makes the sound easy to recall. Sing the start of it, then check with the buttons above.',
          h('dl', { class: 'facts' }, songs.up ? [h('dt', null, 'Going up'), h('dd', null, songs.up)] : null, songs.down ? [h('dt', null, 'Going down'), h('dd', null, songs.down)] : null)) : null,
        section('Shapes on the neck', 'Where the upper note sits when you start on one string. The B string is tuned a semitone lower than the pattern, so shapes that cross it move one fret up.', intervalShapes(interval.semi))
      ];
      return out;
    }
  };
  function intervalShapes(semi) {
    const t = T.STANDARD, rows = [];
    const seen = new Set();
    for (let d = 0; d <= 3; d++) for (let s = 0; s + d <= 5; s++) {
      const offset = semi - (t[s + d] - t[s]);
      if (offset < -4 || offset > 5) continue;
      const crosses = s < 4 && s + d >= 4;
      const key = `${d}:${offset}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const where = d === 0 ? 'Same string' : `${d} string${d > 1 ? 's' : ''} higher`;
      const move = offset === 0 ? 'same fret' : offset > 0 ? `${offset} fret${offset > 1 ? 's' : ''} up` : `${-offset} fret${offset < -1 ? 's' : ''} down`;
      rows.push(h('tr', null, h('td', null, where), h('td', null, move), h('td', { class: 'muted' }, d === 0 ? '' : crosses ? 'when the shape crosses the B string' : 'when it does not cross the B string')));
    }
    return h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Upper note'), h('th', null, 'Move'), h('th', null, 'Applies'))), h('tbody', null, rows));
  }

  // ---------- triads ----------
  const TRIAD_QUALITIES = ['major', 'minor', 'dim', 'aug'];
  const triadsView = {
    parse(p) {
      return { quality: TRIAD_QUALITIES.includes(p[0]) ? p[0] : 'major', root: rootFromSlug(p[1]) || 'C', set: T.TRIAD_SETS.some(s => s.id === p[2]) ? p[2] : '123' };
    },
    link: s => `library/triads/${s.quality}/${rootSlug(s.root)}/${s.set}`,
    title: s => `${T.chordName(s.root, T.chordById(s.quality))} triads`,
    render(state) {
      const chord = T.chordById(state.quality), r = state.root;
      const tones = T.tonesOn(r, chord);
      const set = T.TRIAD_SETS.find(s => s.id === state.set);
      const voicings = T.triadVoicings(r, state.quality, state.set, GT.tuning(), settings.frets);
      const cap = caption();
      const onSet = (s) => set.strings.includes(s);
      const out = [
        h('div', { class: 'lib-title' }, h('div', null, h('h1', null, triadsView.title(state)), h('p', { class: 'muted lib-sub' }, `${tones.map(t => t.name).join(' ')} (${tones.map(t => t.label).join(' ')}) on ${set.name.toLowerCase()}`)),
          h('div', { class: 'row' }, playButton('Play', () => A.notes(chordMidis(r, chord), 'strum')))),
        controls(
          rootCtl(state, triadsView),
          ctl('Quality', GT.segmented('Quality', TRIAD_QUALITIES.map(q => [q, { major: 'Major', minor: 'Minor', dim: 'Dim', aug: 'Aug' }[q]]), state.quality, v => GT.go(triadsView.link(Object.assign({}, state, { quality: v })), true))),
          ctl('Strings', GT.segmented('String set', T.TRIAD_SETS.map(s => [s.id, s.id.split('').reverse().join('–')]), state.set, v => GT.go(triadsView.link(Object.assign({}, state, { set: v })), true))),
          labelsSeg(rerender), fretsSeg(rerender)),
        neck(toneMarkers(tones, { only: s => onSet(s) }), { onPress: pressPlayer(cap, describeNote(tones)), label: `${triadsView.title(state)} on ${set.name}` }),
        cap,
        legend(kindsOf(tones)),
        section('Inversions', 'The same three notes with a different note in the bass. Tap a card to hear it. Up the neck the order repeats: root position, first inversion, second inversion.',
          h('div', { class: 'cards' }, voicings.map((list, inversion) => {
            const v = list[0];
            if (!v) return null;
            const markers = v.frets.map((f, i) => {
              const t = tones.find(x => x.pc === T.mod(GT.tuning()[v.strings[i]] + f));
              return { string: v.strings[i], fret: f, label: lib.labels === 'notes' ? t.name : t.label, kind: FB.degreeKind(t.label) };
            });
            const midis = v.frets.map((f, i) => GT.tuning()[v.strings[i]] + f);
            const low = Math.min(...v.frets), high = Math.max(...v.frets);
            return h('button', { type: 'button', class: 'card', onclick: () => A.notes(midis, 'strum') },
              h('h3', null, T.INVERSIONS[inversion]), h('p', null, `${v.tones[0]} in the bass, frets ${low}–${high}`), miniNeck(markers, low, high, `${T.INVERSIONS[inversion]}`));
          })))
      ];
      return out;
    }
  };

  // ---------- keys and the circle of fifths ----------
  const KEY_NAMES = T.CIRCLE.flatMap(k => [k, k.alt].filter(Boolean));
  const keysView = {
    parse(p) {
      const mode = p[1] === 'minor' ? 'minor' : 'major';
      const name = rootFromSlug(p[0]) || (mode === 'minor' ? 'A' : 'C');
      const entry = KEY_NAMES.find(k => (mode === 'major' ? k.major : k.minor) === name) || KEY_NAMES.find(k => T.pcOf(mode === 'major' ? k.major : k.minor) === T.pcOf(name));
      return { mode, key: mode === 'major' ? entry.major : entry.minor, entry };
    },
    link: s => `library/keys/${rootSlug(s.key)}/${s.mode}`,
    title: s => `${s.key} ${s.mode}`,
    render(state) {
      const { key, mode, entry } = state;
      const scale = T.scaleById(mode === 'major' ? 'major' : 'minor');
      const tones = T.tonesOn(key, scale);
      const triads = T.diatonic(key, mode), sevenths = T.diatonic(key, mode, true);
      const cells = T.keyCells(key, mode);
      const circle = circleOfFifths(state, cells);
      // Hovering or focusing a chord marks it on the circle.
      const mark = i => ({ onmouseenter: () => circle.hot(cells[i]), onfocus: () => circle.hot(cells[i]), onmouseleave: () => circle.hot(null), onblur: () => circle.hot(null) });
      const idx = T.CIRCLE.findIndex(k => k === entry || k.alt === entry);
      const relName = mode === 'major' ? entry.minor : entry.major;
      const next = T.CIRCLE[(idx + 1) % 12], prev = T.CIRCLE[(idx + 11) % 12];
      const pick = k => mode === 'major' ? k.major : k.minor;
      const keyLink = (name, m) => h('a', { href: '#/' + keysView.link({ key: name, mode: m }) }, `${name} ${m}`);
      const playChord = (c, prevVoicing) => {
        const pcs = c.chord.toneList.map(t => T.mod(c.pc + t.semi));
        const v = T.voiceLead(pcs, prevVoicing);
        A.notes([36 + T.mod(c.pc - 36)].concat(v), 'strum');
        return v;
      };
      const progressions = mode === 'major'
        ? [['I–IV–V–I', [1, 4, 5, 1]], ['I–V–vi–IV', [1, 5, 6, 4]], ['ii–V–I', [2, 5, 1]], ['I–vi–IV–V', [1, 6, 4, 5]], ['vi–IV–I–V', [6, 4, 1, 5]]]
        : [['i–iv–v–i', [1, 4, 5, 1]], ['i–♭VI–♭III–♭VII', [1, 6, 3, 7]], ['i–♭VII–♭VI–♭VII', [1, 7, 6, 7]], ['ii°–v–i', [2, 5, 1]]];
      const playProgression = degrees => {
        A.silence();
        let v = null;
        const chords = degrees.map(d => { const c = triads[d - 1]; const pcs = c.chord.toneList.map(t => T.mod(c.pc + t.semi)); v = T.voiceLead(pcs, v); return [36 + T.mod(c.pc - 36)].concat(v); });
        A.chordSequence(chords, 84, 2);
        // Each chord lights up on the circle while it plays.
        const each = 60 / 84 * 2 * 1000;
        degrees.forEach((d, i) => A.later(() => circle.hot(cells[d - 1]), i * each));
        A.later(() => circle.hot(null), degrees.length * each);
      };
      const keyOf = (k, m) => m === 'major' ? k.major : k.minor;
      const details = h('div', null,
        h('h1', null, keysView.title(state)),
        controls(
          ctl('Key', pickList('Key', [{ name: mode === 'major' ? 'Major keys' : 'Minor keys', items: KEY_NAMES.map(k => [keyOf(k, mode), `${keyOf(k, mode)} ${mode}${k.count ? ` (${sigText(k.count, true)})` : ''}`]) }], key, v => GT.go(keysView.link({ key: v, mode }), true))),
          ctl('Mode', GT.segmented('Mode', [['major', 'Major'], ['minor', 'Minor']], mode, v => GT.go(keysView.link({ key, mode: v }), true)))),
        h('dl', { class: 'facts', style: 'margin-top:14px' },
          h('dt', null, 'Key signature'), h('dd', null, sigText(entry.count)),
          h('dt', null, mode === 'major' ? 'Relative minor' : 'Relative major'), h('dd', null, keyLink(relName, mode === 'major' ? 'minor' : 'major'), ', same notes'),
          h('dt', null, 'One fifth up'), h('dd', null, keyLink(pick(next), mode), ', one step clockwise'),
          h('dt', null, 'One fifth down'), h('dd', null, keyLink(pick(prev), mode), ', one step counterclockwise')),
        h('div', { class: 'lib-section', style: 'margin-top:20px' }, h('h2', null, 'Scale'),
          h('div', { class: 'formula' }, tones.map(t => h('button', { type: 'button', class: 'tone', onclick: () => A.note(48 + T.mod(T.pcOf(key) - 48) + t.semi) }, h('b', null, t.name), h('span', null, t.label)))),
          h('p', { style: 'margin-top:10px' }, h('a', { href: `#/library/scales/${scale.id}/${rootSlug(rootForLink(key))}` }, `Show ${key} ${lowerName(scale.name)} on the neck`))),
        h('div', { class: 'lib-section' }, h('h2', null, 'Chords in the key'), h('p', null, 'Tap a chord to hear it.'),
          h('div', { class: 'chord-row' }, triads.map((c, i) => h('button', Object.assign({ type: 'button', class: 'chord-btn', onclick: () => playChord(c) }, mark(i)), h('small', null, c.roman), h('b', null, c.name)))),
          h('div', { class: 'chord-row', style: 'margin-top:8px' }, sevenths.map((c, i) => h('button', Object.assign({ type: 'button', class: 'chord-btn', onclick: () => playChord(c) }, mark(i)), h('small', null, c.roman), h('b', null, c.name)))),
          mode === 'minor' ? h('p', { class: 'small muted', style: 'margin-top:10px' }, `Songs in minor keys often make v a major chord (${T.spell(key, '5')}), borrowed from the harmonic minor.`) : null),
        h('div', { class: 'lib-section' }, h('h2', null, 'Common progressions'),
          h('table', { class: 'table' }, h('tbody', null, progressions.map(([name, degrees]) => h('tr', null,
            h('td', null, name), h('td', null, degrees.map(d => triads[d - 1].name).join('  ')),
            h('td', { style: 'text-align:right' }, h('button', { type: 'button', class: 'btn', onclick: () => playProgression(degrees) }, '▶ Play'))))))));
      const note = h('p', { class: 'circle-note' }, `The frame holds the seven chords of ${key} ${mode}. Clockwise is a fifth up. Tap a key to open it.`);
      return [h('div', { class: 'circle-wrap' }, h('div', null, circle, note), details)];
    }
  };
  function sigText(count, short) {
    if (count === 0) return short ? 'none' : 'No sharps or flats';
    const list = T.signature(count);
    if (short) return `${Math.abs(count)}${count > 0 ? '♯' : '♭'}`;
    return `${Math.abs(count)} ${count > 0 ? 'sharp' : 'flat'}${Math.abs(count) > 1 ? 's' : ''}: ${list.join(' ')}`;
  }
  // Sharps (plus) or flats (minus) in the major scale of a key name, also for names such as C♭.
  const sigCount = name => T.tonesOn(name, T.scaleById('major')).reduce((n, t) => n + (t.name.match(/♯/g) || []).length - (t.name.match(/♭/g) || []).length, 0);
  // Three rings: major keys, their relative minors, and the vii° of the major key at each position.
  // A frame holds the seven chords of the selected key, each with its Roman numeral.
  function circleOfFifths(state, cells) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-212 -212 424 424');
    svg.setAttribute('class', 'circle');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', `Circle of fifths with the chords of ${state.key} ${state.mode} in a frame. Clockwise is a fifth up.`);
    const el = (name, attrs, parent) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); (parent || svg).appendChild(n); return n; };
    const STEP = Math.PI / 6;
    const RINGS = { major: [148, 208, 178], minor: [100, 148, 124], dim: [62, 100, 81] };
    const pt = (r, a) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
    const arc = (r1, r2, a1, a2) => `M ${pt(r2, a1)} A ${r2} ${r2} 0 0 1 ${pt(r2, a2)} L ${pt(r1, a2)} A ${r1} ${r1} 0 0 0 ${pt(r1, a1)} Z`;
    const tonic = cells[0];
    const inKey = new Map(cells.map(c => [`${c.ring}:${c.pos}`, c]));
    const paths = new Map();
    // Text lines per ring: numeral, name, signature (offsets from the middle of the cell).
    const LAYOUT = { major: [[null, 2, 19], [-14, 5, 20]], minor: [[null, 5], [-7, 10]], dim: [[null, 4], [-5, 9]] };
    T.CIRCLE.forEach((k, i) => {
      const a = i * STEP;
      for (const ring of ['major', 'minor', 'dim']) {
        const c = inKey.get(`${ring}:${i}`);
        const [r1, r2, mid] = RINGS[ring];
        const d = arc(r1, r2, a - STEP / 2, a + STEP / 2);
        paths.set(`${ring}:${i}`, d);
        const g = el('g', { class: `cell ring-${ring}${c ? ' in-key' : ''}${c === tonic ? ' is-tonic' : ''}` });
        el('path', { d }, g);
        const x = (mid * Math.sin(a)).toFixed(1), y = -mid * Math.cos(a);
        const text = (cls, dy, value) => { el('text', { x, y: (y + dy).toFixed(1), class: cls }, g).textContent = value; };
        const [numY, nameY, sigY] = LAYOUT[ring][c ? 1 : 0];
        if (c) text('t-num', numY, c.roman);
        text('t-name', nameY, c ? c.name : ring === 'major' ? (k.alt ? `${k.major}/${k.alt.major}` : k.major) : ring === 'minor' ? `${k.minor}m` : `${T.spell(k.major, '7')}°`);
        // Keys such as G♯ major (8♯) exist only in theory, so their cell shows no signature.
        if (ring === 'major' && !(c && Math.abs(sigCount(c.root)) > 7)) text('t-sig', sigY, c ? sigText(sigCount(c.root), true) : k.alt ? `${sigText(k.count, true)}/${sigText(k.alt.count, true)}` : sigText(k.count, true));
        if (ring === 'dim') continue;
        // Diminished chords are not keys. Major and minor cells open their key.
        const pick = e => ring === 'major' ? e.major : e.minor;
        const entry = c && k.alt && pick(k.alt) === c.root ? k.alt : k;
        const target = pick(entry);
        g.setAttribute('role', 'link');
        g.setAttribute('tabindex', '0');
        g.setAttribute('aria-label', `${target} ${ring}${c ? `, ${c.roman} in ${state.key} ${state.mode}` : ''}, ${sigText(entry.count)}`);
        const open = () => GT.go(keysView.link({ key: target, mode: ring }));
        g.addEventListener('click', open);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      }
    });
    el('circle', { r: 60, class: 'hub' });
    el('text', { y: 4, class: 't-hub' }).textContent = state.key;
    el('text', { y: 24, class: 't-hub-sub' }).textContent = state.mode;
    const A = steps => (tonic.pos + steps) * STEP;
    el('path', { class: 'key-frame', d: `M ${pt(208, A(-1.5))} A 208 208 0 0 1 ${pt(208, A(1.5))} L ${pt(100, A(1.5))} A 100 100 0 0 0 ${pt(100, A(0.5))} L ${pt(62, A(0.5))} A 62 62 0 0 0 ${pt(62, A(-0.5))} L ${pt(100, A(-0.5))} A 100 100 0 0 0 ${pt(100, A(-1.5))} Z` });
    // Marks one chord of the key, for example while it plays.
    const hot = el('path', { class: 'hot', visibility: 'hidden' });
    svg.hot = c => {
      if (!c) { hot.setAttribute('visibility', 'hidden'); return; }
      hot.setAttribute('d', paths.get(`${c.ring}:${c.pos}`));
      hot.setAttribute('visibility', 'visible');
    };
    return svg;
  }

  // ---------- notes ----------
  const notesView = {
    parse(p) { return { mode: ['all', 'naturals'].includes(p[0]) ? p[0] : rootFromSlug(p[0]) ? 'one' : 'naturals', note: rootFromSlug(p[0]) || null }; },
    link: s => `library/notes/${s.mode === 'one' ? rootSlug(s.note) : s.mode}`,
    title: s => s.mode === 'one' ? `Every ${s.note} on the neck` : 'Notes on the neck',
    render(state) {
      const cap = caption();
      const tuning = GT.tuning();
      const markers = [];
      for (let s = 0; s < 6; s++) for (let f = 0; f <= settings.frets; f++) {
        const pc = T.mod(tuning[s] + f), name = T.PC_PLAIN[pc];
        if (state.mode === 'naturals' && name.length > 1) continue;
        if (state.mode === 'one' && pc !== T.pcOf(state.note)) continue;
        markers.push({ string: s, fret: f, label: name, kind: state.mode === 'one' ? 'root' : name.length > 1 ? 'ghost' : 'other' });
      }
      return [
        h('div', { class: 'lib-title' }, h('h1', null, notesView.title(state))),
        controls(
          ctl('Show', h('nav', { class: 'chips roots', 'aria-label': 'Note' },
            [['naturals', 'Naturals'], ['all', 'All']].map(([m, t]) => h('a', { class: 'chip', href: '#/' + notesView.link({ mode: m }), 'aria-current': String(state.mode === m) }, t)),
            T.PC_PLAIN.map(n => h('a', { class: 'chip', href: '#/' + notesView.link({ mode: 'one', note: n }), 'aria-current': String(state.mode === 'one' && T.pcOf(state.note) === T.pcOf(n)) }, n))), 'ctl-wide'),
          fretsSeg(rerender)),
        neck(markers, { onPress: pressPlayer(cap, describeNote(null)), label: notesView.title(state) }),
        cap,
        section('Ways to remember', null, h('dl', { class: 'facts' },
          h('dt', null, 'Octave shape'), h('dd', null, 'Two strings higher and two frets up. Across the B string it is three frets up.'),
          h('dt', null, 'Fret 12'), h('dd', null, 'Every string starts again: the notes repeat 12 frets higher.'),
          h('dt', null, 'Fret 5'), h('dd', null, 'Fret 5 of one string is the next open string. On the G string it is fret 4.'),
          h('dt', null, 'Half steps'), h('dd', null, 'B to C and E to F are one fret apart. All other natural notes are two frets apart.')))
      ];
    }
  };

  const VIEWS = { scales: scalesView, chords: chordsView, intervals: intervalsView, triads: triadsView, keys: keysView, notes: notesView };
  let rerender = () => {};

  function render(main, parts) {
    const tab = VIEWS[parts[0]] ? parts[0] : 'scales';
    const view = VIEWS[tab];
    const state = view.parse(parts.slice(1));
    rerender = () => render(main, parts);
    main.replaceChildren();
    // Section tabs. A section with roots opens on the root you look at now.
    const tabLink = id => {
      const target = VIEWS[id], base = target.parse([]);
      return '#/' + (state.root && base.root ? target.link(Object.assign(base, { root: state.root })) : 'library/' + id);
    };
    const tabs = h('nav', { class: 'lib-tabs', 'aria-label': 'Library sections' }, TABS.map(([id, name]) => h('a', { href: tabLink(id), 'aria-current': String(id === tab) }, name)));
    const body = h('div', { class: 'lib-main' }, view.render(state));
    main.append(h('div', { class: 'lib' }, tabs, body));
    // On a phone the root row scrolls sideways: bring the chosen root to the middle.
    const chosen = body.querySelector('.roots [aria-current="true"]');
    if (chosen) { const row = chosen.parentNode; row.scrollLeft += chosen.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - chosen.offsetWidth) / 2; }
    document.title = `${view.title(state)} · ${GT.siteName}`;
    lastRender = rerender;
  }

  GT.route('library', { render, resize: () => lastRender && lastRender() });
  GT.library = { lowerName };
})(window);
