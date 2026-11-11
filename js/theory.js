/* Music theory core: note spelling, scales, chords, keys, guitar shapes.
   Plain script: it defines window.GT.theory, and module.exports under Node for the tests. */
(function (root) {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const SHARP = '♯', FLAT = '♭';
  const mod = (n, m = 12) => ((n % m) + m) % m;

  // Root names offered in pickers. Enharmonic pairs stay separate, so the spelling follows the choice.
  const ROOTS = ['C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B'];
  const PC_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const PC_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  // One name per pitch class for places with no key context (ear training, the note map).
  const PC_PLAIN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  function accidentalText(n) {
    return n > 0 ? SHARP.repeat(n) : FLAT.repeat(-n);
  }
  function parseNote(name) {
    const letter = name[0].toUpperCase();
    let acc = 0;
    for (const ch of name.slice(1)) { if (ch === SHARP || ch === '#') acc++; else if (ch === FLAT || ch === 'b') acc--; }
    return { letter, acc, pc: mod(LETTER_PC[letter] + acc) };
  }
  const pcOf = name => parseNote(name).pc;
  const pcName = (pc, flats = false) => (flats ? PC_FLAT : PC_SHARP)[mod(pc)];

  // A degree label such as "1", "♭3", "♯11" or "♭♭7".
  function parseDegree(label) {
    let i = 0, acc = 0;
    while (label[i] === FLAT || label[i] === SHARP) { acc += label[i] === SHARP ? 1 : -1; i++; }
    const num = Number(label.slice(i));
    const step = mod(num - 1, 7);
    const semi = MAJOR_STEPS[step] + 12 * Math.floor((num - 1) / 7) + acc;
    return { label, num, step, acc, semi };
  }
  // The note name of a degree above a root, spelled from the root letter.
  function spell(rootName, degreeLabel) {
    const r = parseNote(rootName), d = parseDegree(degreeLabel);
    const letter = LETTERS[mod(LETTERS.indexOf(r.letter) + d.step, 7)];
    const pc = mod(r.pc + d.semi);
    const acc = mod(pc - LETTER_PC[letter] + 6) - 6;
    return letter + accidentalText(acc);
  }

  const INTERVALS = [
    { id: 'P1', semi: 0, label: '1', name: 'Unison', short: 'P1' },
    { id: 'm2', semi: 1, label: '♭2', name: 'Minor 2nd', short: 'm2' },
    { id: 'M2', semi: 2, label: '2', name: 'Major 2nd', short: 'M2' },
    { id: 'm3', semi: 3, label: '♭3', name: 'Minor 3rd', short: 'm3' },
    { id: 'M3', semi: 4, label: '3', name: 'Major 3rd', short: 'M3' },
    { id: 'P4', semi: 5, label: '4', name: 'Perfect 4th', short: 'P4' },
    { id: 'TT', semi: 6, label: '♭5', name: 'Tritone', short: 'TT' },
    { id: 'P5', semi: 7, label: '5', name: 'Perfect 5th', short: 'P5' },
    { id: 'm6', semi: 8, label: '♭6', name: 'Minor 6th', short: 'm6' },
    { id: 'M6', semi: 9, label: '6', name: 'Major 6th', short: 'M6' },
    { id: 'm7', semi: 10, label: '♭7', name: 'Minor 7th', short: 'm7' },
    { id: 'M7', semi: 11, label: '7', name: 'Major 7th', short: 'M7' },
    { id: 'P8', semi: 12, label: '8', name: 'Octave', short: 'P8' }
  ];
  const intervalBySemi = semi => INTERVALS.find(i => i.semi === semi);

  const SCALE_GROUPS = [
    { id: 'major-modes', name: 'Major scale and its modes', items: [
      { id: 'major', name: 'Major (Ionian)', tones: '1 2 3 4 5 6 7' },
      { id: 'dorian', name: 'Dorian', tones: '1 2 ♭3 4 5 6 ♭7' },
      { id: 'phrygian', name: 'Phrygian', tones: '1 ♭2 ♭3 4 5 ♭6 ♭7' },
      { id: 'lydian', name: 'Lydian', tones: '1 2 3 ♯4 5 6 7' },
      { id: 'mixolydian', name: 'Mixolydian', tones: '1 2 3 4 5 6 ♭7' },
      { id: 'minor', name: 'Natural minor (Aeolian)', tones: '1 2 ♭3 4 5 ♭6 ♭7' },
      { id: 'locrian', name: 'Locrian', tones: '1 ♭2 ♭3 4 ♭5 ♭6 ♭7' }
    ] },
    { id: 'pentatonic', name: 'Pentatonic and blues', items: [
      { id: 'minor-pentatonic', name: 'Minor pentatonic', tones: '1 ♭3 4 5 ♭7' },
      { id: 'major-pentatonic', name: 'Major pentatonic', tones: '1 2 3 5 6' },
      { id: 'blues', name: 'Blues', tones: '1 ♭3 4 ♭5 5 ♭7' },
      { id: 'major-blues', name: 'Major blues', tones: '1 2 ♭3 3 5 6' }
    ] },
    { id: 'minor-family', name: 'Harmonic and melodic', items: [
      { id: 'harmonic-minor', name: 'Harmonic minor', tones: '1 2 ♭3 4 5 ♭6 7' },
      { id: 'melodic-minor', name: 'Melodic minor', tones: '1 2 ♭3 4 5 6 7' },
      { id: 'phrygian-dominant', name: 'Phrygian dominant', tones: '1 ♭2 3 4 5 ♭6 ♭7' },
      { id: 'lydian-dominant', name: 'Lydian dominant', tones: '1 2 3 ♯4 5 6 ♭7' },
      { id: 'altered', name: 'Altered', tones: '1 ♭2 ♯2 3 ♭5 ♭6 ♭7' },
      { id: 'harmonic-major', name: 'Harmonic major', tones: '1 2 3 4 5 ♭6 7' }
    ] },
    { id: 'symmetric', name: 'Symmetric and other', items: [
      { id: 'whole-tone', name: 'Whole tone', tones: '1 2 3 ♯4 ♯5 ♭7' },
      { id: 'diminished-hw', name: 'Diminished, half-whole', tones: '1 ♭2 ♯2 3 ♯4 5 6 ♭7' },
      { id: 'diminished-wh', name: 'Diminished, whole-half', tones: '1 2 ♭3 4 ♭5 ♭6 6 7' },
      { id: 'double-harmonic', name: 'Double harmonic', tones: '1 ♭2 3 4 5 ♭6 7' },
      { id: 'hungarian-minor', name: 'Hungarian minor', tones: '1 2 ♭3 ♯4 5 ♭6 7' },
      { id: 'chromatic', name: 'Chromatic', tones: '1 ♭2 2 ♭3 3 4 ♭5 5 ♭6 6 ♭7 7' }
    ] }
  ];
  const CHORD_GROUPS = [
    { id: 'triads', name: 'Triads', items: [
      { id: 'major', name: 'Major', symbol: '', tones: '1 3 5' },
      { id: 'minor', name: 'Minor', symbol: 'm', tones: '1 ♭3 5' },
      { id: 'dim', name: 'Diminished', symbol: '°', tones: '1 ♭3 ♭5' },
      { id: 'aug', name: 'Augmented', symbol: '+', tones: '1 3 ♯5' },
      { id: 'sus2', name: 'Suspended 2nd', symbol: 'sus2', tones: '1 2 5' },
      { id: 'sus4', name: 'Suspended 4th', symbol: 'sus4', tones: '1 4 5' },
      { id: 'power', name: 'Power chord', symbol: '5', tones: '1 5' }
    ] },
    { id: 'sevenths', name: 'Seventh chords', items: [
      { id: 'maj7', name: 'Major 7th', symbol: 'maj7', tones: '1 3 5 7' },
      { id: '7', name: 'Dominant 7th', symbol: '7', tones: '1 3 5 ♭7' },
      { id: 'm7', name: 'Minor 7th', symbol: 'm7', tones: '1 ♭3 5 ♭7' },
      { id: 'm7b5', name: 'Half-diminished', symbol: 'm7♭5', tones: '1 ♭3 ♭5 ♭7' },
      { id: 'dim7', name: 'Diminished 7th', symbol: '°7', tones: '1 ♭3 ♭5 ♭♭7' },
      { id: 'mmaj7', name: 'Minor-major 7th', symbol: 'm(maj7)', tones: '1 ♭3 5 7' },
      { id: '7sus4', name: 'Dominant 7th sus4', symbol: '7sus4', tones: '1 4 5 ♭7' }
    ] },
    { id: 'altered', name: 'Altered', items: [
      { id: 'b5', name: 'Major flat 5', symbol: '(♭5)', tones: '1 3 ♭5' },
      { id: '7b5', name: 'Dominant 7th flat 5', symbol: '7♭5', tones: '1 3 ♭5 ♭7' },
      { id: 'augmaj7', name: 'Augmented major 7th', symbol: '+maj7', tones: '1 3 ♯5 7' }
    ] },
    { id: 'sixths-ext', name: 'Sixths and extensions', items: [
      { id: '6', name: 'Major 6th', symbol: '6', tones: '1 3 5 6' },
      { id: 'm6', name: 'Minor 6th', symbol: 'm6', tones: '1 ♭3 5 6' },
      { id: 'add9', name: 'Add 9', symbol: 'add9', tones: '1 3 5 9' },
      { id: '9', name: 'Dominant 9th', symbol: '9', tones: '1 3 5 ♭7 9' },
      { id: 'maj9', name: 'Major 9th', symbol: 'maj9', tones: '1 3 5 7 9' },
      { id: 'm9', name: 'Minor 9th', symbol: 'm9', tones: '1 ♭3 5 ♭7 9' }
    ] }
  ];

  function withTones(item) {
    const tones = item.tones.split(' ').map(parseDegree);
    return Object.assign({}, item, { toneList: tones });
  }
  const SCALES = [], CHORDS = [];
  for (const g of SCALE_GROUPS) g.items = g.items.map(i => { const s = withTones(Object.assign({ group: g.id }, i)); SCALES.push(s); return s; });
  for (const g of CHORD_GROUPS) g.items = g.items.map(i => { const c = withTones(Object.assign({ group: g.id }, i)); CHORDS.push(c); return c; });
  const scaleById = id => SCALES.find(s => s.id === id);
  const chordById = id => CHORDS.find(c => c.id === id);

  // Pitch classes of a scale or chord on a root, with labels and spelled names.
  function tonesOn(rootName, item) {
    const rootPc = pcOf(rootName);
    return item.toneList.map(t => ({ label: t.label, num: t.num, semi: t.semi, pc: mod(rootPc + t.semi), name: spell(rootName, t.label) }));
  }
  const chordName = (rootName, chord) => rootName + chord.symbol;

  // Tunings, low string first. MIDI numbers: E2 = 40.
  const TUNINGS = [
    { id: 'standard', name: 'Standard E A D G B E', midi: [40, 45, 50, 55, 59, 64] },
    { id: 'drop-d', name: 'Drop D', midi: [38, 45, 50, 55, 59, 64] },
    { id: 'half-down', name: 'Half step down', midi: [39, 44, 49, 54, 58, 63] },
    { id: 'dadgad', name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
    { id: 'open-g', name: 'Open G', midi: [38, 43, 50, 55, 59, 62] },
    { id: 'open-d', name: 'Open D', midi: [38, 45, 50, 54, 57, 62] }
  ];
  const STANDARD = TUNINGS[0].midi;
  const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

  // Circle of fifths, clockwise from C. Key names are the usual spellings.
  const CIRCLE = [
    { major: 'C', minor: 'A', count: 0 }, { major: 'G', minor: 'E', count: 1 }, { major: 'D', minor: 'B', count: 2 },
    { major: 'A', minor: 'F♯', count: 3 }, { major: 'E', minor: 'C♯', count: 4 }, { major: 'B', minor: 'G♯', count: 5 },
    { major: 'F♯', minor: 'D♯', count: 6, alt: { major: 'G♭', minor: 'E♭', count: -6 } },
    { major: 'D♭', minor: 'B♭', count: -5, alt: { major: 'C♯', minor: 'A♯', count: 7 } },
    { major: 'A♭', minor: 'F', count: -4 }, { major: 'E♭', minor: 'C', count: -3 },
    { major: 'B♭', minor: 'G', count: -2 }, { major: 'F', minor: 'D', count: -1 }
  ];
  const SHARP_ORDER = ['F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'E♯', 'B♯'];
  const FLAT_ORDER = ['B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭', 'F♭'];
  const signature = count => count >= 0 ? SHARP_ORDER.slice(0, count) : FLAT_ORDER.slice(0, -count);

  const ROMAN_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  const ROMAN_MINOR = ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'];
  const QUALITY_MAJOR = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'];
  const QUALITY_MINOR = ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major'];
  const SEVENTH_MAJOR = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
  // Diatonic chords of a major or natural minor key.
  function diatonic(keyName, mode = 'major', sevenths = false) {
    const scale = scaleById(mode === 'major' ? 'major' : 'minor');
    const quality = mode === 'major' ? QUALITY_MAJOR : QUALITY_MINOR;
    const roman = mode === 'major' ? ROMAN_MAJOR : ROMAN_MINOR;
    const seventh = mode === 'major' ? SEVENTH_MAJOR : SEVENTH_MAJOR.map((_, i) => SEVENTH_MAJOR[(i + 5) % 7]);
    return scale.toneList.map((t, i) => {
      const rootName = spell(keyName, t.label);
      const chord = chordById(sevenths ? seventh[i] : quality[i]);
      return { degree: i + 1, roman: roman[i], root: rootName, chord, name: chordName(rootName, chord), pc: mod(pcOf(keyName) + t.semi) };
    });
  }

  // Where the chords of a key sit on the circle of fifths. Ring 'major' holds the major keys,
  // 'minor' their relative minors and 'dim' the vii° of the major key at that position.
  // Position 0 is C at the top; each step clockwise is a fifth up.
  function keyCells(keyName, mode = 'major') {
    const shift = { major: 0, minor: 3, dim: 1 };
    return diatonic(keyName, mode).map(c => {
      const ring = c.chord.id === 'major' || c.chord.id === 'minor' ? c.chord.id : 'dim';
      return Object.assign({}, c, { ring, pos: mod((c.pc + shift[ring]) * 7) });
    });
  }

  // Open chord shapes, low E string first; null means the string is muted.
  const OPEN_CHORDS = [
    { root: 'C', chord: 'major', frets: [null, 3, 2, 0, 1, 0] },
    { root: 'A', chord: 'major', frets: [null, 0, 2, 2, 2, 0] },
    { root: 'G', chord: 'major', frets: [3, 2, 0, 0, 0, 3] },
    { root: 'E', chord: 'major', frets: [0, 2, 2, 1, 0, 0] },
    { root: 'D', chord: 'major', frets: [null, null, 0, 2, 3, 2] },
    { root: 'F', chord: 'major', frets: [1, 3, 3, 2, 1, 1], barre: 1 },
    { root: 'A', chord: 'minor', frets: [null, 0, 2, 2, 1, 0] },
    { root: 'E', chord: 'minor', frets: [0, 2, 2, 0, 0, 0] },
    { root: 'D', chord: 'minor', frets: [null, null, 0, 2, 3, 1] },
    { root: 'C', chord: '7', frets: [null, 3, 2, 3, 1, 0] },
    { root: 'A', chord: '7', frets: [null, 0, 2, 0, 2, 0] },
    { root: 'G', chord: '7', frets: [3, 2, 0, 0, 0, 1] },
    { root: 'E', chord: '7', frets: [0, 2, 0, 1, 0, 0] },
    { root: 'D', chord: '7', frets: [null, null, 0, 2, 1, 2] },
    { root: 'B', chord: '7', frets: [null, 2, 1, 2, 0, 2] },
    { root: 'A', chord: 'm7', frets: [null, 0, 2, 0, 1, 0] },
    { root: 'E', chord: 'm7', frets: [0, 2, 0, 0, 0, 0] },
    { root: 'D', chord: 'm7', frets: [null, null, 0, 2, 1, 1] },
    { root: 'C', chord: 'maj7', frets: [null, 3, 2, 0, 0, 0] },
    { root: 'F', chord: 'maj7', frets: [null, null, 3, 2, 1, 0] },
    { root: 'A', chord: 'maj7', frets: [null, 0, 2, 1, 2, 0] },
    { root: 'D', chord: 'maj7', frets: [null, null, 0, 2, 2, 2] },
    { root: 'D', chord: 'sus2', frets: [null, null, 0, 2, 3, 0] },
    { root: 'D', chord: 'sus4', frets: [null, null, 0, 2, 3, 3] },
    { root: 'A', chord: 'sus2', frets: [null, 0, 2, 2, 0, 0] },
    { root: 'A', chord: 'sus4', frets: [null, 0, 2, 2, 3, 0] },
    { root: 'E', chord: 'sus4', frets: [0, 2, 2, 2, 0, 0] },
    { root: 'C', chord: 'add9', frets: [null, 3, 2, 0, 3, 0] },
    { root: 'E', chord: 'power', frets: [0, 2, null, null, null, null] },
    { root: 'A', chord: 'power', frets: [null, 0, 2, null, null, null] }
  ];

  // Movable CAGED shapes, written as the open chord they come from.
  const CAGED = {
    major: [
      { shape: 'C', root: 'C', frets: [null, 3, 2, 0, 1, 0] },
      { shape: 'A', root: 'A', frets: [null, 0, 2, 2, 2, 0] },
      { shape: 'G', root: 'G', frets: [3, 2, 0, 0, 0, 3] },
      { shape: 'E', root: 'E', frets: [0, 2, 2, 1, 0, 0] },
      { shape: 'D', root: 'D', frets: [null, null, 0, 2, 3, 2] }
    ],
    minor: [
      { shape: 'C', root: 'C', frets: [null, 3, 1, 0, 1, null] },
      { shape: 'A', root: 'A', frets: [null, 0, 2, 2, 1, 0] },
      { shape: 'G', root: 'G', frets: [3, 1, 0, 0, 3, 3] },
      { shape: 'E', root: 'E', frets: [0, 2, 2, 0, 0, 0] },
      { shape: 'D', root: 'D', frets: [null, null, 0, 2, 3, 1] }
    ]
  };
  // The five CAGED shapes of a major or minor chord, moved to a root, in order up the neck.
  function cagedShapes(rootName, quality = 'major') {
    const rootPc = pcOf(rootName);
    const shapes = CAGED[quality].map(s => {
      const shift = mod(rootPc - pcOf(s.root));
      const frets = s.frets.map(f => f === null ? null : f + shift);
      return { shape: s.shape, frets, low: Math.min(...frets.filter(f => f !== null)), high: Math.max(...frets.filter(f => f !== null)) };
    });
    return shapes.sort((a, b) => a.low - b.low);
  }

  // Movable shapes as fret offsets from the root fret on the root string (0 = 6th string, 1 = 5th, 2 = 4th).
  const MOVABLE = {
    '7': [{ rootString: 0, offsets: [0, 2, 0, 1, 0, 0] }, { rootString: 1, offsets: [null, 0, 2, 0, 2, 0] }, { rootString: 2, offsets: [null, null, 0, 2, 1, 2] }],
    'm7': [{ rootString: 0, offsets: [0, 2, 0, 0, 0, 0] }, { rootString: 1, offsets: [null, 0, 2, 0, 1, 0] }, { rootString: 2, offsets: [null, null, 0, 2, 1, 1] }],
    'maj7': [{ rootString: 0, offsets: [0, null, 1, 1, 0, null] }, { rootString: 1, offsets: [null, 0, 2, 1, 2, 0] }, { rootString: 2, offsets: [null, null, 0, 2, 2, 2] }],
    'm7b5': [{ rootString: 0, offsets: [0, null, 0, 0, -1, null] }, { rootString: 1, offsets: [null, 0, 1, 0, 1, null] }, { rootString: 2, offsets: [null, null, 0, 1, 1, 1] }],
    'dim7': [{ rootString: 0, offsets: [0, null, -1, 0, -1, null] }, { rootString: 1, offsets: [null, 0, 1, -1, 1, null] }],
    'mmaj7': [{ rootString: 0, offsets: [0, null, 1, 0, 0, null] }, { rootString: 1, offsets: [null, 0, 2, 1, 1, 0] }],
    '7sus4': [{ rootString: 0, offsets: [0, 2, 0, 2, 0, 0] }, { rootString: 1, offsets: [null, 0, 2, 0, 3, 0] }],
    'dim': [{ rootString: 1, offsets: [null, 0, 1, 2, 1, null] }, { rootString: 0, offsets: [0, 1, 2, 0, null, null] }],
    'aug': [{ rootString: 1, offsets: [null, 0, 3, 2, 2, 1] }, { rootString: 0, offsets: [0, null, 2, 1, 1, 0] }],
    'sus2': [{ rootString: 1, offsets: [null, 0, 2, 2, 0, 0] }, { rootString: 2, offsets: [null, null, 0, 2, 3, 0] }],
    'sus4': [{ rootString: 0, offsets: [0, 2, 2, 2, 0, 0] }, { rootString: 1, offsets: [null, 0, 2, 2, 3, 0] }, { rootString: 2, offsets: [null, null, 0, 2, 3, 3] }],
    'power': [{ rootString: 0, offsets: [0, 2, 2, null, null, null] }, { rootString: 1, offsets: [null, 0, 2, 2, null, null] }],
    '6': [{ rootString: 1, offsets: [null, 0, 2, 2, 2, 2] }, { rootString: 0, offsets: [0, null, -1, 1, 0, null] }],
    'm6': [{ rootString: 1, offsets: [null, 0, 2, 2, 1, 2] }, { rootString: 0, offsets: [0, null, -1, 0, 0, null] }],
    'add9': [{ rootString: 1, offsets: [null, 0, -1, -3, 0, null] }, { rootString: 0, offsets: [0, null, 2, 1, 0, 2] }],
    '9': [{ rootString: 1, offsets: [null, 0, -1, 0, 0, 0] }, { rootString: 0, offsets: [0, null, 0, 1, 0, 2] }],
    'maj9': [{ rootString: 1, offsets: [null, 0, -1, 1, 0, null] }],
    'm9': [{ rootString: 1, offsets: [null, 0, -2, 0, 0, null] }, { rootString: 0, offsets: [0, null, 0, 0, 0, 2] }]
  };
  // A movable shape placed on a root: the lowest place where every fret is 0 or higher.
  function placeShape(rootName, shape, tuning = STANDARD) {
    const rootFret = mod(pcOf(rootName) - tuning[shape.rootString]);
    const minOffset = Math.min(...shape.offsets.filter(f => f !== null));
    const r = rootFret + minOffset < 0 ? rootFret + 12 : rootFret;
    return shape.offsets.map(f => f === null ? null : r + f);
  }
  // All shapes for a chord on a root: CAGED for major and minor, movable forms for the rest,
  // plus the open shape when one exists for this root.
  function chordShapes(rootName, chordId, tuning = STANDARD) {
    const list = [];
    const open = OPEN_CHORDS.find(c => c.chord === chordId && pcOf(c.root) === pcOf(rootName));
    const same = (a, b) => a.length === b.length && a.every((f, i) => f === b[i]);
    let caged = [];
    if (CAGED[chordId] && tuning === STANDARD) caged = cagedShapes(rootName, chordId);
    // An open chord that is also a CAGED shape (open C is the C shape) appears once, as the CAGED shape.
    if (open && tuning === STANDARD && !caged.some(s => same(s.frets, open.frets))) list.push({ id: 'open', name: 'Open', frets: open.frets });
    if (caged.length) {
      for (const s of caged) list.push({ id: 'caged-' + s.shape, name: s.shape + ' shape', frets: s.frets });
    } else if (MOVABLE[chordId] && tuning === STANDARD) {
      const names = ['6th-string root', '5th-string root', '4th-string root'];
      for (const s of MOVABLE[chordId]) list.push({ id: 'root-' + (6 - s.rootString), name: names[s.rootString], frets: placeShape(rootName, s, tuning) });
    }
    return list.map(s => {
      const fretted = s.frets.filter(f => f !== null);
      return Object.assign(s, { low: Math.min(...fretted), high: Math.max(...fretted) });
    });
  }

  const intervalLabelOf = semi => ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♯5', '6', '♭7', '7'][mod(semi)];
  // Chords built by stacking thirds on each degree of a seven-note scale.
  function identifyChord(semis) {
    const key = semis.map(x => mod(x)).join(',');
    return CHORDS.find(c => c.toneList.map(t => mod(t.semi)).join(',') === key) || null;
  }
  function scaleChords(rootName, scale, sevenths = false) {
    const tones = scale.toneList;
    if (tones.length !== 7) return [];
    return tones.map((t, i) => {
      const picks = (sevenths ? [0, 2, 4, 6] : [0, 2, 4]).map(k => tones[(i + k) % 7].semi + (i + k >= 7 ? 12 : 0));
      const chord = identifyChord(picks.map(x => x - picks[0]));
      const chordRoot = spell(rootName, t.label);
      // A stack with no common chord name shows its formula, for example "D♭ (1 2 ♭5)".
      const formula = picks.map(x => intervalLabelOf(x - picks[0])).join(' ');
      return { degree: i + 1, label: t.label, root: chordRoot, chord, name: chord ? chordRoot + chord.symbol : `${chordRoot} (${formula})` };
    });
  }
  // The major key whose notes a mode shares: D Dorian shares C major.
  const MODE_INDEX = { major: 0, dorian: 1, phrygian: 2, lydian: 3, mixolydian: 4, minor: 5, locrian: 6 };
  function parentMajor(rootName, scaleId) {
    const idx = MODE_INDEX[scaleId];
    if (idx === undefined) return null;
    const r = parseNote(rootName);
    const letter = LETTERS[mod(LETTERS.indexOf(r.letter) - idx, 7)];
    const pc = mod(r.pc - MAJOR_STEPS[idx]);
    return letter + accidentalText(mod(pc - LETTER_PC[letter] + 6) - 6);
  }

  // Close triad voicings on three adjacent strings. Sets are named by their lowest string index.
  const TRIAD_SETS = [
    { id: '123', name: 'Strings 3–2–1 (G B e)', strings: [3, 4, 5] },
    { id: '234', name: 'Strings 4–3–2 (D G B)', strings: [2, 3, 4] },
    { id: '345', name: 'Strings 5–4–3 (A D G)', strings: [1, 2, 3] },
    { id: '456', name: 'Strings 6–5–4 (E A D)', strings: [0, 1, 2] }
  ];
  const INVERSIONS = ['Root position', 'First inversion', 'Second inversion'];
  function triadVoicings(rootName, chordId, setId, tuning = STANDARD, maxFret = 15) {
    const chord = chordById(chordId);
    const [r, third, fifth] = chord.toneList.map(t => t.semi);
    const set = TRIAD_SETS.find(s => s.id === setId).strings;
    const rootPc = pcOf(rootName);
    const result = [];
    for (let inversion = 0; inversion < 3; inversion++) {
      const offsets = inversion === 0 ? [r, third, fifth] : inversion === 1 ? [third, fifth, 12] : [fifth, 12, 12 + third];
      const labels = inversion === 0 ? [0, 1, 2] : inversion === 1 ? [1, 2, 0] : [2, 0, 1];
      const found = [];
      for (let bass = 0; bass <= maxFret; bass++) {
        const bassMidi = tuning[set[0]] + bass;
        if (mod(bassMidi - rootPc) !== mod(offsets[0])) continue;
        const frets = offsets.map((o, i) => bassMidi + o - offsets[0] - tuning[set[i]]);
        if (frets.some(f => f < 0 || f > maxFret)) continue;
        if (Math.max(...frets) - Math.min(...frets) > 4) continue;
        found.push({ inversion, strings: set, frets, tones: labels.map(i => chord.toneList[i].label) });
      }
      result.push(found);
    }
    return result;
  }

  // Scale positions. Pentatonic: two notes per string. Seven-note scales: three notes per string.
  // Position k starts on the k-th scale tone found on the low string.
  function positions(rootName, scale, tuning = STANDARD, maxFret = 24) {
    const perString = scale.toneList.length === 5 ? 2 : scale.toneList.length === 7 ? 3 : 0;
    if (!perString) return [];
    const rootPc = pcOf(rootName);
    const pcs = new Set(scale.toneList.map(t => mod(rootPc + t.semi)));
    const scaleMidis = [];
    for (let m = tuning[0]; m <= tuning[5] + maxFret; m++) if (pcs.has(mod(m))) scaleMidis.push(m);
    const result = [];
    const size = scale.toneList.length;
    const found = new Set();
    // Each position starts on one scale tone of the low string. Take the lowest place where the
    // whole position fits above the nut; near the nut some positions only fit an octave higher.
    for (let startIndex = 0; found.size < size && startIndex < scaleMidis.length; startIndex++) {
      if (found.has(startIndex % size)) continue;
      const notes = [];
      let ok = true;
      for (let s = 0; s < 6; s++) {
        for (let n = 0; n < perString; n++) {
          const midi = scaleMidis[startIndex + s * perString + n];
          const fret = midi - tuning[s];
          if (midi === undefined || fret < 0 || fret > maxFret) { ok = false; break; }
          notes.push({ string: s, fret, midi });
        }
      }
      if (!ok) continue;
      found.add(startIndex % size);
      const frets = notes.map(n => n.fret);
      // Name the position by the scale degree it starts on: position 1 starts on the root.
      const degreeIndex = scale.toneList.findIndex(t => mod(t.semi) === mod(notes[0].midi - rootPc));
      result.push({ index: degreeIndex + 1, startLabel: scale.toneList[degreeIndex].label, notes, low: Math.min(...frets), high: Math.max(...frets) });
    }
    return result.sort((a, b) => a.low - b.low);
  }

  // Close voicing of chord tones near the previous chord, for smooth progressions (MIDI numbers).
  function voiceLead(pcs, prev, low = 52, high = 72) {
    const options = [];
    for (let inv = 0; inv < pcs.length; inv++) {
      const order = pcs.slice(inv).concat(pcs.slice(0, inv));
      for (let start = low; start < low + 12; start++) {
        if (mod(start) !== order[0]) continue;
        const notes = [start];
        for (const pc of order.slice(1)) { let m = notes[notes.length - 1] + 1; while (mod(m) !== pc) m++; notes.push(m); }
        if (notes[notes.length - 1] <= high) options.push(notes);
      }
    }
    if (!prev) return options.sort((a, b) => Math.abs(a[0] - 60) - Math.abs(b[0] - 60))[0];
    const cost = v => v.reduce((sum, m, i) => sum + Math.abs(m - (prev[i] !== undefined ? prev[i] : prev[prev.length - 1])), 0);
    return options.sort((a, b) => cost(a) - cost(b))[0];
  }

  const theory = {
    LETTERS, ROOTS, PC_SHARP, PC_FLAT, PC_PLAIN, INTERVALS, SCALE_GROUPS, CHORD_GROUPS, SCALES, CHORDS,
    TUNINGS, STANDARD, STRING_NAMES, CIRCLE, OPEN_CHORDS, CAGED, MOVABLE, TRIAD_SETS, INVERSIONS, MODE_INDEX,
    mod, parseNote, pcOf, pcName, parseDegree, spell, intervalBySemi, scaleById, chordById,
    tonesOn, chordName, signature, diatonic, keyCells, cagedShapes, triadVoicings, positions,
    placeShape, chordShapes, identifyChord, scaleChords, parentMajor, voiceLead,
    midiName: (midi, flats = false) => pcName(midi, flats),
    freq: midi => 440 * Math.pow(2, (midi - 69) / 12)
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = theory;
  else { root.GT = root.GT || {}; root.GT.theory = theory; }
})(typeof window !== 'undefined' ? window : globalThis);
