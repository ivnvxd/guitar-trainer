/* Sound: a plucked-string voice (Karplus-Strong), a soft tone, chords, sequences and a metronome.
   Browsers start audio only after a click or a key press, so the context opens on first use. */
(function (root) {
  'use strict';
  const GT = root.GT = root.GT || {};
  let ctx = null, master = null;
  const cache = new Map();
  let voice = 'pluck';
  const active = new Set();   // sources that are playing or scheduled
  const pending = new Set();  // timers that start sounds later
  const track = (node, bag = active) => { bag.add(node); node.onended = () => bag.delete(node); };
  let volume = 0.8;
  // The sound switch: the volume stays as it is, the output is closed.
  let muted = false;

  function context() {
    const Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return null;
    if (!ctx) {
      // iPhone: without this, the ring/silent switch mutes the site. Safari 17 and later.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older browsers */ }
      ctx = new Ctx({ latencyHint: 'interactive' });
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      // A gentle low-pass takes the edge off the plucked noise.
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass'; tone.frequency.value = 5200; tone.Q.value = 0.4;
      // A limiter keeps strums and chords below clipping.
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -8; limit.knee.value = 4; limit.ratio.value = 12; limit.attack.value = 0.003; limit.release.value = 0.2;
      master.connect(tone); tone.connect(limit); limit.connect(ctx.destination);
    }
    // Safari also has the state 'interrupted', after a call or a switch to another app.
    if (ctx.state !== 'running') ctx.resume().catch(() => { /* needs a tap first */ });
    return ctx;
  }

  // Phones start audio only inside a tap. The first tap or key press anywhere opens the sound:
  // it resumes the context and plays one silent sample, which iOS needs to unlock the output.
  // Older iPhones without navigator.audioSession: a short silent <audio> element moves the page
  // to the media channel, so the silent switch does not mute it.
  // The media step runs until a play() succeeds, because iOS may not count the first event as a tap.
  let mediaDone = !(/iPhone|iPad|iPod/.test(navigator.userAgent)) || !!navigator.audioSession;
  let mediaTrying = false;
  const SILENT_WAV = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
  function unlock() {
    if (!context()) return;
    if (ctx.state !== 'running') {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
    }
    if (!mediaDone && !mediaTrying) {
      mediaTrying = true;
      try {
        const tag = document.createElement('audio');
        tag.setAttribute('x-webkit-airplay', 'deny');
        tag.preload = 'auto';
        tag.src = SILENT_WAV;
        const p = tag.play();
        if (p && p.then) p.then(() => { mediaDone = true; tag.pause(); }).catch(() => { /* try again on the next tap */ }).finally(() => { mediaTrying = false; });
        else { mediaDone = true; mediaTrying = false; }
      } catch { mediaTrying = false; }
    }
    if (ctx.state === 'running' && mediaDone) for (const type of GESTURES) root.removeEventListener(type, unlock, true);
  }
  const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'];
  for (const type of GESTURES) root.addEventListener(type, unlock, true);
  // Back from another app: the context may be paused. The next tap resumes it as well.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !ctx || ctx.state === 'running') return;
    ctx.resume().catch(() => {});
    for (const type of GESTURES) root.addEventListener(type, unlock, true);
  });
  const freq = midi => 440 * Math.pow(2, (midi - 69) / 12);
  // The bass note of a chord, in the lowest octave of the guitar (E2 to D♯3). Lower notes are lost on a phone speaker.
  const bass = pc => 40 + ((pc - 40) % 12 + 12) % 12;

  // Karplus-Strong. The averaging filter delays by half a sample, so the period is N + 0.5.
  // The playback rate then corrects the pitch exactly, which matters for ear training.
  function pluckBuffer(midi) {
    if (cache.has(midi)) return cache.get(midi);
    const sr = ctx.sampleRate, f = freq(midi);
    const N = Math.max(2, Math.floor(sr / f - 0.5));
    const seconds = midi < 52 ? 3.2 : midi < 64 ? 2.6 : 2.0;
    const out = new Float32Array(Math.floor(sr * seconds));
    const line = new Float32Array(N);
    // Excitation: noise smoothed once, so the attack sounds like a pick, not a hiss.
    let prev = 0;
    for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; line[i] = (r + prev) * 0.5; prev = r; }
    const decay = 0.996 + Math.min(0.0035, (64 - Math.min(64, midi)) * 0.00008);
    let idx = 0, last = line[N - 1];
    for (let n = 0; n < out.length; n++) {
      const cur = line[idx];
      const next = (cur + last) * 0.5 * decay;
      last = cur;
      line[idx] = next;
      out[n] = cur;
      idx = idx + 1 === N ? 0 : idx + 1;
    }
    // Fade the last quarter to zero, so a long bass note does not stop with a click.
    const fade = Math.floor(out.length / 4);
    for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
    const buffer = ctx.createBuffer(1, out.length, sr);
    buffer.copyToChannel(out, 0);
    const item = { buffer, rate: f / (sr / (N + 0.5)) };
    cache.set(midi, item);
    return item;
  }

  function playPluck(midi, at, duration, gainValue, bag) {
    const { buffer, rate } = pluckBuffer(midi);
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainValue, at);
    if (duration) {
      g.gain.setValueAtTime(gainValue, at + duration);
      g.gain.exponentialRampToValueAtTime(0.0001, at + duration + 0.12);
    }
    src.connect(g); g.connect(master);
    track(src, bag);
    src.start(at);
    src.stop(at + (duration ? duration + 0.15 : buffer.duration));
  }
  function playSoft(midi, at, duration, gainValue, bag) {
    const len = duration || 0.9;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o1.type = 'triangle'; o2.type = 'sine';
    o1.frequency.value = freq(midi); o2.frequency.value = freq(midi) * 2;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gainValue * 0.5, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o1.connect(g); o2.connect(g); g.connect(master);
    track(o1, bag); track(o2, bag);
    o1.start(at); o2.start(at); o1.stop(at + len + 0.02); o2.stop(at + len + 0.02);
  }

  // A sound was asked for while the sound is off: tell the page, so the switch can show itself.
  let lastAsked = 0;
  function askedWhileMuted() {
    if (!muted || performance.now() - lastAsked < 500) return;
    lastAsked = performance.now();
    if (GT.audio.onMuted) GT.audio.onMuted();
  }
  // Play one note. "at" is seconds from now. Returns false when the browser has no audio.
  function note(midi, at = 0, duration = 0, gainValue = 0.5) {
    if (!context()) return false;
    askedWhileMuted();
    const when = ctx.currentTime + 0.03 + at;
    (voice === 'soft' ? playSoft : playPluck)(midi, when, duration, gainValue);
    return true;
  }
  // Notes one after another ("up", "down") or together ("together"); "strum" runs over the strings.
  // A strum is slow enough to hear each string, also on a phone speaker: about a third of a second for six strings.
  // Many strings get less gain each, so the limiter does not press the chord into one sound.
  function notes(midis, mode = 'up', gap = 0.6, duration = 0) {
    if (!context()) return false;
    const list = mode === 'down' ? [...midis].reverse() : midis;
    const each = mode === 'together' ? 0 : mode === 'strum' ? Math.min(0.09, Math.max(0.065, 0.34 / list.length)) : gap;
    const gainValue = mode === 'together' ? 0.38 : mode === 'strum' ? Math.min(0.4, 0.74 / Math.sqrt(list.length)) : 0.5;
    list.forEach((m, i) => note(m, i * each, duration, gainValue));
    return true;
  }
  // A sequence of chords: [[midis], [midis], ...], one per beat at the given tempo. Each chord is a short strum.
  function chordSequence(chords, bpm = 80, beatsEach = 2) {
    if (!context()) return false;
    const beat = 60 / bpm;
    chords.forEach((midis, i) => midis.forEach((m, j) => note(m, i * beat * beatsEach + j * 0.055, beat * beatsEach * 0.95, 0.32)));
    return chords.length * beat * beatsEach;
  }
  // Stop every note that plays or waits to play, and every delayed sound. The metronome and a backing go on.
  function silence() {
    for (const id of pending) clearTimeout(id);
    pending.clear();
    for (const node of active) { try { node.stop(); } catch { /* already stopped */ } }
    active.clear();
  }
  // Run a sound later; silence() cancels it.
  function later(fn, ms) {
    const id = setTimeout(() => { pending.delete(id); fn(); }, ms);
    pending.add(id);
  }

  // Play-along: a loop of chords and a drone. They run until you stop them, so silence() leaves them
  // alone: a tap on the neck or a new position on the page does not cut the backing.
  const backing = { nodes: new Set(), timer: null, chords: null, bpm: 84, beats: 4, at: 0, nextTime: 0, onChord: null, drone: null };
  const STRUM_GAIN = [0.3, 0.15, 0.2, 0.15, 0.2, 0.15];
  function scheduleLoop() {
    // After a pause in the background the clock is behind: go on from now, not with every missed bar at once.
    if (backing.nextTime < ctx.currentTime - 0.05) backing.nextTime = ctx.currentTime + 0.05;
    while (backing.nextTime < ctx.currentTime + 0.15) {
      const i = backing.at, midis = backing.chords[i], beat = 60 / backing.bpm, when = backing.nextTime;
      const play = voice === 'soft' ? playSoft : playPluck;
      // One bar for each chord: the bass rings for the bar, a full strum on beat one, lighter strums after it.
      play(midis[0], when, beat * backing.beats * 0.98, 0.3, backing.nodes);
      for (let k = 0; k < backing.beats; k++) midis.slice(1).forEach((m, j) => play(m, when + k * beat + j * (k ? 0.016 : 0.03), beat * 0.95, STRUM_GAIN[k] || 0.15, backing.nodes));
      if (backing.onChord) {
        const chords = backing.chords;
        setTimeout(() => { if (backing.chords === chords && backing.onChord) backing.onChord(i); }, Math.max(0, (when - ctx.currentTime) * 1000));
      }
      backing.at = (i + 1) % backing.chords.length;
      backing.nextTime += beat * backing.beats;
    }
  }
  // chords: [[bass, note, note, ...], ...] as MIDI numbers. onChord(i) runs when chord i starts to sound.
  function startLoop(chords, bpm = 84, beats = 4, onChord = null) {
    if (!context()) return false;
    askedWhileMuted();
    stopLoop();
    Object.assign(backing, { chords, bpm, beats, at: 0, nextTime: ctx.currentTime + 0.1, onChord });
    scheduleLoop();
    backing.timer = setInterval(scheduleLoop, 25);
    return true;
  }
  function stopLoop() {
    clearInterval(backing.timer);
    backing.timer = null;
    backing.chords = null;
    for (const node of backing.nodes) { try { node.stop(); } catch { /* already stopped */ } }
    backing.nodes.clear();
  }
  // A held root note in three octaves. A phone speaker loses the lowest one, so the upper ones carry it.
  function startDrone(pc) {
    if (!context()) return false;
    askedWhileMuted();
    stopDrone();
    const now = ctx.currentTime, out = ctx.createGain(), low = bass(pc);
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(1, now + 0.5);
    out.connect(master);
    const oscs = [[low, 'triangle', 0.17], [low + 12, 'triangle', 0.1], [low + 24, 'sine', 0.035]].map(([midi, type, level]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq(midi); g.gain.value = level;
      o.connect(g); g.connect(out); o.start(now);
      return o;
    });
    backing.drone = { pc, out, oscs };
    return true;
  }
  function stopDrone() {
    const d = backing.drone;
    if (!d) return;
    backing.drone = null;
    const now = ctx.currentTime;
    d.out.gain.cancelScheduledValues(now);
    d.out.gain.setValueAtTime(Math.max(0.0001, d.out.gain.value), now);
    d.out.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    for (const o of d.oscs) o.stop(now + 0.3);
  }

  // Metronome with a look-ahead scheduler, so the clicks stay in time while the page works.
  const metronome = { running: false, bpm: 80, beats: 4, beat: 0, nextTime: 0, timer: null, onBeat: null };
  function click(at, accent) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.06);
  }
  function schedule() {
    while (metronome.nextTime < ctx.currentTime + 0.12) {
      const beat = metronome.beat, at = metronome.nextTime;
      click(at, beat === 0);
      if (metronome.onBeat) {
        const delay = Math.max(0, (at - ctx.currentTime) * 1000);
        setTimeout(() => metronome.running && metronome.onBeat(beat), delay);
      }
      metronome.beat = (beat + 1) % metronome.beats;
      metronome.nextTime += 60 / metronome.bpm;
    }
  }
  function startMetronome(bpm, beats, onBeat) {
    if (!context()) return false;
    askedWhileMuted();
    stopMetronome();
    Object.assign(metronome, { running: true, bpm, beats, beat: 0, nextTime: ctx.currentTime + 0.08, onBeat });
    schedule();
    metronome.timer = setInterval(schedule, 25);
    return true;
  }
  function stopMetronome() {
    metronome.running = false;
    clearInterval(metronome.timer);
    metronome.timer = null;
  }
  function setTempo(bpm) { metronome.bpm = bpm; }

  GT.audio = {
    note, notes, bass, chordSequence, silence, later, startMetronome, stopMetronome, setTempo,
    startLoop, stopLoop, startDrone, stopDrone,
    setLoopTempo(bpm) { backing.bpm = bpm; },
    get metronomeRunning() { return metronome.running; },
    get loopRunning() { return !!backing.chords; },
    // The pitch class of the drone that sounds, or null.
    get droneRoot() { return backing.drone ? backing.drone.pc : null; },
    setVoice(v) { voice = v; },
    setVolume(v) { volume = v; if (master) master.gain.value = muted ? 0 : v; },
    setMuted(v) { muted = !!v; if (master) master.gain.value = muted ? 0 : volume; },
    get muted() { return muted; },
    available: () => !!(root.AudioContext || root.webkitAudioContext),
    running: () => !!ctx && ctx.state === 'running'
  };
})(window);
