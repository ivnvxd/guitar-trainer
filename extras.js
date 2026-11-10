(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const STRINGS = [
    { number: 6, name: 'E', midi: 40 }, { number: 5, name: 'A', midi: 45 },
    { number: 4, name: 'D', midi: 50 }, { number: 3, name: 'G', midi: 55 },
    { number: 2, name: 'B', midi: 59 }, { number: 1, name: 'e', midi: 64 }
  ];
  const KEYS = [
    ['C', 0], ['C♯', 1], ['D', 2], ['E♭', 3], ['E', 4], ['F', 5],
    ['F♯', 6], ['G', 7], ['A♭', 8], ['A', 9], ['B♭', 10], ['B', 11]
  ];
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const INTERVALS = [
    { semi: 0, code: 'P1', name: 'Unison', degree: 1 },
    { semi: 1, code: 'm2', name: 'Minor 2nd', degree: 2 },
    { semi: 2, code: 'M2', name: 'Major 2nd', degree: 2 },
    { semi: 3, code: 'm3', name: 'Minor 3rd', degree: 3 },
    { semi: 4, code: 'M3', name: 'Major 3rd', degree: 3 },
    { semi: 5, code: 'P4', name: 'Perfect 4th', degree: 4 },
    { semi: 6, code: 'TT', name: 'Tritone', degree: 5 },
    { semi: 7, code: 'P5', name: 'Perfect 5th', degree: 5 },
    { semi: 8, code: 'm6', name: 'Minor 6th', degree: 6 },
    { semi: 9, code: 'M6', name: 'Major 6th', degree: 6 },
    { semi: 10, code: 'm7', name: 'Minor 7th', degree: 7 },
    { semi: 11, code: 'M7', name: 'Major 7th', degree: 7 },
    { semi: 12, code: 'P8', name: 'Octave', degree: 8 }
  ];
  const QUALITIES = {
    major: { name: 'Major', semis: [0, 4, 7], degrees: ['1', '3', '5'], degreeNumbers: [1, 3, 5] },
    minor: { name: 'Minor', semis: [0, 3, 7], degrees: ['1', '♭3', '5'], degreeNumbers: [1, 3, 5] },
    diminished: { name: 'Diminished', semis: [0, 3, 6], degrees: ['1', '♭3', '♭5'], degreeNumbers: [1, 3, 5] },
    augmented: { name: 'Augmented', semis: [0, 4, 8], degrees: ['1', '3', '♯5'], degreeNumbers: [1, 3, 5] }
  };
  const CORE_INTERVALS = [3, 4, 5, 7, 12];
  const mod = (x, base = 12) => ((x % base) + base) % base;
  const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
  const randomOf = items => items[Math.floor(Math.random() * items.length)];
  const pitch = (stringIndex, fret) => STRINGS[stringIndex].midi + fret;
  const keyName = midi => KEYS.find(([, pc]) => pc === mod(midi))[0];
  let audioContext;

  function spell(rootName, semi, degree) {
    const rootPc = KEYS.find(([name]) => name === rootName)[1];
    const letter = LETTERS[mod(LETTERS.indexOf(rootName[0]) + degree - 1, 7)];
    const targetPc = mod(rootPc + semi);
    const alteration = mod(targetPc - NATURAL[letter] + 6) - 6;
    return letter + (alteration > 0 ? '♯'.repeat(alteration) : '♭'.repeat(-alteration));
  }
  function audio() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    if (!audioContext) audioContext = new Context();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }
  function playMidi(midi, start, duration = .45) {
    const context = audio(); if (!context) return false;
    const at = start ?? context.currentTime + .02;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const oscillator = context.createOscillator();
    const overtone = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle'; overtone.type = 'sine';
    oscillator.frequency.value = frequency; overtone.frequency.value = frequency * 2;
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(.15, at + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain); overtone.connect(gain); gain.connect(context.destination);
    oscillator.start(at); overtone.start(at);
    oscillator.stop(at + duration + .01); overtone.stop(at + duration + .01);
    return true;
  }
  function playNotes(notes, presentation = 'together') {
    const context = audio(); if (!context) return false;
    const ordered = presentation === 'down' ? [...notes].reverse() : notes;
    ordered.forEach((midi, index) => playMidi(midi, context.currentTime + .06 + (presentation === 'together' ? 0 : index * .53), .43));
    return true;
  }
  function readScore(key) {
    try {
      const item = JSON.parse(localStorage.getItem(key) || '{}');
      return { total: Number(item.total) || 0, correct: Number(item.correct) || 0 };
    } catch { return { total: 0, correct: 0 }; }
  }
  function saveScore(key, score) {
    try { localStorage.setItem(key, JSON.stringify(score)); } catch { /* Practice works without storage. */ }
  }
  function readIntervalSelection() {
    try {
      const saved = JSON.parse(localStorage.getItem('fret-ear-interval-selection-v1') || 'null');
      if (Array.isArray(saved)) {
        const valid = saved.filter(semi => INTERVALS.some(item => item.semi === semi));
        if (valid.length) return new Set(valid);
      }
    } catch { /* Use the starting set when storage is unavailable. */ }
    return new Set(CORE_INTERVALS);
  }
  function saveIntervalSelection() {
    try { localStorage.setItem('fret-ear-interval-selection-v1', JSON.stringify([...ear.intervals])); } catch { /* Practice still works. */ }
  }

  const ear = {
    mode: 'interval', difficulty: 'core', presentation: 'up', number: 1,
    intervals: readIntervalSelection(),
    question: null, answered: false, lastAnswer: null,
    scores: { interval: readScore('fret-ear-interval-v1'), triad: readScore('fret-ear-triad-v1') }
  };
  function earChoices() {
    if (ear.mode === 'interval') return INTERVALS.filter(item => ear.intervals.has(item.semi));
    return ear.difficulty === 'core' ? ['major', 'minor'] : Object.keys(QUALITIES);
  }
  function buildIntervalPicker() {
    const list = $('ear-interval-list');
    for (const interval of INTERVALS) {
      const label = document.createElement('label'); label.className = 'ear-interval-option';
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = interval.semi; input.checked = ear.intervals.has(interval.semi);
      const code = document.createElement('strong'); code.textContent = interval.code;
      const name = document.createElement('span'); name.textContent = interval.name;
      label.append(input, code, name); list.append(label);
    }
  }
  function renderEarControls() {
    for (const button of $('ear-mode').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.earMode === ear.mode));
    $('ear-controls').classList.toggle('interval-mode', ear.mode === 'interval');
    $('ear-difficulty-wrap').hidden = ear.mode === 'interval';
    $('ear-interval-picker').hidden = ear.mode !== 'interval';
    const difficulty = $('ear-difficulty'); difficulty.replaceChildren();
    const options = [['core', 'Major and minor'], ['all', 'All four triad qualities']];
    options.forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; difficulty.append(option); });
    difficulty.value = ear.difficulty;
    $('ear-interval-count').textContent = `${ear.intervals.size} of ${INTERVALS.length} selected`;
    $('ear-interval-list').querySelectorAll('input').forEach(input => { input.checked = ear.intervals.has(Number(input.value)); });
    $('ear-interval-picker').querySelectorAll('[data-interval-preset]').forEach(button => {
      const set = button.dataset.intervalPreset === 'core' ? CORE_INTERVALS : INTERVALS.map(item => item.semi);
      button.setAttribute('aria-pressed', String(set.length === ear.intervals.size && set.every(semi => ear.intervals.has(semi))));
    });
    $('ear-presentation').value = ear.presentation;
    $('ear-first-note').textContent = ear.presentation === 'together' ? 'Lowest note only' : 'First note only';
  }
  function makeEarQuestion() {
    const candidates = earChoices();
    const rootString = Math.floor(Math.random() * 4);
    const rootFret = 5 + Math.floor(Math.random() * 5);
    const rootMidi = pitch(rootString, rootFret);
    if (ear.mode === 'interval') {
      const previous = ear.question?.mode === 'interval' ? ear.question.target.semi : null;
      const pool = candidates.filter(item => item.semi !== previous);
      ear.question = { mode: 'interval', rootString, rootFret, rootMidi, target: randomOf(pool.length ? pool : candidates) };
    } else {
      const previous = ear.question?.mode === 'triad' ? ear.question.target : null;
      const pool = candidates.filter(item => item !== previous);
      ear.question = {
        mode: 'triad', rootString, rootFret, rootMidi,
        target: randomOf(pool.length ? pool : candidates),
        inversion: ear.difficulty === 'all' ? Math.floor(Math.random() * 3) : 0
      };
    }
    ear.answered = false; ear.lastAnswer = null;
    renderEar();
  }
  function earPitches() {
    const question = ear.question;
    if (question.mode === 'interval') return [question.rootMidi, question.rootMidi + question.target.semi];
    const semis = QUALITIES[question.target].semis;
    const inversion = question.inversion;
    const offsets = inversion === 0 ? semis : inversion === 1 ? [semis[1], semis[2], 12] : [semis[2], 12, 12 + semis[1]];
    return offsets.map(offset => question.rootMidi + offset);
  }
  function renderEarAnswerGrid() {
    const grid = $('ear-answer-grid'); grid.replaceChildren();
    earChoices().forEach((choice, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'ear-answer';
      button.dataset.answer = ear.mode === 'interval' ? choice.semi : choice;
      const code = document.createElement('strong'); code.textContent = ear.mode === 'interval' ? choice.code : QUALITIES[choice].degrees.join('–');
      const name = document.createElement('span'); name.textContent = ear.mode === 'interval' ? choice.name : QUALITIES[choice].name;
      button.append(code, name);
      if (ear.answered) {
        const good = ear.mode === 'interval' ? choice.semi === ear.question.target.semi : choice === ear.question.target;
        if (good) button.classList.add('correct');
        else if (String(button.dataset.answer) === String(ear.lastAnswer)) button.classList.add('wrong');
        button.disabled = true;
      }
      button.setAttribute('aria-label', `${index + 1}. ${name.textContent}`);
      grid.append(button);
    });
  }
  function renderEarScore() {
    const score = ear.scores[ear.mode];
    $('ear-score').innerHTML = `<strong>${score.correct} / ${score.total}</strong>correct`;
  }
  function renderEarFeedback() {
    const panel = $('ear-feedback'); panel.className = `feedback${ear.answered ? (ear.lastAnswer === (ear.mode === 'interval' ? String(ear.question.target.semi) : ear.question.target) ? ' correct' : ' wrong') : ''}`;
    const icon = document.createElement('span'); icon.className = 'feedback-icon'; icon.textContent = ear.answered ? (panel.classList.contains('correct') ? '✓' : '×') : '◎';
    const text = document.createElement('span');
    if (!ear.answered) text.textContent = 'Play the question, then choose an answer.';
    else if (ear.mode === 'interval') text.textContent = `${panel.classList.contains('correct') ? 'Correct.' : 'Listen again.'} It was a ${ear.question.target.name.toLowerCase()} (${ear.question.target.semi} semitones).`;
    else text.textContent = `${panel.classList.contains('correct') ? 'Correct.' : 'Listen again.'} It was a ${QUALITIES[ear.question.target].name.toLowerCase()} triad in ${INVERSIONS[ear.question.inversion].toLowerCase()}.`;
    panel.replaceChildren(icon, text);
  }
  function closestTargetPosition(question) {
    const targetMidi = question.rootMidi + question.target.semi;
    const candidates = [];
    for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
      const fret = targetMidi - STRINGS[stringIndex].midi;
      if (question.target.semi === 0 && stringIndex === question.rootString && fret === question.rootFret) continue;
      if (fret >= 0 && fret <= 15) candidates.push({ stringIndex, fret });
    }
    candidates.sort((a, b) => {
      const cost = item => Math.abs(item.fret - question.rootFret) + 2 * Math.abs(item.stringIndex - question.rootString - 1);
      return cost(a) - cost(b);
    });
    return candidates[0];
  }
  function renderEarPosition() {
    const panel = $('ear-position'); panel.replaceChildren(); panel.hidden = !ear.answered;
    if (!ear.answered) return;
    const question = ear.question;
    const heading = document.createElement('strong'); heading.textContent = question.mode === 'interval' ? 'Try it on the guitar' : 'Hear the chord tones';
    const detail = document.createElement('p');
    if (question.mode === 'interval') {
      const target = closestTargetPosition(question);
      const from = keyName(question.rootMidi), to = spell(from, question.target.semi, question.target.degree);
      detail.textContent = `${from} (${ordinal(STRINGS[question.rootString].number)} string, fret ${question.rootFret}) → ${to} (${ordinal(STRINGS[target.stringIndex].number)} string, fret ${target.fret}). Sing the second note before playing it.`;
    } else {
      const quality = QUALITIES[question.target], root = keyName(question.rootMidi);
      const names = quality.semis.map((semi, index) => spell(root, semi, quality.degreeNumbers[index]));
      const order = question.inversion === 0 ? [0, 1, 2] : question.inversion === 1 ? [1, 2, 0] : [2, 0, 1];
      detail.textContent = `${root} ${quality.name.toLowerCase()}, ${INVERSIONS[question.inversion].toLowerCase()}: ${order.map(index => names[index]).join(' – ')} (${order.map(index => quality.degrees[index]).join('–')}). Sing from the lowest note, then replay.`;
    }
    panel.append(heading, detail);
  }
  function renderEar() {
    renderEarControls(); renderEarScore(); renderEarAnswerGrid(); renderEarFeedback(); renderEarPosition();
    $('ear-question-number').textContent = String(ear.number);
    $('ear-prompt').textContent = ear.mode === 'interval' ? 'Which interval did you hear?' : 'Which triad quality did you hear?';
    $('ear-instruction').textContent = ear.mode === 'interval' ? 'The starting note changes each question; focus on the distance.' : 'Listen for the third and fifth. Advanced questions may use an inversion.';
    $('ear-next').disabled = !ear.answered;
  }
  function answerEar(value) {
    if (ear.answered) return;
    ear.answered = true; ear.lastAnswer = String(value);
    const correct = ear.mode === 'interval' ? Number(value) === ear.question.target.semi : value === ear.question.target;
    const score = ear.scores[ear.mode]; score.total++; if (correct) score.correct++;
    saveScore(`fret-ear-${ear.mode}-v1`, score);
    renderEar();
  }

  const TRIAD_SETS = { top: [3, 4, 5], middle: [2, 3, 4] };
  const INVERSIONS = ['Root position', 'First inversion', 'Second inversion'];
  const triad = { key: 'C', quality: 'major', strings: 'top', hideNotes: false, quizTarget: null, quizAnswered: false, quizMessage: 'Hear an inversion and choose the matching card.' };
  function triadVoicing(inversion) {
    const quality = QUALITIES[triad.quality], [third, fifth] = quality.semis.slice(1);
    const offsets = inversion === 0 ? [0, third, fifth] : inversion === 1 ? [third, fifth, 12] : [fifth, 12, 12 + third];
    const set = TRIAD_SETS[triad.strings];
    const rootPc = KEYS.find(([name]) => name === triad.key)[1];
    const candidates = [];
    for (let bassFret = 0; bassFret <= 15; bassFret++) {
      const bassMidi = pitch(set[0], bassFret);
      if (mod(bassMidi - rootPc) !== mod(offsets[0])) continue;
      const midis = offsets.map(offset => bassMidi + offset - offsets[0]);
      const frets = midis.map((midi, index) => midi - STRINGS[set[index]].midi);
      if (frets.some(fret => fret < 0 || fret > 15)) continue;
      if (Math.max(...frets) - Math.min(...frets) > 4) continue;
      candidates.push({ inversion, set, midis, frets, offsets });
    }
    candidates.sort((a, b) => Math.min(...a.frets) - Math.min(...b.frets));
    return candidates[0] || null;
  }
  function triadDegree(semi) {
    const quality = QUALITIES[triad.quality];
    const index = quality.semis.findIndex(value => mod(value) === mod(semi));
    return { index, label: quality.degrees[index], degree: quality.degreeNumbers[index] };
  }
  function renderTriadCard(inversion) {
    const voicing = triadVoicing(inversion);
    const card = document.createElement('button'); card.type = 'button'; card.className = 'triad-card'; card.dataset.inversion = inversion;
    if (triad.quizAnswered && inversion === triad.quizTarget) card.classList.add('correct');
    const title = document.createElement('strong'); title.className = 'triad-card-title'; title.textContent = INVERSIONS[inversion];
    const bassDegree = triadDegree(voicing.offsets[0]);
    const bass = document.createElement('span'); bass.className = 'triad-card-bass'; bass.textContent = `${bassDegree.label} in the bass · tap to hear`;
    const board = document.createElement('span'); board.className = 'triad-mini-grid';
    const start = Math.max(0, Math.min(...voicing.frets) - 1);
    const top = document.createElement('span'); top.className = 'triad-mini-label'; board.append(top);
    for (let fret = start; fret < start + 5; fret++) { const cell = document.createElement('span'); cell.className = 'triad-mini-fret'; cell.textContent = fret; board.append(cell); }
    for (let row = 2; row >= 0; row--) {
      const stringIndex = voicing.set[row];
      const stringLabel = document.createElement('span'); stringLabel.className = 'triad-mini-label'; stringLabel.textContent = STRINGS[stringIndex].name; board.append(stringLabel);
      for (let fret = start; fret < start + 5; fret++) {
        const cell = document.createElement('span'); cell.className = 'triad-mini-cell';
        if (fret === voicing.frets[row]) {
          const info = triadDegree(voicing.offsets[row]);
          const marker = document.createElement('span'); marker.className = `triad-mini-note${info.index === 0 ? ' root' : ''}`;
          marker.textContent = triad.hideNotes ? info.label : spell(triad.key, mod(voicing.offsets[row]), info.degree);
          cell.append(marker);
        }
        board.append(cell);
      }
    }
    const notes = document.createElement('span'); notes.className = 'triad-card-notes';
    notes.textContent = voicing.offsets.map(semi => { const info = triadDegree(semi); return spell(triad.key, mod(semi), info.degree); }).join(' – ');
    card.append(title, bass, board, notes);
    return card;
  }
  function renderTriads() {
    $('triad-key').value = triad.key; $('triad-quality').value = triad.quality; $('triad-strings').value = triad.strings;
    $('triad-label-toggle').setAttribute('aria-pressed', String(triad.hideNotes));
    $('triad-label-toggle').textContent = triad.hideNotes ? 'Show note names' : 'Hide note names';
    const quality = QUALITIES[triad.quality];
    $('triad-formula').textContent = `${triad.key} ${quality.name.toLowerCase()} · ${quality.degrees.join('–')}`;
    $('triad-notes').textContent = quality.semis.map((semi, index) => spell(triad.key, semi, quality.degreeNumbers[index])).join(' – ');
    const cards = $('triad-cards'); cards.replaceChildren();
    for (let inversion = 0; inversion < 3; inversion++) cards.append(renderTriadCard(inversion));
    $('triad-quiz-feedback').textContent = triad.quizMessage;
    $('triad-quiz-next').disabled = !triad.quizAnswered;
    $('triad-quiz-play').textContent = triad.quizTarget === null ? '▶ Play a question' : '▶ Replay question';
  }
  function playTriadVoicing(inversion) {
    const voicing = triadVoicing(inversion);
    playNotes(voicing.midis, 'together');
  }
  function resetTriadQuiz() {
    triad.quizTarget = null; triad.quizAnswered = false;
    triad.quizMessage = 'Hear an inversion and choose the matching card.';
    renderTriads();
  }
  function newTriadQuiz() {
    triad.quizTarget = Math.floor(Math.random() * 3);
    triad.quizAnswered = false;
    triad.quizMessage = 'Which inversion is sounding? Listen to the lowest note.';
    renderTriads(); playTriadVoicing(triad.quizTarget);
  }

  function init() {
    buildIntervalPicker();
    $('ear-mode').addEventListener('click', event => {
      const button = event.target.closest('button[data-ear-mode]'); if (!button) return;
      ear.mode = button.dataset.earMode; ear.difficulty = 'core'; ear.number = 1; makeEarQuestion();
    });
    $('ear-interval-picker').addEventListener('click', event => {
      const button = event.target.closest('button[data-interval-preset]'); if (!button) return;
      ear.intervals = new Set(button.dataset.intervalPreset === 'core' ? CORE_INTERVALS : INTERVALS.map(item => item.semi));
      $('ear-interval-help').textContent = 'Choose any combination. At least one interval must stay selected.';
      saveIntervalSelection(); ear.number = 1; makeEarQuestion();
    });
    $('ear-interval-list').addEventListener('change', event => {
      const input = event.target.closest('input[type="checkbox"]'); if (!input) return;
      const semi = Number(input.value);
      if (!input.checked && ear.intervals.size === 1) {
        input.checked = true;
        $('ear-interval-help').textContent = 'Keep at least one interval selected. Select another one first.';
        return;
      }
      if (input.checked) ear.intervals.add(semi); else ear.intervals.delete(semi);
      $('ear-interval-help').textContent = 'Choose any combination. At least one interval must stay selected.';
      saveIntervalSelection(); ear.number = 1; makeEarQuestion();
    });
    $('ear-difficulty').addEventListener('change', event => { ear.difficulty = event.target.value; ear.number = 1; makeEarQuestion(); });
    $('ear-presentation').addEventListener('change', event => { ear.presentation = event.target.value; renderEarControls(); });
    $('ear-replay').addEventListener('click', () => { if (!playNotes(earPitches(), ear.presentation)) $('ear-feedback').textContent = 'Audio is unavailable in this browser.'; });
    $('ear-first-note').addEventListener('click', () => { const notes = earPitches(); playMidi(ear.presentation === 'down' ? notes[notes.length - 1] : notes[0]); });
    $('ear-answer-grid').addEventListener('click', event => { const button = event.target.closest('button[data-answer]'); if (button) answerEar(button.dataset.answer); });
    $('ear-next').addEventListener('click', () => { if (!ear.answered) return; ear.number++; makeEarQuestion(); playNotes(earPitches(), ear.presentation); });
    document.addEventListener('keydown', event => {
      if (!$('ear-training').contains(document.activeElement) || ['SELECT', 'INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (event.code === 'Space') { event.preventDefault(); playNotes(earPitches(), ear.presentation); }
      else if (/^Digit[1-9]$/.test(event.code)) { const answer = $('ear-answer-grid').children[Number(event.code.slice(-1)) - 1]; if (answer) answer.click(); }
    });
    for (const [name] of KEYS) { const option = document.createElement('option'); option.value = name; option.textContent = name; $('triad-key').append(option); }
    $('triad-key').addEventListener('change', event => { triad.key = event.target.value; resetTriadQuiz(); });
    $('triad-quality').addEventListener('change', event => { triad.quality = event.target.value; resetTriadQuiz(); });
    $('triad-strings').addEventListener('change', event => { triad.strings = event.target.value; resetTriadQuiz(); });
    $('triad-label-toggle').addEventListener('click', () => { triad.hideNotes = !triad.hideNotes; renderTriads(); });
    $('triad-cards').addEventListener('click', event => {
      const card = event.target.closest('button[data-inversion]'); if (!card) return;
      const inversion = Number(card.dataset.inversion);
      if (triad.quizTarget !== null && !triad.quizAnswered) {
        triad.quizAnswered = true;
        triad.quizMessage = inversion === triad.quizTarget ? `Correct: ${INVERSIONS[inversion].toLowerCase()}.` : `That was ${INVERSIONS[triad.quizTarget].toLowerCase()}. Play both cards to compare the bass note.`;
        renderTriads();
      }
      playTriadVoicing(inversion);
    });
    $('triad-quiz-play').addEventListener('click', () => { if (triad.quizTarget === null) newTriadQuiz(); else playTriadVoicing(triad.quizTarget); });
    $('triad-quiz-next').addEventListener('click', () => { if (triad.quizAnswered) newTriadQuiz(); });
    makeEarQuestion(); renderTriads();
  }
  init();
})();
