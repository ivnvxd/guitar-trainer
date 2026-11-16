/* Sound: a plucked-string voice (Karplus-Strong), a soft tone, chords, sequences and a metronome.
   Browsers start audio only after a click or a key press, so the context opens on first use. */
(function (root) {
  'use strict';
  const GT = root.GT = root.GT || {};
  let ctx = null, master = null;
  const cache = new Map();
  let voice = 'pluck';
  const active = new Set();   // sources that are playing or scheduled
  const pending = new Map();  // timers that start sounds later, each with what to do if it is cancelled
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
    if (stuckAfterReturn()) rebuild();
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
  // Back from another app. iOS can leave the context 'interrupted', or 'running' with a clock that stands still,
  // and resume() may never answer (WebKit bugs 263627 and 273511). Only a new context helps, as a restart of the
  // app does. So the page notes the clock on return, and at the next tap it replaces a context that is not running
  // or whose clock did not move: inside a tap, iOS lets a new context start.
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let back = null;
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') {
      // An iPhone stops the sound in the background anyway. The page stops it too, so its buttons say so.
      if (IOS && stopAll() && GT.render) GT.render();
      return;
    }
    try { if (navigator.audioSession && !mic) navigator.audioSession.type = 'playback'; } catch { /* older browsers */ }
    back = { clock: ctx.currentTime, at: performance.now() };
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    for (const type of GESTURES) root.addEventListener(type, unlock, true);
  });
  function stuckAfterReturn() {
    if (!back) return false;
    const waited = performance.now() - back.at, moved = ctx.currentTime - back.clock;
    back = null;
    return ctx.state !== 'running' || (waited > 300 && moved < waited / 4000);
  }
  // A new context in place of a stuck one. Every sound stops; the player loads its song again (onNewContext).
  function rebuild() {
    stopAll();
    const old = ctx;
    ctx = null; master = null; noise = null;
    cache.clear(); active.clear(); backing.nodes.clear(); rhythm.nodes.clear();
    try { old.close().catch(() => {}); } catch { /* closed already */ }
    context();
    if (GT.audio.onNewContext) GT.audio.onNewContext();
  }
  // Everything stops: notes, rhythms, the backing, the drone and the metronome. True when a loop of some kind ran.
  function stopAll() {
    const was = metronome.running || !!backing.chords || !!backing.drone || !!rhythm.o;
    silence(); stopLoop(); stopDrone(); stopMetronome();
    return was;
  }

  // One sound at a time: the first note that a tap or a key asks for stops the notes of earlier taps, such as an
  // interval that still rings or the rest of a run. A loop, the drone, the metronome and a rhythm go on.
  // A tap is pointerdown and the click after it; the flag holds only while the handlers of the event run.
  let gesture = 0, cutFor = -1, inGesture = false;
  const arm = () => { inGesture = true; setTimeout(() => { inGesture = false; }, 0); };
  root.addEventListener('pointerdown', () => { gesture++; arm(); }, true);
  root.addEventListener('keydown', e => { if (!e.repeat) gesture++; arm(); }, true);
  root.addEventListener('click', arm, true);
  // A new sound from a tap: the notes of earlier taps stop. Notes, loops, the drone and rhythms call this.
  function fresh() { if (inGesture && cutFor !== gesture) { cutFor = gesture; cut(); } }
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
    src.fade = g;
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
    o1.fade = o2.fade = g;
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
    fresh();
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
  // Stop every note that plays or waits to play, with a short fade, and every delayed sound.
  function cut() {
    const cancelled = [...pending.values()];
    for (const id of pending.keys()) clearTimeout(id);
    pending.clear();
    const now = ctx ? ctx.currentTime : 0;
    for (const node of active) {
      const g = node.fade && node.fade.gain;
      if (g) { try { if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else g.cancelScheduledValues(now); g.setTargetAtTime(0, now, 0.015); } catch { /* gone */ } }
      try { node.stop(g ? now + 0.08 : 0); } catch { /* already stopped */ }
    }
    active.clear();
    cancelled.forEach(f => f && f());
  }
  // The same, and a rhythm stops too. The metronome and a backing go on.
  function silence() {
    stopRhythm();
    cut();
  }
  // Run a sound later; silence() cancels it. onCancel runs in its place when it is cancelled, for example to
  // take away a highlight that the sound would have taken away.
  function later(fn, ms, onCancel) {
    const id = setTimeout(() => { pending.delete(id); fn(); }, ms);
    pending.set(id, onCancel || null);
  }

  // Play-along: a loop of chords and a drone. They run until you stop them, so silence() leaves them
  // alone: a tap on the neck or a new position on the page does not cut the backing.
  const backing = { nodes: new Set(), timer: null, chords: null, bpm: 84, beats: 4, at: 0, nextTime: 0, onChord: null, drone: null, drums: false };
  // Drums under a loop, made from a sine sweep (kick) and filtered noise (snare, hi-hat).
  let noise = null;
  function noiseBuffer() {
    if (!noise) {
      noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.5), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noise;
  }
  function drum(kind, at, bag) {
    const g = ctx.createGain();
    g.connect(master);
    g.gain.setValueAtTime(0.0001, at);
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, at);
      o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
      g.gain.exponentialRampToValueAtTime(0.8, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
      o.connect(g); o.start(at); o.stop(at + 0.34); track(o, bag);
      return;
    }
    const snare = kind === 'snare', len = snare ? 0.16 : 0.045;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = snare ? 'bandpass' : 'highpass';
    f.frequency.value = snare ? 1800 : 7000;
    if (snare) f.Q.value = 0.7;
    g.gain.exponentialRampToValueAtTime(snare ? 0.4 : 0.1, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(f); f.connect(g); src.start(at); src.stop(at + len + 0.02); track(src, bag);
  }
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
      // A rock beat: kick on 1 and 3, snare on 2 and 4, hi-hat on every eighth note.
      if (backing.drums) for (let k = 0; k < backing.beats; k++) {
        drum(k % 2 ? 'snare' : 'kick', when + k * beat, backing.nodes);
        drum('hat', when + k * beat, backing.nodes);
        drum('hat', when + (k + 0.5) * beat, backing.nodes);
      }
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
    fresh();
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
    fresh();
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
  // Options: sub (clicks in a beat), plan(bar) (which clicks of a bar sound, from GT.rhythm.clickPlan),
  // ramp ({ step, every, max }: a tempo that rises) and onBar(bar, bpm).
  const metronome = { running: false, bpm: 80, base: 80, beats: 4, sub: 1, bar: 0, idx: 0, plan: null, opts: {}, nextTime: 0, timer: null, onBeat: null };
  // A click: high on beat 1, middle on the other beats, low and soft between the beats.
  function click(at, accent, soft, bag) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1760 : soft ? 880 : 1175;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(accent ? 0.5 : soft ? 0.14 : 0.3, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.06);
    if (bag) track(o, bag);
  }
  function schedule() {
    const m = metronome, run = m.run;
    // After a pause in the background the clock is behind: go on from now, not with every missed click at once.
    if (m.nextTime < ctx.currentTime - 0.05) m.nextTime = ctx.currentTime + 0.05;
    while (m.nextTime < ctx.currentTime + 0.12) {
      if (m.idx === 0) {
        if (m.opts.ramp) m.bpm = GT.rhythm.rampBpm(m.base, m.bar, m.opts.ramp);
        m.plan = m.opts.plan ? m.opts.plan(m.bar) : null;
        if (m.opts.onBar) { const bar = m.bar, bpm = m.bpm, delay = Math.max(0, (m.nextTime - ctx.currentTime) * 1000); setTimeout(() => m.running && m.run === run && m.opts.onBar(bar, bpm), delay); }
      }
      const at = m.nextTime, beat = Math.floor(m.idx / m.sub), sub = m.idx % m.sub;
      const c = m.plan ? m.plan[m.idx] : { beat, sub, accent: beat === 0 && sub === 0, sound: true };
      if (c.sound) click(at, c.accent, sub > 0);
      if (sub === 0 && m.onBeat) {
        const delay = Math.max(0, (at - ctx.currentTime) * 1000), silent = !c.sound;
        setTimeout(() => m.running && m.run === run && m.onBeat(beat, silent), delay);
      }
      m.idx = (m.idx + 1) % (m.beats * m.sub);
      if (m.idx === 0) m.bar++;
      m.nextTime += 60 / m.bpm / m.sub;
    }
  }
  function startMetronome(bpm, beats, onBeat, opts = {}) {
    if (!context()) return false;
    askedWhileMuted();
    stopMetronome();
    // run: a new start makes the beat callbacks of the last one stop.
    Object.assign(metronome, { running: true, run: (metronome.run || 0) + 1, bpm, base: bpm, beats, sub: opts.sub || 1, bar: 0, idx: 0, plan: null, opts, nextTime: ctx.currentTime + 0.08, onBeat });
    schedule();
    metronome.timer = setInterval(schedule, 25);
    return true;
  }
  function stopMetronome() {
    metronome.running = false;
    clearInterval(metronome.timer);
    metronome.timer = null;
  }
  function setTempo(bpm) { metronome.bpm = bpm; metronome.base = bpm; }

  // ---------- rhythm player ----------
  // Plays bars of rhythm: strums, chucks, bass notes or held tones, with a count-in and clicks if asked.
  // o: { bpm, beats (in a bar), barSeconds, bars (how many; 0 loops), countIn (clicks before), clicks (a click on
  //      each beat), events(bar) → [{ t (seconds into the bar), sound, dir, accent, dur, midis, step }],
  //      onStep(step, bar), onEnd() }
  // sound is 'strum', 'chuck', 'bass', 'tone', a drum ('kick', 'snare', 'hat') or 'none' (a ghost stroke: only onStep runs).
  // It returns the audio time at which bar 0 starts, so a drill can compare taps with it.
  const rhythm = { o: null, bar: 0, next: 0, timer: null, nodes: new Set(), waits: new Set() };
  function noiseHit(at, gainValue, freqValue, len, bag) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer();
    f.type = 'bandpass'; f.frequency.value = freqValue; f.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gainValue, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(at); src.stop(at + len + 0.02); track(src, bag);
  }
  // A strum goes low to high on a down stroke and high to low on an up stroke, which takes the top four strings.
  // A chuck is a muted strum: a short burst of noise and dead strings.
  function strumAt(ev, at, bag) {
    const play = voice === 'soft' ? playSoft : playPluck;
    if (ev.sound === 'bass') { play(ev.midis[0], at, ev.dur, ev.accent ? 0.42 : 0.32, bag); return; }
    if (ev.sound === 'tone') { playSoft(ev.midis[0], at, ev.dur, ev.accent ? 0.5 : 0.38, bag); return; }
    if (ev.sound === 'kick' || ev.sound === 'snare' || ev.sound === 'hat') { drum(ev.sound, at, bag); return; }
    const list = ev.dir === 'U' ? ev.midis.slice(-4).reverse() : ev.midis;
    if (ev.sound === 'chuck') {
      noiseHit(at, ev.accent ? 0.35 : 0.22, 2400, 0.05, bag);
      list.forEach((m, i) => playPluck(m, at + i * 0.004, 0.03, 0.1, bag));
      return;
    }
    const gain = (ev.dir === 'U' ? 0.12 : 0.16) * (ev.accent ? 1.45 : 1);
    list.forEach((m, i) => play(m, at + i * (ev.dir === 'U' ? 0.007 : 0.01), ev.dur, gain, bag));
  }
  function rhythmWait(fn, at) {
    const id = setTimeout(() => { rhythm.waits.delete(id); fn(); }, Math.max(0, (at - ctx.currentTime) * 1000));
    rhythm.waits.add(id);
  }
  function scheduleRhythm() {
    const o = rhythm.o;
    if (!o) return;
    if (rhythm.next < ctx.currentTime - 0.05) rhythm.next = ctx.currentTime + 0.05;
    while (rhythm.o && rhythm.next < ctx.currentTime + 0.2) {
      if (o.bars && rhythm.bar >= o.bars) {
        const end = rhythm.next;
        clearInterval(rhythm.timer); rhythm.timer = null;
        rhythmWait(() => { if (rhythm.o === o) { rhythm.o = null; if (o.onEnd) o.onEnd(); } }, end);
        return;
      }
      const at = rhythm.next, n = rhythm.bar;
      for (const ev of o.events(n)) {
        if (ev.sound !== 'none') strumAt(ev, at + ev.t, rhythm.nodes);
        if (o.onStep && ev.step !== undefined) rhythmWait(() => rhythm.o === o && o.onStep(ev.step, n), at + ev.t);
      }
      // clicks: true, false, or a function of the bar, for bars with and without the click.
      if (typeof o.clicks === 'function' ? o.clicks(n) : o.clicks) for (let b = 0; b < o.beats; b++) click(at + b * o.barSeconds / o.beats, b === 0, true, rhythm.nodes);
      rhythm.bar++;
      rhythm.next += o.barSeconds;
    }
  }
  function startRhythm(o) {
    if (!context()) return null;
    fresh();
    askedWhileMuted();
    stopRhythm();
    const beat = o.barSeconds / o.beats, start = ctx.currentTime + 0.12, count = o.countIn || 0;
    for (let k = 0; k < count; k++) click(start + k * beat, k % o.beats === 0, false, rhythm.nodes);
    Object.assign(rhythm, { o, bar: 0, next: start + count * beat });
    scheduleRhythm();
    rhythm.timer = setInterval(scheduleRhythm, 25);
    return start + count * beat;
  }
  function stopRhythm() {
    clearInterval(rhythm.timer);
    rhythm.timer = null;
    rhythm.o = null;
    for (const id of rhythm.waits) clearTimeout(id);
    rhythm.waits.clear();
    for (const node of rhythm.nodes) { try { node.stop(); } catch { /* already stopped */ } }
    rhythm.nodes.clear();
  }
  // The time on the page clock (performance.now) at which an audio time is heard. The output timestamp includes
  // the delay of the output where the browser knows it; the calibration of a drill covers the rest.
  function heardAt(audioTime) {
    if (!ctx) return performance.now();
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.performanceTime) return ts.performanceTime + (audioTime - ts.contextTime) * 1000;
    }
    return performance.now() + (audioTime - ctx.currentTime) * 1000;
  }

  // The microphone, for the tuner and the drill that listens. It runs through the context of the site, which a tap
  // has started: an iPhone keeps a context made later paused, and an analyser on it reads only silence.
  // listen() must start inside a tap. onFrame gets 4096 samples about ten times a second, or null while the
  // context is paused. It resolves to false when stop came first.
  let mic = null;
  async function listen(onFrame) {
    stopListening();
    const c = context();
    if (!c || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { const e = new Error('No microphone'); e.name = 'NoMicrophone'; throw e; }
    const me = mic = { stopped: false };
    // An iPhone records only when the page asks for recording and playback together.
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch { /* older browsers */ }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) { if (mic === me) stopListening(); throw e; }
    // The page changed, or stop came, while the microphone started.
    if (me.stopped || mic !== me) { stream.getTracks().forEach(t => t.stop()); return false; }
    if (c.state !== 'running') c.resume().catch(() => {});
    const src = c.createMediaStreamSource(stream), an = c.createAnalyser();
    an.fftSize = 4096;
    // Safari reads an analyser only when it leads to the output, so a silent gain closes the path.
    const shut = c.createGain();
    shut.gain.value = 0;
    src.connect(an); an.connect(shut); shut.connect(c.destination);
    const buf = new Float32Array(an.fftSize);
    Object.assign(me, { stream, nodes: [src, an, shut], timer: setInterval(() => {
      if (c.state !== 'running') { onFrame(null, c.sampleRate); return; }
      an.getFloatTimeDomainData(buf);
      onFrame(buf, c.sampleRate);
    }, 90) });
    return true;
  }
  function stopListening() {
    if (!mic) return;
    mic.stopped = true;
    clearInterval(mic.timer);
    if (mic.stream) mic.stream.getTracks().forEach(t => t.stop());
    if (mic.nodes) mic.nodes.forEach(n => { try { n.disconnect(); } catch { /* gone */ } });
    mic = null;
    // Back to playback only, so the silent switch of an iPhone does not mute the site.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older browsers */ }
  }
  // The loudness of a frame (root mean square) and its highest sample.
  function levelOf(buf) {
    let sum = 0, peak = 0;
    for (const v of buf) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
    return { rms: Math.sqrt(sum / buf.length), peak };
  }

  GT.audio = {
    listen, stopListening, levelOf, startRhythm, stopRhythm, heardAt,
    get rhythmRunning() { return !!rhythm.o; },
    get listening() { return !!mic; },
    note, notes, bass, chordSequence, silence, later, startMetronome, stopMetronome, setTempo,
    startLoop, stopLoop, startDrone, stopDrone,
    setLoopTempo(bpm) { backing.bpm = bpm; },
    setDrums(v) { backing.drums = !!v; },
    get metronomeRunning() { return metronome.running; },
    get loopRunning() { return !!backing.chords; },
    // The pitch class of the drone that sounds, or null.
    get droneRoot() { return backing.drone ? backing.drone.pc : null; },
    setVoice(v) { voice = v; },
    setVolume(v) { volume = v; if (master) master.gain.value = muted ? 0 : v; if (GT.audio.onVolume) GT.audio.onVolume(); },
    setMuted(v) { muted = !!v; if (master) master.gain.value = muted ? 0 : volume; if (GT.audio.onVolume) GT.audio.onVolume(); },
    // A sound asked for while the sound is off: the sound button shows it.
    askedWhileMuted,
    get muted() { return muted; },
    available: () => !!(root.AudioContext || root.webkitAudioContext),
    // The one audio context of the site and its main volume, for the player. context() starts it in a tap.
    context,
    get master() { return master; },
    // The player plays songs past the soft tone filter of the plucked sound, with the same volume.
    get volume() { return muted ? 0 : volume; },

    running: () => !!ctx && ctx.state === 'running'
  };
})(window);
