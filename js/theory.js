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
  // Songs that open with an interval, by semitones. They help you recall the sound of a melodic interval.
  const INTERVAL_SONGS = {
    1: { up: 'Jaws (the theme)', down: 'Joy to the World' },
    2: { up: 'Happy Birthday, on “-py birth-”', down: 'Mary Had a Little Lamb' },
    3: { up: 'Smoke on the Water (the riff)', down: 'Hey Jude' },
    4: { up: 'When the Saints Go Marching In', down: 'Swing Low, Sweet Chariot' },
    5: { up: 'Here Comes the Bride', down: 'Eine kleine Nachtmusik' },
    6: { up: 'The Simpsons theme', down: 'Black Sabbath (the riff)' },
    7: { up: 'Star Wars (the main theme)', down: 'The Flintstones' },
    8: { up: 'The Entertainer, on the third and fourth notes' },
    9: { up: 'My Bonnie Lies over the Ocean', down: 'Nobody Knows the Trouble I’ve Seen' },
    10: { up: 'Star Trek (the original theme)' },
    11: { up: 'Take On Me (the chorus)' },
    12: { up: 'Somewhere Over the Rainbow' }
  };

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
      { id: 'augmaj7', name: 'Augmented major 7th', symbol: '+maj7', tones: '1 3 ♯5 7' },
      { id: '7sharp5', name: 'Dominant 7th sharp 5', symbol: '7♯5', tones: '1 3 ♯5 ♭7' },
      { id: '7b9', name: 'Dominant 7th flat 9', symbol: '7♭9', tones: '1 3 5 ♭7 ♭9' },
      { id: '7sharp9', name: 'Dominant 7th sharp 9', symbol: '7♯9', tones: '1 3 5 ♭7 ♯9' }
    ] },
    { id: 'sixths-ext', name: 'Sixths and extensions', items: [
      { id: '6', name: 'Major 6th', symbol: '6', tones: '1 3 5 6' },
      { id: 'm6', name: 'Minor 6th', symbol: 'm6', tones: '1 ♭3 5 6' },
      { id: 'add9', name: 'Add 9', symbol: 'add9', tones: '1 3 5 9' },
      { id: '9', name: 'Dominant 9th', symbol: '9', tones: '1 3 5 ♭7 9' },
      { id: 'maj9', name: 'Major 9th', symbol: 'maj9', tones: '1 3 5 7 9' },
      { id: 'm9', name: 'Minor 9th', symbol: 'm9', tones: '1 ♭3 5 ♭7 9' },
      { id: '69', name: 'Six nine', symbol: '6/9', tones: '1 3 5 6 9' },
      { id: '11', name: 'Dominant 11th', symbol: '11', tones: '1 3 5 ♭7 9 11' },
      { id: 'm11', name: 'Minor 11th', symbol: 'm11', tones: '1 ♭3 5 ♭7 9 11' },
      { id: '13', name: 'Dominant 13th', symbol: '13', tones: '1 3 5 ♭7 9 13' }
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
  // Chords from outside the key that songs use often, each with its numeral and group:
  // secondary dominants (the V7 of another chord of the key) and chords borrowed from a near scale.
  // A minor key takes V and V7 from harmonic minor: the major V that most minor-key songs use.
  function outsideChords(keyName, mode = 'major') {
    const out = [];
    const add = (group, roman, label, chordId) => {
      const root = spell(keyName, label), chord = chordById(chordId);
      out.push({ group, roman, root, chord, name: chordName(root, chord), pc: mod(pcOf(keyName) + parseDegree(label).semi) });
    };
    // The V7 of a chord: a dominant seventh chord a fifth above its root.
    const dominantOf = (label, roman) => {
      const target = spell(keyName, label), root = spell(target, '5'), chord = chordById('7');
      out.push({ group: mode === 'major' ? 'Secondary dominants' : 'Borrowed and secondary dominants', roman: `V7/${roman}`, root, chord, name: chordName(root, chord), pc: mod(pcOf(target) + 7) });
    };
    if (mode === 'major') {
      [['2', 'ii'], ['3', 'iii'], ['4', 'IV'], ['5', 'V'], ['6', 'vi']].forEach(([l, r]) => dominantOf(l, r));
      add('Borrowed from the minor key', 'iv', '4', 'minor');
      add('Borrowed from the minor key', '♭III', '♭3', 'major');
      add('Borrowed from the minor key', '♭VI', '♭6', 'major');
      add('Borrowed from the minor key', '♭VII', '♭7', 'major');
    } else {
      add('From harmonic minor', 'V', '5', 'major');
      add('From harmonic minor', 'V7', '5', '7');
      add('From harmonic minor', 'vii°7', '7', 'dim7');
      add('Borrowed and secondary dominants', 'IV', '4', 'major');
      dominantOf('4', 'iv');
      dominantOf('5', 'V');
    }
    return out;
  }
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

  // How far a tuning sits from standard: the same number of semitones on every string, as with a capo or
  // half step down. The low string may sit two semitones lower still, as in drop D. null for other tunings.
  function standardShift(tuning) {
    if (!tuning || tuning.length !== 6) return null;
    const d = tuning.map((m, s) => m - STANDARD[s]);
    return d.slice(2).every(x => x === d[1]) && (d[0] === d[1] || d[0] === d[1] - 2) ? d[1] : null;
  }
  // Shapes written for standard tuning, for a tuning of the standard family: the shapes of the root moved
  // back by the shift, on the same frets, and two frets higher on the low string in a drop tuning.
  // null for other tunings.
  function familyShapes(rootName, tuning, make) {
    const k = standardShift(tuning);
    if (k === null) return null;
    const drop = tuning[0] - k !== STANDARD[0];
    return make(PC_SHARP[mod(pcOf(rootName) - k)]).map(s => drop ? Object.assign(s, { frets: s.frets.map((f, i) => i === 0 && f !== null ? f + 2 : f) }) : s);
  }

  // Every CAGED shape that fits between the nut and maxFret, also the copies 12 frets up or down,
  // in order up the neck. Neighbours share notes: that is how the five shapes join.
  // Tunings outside the standard family have no CAGED shapes.
  function cagedMap(rootName, quality = 'major', maxFret = 15, tuning = STANDARD) {
    const out = [];
    const shapes = familyShapes(rootName, tuning, name => cagedShapes(name, quality)) || [];
    for (const s of shapes) for (const k of [-12, 0, 12]) {
      const frets = s.frets.map(f => f === null ? null : f + k);
      const used = frets.filter(f => f !== null);
      const low = Math.min(...used), high = Math.max(...used);
      if (low >= 0 && high <= maxFret) out.push({ shape: s.shape, frets, low, high });
    }
    return out.sort((a, b) => a.low - b.low || a.high - b.high);
  }
  // The places that two shapes both use, as "string:fret".
  function sharedPlaces(a, b) {
    return a.frets.map((f, s) => f !== null && b.frets[s] === f ? `${s}:${f}` : null).filter(Boolean);
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
    'm9': [{ rootString: 1, offsets: [null, 0, -2, 0, 0, null] }, { rootString: 0, offsets: [0, null, 0, 0, 0, 2] }],
    '7sharp5': [{ rootString: 0, offsets: [0, null, 0, 1, 1, null] }, { rootString: 1, offsets: [null, 0, null, 0, 2, 1] }],
    '7b9': [{ rootString: 0, offsets: [0, null, 0, 1, 0, 1] }, { rootString: 1, offsets: [null, 0, -1, 0, -1, null] }],
    '7sharp9': [{ rootString: 1, offsets: [null, 0, -1, 0, 1, null] }],
    '69': [{ rootString: 0, offsets: [0, -1, -1, -1, 0, 0] }, { rootString: 1, offsets: [null, 0, -1, -1, 0, 0] }],
    // The usual 11 chord leaves out the 3rd and the 5th: a 9sus4 sound.
    '11': [{ rootString: 0, offsets: [0, null, 0, -1, -2, null] }, { rootString: 1, offsets: [null, 0, 0, 0, 0, null] }],
    'm11': [{ rootString: 0, offsets: [0, null, 0, 0, -2, null] }, { rootString: 1, offsets: [null, 0, -2, 0, 0, -2] }],
    '13': [{ rootString: 0, offsets: [0, null, 0, 1, 2, null] }, { rootString: 1, offsets: [null, 0, -1, 0, 2, 2] }]
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
  // The shapes of a chord. Tunings of the standard family (a capo, half step down, drop D) use the standard
  // shapes moved to them. Other tunings get none.
  function chordShapes(rootName, chordId, tuning = STANDARD) {
    return (familyShapes(rootName, tuning, name => standardChordShapes(name, chordId)) || []).map(s => {
      const fretted = s.frets.filter(f => f !== null);
      return Object.assign(s, { low: Math.min(...fretted), high: Math.max(...fretted) });
    });
  }
  function standardChordShapes(rootName, chordId) {
    const tuning = STANDARD;
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
      const names = ['Root on the 6th string', 'Root on the 5th string', 'Root on the 4th string'];
      for (const s of MOVABLE[chordId]) list.push({ id: 'root-' + (6 - s.rootString), name: names[s.rootString], frets: placeShape(rootName, s, tuning) });
    }
    return list;
  }

  const intervalLabelOf = semi => ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♯5', '6', '♭7', '7'][mod(semi)];
  // Chords built by stacking thirds on each degree of a seven-note scale.
  function identifyChord(semis) {
    const key = semis.map(x => mod(x)).join(',');
    return CHORDS.find(c => c.toneList.map(t => mod(t.semi)).join(',') === key) || null;
  }
  // A Roman numeral for a chord on a scale degree: "♭VII", "ii", "vii°", "V7", "iiø7", "Imaj7".
  // Minor and diminished chords are small letters.
  function romanOf(label, chord) {
    const d = parseDegree(label), n = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][d.step];
    if (!chord) return label.replace(/\d+/, '') + n;
    const labels = chord.toneList.map(t => t.label), small = labels.includes('♭3') && !labels.includes('3');
    const tail = { dim: '°', aug: '+', m7b5: 'ø7', dim7: '°7', maj7: 'maj7', 7: '7', m7: '7', mmaj7: '(maj7)', augmaj7: '+maj7' }[chord.id] || '';
    return label.replace(/\d+/, '') + (small ? n.toLowerCase() : n) + tail;
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
      return { degree: i + 1, label: t.label, roman: romanOf(t.label, chord), root: chordRoot, chord, name: chord ? chordRoot + chord.symbol : `${chordRoot} (${formula})` };
    });
  }
  // Reverse lookup: the chords that a set of notes spells. pcs are pitch classes in any order,
  // bass is the pitch class of the lowest note. A chord whose root is in the bass comes first,
  // then the common chords before the rare ones. "missing" asks for chords that need that many more notes.
  function chordsFrom(pcs, bass, missing = 0) {
    const set = [...new Set(pcs.map(x => mod(x)))];
    const out = [];
    for (const rootPc of set) {
      const have = new Set(set.map(pc => mod(pc - rootPc)));
      CHORDS.forEach((chord, rank) => {
        const want = [...new Set(chord.toneList.map(t => mod(t.semi)))];
        if (want.length !== have.size + missing || ![...have].every(x => want.includes(x))) return;
        const rootName = PC_PLAIN[rootPc];
        const tones = tonesOn(rootName, chord);
        const bassTone = tones.find(t => t.pc === mod(bass));
        const inversion = bassTone ? tones.indexOf(bassTone) : 0;
        out.push({
          root: rootName, chord, rank, inversion,
          // The bass under its plain name: "E+/C", not "E+/B♯".
          name: chordName(rootName, chord) + (inversion ? '/' + PC_PLAIN[bassTone.pc] : ''),
          missing: tones.filter(t => !set.includes(t.pc)).map(t => t.name)
        });
      });
    }
    return out.sort((a, b) => (a.inversion ? 1 : 0) - (b.inversion ? 1 : 0) || a.rank - b.rank);
  }
  // The scales that hold every one of the notes. A scale that starts on the lowest note comes first,
  // then a scale that starts on any of the notes, then the common scales before the rare ones.
  function scalesWith(pcs, bass) {
    const set = [...new Set(pcs.map(x => mod(x)))];
    const out = [];
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      SCALES.forEach((scale, rank) => {
        if (scale.id === 'chromatic') return;
        const want = scale.toneList.map(t => mod(rootPc + t.semi));
        if (!set.every(pc => want.includes(pc))) return;
        out.push({ root: PC_PLAIN[rootPc], scale, rank, exact: want.length === set.length, onBass: rootPc === mod(bass), onNote: set.includes(rootPc) });
      });
    }
    const order = x => (x.onBass ? 0 : x.onNote ? 1 : 2);
    return out.sort((a, b) => order(a) - order(b) || (a.exact ? 0 : 1) - (b.exact ? 0 : 1) || a.rank - b.rank);
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

  // The usual scale over a chord, for the notes around it: a diminished triad is the first chord of Locrian,
  // an augmented triad of the whole-tone scale, a dominant seventh of Mixolydian. A chord with no usual scale is left out.
  const CHORD_SCALE = {
    major: 'major', minor: 'minor', dim: 'locrian', aug: 'whole-tone', sus2: 'major', sus4: 'mixolydian', power: 'minor-pentatonic',
    maj7: 'major', 7: 'mixolydian', m7: 'dorian', m7b5: 'locrian', dim7: 'diminished-wh', mmaj7: 'melodic-minor', '7sus4': 'mixolydian',
    b5: 'whole-tone', '7b5': 'whole-tone', 6: 'major', m6: 'dorian', add9: 'major', 9: 'mixolydian', maj9: 'major', m9: 'dorian',
    '7sharp5': 'whole-tone', '7b9': 'diminished-hw', '7sharp9': 'diminished-hw', 69: 'major-pentatonic', 11: 'mixolydian', m11: 'dorian', 13: 'mixolydian'
  };
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
  // Position k starts on the k-th scale tone found on the low string. Each position takes the lowest place where it
  // fits between the nut and maxFret. A position that fits nowhere is cut at the nut or the last fret (partial: true),
  // so the numbers never skip.
  function positions(rootName, scale, tuning = STANDARD, maxFret = 24) {
    const perString = scale.toneList.length === 5 ? 2 : scale.toneList.length === 7 ? 3 : 0;
    if (!perString) return [];
    const rootPc = pcOf(rootName);
    const pcs = new Set(scale.toneList.map(t => mod(rootPc + t.semi)));
    const scaleMidis = [];
    for (let m = tuning[0] - 12; m <= tuning[5] + maxFret + 12; m++) if (pcs.has(mod(m))) scaleMidis.push(m);
    const size = scale.toneList.length;
    const best = new Map();
    for (let startIndex = 0; startIndex + 6 * perString <= scaleMidis.length; startIndex++) {
      const notes = [];
      for (let s = 0; s < 6; s++) for (let n = 0; n < perString; n++) {
        const midi = scaleMidis[startIndex + s * perString + n];
        notes.push({ string: s, fret: midi - tuning[s], midi });
      }
      const inside = notes.filter(n => n.fret >= 0 && n.fret <= maxFret);
      const degreeIndex = scale.toneList.findIndex(t => mod(t.semi) === mod(notes[0].midi - rootPc));
      const had = best.get(degreeIndex);
      const full = inside.length === notes.length;
      if (had && (had.full || (!full && had.notes.length >= inside.length))) continue;
      if (inside.length < 4) continue;
      best.set(degreeIndex, { full, notes: inside });
    }
    const result = [];
    for (const [degreeIndex, { full, notes }] of best) {
      const frets = notes.map(n => n.fret);
      result.push({ index: degreeIndex + 1, startLabel: scale.toneList[degreeIndex].label, notes, low: Math.min(...frets), high: Math.max(...frets), partial: !full });
    }
    return result.sort((a, b) => a.low - b.low);
  }

  // Vertical boxes of 4 or 5 frets. A pentatonic scale is its own five boxes. A seven-note scale takes the five boxes
  // of the pentatonic on its root (major with a 3, else minor) and fills each with every scale note between its frets.
  function boxes(rootName, scale, tuning = STANDARD, maxFret = 24) {
    const size = scale.toneList.length;
    if (size === 5) return positions(rootName, scale, tuning, maxFret);
    if (size !== 7) return [];
    const rootPc = pcOf(rootName);
    const pent = scaleById(scale.toneList.some(t => t.label === '3') ? 'major-pentatonic' : 'minor-pentatonic');
    return positions(rootName, pent, tuning, maxFret).map(p => {
      const notes = [];
      for (let s = 0; s < tuning.length; s++) for (let f = p.low; f <= p.high; f++) {
        const t = scale.toneList.find(x => mod(rootPc + x.semi) === mod(tuning[s] + f));
        if (t) notes.push({ string: s, fret: f, midi: tuning[s] + f, label: t.label });
      }
      return { index: p.index, startLabel: notes[0].label, notes, low: p.low, high: p.high };
    });
  }

  // Slash chords: the shapes of a chord with another note in the bass, for example C/E or C/B♭.
  // The bass note goes on a string under the shape, within reach of the hand (C/G: 3 3 2 0 1 0). When no string
  // under it fits, a string of the shape that plays the bass note becomes the lowest one (C/E: x x 2 0 1 0).
  function slashShapes(rootName, chordId, bassName, tuning = STANDARD) {
    const bass = pcOf(bassName), rootPc = pcOf(rootName);
    const out = [], seen = new Set();
    for (const sh of chordShapes(rootName, chordId, tuning)) {
      const used = sh.frets.map((f, s) => f === null ? null : s).filter(s => s !== null);
      const low = used[0];
      const fretted = sh.frets.filter(f => f !== null && f > 0);
      const lo = fretted.length ? Math.min(...fretted) : 0, hi = fretted.length ? Math.max(...fretted) : 0;
      let frets = null;
      for (let s = low - 1; s >= 0 && !frets; s--) for (let f = Math.max(0, lo - 2); f <= hi + 1 && !frets; f++) {
        if (mod(tuning[s] + f) === bass) frets = sh.frets.map((x, k) => k === s ? f : k < low ? null : x);
      }
      const onBass = used.find(s => mod(tuning[s] + sh.frets[s]) === bass);
      if (!frets && onBass !== undefined) frets = sh.frets.map((f, s) => s < onBass ? null : f);
      if (!frets) continue;
      const sounding = frets.map((f, s) => f === null ? null : mod(tuning[s] + f)).filter(x => x !== null);
      const span = frets.filter(f => f !== null && f > 0);
      if (sounding.length < 3 || !sounding.includes(rootPc) || (span.length && Math.max(...span) - Math.min(...span) > 4)) continue;
      const key = frets.join();
      if (seen.has(key)) continue;
      seen.add(key);
      const used2 = frets.filter(f => f !== null);
      out.push({ id: sh.id, name: sh.name, frets, low: Math.min(...used2), high: Math.max(...used2) });
    }
    return out;
  }

  // Drop 2 and drop 3 voicings of four-note chords on a set of strings, as on the Triads page.
  // A close voicing (the four notes inside one octave) drops its second note from the top (drop 2)
  // or its third (drop 3) by an octave. Drop 3 skips a string. The result groups the shapes by the tone in the bass.
  const DROP_SETS = {
    drop2: [{ id: '6543', strings: [0, 1, 2, 3] }, { id: '5432', strings: [1, 2, 3, 4] }, { id: '4321', strings: [2, 3, 4, 5] }],
    drop3: [{ id: '6432', strings: [0, 2, 3, 4] }, { id: '5321', strings: [1, 3, 4, 5] }]
  };
  function dropVoicings(rootName, chordId, kind, setId, tuning = STANDARD, maxFret = 15) {
    const chord = chordById(chordId), set = (DROP_SETS[kind].find(s => s.id === setId) || {}).strings;
    // Only chords inside one octave have a close voicing to drop from: add9 has its 9 above the octave.
    if (!chord || chord.toneList.length !== 4 || chord.toneList.some(t => t.semi >= 12) || !set) return [];
    const semis = chord.toneList.map(t => t.semi), rootPc = pcOf(rootName);
    const result = [[], [], [], []];
    for (let inv = 0; inv < 4; inv++) {
      const idx = [0, 1, 2, 3].map(k => (inv + k) % 4);
      const close = idx.map((i, k) => semis[i] + (inv + k >= 4 ? 12 : 0));
      const pick = kind === 'drop2' ? [2, 0, 1, 3] : [1, 0, 2, 3];
      const voiced = pick.map((k, j) => close[k] - (j === 0 ? 12 : 0)), order = pick.map(k => idx[k]);
      for (let bassFret = 0; bassFret <= maxFret; bassFret++) {
        const bassMidi = tuning[set[0]] + bassFret;
        if (mod(bassMidi - rootPc) !== mod(voiced[0])) continue;
        const frets = voiced.map((v, j) => bassMidi + v - voiced[0] - tuning[set[j]]);
        if (frets.some(f => f < 0 || f > maxFret) || Math.max(...frets) - Math.min(...frets) > 4) continue;
        result[order[0]].push({ kind, strings: set, frets, tones: order.map(i => chord.toneList[i].label) });
      }
    }
    return result;
  }

  // Fingers for a shape: 1 is the index finger. A shape with more than four fretted notes takes a barre with finger 1
  // on its lowest fret. The other notes get the finger of their distance from the lowest fret, or the next free one.
  // Where this rule is not sure (two notes side by side on the lowest fret without a barre, or a fifth finger),
  // every finger is null: no number is better than a wrong one.
  function fingers(frets) {
    const none = frets.map(() => null);
    const fretted = frets.map((f, s) => ({ f, s })).filter(x => x.f !== null && x.f > 0);
    if (!fretted.length) return none;
    const min = Math.min(...fretted.map(x => x.f)), atMin = fretted.filter(x => x.f === min);
    const out = frets.map(() => null);
    const taken = new Set();
    let rest = fretted;
    if (fretted.length > 4) {
      if (atMin.length < 2) return none;
      atMin.forEach(x => { out[x.s] = 1; });
      taken.add(1);
      rest = fretted.filter(x => x.f !== min);
    } else if (atMin.some((x, i) => i > 0 && x.s === atMin[i - 1].s + 1)) return none;
    for (const x of rest.slice().sort((a, b) => a.f - b.f || a.s - b.s)) {
      let finger = Math.min(4, 1 + x.f - min);
      while (taken.has(finger)) finger++;
      if (finger > 4) return none;
      out[x.s] = finger;
      taken.add(finger);
    }
    return out;
  }

  // Arpeggio positions: the notes of a chord inside each of the five boxes of the pentatonic scale on its root
  // (major with a 3, else minor). A box covers 4 or 5 frets.
  function arpeggioBoxes(rootName, chordId, tuning = STANDARD, maxFret = 24) {
    const chord = chordById(chordId), rootPc = pcOf(rootName);
    const pent = scaleById(chord.toneList.some(t => t.label === '3') ? 'major-pentatonic' : 'minor-pentatonic');
    return positions(rootName, pent, tuning, maxFret).map(p => {
      const notes = [];
      for (let s = 0; s < tuning.length; s++) for (let f = p.low; f <= p.high; f++) {
        const t = chord.toneList.find(x => mod(rootPc + x.semi) === mod(tuning[s] + f));
        if (t) notes.push({ string: s, fret: f, midi: tuning[s] + f, label: t.label });
      }
      return { index: p.index, notes, low: p.low, high: p.high };
    }).filter(p => p.notes.length);
  }

  // The frequency of a buffer, or null when it is too quiet or has no clear pitch. Periods from 60 Hz to 1000 Hz.
  function pitchOf(buf, rate) {
    let rms = 0;
    for (const v of buf) rms += v * v;
    if (Math.sqrt(rms / buf.length) < 0.008) return null;
    const minLag = Math.floor(rate / 1000), maxLag = Math.min(Math.floor(rate / 60), buf.length >> 1);
    const c = new Float32Array(maxLag + 2);
    // Each sum is divided by its number of terms: longer lags have fewer, and would read too short otherwise.
    for (let lag = minLag; lag <= maxLag + 1; lag++) { let sum = 0; for (let i = 0; i + lag < buf.length; i++) sum += buf[i] * buf[i + lag]; c[lag] = sum / (buf.length - lag); }
    // Start after the first dip, so the peak at lag 0 does not count. Then take the first peak that is nearly as high
    // as the highest one: later peaks are whole multiples of the period and would read an octave or more too low.
    let start = minLag;
    while (start < maxLag && c[start] > c[start + 1]) start++;
    let top = -Infinity;
    for (let lag = start; lag <= maxLag; lag++) top = Math.max(top, c[lag]);
    if (!(top > 0)) return null;
    let at = -1;
    for (let lag = Math.max(start, minLag + 1); lag <= maxLag; lag++) if (c[lag] >= 0.9 * top && c[lag] >= c[lag - 1] && c[lag] >= c[lag + 1]) { at = lag; break; }
    if (at < 0) return null;
    const a = c[at - 1], b = c[at], d = c[at + 1], shift = (a - d) / (2 * (a - 2 * b + d) || 1);
    return rate / (at + (Number.isFinite(shift) ? shift : 0));
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
    TUNINGS, STANDARD, STRING_NAMES, CIRCLE, OPEN_CHORDS, CAGED, MOVABLE, TRIAD_SETS, CHORD_SCALE, INVERSIONS, MODE_INDEX,
    mod, parseNote, pcOf, pcName, parseDegree, spell, intervalBySemi, INTERVAL_SONGS, scaleById, chordById,
    tonesOn, chordName, signature, diatonic, outsideChords, keyCells, cagedShapes, cagedMap, standardShift, sharedPlaces, triadVoicings, positions, boxes,
    placeShape, chordShapes, slashShapes, DROP_SETS, dropVoicings, fingers, arpeggioBoxes, romanOf, pitchOf, identifyChord, chordsFrom, scalesWith, scaleChords, parentMajor, voiceLead,
    midiName: (midi, flats = false) => pcName(midi, flats),
    freq: midi => 440 * Math.pow(2, (midi - 69) / 12)
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = theory;
  else { root.GT = root.GT || {}; root.GT.theory = theory; }
})(typeof window !== 'undefined' ? window : globalThis);
