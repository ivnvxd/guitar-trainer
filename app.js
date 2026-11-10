(() => {
  'use strict';

  const STRINGS = [
    { number: 6, name: 'E', midi: 40 },
    { number: 5, name: 'A', midi: 45 },
    { number: 4, name: 'D', midi: 50 },
    { number: 3, name: 'G', midi: 55 },
    { number: 2, name: 'B', midi: 59 },
    { number: 1, name: 'e', midi: 64 }
  ];
  const KEYS = [
    { name: 'C', pc: 0 }, { name: 'C♯', pc: 1 }, { name: 'D♭', pc: 1 }, { name: 'D', pc: 2 },
    { name: 'E♭', pc: 3 }, { name: 'E', pc: 4 }, { name: 'F', pc: 5 },
    { name: 'F♯', pc: 6 }, { name: 'G', pc: 7 }, { name: 'A♭', pc: 8 },
    { name: 'A', pc: 9 }, { name: 'B♭', pc: 10 }, { name: 'B', pc: 11 }
  ];
  const NATURAL_PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const DEGREE = {
    0: { label: '1', name: 'root', degree: 1 },
    1: { label: '♭2', name: 'minor second', degree: 2 },
    2: { label: '2', name: 'major second', degree: 2 },
    3: { label: '♭3', name: 'minor third', degree: 3 },
    4: { label: '3', name: 'major third', degree: 3 },
    5: { label: '4', name: 'perfect fourth', degree: 4 },
    6: { label: '♭5', name: 'diminished fifth', degree: 5 },
    7: { label: '5', name: 'perfect fifth', degree: 5 },
    8: { label: '♭6', name: 'minor sixth', degree: 6 },
    9: { label: '6', name: 'major sixth', degree: 6 },
    10: { label: '♭7', name: 'minor seventh', degree: 7 },
    11: { label: '7', name: 'major seventh', degree: 7 },
    12: { label: '8', name: 'octave', degree: 8 }
  };

  const LESSONS = [
    { id: 'power', name: 'Anchor tones', formula: '1 · 5 · 8', semis: [0, 7, 12], description: 'Find the fifth and octave around one root: the basic power-chord shape.' },
    { id: 'major-triad', name: 'Major triad', formula: '1 · 3 · 5 · 8', semis: [0, 4, 7, 12], description: 'Add the major third and connect it to the root and fifth.' },
    { id: 'minor-triad', name: 'Minor triad', formula: '1 · ♭3 · 5 · 8', semis: [0, 3, 7, 12], description: 'Lower the third by one semitone and compare it with major.' },
    { id: 'sevenths', name: 'Two sevenths', formula: '♭7 ↔ 7', semis: [0, 10, 11, 12], description: 'Distinguish the minor and major seventh beside the octave.' },
    { id: 'major-pent', name: 'Major pentatonic', formula: '1 · 2 · 3 · 5 · 6', semis: [0, 2, 4, 7, 9, 12], description: 'Five useful degrees for simple melodic phrases.' },
    { id: 'minor-pent', name: 'Minor pentatonic', formula: '1 · ♭3 · 4 · 5 · ♭7', semis: [0, 3, 5, 7, 10, 12], description: 'Find the notes of a familiar riff and solo shape around the root.' },
    { id: 'blues', name: 'Blues scale', formula: '1 · ♭3 · 4 · ♭5 · 5 · ♭7', semis: [0, 3, 5, 6, 7, 10, 12], description: 'Add the blues note ♭5 between the fourth and fifth.' },
    { id: 'major-scale', name: 'Major scale', formula: '1 · 2 · 3 · 4 · 5 · 6 · 7', semis: [0, 2, 4, 5, 7, 9, 11, 12], description: 'Find all seven major-scale degrees in one fretboard area.' },
    { id: 'minor-scale', name: 'Natural minor', formula: '1 · 2 · ♭3 · 4 · 5 · ♭6 · ♭7', semis: [0, 2, 3, 5, 7, 8, 10, 12], description: 'Notice how the third, sixth, and seventh differ from major.' }
  ];

  const PATTERNS = {
    scales: [
      { id: 'blues', name: 'Blues scale', semis: [0, 3, 5, 6, 7, 10, 12], description: 'Minor pentatonic with the added blues note ♭5.' },
      { id: 'major-pent', name: 'Major pentatonic', semis: [0, 2, 4, 7, 9, 12], description: 'Five notes with no adjacent semitones.' },
      { id: 'minor-pent', name: 'Minor pentatonic', semis: [0, 3, 5, 7, 10, 12], description: 'Five anchor tones of a minor sound.' },
      { id: 'major', name: 'Major scale', semis: [0, 2, 4, 5, 7, 9, 11, 12], description: 'The major scale: whole · whole · half · whole · whole · whole · half.' },
      { id: 'minor', name: 'Natural minor', semis: [0, 2, 3, 5, 7, 8, 10, 12], description: 'Minor third, minor sixth, and minor seventh.' },
      { id: 'dorian', name: 'Dorian mode', semis: [0, 2, 3, 5, 7, 9, 10, 12], description: 'A minor sound with a major sixth.' },
      { id: 'mixolydian', name: 'Mixolydian mode', semis: [0, 2, 4, 5, 7, 9, 10, 12], description: 'A major sound with a minor seventh.' },
      { id: 'harmonic-minor', name: 'Harmonic minor', semis: [0, 2, 3, 5, 7, 8, 11, 12], description: 'Natural minor with a raised seventh.' },
      { id: 'melodic-minor', name: 'Melodic minor ↑', semis: [0, 2, 3, 5, 7, 9, 11, 12], description: 'The ascending form of melodic minor.' }
    ],
    chords: [
      { id: 'major', name: 'Major triad', semis: [0, 4, 7, 12], description: 'Root, major third, and perfect fifth.' },
      { id: 'minor', name: 'Minor triad', semis: [0, 3, 7, 12], description: 'Root, minor third, and perfect fifth.' },
      { id: 'diminished', name: 'Diminished triad', semis: [0, 3, 6, 12], description: 'Minor third and diminished fifth.' },
      { id: 'augmented', name: 'Augmented triad', semis: [0, 4, 8, 12], description: 'Major third and augmented fifth.' },
      { id: 'sus2', name: 'Suspended sus2', semis: [0, 2, 7, 12], description: 'Second instead of third.' },
      { id: 'sus4', name: 'Suspended sus4', semis: [0, 5, 7, 12], description: 'Fourth instead of third.' },
      { id: 'maj7', name: 'Major seventh · maj7', semis: [0, 4, 7, 11, 12], description: 'Major triad with a major seventh.' },
      { id: 'dom7', name: 'Dominant seventh · 7', semis: [0, 4, 7, 10, 12], description: 'Major triad with a minor seventh.' },
      { id: 'm7', name: 'Minor seventh · m7', semis: [0, 3, 7, 10, 12], description: 'Minor triad with a minor seventh.' },
      { id: 'm7b5', name: 'Half-diminished · m7♭5', semis: [0, 3, 6, 10, 12], description: 'Minor third, diminished fifth, and minor seventh.' }
    ],
    intervals: [
      { id: 'm2', name: 'Minor second · ♭2', semis: [0, 1], description: 'One semitone above the root.' },
      { id: 'M2', name: 'Major second · 2', semis: [0, 2], description: 'Two semitones above the root.' },
      { id: 'm3', name: 'Minor third · ♭3', semis: [0, 3], description: 'Three semitones above the root.' },
      { id: 'M3', name: 'Major third · 3', semis: [0, 4], description: 'Four semitones above the root.' },
      { id: 'P4', name: 'Perfect fourth · 4', semis: [0, 5], description: 'Five semitones above the root.' },
      { id: 'd5', name: 'Tritone · ♭5', semis: [0, 6], description: 'Six semitones above the root.' },
      { id: 'P5', name: 'Perfect fifth · 5', semis: [0, 7], description: 'Seven semitones above the root.' },
      { id: 'm6', name: 'Minor sixth · ♭6', semis: [0, 8], description: 'Eight semitones above the root.' },
      { id: 'M6', name: 'Major sixth · 6', semis: [0, 9], description: 'Nine semitones above the root.' },
      { id: 'm7', name: 'Minor seventh · ♭7', semis: [0, 10], description: 'Ten semitones above the root.' },
      { id: 'M7', name: 'Major seventh · 7', semis: [0, 11], description: 'Eleven semitones above the root.' }
    ]
  };

  const CIRCLE = [
    { name: 'C', minor: 'A', signs: '' },
    { name: 'G', minor: 'E', signs: 'F♯' },
    { name: 'D', minor: 'B', signs: 'F♯ C♯' },
    { name: 'A', minor: 'F♯', signs: 'F♯ C♯ G♯' },
    { name: 'E', minor: 'C♯', signs: 'F♯ C♯ G♯ D♯' },
    { name: 'B', minor: 'G♯', signs: 'F♯ C♯ G♯ D♯ A♯' },
    { name: 'F♯', minor: 'D♯', signs: 'F♯ C♯ G♯ D♯ A♯ E♯' },
    { name: 'D♭', minor: 'B♭', signs: 'B♭ E♭ A♭ D♭ G♭' },
    { name: 'A♭', minor: 'F', signs: 'B♭ E♭ A♭ D♭' },
    { name: 'E♭', minor: 'C', signs: 'B♭ E♭ A♭' },
    { name: 'B♭', minor: 'G', signs: 'B♭ E♭' },
    { name: 'F', minor: 'D', signs: 'B♭' }
  ];
  const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
  const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  const CHORD_QUALITY = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
  const VOICINGS = {
    major: { E: [0, 2, 2, 1, 0, 0], A: [null, 0, 2, 2, 2, 0] },
    minor: { E: [0, 2, 2, 0, 0, 0], A: [null, 0, 2, 2, 1, 0] },
    diminished: { A: [null, 0, 1, 2, 1, null] },
    augmented: { A: [null, 0, 3, 2, 2, 1] },
    sus2: { A: [null, 0, 2, 2, 0, 0] },
    sus4: { A: [null, 0, 2, 2, 3, 0] },
    maj7: { E: [0, 2, 1, 1, 0, 0], A: [null, 0, 2, 1, 2, 0] },
    dom7: { E: [0, 2, 0, 1, 0, 0], A: [null, 0, 2, 0, 2, 0] },
    m7: { E: [0, 2, 0, 0, 0, 0], A: [null, 0, 2, 0, 1, 0] },
    m7b5: { A: [null, 0, 1, 0, 1, null] }
  };

  const $ = id => document.getElementById(id);
  const mod = (n, m = 12) => ((n % m) + m) % m;
  const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
  const fretName = fret => fret === 0 ? 'open string' : `${ordinal(fret)} fret`;
  const noteAt = (stringIndex, fret) => STRINGS[stringIndex].midi + fret;
  const keyForMidi = midi => KEYS.find(key => key.pc === mod(midi)).name;
  const currentRoot = () => noteAt(state.rootString, state.rootFret);
  const currentLesson = () => LESSONS.find(lesson => lesson.id === state.lesson);
  const currentPattern = () => PATTERNS[state.family].find(pattern => pattern.id === state.pattern);
  const familyNames = { scales: 'SCALE', chords: 'CHORD', intervals: 'INTERVAL' };
  const progressKey = 'guitar-fret-learning-progress-v1';
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(progressKey) || '{}') || {}; } catch { progress = {}; }
  let audioContext;
  let playTimer;
  const state = {
    lesson: 'power', rootString: 0, rootFret: 5, questionNumber: 1,
    target: 7, queue: [], status: 'idle', selected: null, attempted: false,
    hint: false, showAnchors: false, feedbackType: '', feedbackText: '',
    key: 'A', family: 'scales', pattern: 'blues', labels: 'degrees',
    stepIndex: 0, stepHighlight: false, voicing: 'E',
    circleKey: 'C', circleQuiz: false, circleQuestion: null, circleRevealed: null, circleCorrect: false
  };

  function referenceToneInfo(semi) {
    if (state.family === 'chords' && state.pattern === 'augmented' && semi === 8) return { label: '♯5', name: 'augmented fifth', degree: 5 };
    return DEGREE[semi];
  }
  function spellNote(keyName, semi, info = DEGREE[semi]) {
    const rootLetter = keyName[0];
    const letter = LETTERS[mod(LETTERS.indexOf(rootLetter) + info.degree - 1, 7)];
    const rootPc = KEYS.find(key => key.name === keyName).pc;
    const targetPc = mod(rootPc + semi);
    const shift = mod(targetPc - NATURAL_PCS[letter] + 6) - 6;
    return letter + (shift > 0 ? '♯'.repeat(shift) : '♭'.repeat(-shift));
  }

  function saveProgress() {
    try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch { /* The trainer still works if storage is unavailable. */ }
  }
  function lessonProgress(id) {
    if (!progress[id] || typeof progress[id] !== 'object') progress[id] = { attempts: 0, firstTry: 0, solved: 0 };
    return progress[id];
  }
  function recordAttempt(correct) {
    const item = lessonProgress(state.lesson);
    item.attempts += 1;
    if (correct) item.firstTry += 1;
    saveProgress();
    renderProgress();
  }
  function recordSolved() {
    lessonProgress(state.lesson).solved += 1;
    saveProgress();
    renderProgress();
  }
  function renderProgress() {
    const total = LESSONS.reduce((n, lesson) => n + lessonProgress(lesson.id).solved, 0);
    const attempts = LESSONS.reduce((n, lesson) => n + lessonProgress(lesson.id).attempts, 0);
    const firstTry = LESSONS.reduce((n, lesson) => n + lessonProgress(lesson.id).firstTry, 0);
    $('progress-summary').innerHTML = `<strong>${total} solved</strong>${attempts ? `${Math.round(firstTry / attempts * 100)}% correct first try` : 'No answers yet'}`;
    renderLessonList();
  }
  function renderLessonList() {
    const list = $('lesson-list');
    list.replaceChildren();
    LESSONS.forEach((lesson, index) => {
      const data = lessonProgress(lesson.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lesson-button';
      button.dataset.lesson = lesson.id;
      button.setAttribute('aria-current', lesson.id === state.lesson ? 'true' : 'false');
      const number = document.createElement('span'); number.className = 'lesson-number'; number.textContent = String(index + 1).padStart(2, '0');
      const body = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = lesson.name;
      const detail = document.createElement('small'); detail.textContent = data.attempts ? `${data.solved} solved · ${Math.round(data.firstTry / data.attempts * 100)}% first try` : lesson.formula;
      body.append(title, detail); button.append(number, body); list.append(button);
    });
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function drawTarget(previous) {
    if (!state.queue.length) {
      state.queue = shuffle(currentLesson().semis.filter(semi => semi !== 0));
      if (state.queue.length > 1 && state.queue[0] === previous) [state.queue[0], state.queue[1]] = [state.queue[1], state.queue[0]];
    }
    state.target = state.queue.shift();
  }
  function resetQuestion(resetNumber = true) {
    if (resetNumber) state.questionNumber = 1;
    state.queue = [];
    drawTarget(null);
    state.status = 'idle'; state.selected = null; state.attempted = false; state.hint = false;
    state.feedbackType = ''; state.feedbackText = 'Choose a position on the fretboard.';
    renderTrainer();
  }
  function nextQuestion() {
    if (state.status !== 'correct' && state.status !== 'revealed') return;
    const previous = state.target;
    state.questionNumber += 1;
    drawTarget(previous);
    state.status = 'idle'; state.selected = null; state.attempted = false; state.hint = false;
    state.feedbackType = ''; state.feedbackText = 'Choose a position on the fretboard.';
    renderTrainer();
  }
  function matchingTrainerCells(semi) {
    const result = [];
    const start = state.rootFret - 2, end = state.rootFret + 4, root = currentRoot();
    for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
      for (let fret = start; fret <= end; fret++) if (noteAt(stringIndex, fret) - root === semi) result.push({ stringIndex, fret });
    }
    return result;
  }
  function hintCell() {
    return matchingTrainerCells(state.target).sort((a, b) => {
      const distance = cell => Math.abs(cell.stringIndex - state.rootString - (state.target === 12 ? 2 : 1)) * 10 + Math.abs(cell.fret - state.rootFret);
      return distance(a) - distance(b);
    })[0];
  }
  function renderRootControls() {
    const group = $('root-string-buttons'); group.replaceChildren();
    STRINGS.slice(0, 4).forEach((string, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.dataset.string = index; button.textContent = `${ordinal(string.number)} ${string.name}`;
      button.setAttribute('aria-pressed', index === state.rootString ? 'true' : 'false'); group.append(button);
    });
    $('root-fret').value = state.rootFret;
    $('root-fret-value').value = state.rootFret;
  }
  function makeTopCell(text, first = false, open = false) {
    const cell = document.createElement('div'); cell.className = `fret-top${first ? ' first' : ''}${open ? ' open' : ''}`; cell.textContent = text; return cell;
  }
  function makeStringLabel(string) {
    const label = document.createElement('div'); label.className = 'string-label';
    label.textContent = string.name; label.setAttribute('aria-hidden', 'true'); return label;
  }
  function makeMarker(label, type) {
    const marker = document.createElement('span'); marker.className = `note-marker ${type}`;
    marker.textContent = label; return marker;
  }
  function renderTrainerBoard() {
    const board = $('trainer-board'); board.replaceChildren();
    const start = state.rootFret - 2, end = state.rootFret + 4, root = currentRoot();
    board.append(makeTopCell('', true));
    for (let fret = start; fret <= end; fret++) board.append(makeTopCell(fret));
    const hint = state.hint ? hintCell() : null;
    for (let stringIndex = 5; stringIndex >= 0; stringIndex--) {
      const string = STRINGS[stringIndex]; board.append(makeStringLabel(string));
      for (let fret = start; fret <= end; fret++) {
        const diff = noteAt(stringIndex, fret) - root;
        const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'fret-cell';
        cell.dataset.string = stringIndex; cell.dataset.fret = fret;
        cell.setAttribute('aria-label', `${ordinal(string.number)} string ${string.name}, ${fretName(fret)}`);
        const selected = state.selected && state.selected.stringIndex === stringIndex && state.selected.fret === fret;
        const isRoot = stringIndex === state.rootString && fret === state.rootFret;
        let marker = makeMarker('', 'hidden');
        if (isRoot) { marker = makeMarker('1', 'root'); cell.classList.add('root-cell'); }
        if (state.showAnchors && [3, 4, 7, 12].includes(diff)) {
          const type = { 3: 'anchor-minor', 4: 'anchor-major', 7: 'anchor-fifth', 12: 'anchor-octave' }[diff];
          marker = makeMarker(DEGREE[diff].label, type);
        }
        if (state.status === 'revealed' && diff === state.target) { marker = makeMarker(DEGREE[diff].label, 'correct'); cell.classList.add('revealed-cell'); }
        if (hint && hint.stringIndex === stringIndex && hint.fret === fret && state.status !== 'correct' && state.status !== 'revealed') marker.classList.add('hint');
        if (selected) {
          const good = state.status === 'correct';
          marker = makeMarker(diff === 12 ? '8' : DEGREE[mod(diff)].label, good ? 'correct' : 'wrong');
          cell.classList.add('selected-cell');
        }
        cell.append(marker); board.append(cell);
      }
    }
  }
  function renderFeedback() {
    const panel = $('feedback'); panel.className = `feedback${state.feedbackType ? ' ' + state.feedbackType : ''}`;
    panel.replaceChildren();
    const icon = document.createElement('span'); icon.className = 'feedback-icon';
    icon.textContent = { correct: '✓', wrong: '×', hint: '↗' }[state.feedbackType] || '◎';
    const message = document.createElement('span'); message.textContent = state.feedbackText;
    panel.append(icon, message);
  }
  function renderTrainer() {
    const lesson = currentLesson(), rootName = keyForMidi(currentRoot()), target = DEGREE[state.target];
    $('lesson-title').textContent = lesson.name;
    $('lesson-description').textContent = lesson.description;
    $('lesson-formula').textContent = lesson.formula;
    $('question-number').textContent = `№ ${state.questionNumber}`;
    $('challenge-title').textContent = `Find ${target.label} — ${target.name}`;
    $('challenge-subtitle').textContent = `From ${rootName} on the ${ordinal(STRINGS[state.rootString].number)} string, ${fretName(state.rootFret)}`;
    $('anchor-toggle').setAttribute('aria-pressed', state.showAnchors ? 'true' : 'false');
    $('anchor-toggle').textContent = state.showAnchors ? 'Hide anchors' : 'Show anchors';
    $('next-button').disabled = state.status !== 'correct' && state.status !== 'revealed';
    renderRootControls(); renderTrainerBoard(); renderFeedback();
  }
  function respond(stringIndex, fret) {
    if (state.status === 'correct' || state.status === 'revealed') return;
    const diff = noteAt(stringIndex, fret) - currentRoot();
    const good = diff === state.target;
    if (!state.attempted) { recordAttempt(good); state.attempted = true; }
    state.selected = { stringIndex, fret };
    const keyName = keyForMidi(currentRoot());
    if (good) {
      recordSolved(); state.status = 'correct'; state.feedbackType = 'correct';
      state.feedbackText = `Correct. ${DEGREE[diff].label} is ${spellNote(keyName, diff)} on the ${ordinal(STRINGS[stringIndex].number)} string, ${fretName(fret)}.`;
    } else {
      state.status = 'wrong'; state.feedbackType = 'wrong';
      const actualLabel = diff === 12 ? '8' : DEGREE[mod(diff)].label;
      const direction = diff < 0 ? ' below the root' : diff > 12 ? ' above the octave' : '';
      state.feedbackText = `That is ${keyForMidi(noteAt(stringIndex, fret))} (${actualLabel}${direction}). Find ${DEGREE[state.target].label} and try again.`;
    }
    playMidi(noteAt(stringIndex, fret));
    renderTrainer();
  }
  function showHint() {
    if (state.status === 'correct' || state.status === 'revealed') return;
    state.hint = true; state.feedbackType = 'hint';
    const cell = hintCell();
    state.feedbackText = cell ? `One answer is on the ${ordinal(STRINGS[cell.stringIndex].number)} string (${STRINGS[cell.stringIndex].name}), ${fretName(cell.fret)}.` : 'Try a neighboring string.';
    renderTrainer();
  }
  function revealAnswer() {
    if (state.status === 'correct' || state.status === 'revealed') return;
    if (!state.attempted) { recordAttempt(false); state.attempted = true; }
    state.status = 'revealed'; state.selected = null; state.feedbackType = 'hint';
    const keyName = keyForMidi(currentRoot());
    state.feedbackText = `All positions of ${DEGREE[state.target].label} are highlighted. The note is ${spellNote(keyName, state.target)}.`;
    renderTrainer();
  }

  function renderReferenceControls() {
    $('key-select').value = state.key;
    for (const button of $('family-buttons').querySelectorAll('button')) button.setAttribute('aria-pressed', button.dataset.family === state.family ? 'true' : 'false');
    const select = $('pattern-select'); select.replaceChildren();
    for (const pattern of PATTERNS[state.family]) {
      const option = document.createElement('option'); option.value = pattern.id; option.textContent = pattern.name; select.append(option);
    }
    select.value = state.pattern;
    for (const button of $('label-buttons').querySelectorAll('button')) button.setAttribute('aria-pressed', button.dataset.labels === state.labels ? 'true' : 'false');
  }
  function renderToneStrip() {
    const strip = $('tone-strip'); strip.replaceChildren();
    const semis = currentPattern().semis;
    const activeIndex = state.stepIndex < semis.length ? state.stepIndex : (semis.length - 1) * 2 - state.stepIndex;
    semis.forEach((semi, index) => {
      if (index) { const arrow = document.createElement('span'); arrow.className = 'tone-arrow'; arrow.textContent = '→'; strip.append(arrow); }
      const chip = document.createElement('button'); chip.type = 'button'; chip.dataset.index = index;
      chip.className = `tone-chip${semi === 0 || semi === 12 ? ' root' : ''}${semi === 6 ? ' special' : ''}${state.stepHighlight && index === activeIndex ? ' current' : ''}`;
      const info = referenceToneInfo(semi);
      const degree = document.createElement('strong'); degree.textContent = info.label;
      const note = document.createElement('span'); note.textContent = spellNote(state.key, semi, info);
      chip.append(degree, note); strip.append(chip);
    });
  }
  function stepPath() {
    const semis = currentPattern().semis;
    return semis.concat(semis.slice(0, -1).reverse());
  }
  function renderStepControls() {
    const path = stepPath();
    state.stepIndex = Math.min(state.stepIndex, path.length - 1);
    const semi = path[state.stepIndex], info = referenceToneInfo(semi);
    $('reference-step-name').textContent = `${info.label} · ${spellNote(state.key, semi, info)} · ${state.stepIndex + 1} of ${path.length}`;
    $('reference-prev').disabled = state.stepIndex === 0;
    $('reference-next').disabled = state.stepIndex === path.length - 1;
    $('reference-step-toggle').setAttribute('aria-pressed', String(state.stepHighlight));
    $('reference-step-toggle').textContent = `Highlight: ${state.stepHighlight ? 'on' : 'off'}`;
  }
  function renderReferenceBoard() {
    const board = $('reference-board'); board.replaceChildren();
    const keyPc = KEYS.find(key => key.name === state.key).pc;
    const currentSemi = stepPath()[state.stepIndex];
    const map = new Map(currentPattern().semis.map(semi => [mod(semi), semi]));
    map.set(0, 0);
    board.append(makeTopCell('', true));
    for (let fret = 0; fret <= 15; fret++) board.append(makeTopCell(fret, false, fret === 0));
    for (let stringIndex = 5; stringIndex >= 0; stringIndex--) {
      const string = STRINGS[stringIndex]; board.append(makeStringLabel(string));
      for (let fret = 0; fret <= 15; fret++) {
        const midi = noteAt(stringIndex, fret), rel = mod(midi - keyPc);
        const semi = map.get(rel);
        const cell = document.createElement(semi === undefined ? 'div' : 'button');
        cell.className = `fret-cell${fret === 0 ? ' open' : ''}`;
        if (semi !== undefined) {
          cell.type = 'button'; cell.dataset.string = stringIndex; cell.dataset.fret = fret;
          const info = referenceToneInfo(semi);
          const label = state.labels === 'notes' ? spellNote(state.key, semi, info) : info.label;
          const type = semi === 0 ? 'scale-root' : semi === 6 ? 'scale-special' : 'scale-tone';
          const marker = makeMarker(label, type);
          if (state.stepHighlight) marker.classList.add(mod(semi) === mod(currentSemi) ? 'step-current' : 'step-dim');
          cell.append(marker);
          cell.setAttribute('aria-label', `${label}, ${ordinal(string.number)} string ${string.name}, ${fretName(fret)}`);
          cell.title = `${info.label} · ${spellNote(state.key, semi, info)} · ${ordinal(string.number)} string, ${fretName(fret)}`;
        }
        board.append(cell);
      }
    }
  }
  function renderReference() {
    const pattern = currentPattern();
    renderReferenceControls();
    $('reference-family-label').textContent = familyNames[state.family];
    $('reference-title').textContent = `${state.key} ${pattern.name}`;
    $('reference-description').textContent = pattern.description;
    renderStepControls(); renderToneStrip(); renderReferenceBoard(); renderVoicing();
    $('played-note').textContent = 'Tap a note on the fretboard to hear it.';
  }

  function audio() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    if (!audioContext) audioContext = new Context();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }
  function playMidi(midi, when, duration = .48) {
    const context = audio(); if (!context) return false;
    const start = when ?? context.currentTime;
    const fundamental = 440 * 2 ** ((midi - 69) / 12);
    const oscillator = context.createOscillator();
    const overtone = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle'; overtone.type = 'sine';
    oscillator.frequency.value = fundamental; overtone.frequency.value = fundamental * 2;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.16, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); overtone.connect(gain); gain.connect(context.destination);
    oscillator.start(start); overtone.start(start);
    oscillator.stop(start + duration + .01); overtone.stop(start + duration + .01);
    return true;
  }
  function playReferenceCell(stringIndex, fret) {
    const midi = noteAt(stringIndex, fret);
    const keyPc = KEYS.find(key => key.name === state.key).pc;
    const semi = currentPattern().semis.find(n => mod(n) === mod(midi - keyPc));
    if (semi === undefined) return;
    const info = referenceToneInfo(semi), note = spellNote(state.key, semi, info);
    $('played-note').textContent = `${note} · ${info.label} · ${ordinal(STRINGS[stringIndex].number)} string, ${fretName(fret)}`;
    if (!playMidi(midi)) $('played-note').textContent += ' · audio unavailable in this browser';
  }
  function playPattern() {
    clearTimeout(playTimer);
    const context = audio();
    if (!context) { $('played-note').textContent = 'Audio unavailable in this browser.'; return; }
    const keyPc = KEYS.find(key => key.name === state.key).pc;
    const base = 60 + keyPc;
    const semis = currentPattern().semis;
    semis.forEach((semi, index) => playMidi(base + semi, context.currentTime + .08 + index * .42, .35));
    $('played-note').textContent = `Playing ${state.key} ${currentPattern().name.toLowerCase()}.`;
    playTimer = setTimeout(() => { $('played-note').textContent = 'Tap a note on the fretboard to hear it.'; }, (semis.length + 1) * 420);
  }

  function voicingData() {
    const shapes = VOICINGS[state.pattern];
    if (!shapes) return null;
    if (!shapes[state.voicing]) state.voicing = Object.keys(shapes)[0];
    const rootString = state.voicing === 'E' ? 0 : 1;
    const rootPc = KEYS.find(key => key.name === state.key).pc;
    const rootFret = mod(rootPc - STRINGS[rootString].midi);
    return { offsets: shapes[state.voicing], rootString, rootFret, rootPc };
  }
  function renderVoicing() {
    const panel = $('voicing-panel');
    panel.hidden = state.family !== 'chords';
    if (panel.hidden) return;
    const data = voicingData();
    const group = $('voicing-buttons'); group.replaceChildren();
    for (const kind of Object.keys(VOICINGS[state.pattern])) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.voicing = kind;
      button.textContent = `${kind === 'E' ? '6th' : '5th'} string root`;
      button.setAttribute('aria-pressed', String(state.voicing === kind)); group.append(button);
    }
    $('voicing-description').textContent = `${state.key} · root on the ${ordinal(STRINGS[data.rootString].number)} string, ${fretName(data.rootFret)}. Frets ${data.rootFret}–${data.rootFret + Math.max(...data.offsets.filter(n => n !== null))}.`;
    const diagram = $('voicing-diagram'); diagram.replaceChildren();
    data.offsets.forEach((offset, stringIndex) => {
      const column = document.createElement('div'); column.className = `voicing-string${offset === null ? ' muted' : ''}`;
      const name = document.createElement('span'); name.className = 'string-name'; name.textContent = STRINGS[stringIndex].name;
      const line = document.createElement('div'); line.className = 'voicing-line';
      const fretLabel = document.createElement('span'); fretLabel.className = 'voicing-fret';
      if (offset === null) fretLabel.textContent = '×';
      else {
        const fret = data.rootFret + offset;
        const midi = noteAt(stringIndex, fret);
        const semi = currentPattern().semis.find(n => mod(n) === mod(midi - data.rootPc));
        const info = referenceToneInfo(semi);
        const button = document.createElement('button'); button.type = 'button'; button.dataset.string = stringIndex; button.dataset.fret = fret;
        button.setAttribute('aria-label', `${ordinal(STRINGS[stringIndex].number)} string, ${fretName(fret)}, ${info.label} ${spellNote(state.key, semi, info)}`);
        const dot = document.createElement('span'); dot.className = `voicing-dot${mod(semi) === 0 ? ' root' : ''}`; dot.textContent = info.label;
        dot.style.setProperty('--fret-offset', offset);
        button.append(dot); line.append(button);
        fretLabel.textContent = fret === 0 ? '○' : `${fret} · ${spellNote(state.key, semi, info)}`;
      }
      column.append(name, line, fretLabel); diagram.append(column);
    });
  }
  function playVoicing() {
    const data = voicingData(); if (!data) return;
    const context = audio(); if (!context) return;
    data.offsets.forEach((offset, stringIndex) => { if (offset !== null) playMidi(noteAt(stringIndex, data.rootFret + offset), context.currentTime + .04 + stringIndex * .035, 1.3); });
    $('played-note').textContent = `Playing a ${state.key} ${currentPattern().name.toLowerCase()} shape.`;
  }

  function circleEntry() { return CIRCLE.find(entry => entry.name === state.circleKey); }
  function renderCircleWheel() {
    const wheel = $('circle-wheel');
    wheel.classList.toggle('quiz', state.circleQuiz);
    wheel.querySelectorAll('.circle-key').forEach(button => button.remove());
    CIRCLE.forEach((entry, index) => {
      const angle = index * Math.PI / 6;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'circle-key';
      button.dataset.index = index;
      button.style.left = `${50 + 40 * Math.sin(angle)}%`;
      button.style.top = `${50 - 40 * Math.cos(angle)}%`;
      if (state.circleQuiz && (index === state.circleQuestion?.fromIndex || index === state.circleRevealed)) button.classList.add(index === state.circleQuestion?.fromIndex ? 'origin' : 'revealed');
      button.setAttribute('aria-current', String(entry.name === state.circleKey));
      button.setAttribute('aria-label', state.circleQuiz && index !== state.circleQuestion?.fromIndex && index !== state.circleRevealed ? `Position ${index + 1}` : `${entry.name} major, ${entry.minor} minor`);
      const major = document.createElement('strong'); major.textContent = entry.name;
      const minor = document.createElement('small'); minor.textContent = `${entry.minor}m`;
      button.append(major, minor); wheel.append(button);
    });
    $('circle-center-key').textContent = state.circleKey;
    $('circle-center-minor').textContent = `${circleEntry().minor} minor`;
  }
  function renderCircleDetails() {
    const entry = circleEntry();
    $('circle-key-name').textContent = `${entry.name} major`;
    $('circle-signature').textContent = entry.signs ? `Key signature: ${entry.signs}` : 'No sharps or flats';
    $('circle-relative').textContent = `Relative minor: ${entry.minor}`;
    const scale = $('circle-scale-notes'); scale.replaceChildren();
    MAJOR_SCALE.forEach(semi => { const chip = document.createElement('span'); chip.className = 'circle-note'; chip.textContent = spellNote(entry.name, semi); scale.append(chip); });
    const chords = $('circle-diatonic-chords'); chords.replaceChildren();
    MAJOR_SCALE.forEach((semi, index) => {
      const rootName = spellNote(entry.name, semi);
      const suffix = CHORD_QUALITY[index] === 'minor' ? 'm' : CHORD_QUALITY[index] === 'diminished' ? '°' : '';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'diatonic-chord'; button.dataset.degree = index;
      button.title = `Play the ${ROMAN[index]} chord`;
      const roman = document.createElement('span'); roman.textContent = ROMAN[index];
      button.append(roman, document.createTextNode(rootName + suffix)); chords.append(button);
    });
  }
  function renderCircleFeedback() {
    const panel = $('circle-feedback'); panel.className = `circle-feedback${state.circleFeedbackType ? ' ' + state.circleFeedbackType : ''}`;
    panel.textContent = state.circleFeedbackText || 'Choose a key on the circle.';
    $('circle-quiz-toggle').setAttribute('aria-pressed', String(state.circleQuiz));
    $('circle-quiz-toggle').textContent = state.circleQuiz ? 'End quiz' : 'Test yourself';
    $('circle-next-question').hidden = !state.circleQuiz || !state.circleCorrect;
  }
  function renderCircle() { renderCircleWheel(); renderCircleDetails(); renderCircleFeedback(); }
  function startCircleQuestion() {
    const fromIndex = Math.floor(Math.random() * CIRCLE.length);
    const direction = Math.random() < .5 ? 1 : -1;
    state.circleQuestion = { fromIndex, targetIndex: mod(fromIndex + direction, CIRCLE.length), direction };
    state.circleKey = CIRCLE[fromIndex].name;
    state.circleRevealed = null; state.circleCorrect = false;
    state.circleFeedbackType = '';
    state.circleFeedbackText = `From ${state.circleKey}, which key is a ${direction === 1 ? 'fifth' : 'fourth'} higher? Tap its position.`;
    renderCircle();
  }
  function chooseCircle(index) {
    const entry = CIRCLE[index];
    if (state.circleQuiz) {
      if (state.circleCorrect) return;
      state.circleRevealed = index;
      state.circleKey = entry.name;
      const correct = index === state.circleQuestion.targetIndex;
      state.circleCorrect = correct;
      state.circleFeedbackType = correct ? 'good' : 'bad';
      state.circleFeedbackText = correct ? `Correct: ${entry.name} major. Ready for the next question.` : `That is ${entry.name} major. Try again.`;
    } else {
      state.circleKey = entry.name;
      state.circleFeedbackType = '';
      state.circleFeedbackText = `${entry.name} major · ${entry.minor} minor`;
    }
    state.key = entry.name; state.stepIndex = 0; state.stepHighlight = false; renderReference(); renderCircle();
  }
  function playDiatonicChord(index) {
    const context = audio(); if (!context) return;
    const entry = circleEntry();
    const base = 60 + KEYS.find(key => key.name === entry.name).pc;
    for (const position of [index, index + 2, index + 4]) {
      const semi = MAJOR_SCALE[position % 7] + 12 * Math.floor(position / 7);
      playMidi(base + semi, context.currentTime + .04, .85);
    }
    if (!state.circleQuiz) {
      const root = spellNote(entry.name, MAJOR_SCALE[index]);
      const quality = CHORD_QUALITY[index];
      state.circleFeedbackText = `${ROMAN[index]} chord: ${root} ${quality}`;
      renderCircleFeedback();
    }
  }

  function initialize() {
    for (const key of KEYS) { const option = document.createElement('option'); option.value = key.name; option.textContent = key.name; $('key-select').append(option); }
    $('lesson-list').addEventListener('click', event => { const button = event.target.closest('button[data-lesson]'); if (!button) return; state.lesson = button.dataset.lesson; state.showAnchors = false; resetQuestion(); renderLessonList(); });
    $('root-string-buttons').addEventListener('click', event => { const button = event.target.closest('button[data-string]'); if (!button) return; state.rootString = Number(button.dataset.string); resetQuestion(); });
    $('root-fret').addEventListener('input', event => { state.rootFret = Number(event.target.value); resetQuestion(); });
    $('anchor-toggle').addEventListener('click', () => { state.showAnchors = !state.showAnchors; renderTrainer(); });
    $('trainer-board').addEventListener('click', event => { const cell = event.target.closest('button[data-string]'); if (cell) respond(Number(cell.dataset.string), Number(cell.dataset.fret)); });
    $('hint-button').addEventListener('click', showHint);
    $('reveal-button').addEventListener('click', revealAnswer);
    $('next-button').addEventListener('click', nextQuestion);
    $('key-select').addEventListener('change', event => { state.key = event.target.value; state.stepIndex = 0; state.stepHighlight = false; renderReference(); });
    $('family-buttons').addEventListener('click', event => { const button = event.target.closest('button[data-family]'); if (!button) return; state.family = button.dataset.family; state.pattern = PATTERNS[state.family][0].id; state.stepIndex = 0; state.stepHighlight = false; state.voicing = 'E'; renderReference(); });
    $('pattern-select').addEventListener('change', event => { state.pattern = event.target.value; state.stepIndex = 0; state.stepHighlight = false; state.voicing = 'E'; renderReference(); });
    $('label-buttons').addEventListener('click', event => { const button = event.target.closest('button[data-labels]'); if (!button) return; state.labels = button.dataset.labels; renderReference(); });
    $('tone-strip').addEventListener('click', event => { const chip = event.target.closest('button[data-index]'); if (!chip) return; state.stepIndex = Number(chip.dataset.index); state.stepHighlight = true; renderStepControls(); renderToneStrip(); renderReferenceBoard(); });
    $('reference-prev').addEventListener('click', () => { state.stepIndex = Math.max(0, state.stepIndex - 1); state.stepHighlight = true; renderStepControls(); renderToneStrip(); renderReferenceBoard(); });
    $('reference-next').addEventListener('click', () => { state.stepIndex = Math.min(stepPath().length - 1, state.stepIndex + 1); state.stepHighlight = true; renderStepControls(); renderToneStrip(); renderReferenceBoard(); });
    $('reference-step-toggle').addEventListener('click', () => { state.stepHighlight = !state.stepHighlight; renderStepControls(); renderToneStrip(); renderReferenceBoard(); });
    $('reference-board').addEventListener('click', event => { const cell = event.target.closest('button[data-string]'); if (cell) playReferenceCell(Number(cell.dataset.string), Number(cell.dataset.fret)); });
    $('play-pattern').addEventListener('click', playPattern);
    $('voicing-buttons').addEventListener('click', event => { const button = event.target.closest('button[data-voicing]'); if (!button) return; state.voicing = button.dataset.voicing; renderVoicing(); });
    $('voicing-diagram').addEventListener('click', event => { const button = event.target.closest('button[data-string]'); if (!button) return; const midi = noteAt(Number(button.dataset.string), Number(button.dataset.fret)); playMidi(midi); $('played-note').textContent = button.getAttribute('aria-label'); });
    $('play-voicing').addEventListener('click', playVoicing);
    $('circle-wheel').addEventListener('click', event => { const button = event.target.closest('button[data-index]'); if (button) chooseCircle(Number(button.dataset.index)); });
    $('circle-quiz-toggle').addEventListener('click', () => { state.circleQuiz = !state.circleQuiz; if (state.circleQuiz) startCircleQuestion(); else { state.circleQuestion = null; state.circleRevealed = null; state.circleCorrect = false; state.circleFeedbackType = ''; state.circleFeedbackText = 'Choose a key on the circle.'; renderCircle(); } });
    $('circle-next-question').addEventListener('click', startCircleQuestion);
    $('circle-diatonic-chords').addEventListener('click', event => { const button = event.target.closest('button[data-degree]'); if (button) playDiatonicChord(Number(button.dataset.degree)); });
    $('circle-show-fretboard').addEventListener('click', () => { state.key = state.circleKey; state.family = 'scales'; state.pattern = 'major'; state.stepIndex = 0; state.stepHighlight = false; renderReference(); $('reference').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    renderProgress(); resetQuestion(); renderReference(); renderCircle();
  }
  initialize();
})();
