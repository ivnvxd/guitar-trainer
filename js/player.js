/* Slow down: a player to learn songs by ear, the Tools page tools/play.
   Open a song file (audio or video), a YouTube link, or record a part of a browser tab. Slow it down without
   changing its pitch, transpose it, loop a part, mark the parts of a song, cut the bass, the drums or the voice, and
   see the notes at the playhead while it plays. A file never leaves this device. The page keeps the markers and the settings of each song in the browser,
   and a recording until you delete it.
   The sound of a file goes through Signalsmith Stretch (js/vendor), which the page loads when you open a file.
   A YouTube video plays in YouTube's own frame: the page can only ask it for a speed from its list and jump back for
   a loop, so the other tools work only on files and recordings. */
(function (root) {
  'use strict';
  const GT = root.GT, A = GT.audio, T = GT.theory, FB = GT.fretboard;
  const { h, store, settings } = GT;

  // Longer songs need too much memory on a phone: the sound of a 10-minute song is about 200 MB.
  // A mono copy at a lower rate draws the waveform and feeds the note guess.
  const MONO_RATE = 22050;
  // The waveform keeps the loudest sample and the average of each block of the mono copy, for a view from far.
  const BLOCK = 64;
  // The closest zoom shows 2 seconds.
  const MIN_SPAN = 2;
  // The drum cut (js/drumcut.js) sends the sound out late: by 4096 samples and some steps of 1024 samples, more
  // steps for a slower song. The numbers are the same as in that file.
  const drumDelay = rate => 4096 + clamp(Math.round(4 / rate), 4, 18) * 1024;
  // neck: the notes at the playhead also show on a neck. On a phone the neck is off at first, because it is tall.
  // tab: the group of settings that is open. snap: the ends of a loop go to the nearest beat, when the song has beats.
  const saved = Object.assign({ songs: {}, neck: !matchMedia('(max-width: 660px)').matches, tab: 'loop', snap: true, chords: true }, store.get('player', {}));
  const save = () => store.set('player', saved);

  // The state of the player. It lives as long as the page is open, so you can look at another page and come back.
  const P = {
    kind: null, key: null, name: '', duration: 0, pos: 0, playing: false,
    rate: 1, semis: 0, cut: { bass: false, drums: false, voice: false }, boost: false, a: null, b: null, loop: false, gap: 0, climb: 0, markers: [],
    // view: the part of the song that the waveform shows. free: you moved the view, so it does not follow the song.
    view: { start: 0, span: 0 }, free: false, stereo: true, posAt: 0,
    node: null, out: null, drum: null, mono: null, video: null, videoUrl: null,
    yt: null, ytId: null, ytRates: [1], ytTimer: null, waitTimer: null, lastT: 0,
    rec: null, ui: {}
  };
  const fmt = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; };
  // With tenths of a second, for the ends of the loop.
  const fmt1 = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor((t - m * 60) * 10) / 10; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
  const isFile = () => P.kind === 'file';
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hasLoop = () => P.a !== null && P.b !== null && P.b > P.a;
  const noCut = () => ({ bass: false, drums: false, voice: false });

  // ---------- saved songs ----------
  function remember() {
    if (!P.key) return;
    saved.songs[P.key] = { name: P.name, markers: P.markers, a: P.a, b: P.b, loop: P.loop, rate: P.rate, semis: P.semis, cut: Object.keys(P.cut).filter(k => P.cut[k]), boost: P.boost, gap: P.gap, climb: P.climb, beat: P.beat || null, fine: P.fine || undefined, tune: P.tune || undefined, at: Date.now() };
    save();
  }
  function restore(key) {
    const s = saved.songs[key] || {};
    // A song saved by an earlier version has one filter and no list of cuts.
    const cut = Array.isArray(s.cut) ? s.cut : s.filter === 'bass-cut' ? ['bass'] : s.filter === 'voice-cut' ? ['voice'] : [];
    Object.assign(P, { rate: s.rate || 1, semis: s.semis || 0, cut: { bass: cut.includes('bass'), drums: cut.includes('drums'), voice: cut.includes('voice') },
      boost: 'boost' in s ? !!s.boost : s.filter === 'bass-up', a: s.a ?? null, b: s.b ?? null,
      loop: !!s.loop, gap: s.gap || 0, climb: s.climb || 0, markers: Array.isArray(s.markers) ? s.markers : [], pos: 0,
      beat: s.beat && s.beat.period > 0 ? s.beat : null, fine: !!s.fine, tune: s.tune || 0, taps: null, undo: null });
  }

  // ---------- recordings and copies of opened files, kept in IndexedDB ----------
  const NOT_KEPT = 'The browser did not keep this song: its storage is full, or it is a private window. The song is open now, but it is gone when you leave the page. Delete songs that you do not need in "Your songs".';
  const NO_COPY = 'The browser did not keep a copy of this song: its storage is full, or it is a private window. The song is open now. Next time, choose the file again. Delete songs that you do not need in "Your songs".';
  // The key of a kept song in the saved songs. The copy of a file has the key of that file as its id, so the loop
  // and the parts of a file are the same with and without a copy.
  const songKey = r => r.id.startsWith('file:') ? r.id : `rec:${r.id}`;
  function db() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('guitar-trainer', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('recordings', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function recordings(op, value) {
    try {
      const base = await db();
      return await new Promise((resolve, reject) => {
        const tx = base.transaction('recordings', op === 'list' ? 'readonly' : 'readwrite'), st = tx.objectStore('recordings');
        const req = op === 'list' ? st.getAll() : op === 'put' ? st.put(value) : op === 'get' ? st.get(value) : st.delete(value);
        // A write counts when the browser has kept it: a full store gives up after the request went well.
        tx.oncomplete = () => resolve(op === 'delete' ? true : req.result);
        tx.onerror = tx.onabort = () => reject(tx.error || req.error);
      });
    } catch (e) { return op === 'list' ? [] : null; }
  }

  // ---------- the sound of a file ----------
  let stretchScript = null;
  function loadStretch() {
    if (root.SignalsmithStretch) return Promise.resolve();
    if (!stretchScript) stretchScript = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/signalsmith-stretch.js';
      s.onload = resolve;
      s.onerror = () => { stretchScript = null; reject(new Error('The slow-down engine did not load. Check the connection and try again.')); };
      document.head.append(s);
    });
    return stretchScript;
  }
  async function engine() {
    if (P.node) return P.node;
    await loadStretch();
    const c = A.context();
    P.node = await root.SignalsmithStretch(c);
    P.out = c.createGain();
    P.out.connect(c.destination);
    route();
    P.node.setUpdateInterval(0.05, t => onTime(t));
    return P.node;
  }
  // The drum cut is a worklet of its own. The page loads it the first time you ask for it, and for each new context.
  function drumNode() {
    const c = A.context();
    if (P.drum && P.drum.context === c) return P.drum;
    if (!c.audioWorklet) return null;
    if (!P.drumLoad || P.drumLoad !== c) {
      P.drumLoad = c;
      c.audioWorklet.addModule('js/drumcut.js').then(() => {
        if (A.context() !== c) return;
        P.drum = new AudioWorkletNode(c, 'gt-drum-cut', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
        P.drumRate = 0;
        route();
      }).catch(() => { P.drumLoad = null; P.cut = Object.assign({}, P.cut, { drums: false }); say('The drum cut did not load. Check the connection and try again.', 'bad'); draw(); });
    }
    return null;
  }
  // The sound in the drum cut is from before a jump: drop it.
  const clearDrum = () => { if (P.drum) P.drum.port.postMessage('clear'); };
  // How late the sound is, in seconds.
  const lag = () => P.cut.drums && P.drum && isFile() ? drumDelay(P.rate) / A.context().sampleRate : 0;
  // A slowed song has slow drum hits, so the drum cut gets the speed.
  function drumSpeed() {
    if (!P.drum || P.drumRate === P.rate) return;
    P.drumRate = P.rate;
    P.drum.port.postMessage({ rate: P.rate });
  }
  // The cuts between the player and the speakers, one after the other, so they work together.
  // Drums: see js/drumcut.js. Voice: above 180 Hz only what differs between left and right stays, so a voice in the
  // middle of a stereo mix goes, and what else is in the middle there. Under 180 Hz the sound stays, so the bass
  // and the kick drum stay. Bass: the sound under 200 Hz goes.
  function route() {
    if (!P.node) return;
    const c = A.context();
    [P.node, P.drum].concat(P.chain || []).forEach(n => { try { if (n) n.disconnect(); } catch (e) { /* not connected */ } });
    P.chain = [];
    P.out.gain.value = A.volume;
    let last = P.node;
    const add = n => { last.connect(n); P.chain.push(n); last = n; return n; };
    const filter = (type, hz, gain) => { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = 0.7; if (gain) f.gain.value = gain; return f; };
    const gain = v => { const g = c.createGain(); g.gain.value = v; return g; };
    if (P.cut.drums) { const d = drumNode(); if (d) { drumSpeed(); last.connect(d); last = d; } }
    if (P.cut.voice && P.stereo) {
      const split = add(c.createChannelSplitter(2)), side = gain(0.8), flip = gain(-1), low = gain(0.5), mix = gain(1);
      split.connect(side, 0); split.connect(flip, 1); flip.connect(side);
      split.connect(low, 0); split.connect(low, 1);
      const sideHigh = [filter('highpass', 180), filter('highpass', 180)], lowOnly = [filter('lowpass', 180), filter('lowpass', 180)];
      side.connect(sideHigh[0]); sideHigh[0].connect(sideHigh[1]); sideHigh[1].connect(mix);
      low.connect(lowOnly[0]); lowOnly[0].connect(lowOnly[1]); lowOnly[1].connect(mix);
      P.chain.push(side, flip, low, mix, ...sideHigh, ...lowOnly);
      last = mix;
    }
    if (P.cut.bass) { add(filter('highpass', 200)); add(filter('highpass', 200)); }
    else if (P.boost) { add(filter('lowshelf', 220, 10)); add(gain(0.6)); }
    last.connect(P.out);
  }
  // A mono copy at about 22 kHz, and for each block of it the loudest sample and the average, for the waveform.
  function keepMono(buf) {
    const step = Math.max(1, Math.round(buf.sampleRate / MONO_RATE)), n = Math.floor(buf.length / step);
    const l = buf.getChannelData(0), r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
    const mono = new Float32Array(n);
    let sides = 0, all = 0;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k < step; k++) s += l[i * step + k] + r[i * step + k];
      mono[i] = s / (2 * step);
      const d = l[i * step] - r[i * step];
      sides += d * d; all += mono[i] * mono[i];
    }
    P.mono = mono;
    P.monoRate = buf.sampleRate / step;
    // A file with the same sound left and right has nothing for the voice cut to work on.
    P.stereo = buf.numberOfChannels > 1 && sides > all * 1e-4;
    // What differs between left and right, at half the rate and in 16 bits (about 13 MB for 10 minutes): the note
    // row reads it while the voice cut is on, so it names what you hear.
    P.side = null;
    if (P.stereo) {
      const wide = step * 2, m = Math.floor(buf.length / wide), side = new Int16Array(m);
      let sideTop = 0;
      for (let i = 0; i < m; i++) {
        let d = 0;
        for (let k = 0; k < wide; k++) d += l[i * wide + k] - r[i * wide + k];
        d = clamp(d / (2 * wide), -1, 1);
        side[i] = d * 32767;
        if (Math.abs(d) > sideTop) sideTop = Math.abs(d);
      }
      P.side = side; P.sideRate = buf.sampleRate / wide; P.sideTop = sideTop || 1;
    }
    const count = Math.ceil(n / BLOCK), peak = new Float32Array(count), mean = new Float32Array(count);
    let top = 0;
    for (let b = 0; b < count; b++) {
      let m = 0, sq = 0;
      const end = Math.min(n, (b + 1) * BLOCK);
      for (let i = b * BLOCK; i < end; i++) { const v = Math.abs(mono[i]); if (v > m) m = v; sq += v * v; }
      peak[b] = m; mean[b] = Math.sqrt(sq / (end - b * BLOCK));
      if (m > top) top = m;
    }
    P.blocks = { peak, mean };
    P.top = top || 1;
  }
  // Decoded sound into the player: both channels go to the engine, and only the mono copy stays here.
  // The sound of a song is in memory as a whole: about 20 MB for each minute. A long song can be too much for a
  // device, and then the browser cannot make the sound.
  const tooMuch = (name, seconds) => `The sound of ${name} did not fit in the memory of this device: it is ${fmt(seconds)} long, and each minute takes about 20 MB. Use a shorter part of it.`;
  // False when a later open started meanwhile: that one wins.
  async function loadDecoded(buf, name, key, media, my) {
    const node = await engine();
    if (my !== opening) return false;
    const chans = [0, buf.numberOfChannels > 1 ? 1 : 0].map(ch => buf.getChannelData(ch).slice());
    await node.dropBuffers();
    await node.addBuffers(chans, chans.map(c => c.buffer));
    if (my !== opening) return false;
    keepMono(buf);
    findChords(my);
    unloadYouTube();
    Object.assign(P, { kind: 'file', name, key, duration: buf.duration, ytError: null, view: { start: 0, span: buf.duration }, free: false });
    restore(key);
    if (P.videoUrl) URL.revokeObjectURL(P.videoUrl);
    P.video = null; P.videoUrl = null;
    if (media) {
      P.videoUrl = URL.createObjectURL(media);
      const video = h('video', { class: 'player-video', src: P.videoUrl, muted: true, playsinline: true, preload: 'auto' });
      video.muted = true;
      // A video file with sound only (a .mov from a recorder, for example) has no picture to show.
      video.addEventListener('loadedmetadata', () => { if (!video.videoWidth && P.video === video) { P.video = null; drawMedia(); } });
      // A picture that this browser cannot show: the song goes on with its sound.
      video.addEventListener('error', () => { if (P.video !== video) return; P.video = null; drawMedia(); say('This browser cannot show the picture of this song. The sound works.'); });
      P.video = video;
    }
    route();
    remember();
    return true;
  }
  // A file over 300 MB is a long video: its sound would not fit in a phone's memory.
  const MAX_BYTES = 300 * 1024 * 1024;
  // Each open counts. When a later open starts while an earlier one still decodes, the earlier one gives up.
  let opening = 0;
  // The length of a file from its header: a long mp3 is small as a file but large when decoded. NaN when the
  // browser cannot tell. Over 20 minutes, a sound that the browser could not make was probably too long.
  const LONG = 1200;
  function lengthOf(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file), m = document.createElement(/^video\//.test(file.type) ? 'video' : 'audio');
      const done = d => { clearTimeout(late); m.onloadedmetadata = m.onerror = null; m.removeAttribute('src'); m.load(); URL.revokeObjectURL(url); resolve(d); };
      const late = setTimeout(() => done(NaN), 2500);
      m.preload = 'metadata';
      m.onloadedmetadata = () => done(m.duration);
      m.onerror = () => done(NaN);
      m.src = url;
      m.load();
    });
  }
  // keep: you chose or dropped the file. A copy stays in the browser, so the song opens again from "Your songs"
  // with one tap: a page cannot open a file on the disk by itself.
  async function openFile(file, keep) {
    stop();
    const my = ++opening;
    if (file.size > MAX_BYTES) { say(`${file.name} is ${Math.round(file.size / 1048576)} MB. The player takes files up to 300 MB: use the sound only (mp3 or m4a), or a shorter part.`, 'bad'); return; }
    say(`Opening ${file.name}…`, 'busy');
    try {
      const c = A.context();
      if (!c) throw new Error('This browser cannot play sound.');
      if (c.state !== 'running') c.resume().catch(() => {});
      let buf;
      try { buf = await c.decodeAudioData(await file.arrayBuffer()); }
      catch (e) {
        const length = await lengthOf(file);
        throw new Error(length > LONG ? tooMuch(file.name, length) : `This browser cannot read the sound of ${file.name}. Try an mp3, m4a, wav, mp4 or mov file.`);
      }
      if (my !== opening) return;
      if (!await loadDecoded(buf, file.name, `file:${file.name}:${Math.round(buf.duration)}`, /^video\//.test(file.type) ? file : null, my)) return;
      P.source = { file };
      say('');
      drawAll();
      if (keep) {
        const key = P.key, kept = await recordings('put', { id: key, name: file.name, blob: file, at: Date.now() });
        if (P.ui.refreshSongs) P.ui.refreshSongs();
        if (!kept && P.key === key) say(NO_COPY);
      }
    } catch (e) { if (my === opening) say(e.message || 'The file did not open.', 'bad'); }
  }

  // ---------- playing a file ----------
  // The pitch of the sound: the key you chose, in semitones. With "Tune to 440" on, the recording also moves by the
  // part of a semitone that it is off (P.tune, see findChords). Note names move with the key only. The page saves
  // P.tune with the song, so the next time the sound is right from the first second.
  const pitch = () => P.semis + (P.fine ? -(P.tune || 0) : 0);
  // The engine loops by itself when there is no pause between the passes; with a pause the page stops and starts it.
  const ownLoop = () => P.loop && hasLoop() && !P.gap;
  // Where the song is now. The engine reports its place 20 times a second: between two reports the place moves on
  // with the clock, so the playhead moves evenly. With the drum cut the sound is a little late.
  function heard() {
    if (!isFile() || !P.playing || P.waiting) return P.pos;
    const looping = P.loop && hasLoop();
    // At most 0.15 s past the last report: when the reports stop, the playhead stops too.
    let t = Math.min(P.pos + Math.min(0.15, (performance.now() - P.posAt) / 1000) * P.rate, looping ? P.b : P.duration) - lag() * P.rate;
    if (looping && t < P.a && P.pos >= P.a) t = P.b - (P.a - t);
    return Math.max(0, t);
  }
  function schedule(extra = {}) {
    if (!P.node) return;
    if (P.cut.drums) drumSpeed();
    P.node.schedule(Object.assign({ rate: P.rate, semitones: pitch(), loopStart: ownLoop() ? P.a : 0, loopEnd: ownLoop() ? P.b : 0 }, extra));
  }
  function play() {
    if (P.kind === 'youtube') { if (P.yt && P.yt.playVideo) P.yt.playVideo(); return; }
    if (!isFile() || !P.node) return;
    P.holding = false;
    const c = A.context();
    if (c && c.state !== 'running') c.resume().catch(() => {});
    A.askedWhileMuted();
    // A backing from another Library page stops: one sound at a time.
    if (GT.stopBacking) GT.stopBacking();
    A.silence();
    if (P.loop && P.a !== null && P.b !== null && (P.pos < P.a || P.pos >= P.b)) P.pos = P.a;
    if (P.pos >= P.duration - 0.05) P.pos = 0;
    route();
    schedule({ active: true, input: P.pos });
    P.playing = true;
    P.lastT = P.pos;
    P.posAt = performance.now();
    if (P.video) { P.video.currentTime = P.pos; P.video.playbackRate = Math.max(0.25, P.rate); P.video.play().catch(() => {}); }
    show();
  }
  function stop() {
    clearTimeout(P.waitTimer);
    P.waiting = false;
    if (P.kind === 'youtube' && P.yt && P.yt.pauseVideo) P.yt.pauseVideo();
    if (P.node && (P.playing || P.holding)) P.node.stop();
    P.playing = false; P.holding = false;
    if (P.video) P.video.pause();
    show();
  }
  // Hold: the song stands still at one place and the sound of that place goes on, so you can find its notes on the
  // guitar. The engine plays at speed 0 for this. The speed you chose stays as it is.
  function holdAt() { P.node.schedule({ active: true, input: P.pos, rate: 0, semitones: pitch(), loopStart: 0, loopEnd: 0 }); }
  function hold(on) {
    if (!isFile() || !P.node || on === !!P.holding) return;
    if (!on) {
      P.holding = false;
      if (P.heldPlaying) play(); else { P.node.stop(); show(); }
      return;
    }
    const c = A.context();
    if (c && c.state !== 'running') c.resume().catch(() => {});
    A.askedWhileMuted();
    if (GT.stopBacking) GT.stopBacking();
    A.silence();
    P.pos = heard();
    // After the hold the song plays on, if it played before.
    P.heldPlaying = P.playing;
    clearTimeout(P.waitTimer);
    P.waiting = false; P.playing = false; P.holding = true;
    route();
    holdAt();
    if (P.video) { P.video.pause(); P.video.currentTime = P.pos; }
    show();
  }
  function seek(t) {
    P.pos = Math.max(0, Math.min(P.duration, t));
    P.posAt = performance.now();
    // The view follows the song again after a jump.
    P.free = false;
    if (P.kind === 'youtube') { if (P.yt && P.yt.seekTo) P.yt.seekTo(P.pos, true); show(); return; }
    clearDrum();
    if (P.playing) schedule({ input: P.pos }); else if (P.holding) holdAt();
    if (P.video) P.video.currentTime = P.pos;
    show();
  }
  // The end of a pass: wait if there is a pause, go a little faster if you asked for it, then start again at A.
  function nextPass() {
    if (P.climb && P.rate < 1 && P.kind !== 'youtube') { P.rate = Math.min(1, Math.round((P.rate + P.climb / 100) * 100) / 100); remember(); }
    if (P.kind === 'youtube') {
      // YouTube has only its own speeds: each pass takes the next one, up to 100%.
      if (P.climb && P.yt && P.rate < 1) { const r = P.ytRates.find(x => x > P.rate + 0.001) || 1; P.yt.setPlaybackRate(Math.min(1, r)); P.rate = Math.min(1, r); }
      P.yt.seekTo(P.a, true);
      if (P.gap) { P.yt.pauseVideo(); P.waitTimer = setTimeout(() => P.yt && P.yt.playVideo(), P.gap * 1000); }
      return;
    }
    if (P.gap) {
      P.node.stop();
      P.pos = P.a;
      P.waiting = true;
      if (P.video) P.video.pause();
      P.waitTimer = setTimeout(() => {
        P.waiting = false; P.lastT = P.a; P.posAt = performance.now();
        if (!P.playing) return;
        schedule({ active: true, input: P.a });
        if (P.video) { P.video.currentTime = P.a; P.video.play().catch(() => {}); }
      }, P.gap * 1000);
    } else schedule({ input: P.a });
    if (P.video) { P.video.currentTime = P.a; P.video.playbackRate = Math.max(0.25, P.rate); }
    show();
  }
  // The engine reports where it is about 20 times a second.
  function onTime(t) {
    if (!isFile() || !P.playing || P.waiting) return;
    const wrapped = t < P.lastT - 0.2;
    P.lastT = t;
    P.pos = t;
    P.posAt = performance.now();
    if (P.loop && hasLoop()) {
      if (ownLoop() && wrapped && P.climb && P.rate < 1) { P.rate = Math.min(1, Math.round((P.rate + P.climb / 100) * 100) / 100); schedule(); remember(); }
      else if (!ownLoop() && t >= P.b) nextPass();
    } else if (t >= P.duration - 0.02) { stop(); P.pos = 0; }
    if (P.video && Math.abs(P.video.currentTime - t) > 0.25) P.video.currentTime = t;
    if (P.video) P.video.playbackRate = Math.max(0.25, P.rate);
    show();
  }

  // ---------- YouTube ----------
  const ytIdOf = text => {
    const m = String(text).trim().match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/) || String(text).trim().match(/^([\w-]{11})$/);
    return m ? m[1] : null;
  };
  let ytApi = null;
  function loadYouTubeApi() {
    if (root.YT && root.YT.Player) return Promise.resolve();
    if (!ytApi) ytApi = new Promise((resolve, reject) => {
      const before = root.onYouTubeIframeAPIReady;
      root.onYouTubeIframeAPIReady = () => { if (before) before(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { ytApi = null; reject(new Error('YouTube did not answer. A YouTube video needs a connection.')); };
      document.head.append(s);
    });
    return ytApi;
  }
  function unloadYouTube() {
    clearInterval(P.ytTimer);
    if (P.yt && P.yt.destroy) { try { P.yt.destroy(); } catch (e) { /* gone */ } }
    P.yt = null; P.ytId = null;
  }
  // at: the second to start from, when you come back to the page.
  async function openYouTube(text, at = 0) {
    const id = ytIdOf(text);
    if (!id) { say('That is not a YouTube link. Copy the address of the video, for example https://youtu.be/…', 'bad'); return; }
    stop();
    const my = ++opening;
    say('Opening the video…', 'busy');
    try { await loadYouTubeApi(); } catch (e) { if (my === opening) say(e.message, 'bad'); return; }
    if (my !== opening) return;
    unloadYouTube();
    if (P.node) { try { await P.node.dropBuffers(); } catch (e) { /* none */ } }
    if (my !== opening) return;
    P.mono = null; P.blocks = null; P.video = null;
    Object.assign(P, { kind: 'youtube', ytId: id, ytError: null, source: null, key: `yt:${id}`, name: (saved.songs[`yt:${id}`] || {}).name || 'YouTube video', duration: 0 });
    restore(P.key);
    P.semis = 0; P.cut = noCut(); P.boost = false;
    drawAll();
    P.yt = new root.YT.Player(P.ui.ytBox, {
      videoId: id, playerVars: Object.assign({ playsinline: 1, rel: 0, modestbranding: 1 }, at >= 1 ? { start: Math.floor(at) } : {}),
      events: {
        onReady: () => {
          P.duration = P.yt.getDuration() || 0;
          const data = P.yt.getVideoData ? P.yt.getVideoData() : null;
          if (data && data.title) P.name = data.title;
          P.ytRates = (P.yt.getAvailablePlaybackRates() || [1]).filter(r => r <= 1.5);
          const r = P.ytRates.reduce((best, x) => Math.abs(x - P.rate) < Math.abs(best - P.rate) ? x : best, 1);
          P.rate = r; P.yt.setPlaybackRate(r);
          remember(); say(''); draw();
        },
        onStateChange: e => { P.playing = e.data === 1; show(); },
        onPlaybackRateChange: e => { P.rate = e.data; show(); },
        onError: e => {
          P.ytError = [101, 150].includes(e.data)
            ? 'The owner of this video does not let it play on other sites. Watch it on YouTube, or record a part of it from there on a computer.'
            : 'YouTube could not play this video. Check the link.';
          say(''); stop(); drawMedia(); draw();
        }
      }
    });
    // Loops: the page asks YouTube where it is ten times a second, and jumps back at B.
    P.pos = at;
    P.ytTimer = setInterval(() => {
      if (!P.yt || !P.yt.getCurrentTime) return;
      // Before the first play YouTube reports 0, also when the video will start further on.
      const state = P.yt.getPlayerState ? P.yt.getPlayerState() : 1;
      if (state === -1 || state === 5) { show(); return; }
      P.pos = P.yt.getCurrentTime();
      if (P.playing && P.loop && P.a !== null && P.b !== null && P.b > P.a && P.pos >= P.b) nextPass();
      show();
    }, 100);
  }

  // ---------- recording a tab (Chrome and Edge on a computer) ----------
  const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && root.MediaRecorder) && !matchMedia('(pointer: coarse)').matches;
  async function record() {
    if (P.rec) { P.rec.stop(); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, systemAudio: 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude' });
    } catch (e) { say('Recording did not start. Pick the tab with the video, and tick "Share tab audio".', 'bad'); return; }
    const tracks = stream.getAudioTracks();
    if (!tracks.length) {
      stream.getTracks().forEach(t => t.stop());
      say('The share had no sound. Share a browser tab, not a window or the screen, and tick "Share tab audio". Chrome and Edge can do this; Safari and Firefox cannot.', 'bad');
      return;
    }
    const chunks = [], rec = new MediaRecorder(new MediaStream(tracks));
    const started = Date.now();
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      clearInterval(P.recTimer);
      P.rec = null;
      if (P.ui.recBtn) P.ui.recBtn.textContent = '● Record a part from a tab';
      say('Opening the recording…', 'busy');
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      const id = `r${Date.now()}`, name = `Recording ${new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
      const kept = await recordings('put', { id, name, blob, at: Date.now() });
      if (P.ui.refreshSongs) P.ui.refreshSongs();
      await openRecording({ id, name, blob });
      if (!kept) say(NOT_KEPT);
    };
    stream.getTracks().forEach(t => t.addEventListener('ended', () => { if (rec.state === 'recording') rec.stop(); }));
    rec.start(1000);
    P.rec = rec;
    if (P.ui.recBtn) P.ui.recBtn.textContent = '■ Stop recording';
    draw();
    P.recTimer = setInterval(() => say(`Recording… ${fmt((Date.now() - started) / 1000)}. Play the part in the other tab, then come back and tap Stop recording.`, 'rec'), 500);
  }
  // r: a recording, a download or the copy of a file, as the browser keeps it.
  async function openRecording(r) {
    stop();
    const my = ++opening;
    say(`Opening ${r.name}…`, 'busy');
    try {
      const c = A.context();
      let buf;
      try { buf = await c.decodeAudioData(await r.blob.arrayBuffer()); }
      catch (e) { throw new Error(`The browser could not make the sound of ${r.name}. A long song can be too much for the memory of this device: each minute takes about 20 MB.`); }
      // A download can have the picture of the video as a second file, without sound. The copy of a video file
      // has its picture in itself.
      const media = r.picture || (/^video\//.test(r.blob.type) ? r.blob : null);
      if (my !== opening || !await loadDecoded(buf, r.name, songKey(r), media, my)) return;
      P.source = { rec: r };
      say('');
    } catch (e) { if (my === opening) say(e.message || 'The recording did not open.', 'bad'); }
    drawAll();
  }

  // ---------- downloading a YouTube video: a command for your own computer ----------
  // The page cannot read or download a YouTube video. The program yt-dlp on your computer can. So Download shows
  // one command to copy. You run it in the Terminal, the file goes to your Downloads folder, and you drop it on
  // this page. Nothing runs on a server.
  // The command never uses an account: its first three options keep yt-dlp from the cookies of a browser, and from
  // a config file on the computer that could ask for them.
  // id: the 11 characters of a video, as ytIdOf gives them. Only the id goes into the command, never the text of
  // the link field. With the picture, the command joins the picture and the sound into one mp4 file of 360 lines.
  // The sound is "the best m4a", not format 140 by its number: a video with dubbed sound has only 140-0, 140-1…,
  // and yt-dlp then takes the one in the language of the video.
  const command = (id, picture) => [
    'yt-dlp --ignore-config --no-cookies --no-cookies-from-browser',
    picture ? "-f 'bestvideo[ext=mp4][vcodec^=avc1][height<=360][protocol^=http]+bestaudio[ext=m4a]' --merge-output-format mp4" : "-f '140/bestaudio[ext=m4a]'",
    "-P ~/Downloads -o '%(title)s.%(ext)s'",
    `'https://www.youtube.com/watch?v=${id}'`].join(' ');
  const BREW = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
  const mb = bytes => bytes < 1048576 * 10 ? Math.max(0.1, bytes / 1048576).toFixed(1) : String(Math.round(bytes / 1048576));
  // A command with a button that copies it. You can also select the text by hand.
  const copyable = text => {
    const copy = btn('Copy', () => {
      const told = ok => { copy.textContent = ok ? 'Copied' : 'Select the text and copy it'; setTimeout(() => { copy.textContent = 'Copy'; }, 2500); };
      // Safari copies only inside the click itself, so nothing waits before this call.
      try { navigator.clipboard.writeText(text).then(() => told(true), () => told(false)); } catch (e) { told(false); }
    });
    // Each word is one piece, so a line of the command ends only at a space.
    return h('div', { class: 'player-cmd' }, h('pre', null, h('code', null, text.split(' ').map((word, i) => [i ? ' ' : null, h('span', null, word)]))), copy);
  };
  // The first install, for someone who has never used the Terminal.
  const installSteps = open => h('details', { class: 'drill-help player-install', open },
    h('summary', null, 'First time? Install these three programs first'),
    h('p', null, 'The command needs three programs on your computer: yt-dlp, deno and ffmpeg. The install takes about 10 minutes.'),
    h('ol', null,
      h('li', null, 'Open the Terminal app. Press Cmd+Space, type ', h('code', null, 'Terminal'), ', and press Enter. A window with text opens. You paste commands there and press Enter.'),
      h('li', null, 'Install Homebrew, a program that installs other programs. Copy this line, paste it in the Terminal, and press Enter.', copyable(BREW),
        h('p', null, 'It asks for the password of your Mac. The Terminal shows nothing while you type it. That is normal. Type it and press Enter.')),
      h('li', null, 'When it ends, look for "Next steps" in the text. If it shows two lines there, copy each one, paste it, and press Enter.'),
      h('li', null, 'Install the three programs.', copyable('brew install yt-dlp deno ffmpeg')),
      h('li', null, 'Check the result.', copyable('yt-dlp --version'),
        h('p', null, 'A date such as ', h('code', null, '2026.10.26'), ' means that all is ready. "command not found" means that step 3 is missing.'))),
    h('p', null, 'If a download stops working later, YouTube changed something. Run ', h('code', null, 'brew upgrade yt-dlp'), '.'),
    h('p', null, 'These steps are for a Mac. On Windows, install the programs with ', h('code', null, 'winget install yt-dlp.yt-dlp DenoLand.Deno Gyan.FFmpeg'), ' and run the command in PowerShell. On Linux, install yt-dlp, deno and ffmpeg with the package manager of your system. Windows and Linux are not tested.'));
  // Download: the panel with the command for one video.
  // where: 'box' puts the panel at the end of the box to open a song, under the ways to add one, 'tab' under the
  // open tab. Without it the panel stays where it is.
  function showGet(text, where) {
    const id = ytIdOf(text), el = P.ui.get;
    if (!id) { say('That is not a YouTube link. Copy the address of the video, for example https://youtu.be/…', 'bad'); return; }
    if (!el) return;
    say('');
    // The folds stay open when the command changes with the choice of the picture. The picture is on until you
    // choose the sound only.
    const open = !!el.querySelector('.player-install[open]'), shown = !!el.querySelector('.player-on-computer[open]');
    // A phone or a tablet cannot run the command: the note comes first there, and the steps wait in a fold.
    const touch = root.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const steps = [
      GT.segmented('The file', [[1, 'With picture'], [0, 'Sound only']], saved.soundOnly ? 0 : 1, v => { saved.soundOnly = !v; save(); showGet(id); }),
      h('p', { class: 'small muted' }, saved.soundOnly ? 'The file has no picture. It is about four times smaller.' : 'The picture comes in small size. The sound only makes a file about four times smaller.'),
      h('ol', { class: 'player-steps' },
        h('li', null, 'Copy this command.', copyable(command(id, !saved.soundOnly))),
        h('li', null, 'Paste it in the Terminal and press Enter. The file goes to your Downloads folder.'),
        h('li', null, 'Drop the file on this page, or choose it. ', btn('Open a song file', () => P.ui.pick()))),
      installSteps(open)];
    if (where === 'box') P.ui.source.append(el); else if (where) P.ui.box.after(el);
    el.hidden = false;
    el.replaceChildren(
      h('div', { class: 'player-get-head' }, h('b', null, 'Download with your computer'),
        h('button', { type: 'button', class: 'btn btn-icon say-close', 'aria-label': 'Close', onclick: hideGet }, '×')),
      h('p', { class: 'small muted' }, touch ? 'This works on a computer, not on a phone or a tablet. Open this site on your computer, paste the link of the video there and press "Download as a file".'
        : 'This site cannot download a YouTube video. A program on your computer can. It uses no YouTube account.'),
      ...(touch ? [h('details', { class: 'drill-help player-on-computer', open: shown }, h('summary', null, 'The steps on the computer'), steps)] : steps));
    el.scrollIntoView({ block: 'nearest' });
  }
  function hideGet() {
    const el = P.ui.get;
    if (el) { el.hidden = true; el.replaceChildren(); }
  }
  // ---------- the notes at the playhead ----------
  // The notes in about a third of a second from a place in the song, as you hear them: in the key you chose.
  function notesAt(pos) {
    if (!P.mono) return [];
    // With the voice cut on, the row reads what differs between left and right, as your ears do.
    const sides = P.cut.voice && P.side, data = sides ? P.side : P.mono, rate = sides ? P.sideRate : P.monoRate, size = sides ? 4096 : 8192;
    const at = Math.max(0, Math.floor((pos - 0.05) * rate));
    let part = data.subarray(at, at + size);
    if (part.length < 2048) return [];
    if (sides || P.cut.bass) {
      part = Float32Array.from(part, sides ? v => v / 32767 : undefined);
      // With the bass cut on, the sound under 200 Hz goes here too.
      if (P.cut.bass) { highpass(part, rate, 200); highpass(part, rate, 200); }
    }
    // A quiet spot has no notes: the guess would name the noise.
    let sq = 0;
    for (let i = 0; i < part.length; i += 4) sq += part[i] * part[i];
    if (Math.sqrt(sq / (part.length / 4)) < 0.02 * (sides ? P.sideTop : P.top)) return [];
    // A recording that is a little sharp or flat reads at its note names: see T.tuning.
    return T.notesAt(part, rate / Math.pow(2, (P.tune || 0) / 12)).map(n => ({ midi: n.midi + P.semis, pc: T.mod(n.pc + P.semis), strength: n.strength }));
  }
  // Take the sound under a frequency out of a stretch of samples, in place.
  function highpass(x, rate, hz) {
    const w = 2 * Math.PI * hz / rate, cs = Math.cos(w), al = Math.sin(w) / 1.414, a0 = 1 + al;
    const b0 = (1 + cs) / 2 / a0, b1 = -(1 + cs) / a0, a1 = -2 * cs / a0, a2 = (1 - al) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
  }
  // While the song plays the page listens about 8 times a second. A note shows when two of the last three listens
  // heard it, so the row does not flicker. When the song stands still, the notes are those of that place.
  function liveNotes() {
    const u = P.ui;
    if (!u.live || !u.live.isConnected || !P.mono) return;
    const pos = heard(), time = performance.now();
    if (P.playing ? time - (u.liveAt || 0) < 120 : pos === u.livePos) return;
    u.liveAt = time; u.livePos = pos;
    const heardNow = notesAt(pos);
    u.liveLast = P.playing ? (u.liveLast || []).concat([heardNow]).slice(-3) : [heardNow];
    const need = u.liveLast.length >= 3 ? 2 : 1, strength = new Map(), seen = new Map();
    u.liveLast.forEach(list => new Set(list.map(n => n.pc)).forEach(pc => seen.set(pc, (seen.get(pc) || 0) + 1)));
    u.liveLast.forEach(list => list.forEach(n => { if (seen.get(n.pc) >= need) strength.set(n.pc, Math.max(strength.get(n.pc) || 0, n.strength)); }));
    const pcs = [...strength.keys()].sort((x, y) => x - y);
    const lowest = heardNow.filter(n => strength.has(n.pc)).reduce((lo, n) => !lo || n.midi < lo.midi ? n : lo, null);
    const bass = lowest ? lowest.pc : pcs.length ? pcs[0] : null;
    // The chord name is the one of the band on the waveform. Where the band has no chord, and while the voice cut
    // is on (the row then reads what you hear, and the band does not), the notes of the row can name a plain chord:
    // major, minor or a power chord on its root. Other names from a few notes of a full band are too often wrong.
    const along = P.cut.voice && P.side ? null : chordAt(pos);
    const spelled = !along && pcs.length >= 2 ? T.chordsFrom(pcs, bass)[0] : null;
    const chord = along ? chordName(along) : spelled && !spelled.inversion && ['major', 'minor', 'power'].includes(spelled.chord.id) ? names()[T.pcOf(spelled.root)] + spelled.chord.symbol : null;
    // The next chord and the time to it, so the hand can get ready. The time is the time you wait at this speed.
    // While a loop repeats, the song goes back to A at B: the next chord is then the first other one from A.
    const band = saved.chords && P.chords && !(P.cut.voice && P.side) ? P.chords : [], other = c => chordName(c) !== chord;
    const round = P.loop && hasLoop() && pos >= P.a && pos < P.b;
    let next = band.find(c => c.t > pos && (!round || c.t < P.b) && other(c)) || null, far = next ? next.t - pos : 0;
    if (!next && round) { next = band.find(c => c.end > P.a && c.t < pos && other(c)) || null; far = next ? P.b - pos + Math.max(0, next.t - P.a) : 0; }
    const wait = next ? Math.max(1, Math.round(far / P.rate)) : 0;
    // The chords of the loop, each one once in a row.
    const inLoop = saved.chords && P.chords && hasLoop() ? P.chords.filter(c => Math.min(c.end, P.b) - Math.max(c.t, P.a) >= 0.25).map(chordName).filter((n, i, l) => n !== l[i - 1]) : [];
    const key = `${pcs.join(',')}|${bass}|${chord}|${next ? chordName(next) + wait : ''}|${inLoop.join(' ')}|${names().join('')}|${P.tune}|${P.fine}|${P.tonic ? P.tonic.root + (P.tonic.minor ? 'm' : '') : ''}`;
    u.cells.forEach((cell, pc) => {
      const v = strength.get(pc) || 0;
      cell.classList.toggle('is-on', v > 0);
      cell.classList.toggle('is-bass', v > 0 && pc === bass);
      cell.style.setProperty('--s', (0.35 + 0.65 * v).toFixed(2));
    });
    if (key === u.liveKey) return;
    u.liveKey = key;
    u.cells.forEach((cell, pc) => { if (cell.textContent !== names()[pc]) cell.textContent = names()[pc]; });
    u.chord.replaceChildren(...[
      h('span', { class: 'player-chord-now' }, ...(chord ? [h('span', { class: 'muted' }, 'Maybe '), h('b', null, chord)]
        : pcs.length ? [h('b', null, pcs.map(pc => names()[pc]).join(' '))] : [h('span', { class: 'muted' }, 'No clear note here')])),
      // The second line is always there, so the controls under it stay in place.
      h('span', { class: 'player-chord-next muted' }, ...(next ? ['then ', h('b', null, chordName(next)), wait <= 30 ? ` in ${wait} s` : ''] : ['\u00a0']))]);
    u.loopChords.hidden = inLoop.length < 2;
    if (inLoop.length >= 2) u.loopChords.replaceChildren('Chords in the loop: ', h('b', null, inLoop.join('  ')));
    aboutSong();
    drawNeck(pcs, bass);
  }
  // The line about the song: its key, as a guess, and how far the recording is from the usual pitch. A recording
  // that is off by 20 cents or more (100 cents are one fret) gets a switch that tunes it, so a guitar in tune fits.
  function aboutSong() {
    const u = P.ui, cents = Math.round((P.tune || 0) * 100), off = Math.abs(cents) >= 20;
    const k = P.tonic && { root: T.mod(P.tonic.root + P.semis), minor: P.tonic.minor };
    // The line is there from the first moment, so the controls under it stay in place when the key comes.
    u.aboutText.textContent = k ? `Key: maybe ${names()[k.root]} ${k.minor ? 'minor' : 'major'}.` : P.chords ? 'Key: not clear.' : 'Reading the chords…';
    u.offText.textContent = off ? `Pitch: ${Math.abs(cents)} cents ${cents > 0 ? 'sharp' : 'flat'}.` : '';
    u.offText.hidden = u.fineChip.hidden = !off;
    u.fineChip.setAttribute('aria-pressed', String(!!P.fine));
  }
  function drawNeck(pcs, bass) {
    const u = P.ui;
    if (!u.neck) return;
    u.neck.hidden = !saved.neck;
    if (!saved.neck) return;
    const open = GT.openStrings(), markers = [];
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 12; f++) {
      const pc = T.mod(open[s] + f);
      if (pcs.includes(pc)) markers.push({ string: s, fret: f, kind: pc === bass ? 'root' : 'other', label: names()[pc] });
    }
    FB.render(u.neck, { from: 0, to: 12, tuning: open, capo: GT.capo(), markers, leftHanded: settings.leftHanded, orientation: settings.orientation, label: 'The notes at the playhead' });
  }

  // ---------- chord guesses along the song ----------
  // The reading of a song, in small pieces after the song opens, so the page stays quick (theory.js: tuning,
  // chroma, chordsAlong, keyFromChroma):
  // - P.tune: how far the recording is from the pitch A = 440 Hz, in semitones. The reader corrects for it.
  // - P.chords: for each quarter of a second the major or minor chord that fits the sound best, joined to
  //   [{ t, end, root, minor }] in the key of the recording.
  // - P.tonic: the key of the song as a guess, { root, minor }. The note names follow it. (P.key is the name
  //   under which the page saves the song.)
  const CHORD_STEP = 0.25;
  function findChords(my) {
    Object.assign(P, { chords: null, tonic: null, tune: 0 });
    const mono = P.mono, rate = P.monoRate, steps = Math.floor(mono.length / rate / CHORD_STEP);
    const alive = () => my === opening && mono === P.mono;
    // One pass over the song for a pitch that is off by t semitones.
    const pass = (t, done) => {
      const r = rate / Math.pow(2, t / 12), chromas = new Array(steps).fill(null), sum = new Float64Array(12);
      let i = 0;
      const work = () => {
        if (!alive()) return;
        const until = performance.now() + 12;
        for (; i < steps && performance.now() < until; i++) {
          const at = Math.floor(i * CHORD_STEP * rate), part = mono.subarray(at, at + 8192);
          let sq = 0;
          for (let k = 0; k < part.length; k += 8) sq += part[k] * part[k];
          if (part.length < 2048 || Math.sqrt(sq / (part.length / 8)) < 0.02 * P.top) continue;
          chromas[i] = T.chroma(part, r);
          for (let k = 0; k < 12; k++) sum[k] += chromas[i][k];
        }
        if (i < steps) { setTimeout(work, 0); return; }
        done({ tune: t, chords: T.chordsAlong(chromas, CHORD_STEP), tonic: T.keyFromChroma(sum) });
      };
      setTimeout(work, 0);
    };
    const use = out => {
      if (!alive()) return;
      const moved = out.tune !== P.tune;
      Object.assign(P, out);
      if (moved) remember();
      P.ui.liveKey = P.ui.livePos = null;
      // With "Tune to 440" on, the sound moves as soon as the page knows by how much.
      if (P.fine && P.tune && isFile()) { if (P.playing) schedule(); else if (P.holding) holdAt(); }
      paint();
    };
    setTimeout(() => {
      if (!alive()) return;
      // A measure that the peaks do not agree on is no measure: the reader then takes the song as it is. It also
      // takes a song under 15 cents as it is: the overtones of real strings are a little sharp, so a small measure
      // says little, and the reader has room for it.
      const found = T.tuning(mono, rate), t = found.sure >= 0.08 && Math.abs(found.tune) >= 0.15 ? Math.round(found.tune * 100) / 100 : 0;
      pass(t, first => {
        // Near the middle between two notes the song can be read a little up or a little down. The reading with more
        // chords on the plain notes wins (theory.js: plainShare).
        if (Math.abs(t) <= 0.3) { use(first); return; }
        pass(t > 0 ? t - 1 : t + 1, other => use(T.plainShare(other.chords) > T.plainShare(first.chords) ? other : first));
      });
    }, 0);
  }
  // The twelve note names in the key you hear: G♯ in E major, A♭ in E♭ major.
  const names = () => T.namesIn(P.tonic && { root: T.mod(P.tonic.root + P.semis), minor: P.tonic.minor });
  // The name of a chord guess in the key you hear.
  const chordName = c => names()[T.mod(c.root + P.semis)] + (c.minor ? 'm' : '');
  const chordAt = t => (saved.chords && P.chords && P.chords.find(c => t >= c.t && t < c.end)) || null;
  // The chord names in a band at the top of the waveform.
  function drawChords(g, x, start, span, w, c) {
    if (!saved.chords || !P.chords) return false;
    g.fillStyle = c.box; g.fillRect(0, 0, w, 17);
    g.font = `600 12px ${c.font}`;
    let free = -1;
    P.chords.forEach(ch => {
      if (ch.end < start || ch.t > start + span) return;
      const px = x(ch.t), name = chordName(ch), tw = g.measureText(name).width;
      g.fillStyle = c.text; g.globalAlpha = 0.45; g.fillRect(Math.round(px), 0, 1, 17); g.globalAlpha = 1;
      const tx = Math.max(px + 4, 4);
      if (tx < free || tx + tw > Math.min(w, x(ch.end)) + 2) return;
      g.fillStyle = c.head; g.fillText(name, tx, 13);
      free = tx + tw + 6;
    });
    g.font = `12px ${c.font}`;
    return true;
  }

  // ---------- beats and bars (a trial, kept apart so it can go again) ----------
  // P.beat is { period: seconds of the song for one beat, first: the place of a first beat of a bar, per: beats in
  // a bar }, or null. It is saved with the song.
  // The nearest beat, when the song has beats and Snap is on.
  function snap(t) {
    if (!P.beat || !saved.snap) return t;
    const n = Math.round((t - P.beat.first) / P.beat.period);
    return clamp(Math.round((P.beat.first + n * P.beat.period) * 100) / 100, 0, P.duration);
  }
  // A tap on a beat while the song plays. The place in the song counts, not the clock, so a slowed song gives the
  // tempo of the song. Four taps or more make the beat: the line that fits them best.
  function tapBeat() {
    if (!isFile()) return;
    if (!P.playing) { say('Play the song, then tap Tap on each beat. Start on the first beat of a bar.'); return; }
    say('');
    const t = heard(), last = P.taps && P.taps[P.taps.length - 1];
    const taps = P.taps && t > last && t - last < 2.5 ? P.taps : [];
    taps.push(t);
    P.taps = taps;
    if (taps.length >= 4) {
      const n = taps.length, mx = (n - 1) / 2, my = taps.reduce((sum, v) => sum + v, 0) / n;
      let num = 0, den = 0;
      taps.forEach((v, i) => { num += (i - mx) * (v - my); den += (i - mx) * (i - mx); });
      const period = num / den;
      if (period > 0.2 && period < 2) { P.beat = { period, first: my - mx * period, per: (P.beat && P.beat.per) || 4 }; remember(); }
    }
    GT.keepPlace(draw);
  }
  const setBeat = patch => { P.beat = patch ? Object.assign({}, P.beat, patch) : null; if (!patch) P.taps = null; remember(); GT.keepPlace(draw); };
  function barRows() {
    const b = P.beat, n = (P.taps || []).length;
    return [
      h('div', { class: 'player-field' },
        btn('Tap', tapBeat, { class: 'btn btn-primary player-tap', title: 'Key T' }),
        h('output', { class: 'player-rate player-key' }, b ? `${Math.round(60 / b.period)} bpm` : n ? `${n} tap${n > 1 ? 's' : ''}` : 'No beat yet'),
        b ? GT.segmented('Beats in a bar', [[3, '3'], [4, '4'], [6, '6']], b.per, v => setBeat({ per: v })) : null),
      b ? h('div', { class: 'player-field' },
        btn('Bar 1 here', () => setBeat({ first: P.pos }), { title: 'The first beat of a bar is where the song is now' }),
        chip('Snap', saved.snap, () => { saved.snap = !saved.snap; save(); GT.keepPlace(draw); }, 'The ends of a loop go to the nearest beat'),
        btn('Clear', () => setBeat(null), { class: 'btn btn-text' })) : null,
      h('p', { class: 'small muted player-hint' }, 'A trial. Play the song and tap Tap on each beat, and start on the first beat of a bar. Four taps make a beat, and more taps make it more exact. The waveform then shows the bars, and with Snap the ends of a loop go to the nearest beat.')
    ].filter(Boolean);
  }
  // The lines of the bars and, from close, of the beats.
  function drawBeats(g, x, start, span, w, hgt, color) {
    const b = P.beat;
    if (!b) return;
    const beatPx = b.period / span * w, barPx = beatPx * b.per;
    if (barPx < 6) return;
    g.fillStyle = color;
    for (let n = Math.ceil((start - b.first) / b.period); b.first + n * b.period <= start + span; n++) {
      const bar = ((n % b.per) + b.per) % b.per === 0;
      if (!bar && beatPx < 9) continue;
      g.globalAlpha = bar ? 0.4 : 0.16;
      g.fillRect(Math.round(x(b.first + n * b.period)), 0, 1, hgt);
    }
    g.globalAlpha = 1;
  }

  // ---------- drawing ----------
  // The line above the song: what the page does now, or what went wrong. kind 'busy': the page works, and the
  // seconds count up, so you see that it goes on. kind 'bad': a failure, in the color of a wrong answer, and the
  // page scrolls to it.
  let sayTimer = null;
  function say(text, kind = '') {
    const el = P.ui.say;
    clearInterval(sayTimer);
    if (!el) return;
    el.hidden = !text;
    el.className = `player-say say${kind ? ` is-${kind}` : ''}`;
    el.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
    const line = h('span', { class: 'say-text' }, text), time = h('span', { class: 'say-time' });
    // A note stays until you close it, or until the page has something new to say.
    const close = kind === 'bad' || !kind ? h('button', { type: 'button', class: 'btn btn-icon say-close', 'aria-label': 'Close the message', onclick: () => say('') }, '×') : null;
    el.replaceChildren(...[kind === 'busy' ? h('span', { class: 'say-turn', 'aria-hidden': 'true' }) : null, line, kind === 'busy' ? time : null, close].filter(Boolean));
    if (kind === 'busy') {
      const began = Date.now();
      sayTimer = setInterval(() => { if (!el.isConnected) { clearInterval(sayTimer); return; } const s = Math.round((Date.now() - began) / 1000); if (s >= 2) time.textContent = `${s} s`; }, 1000);
    }
    if (kind === 'bad' && el.isConnected) el.scrollIntoView({ block: 'nearest' });
  }
  // A text of a part that the song moves: written only when it changes. A browser can lose a click on a button
  // whose text was written again between the press and the release, and the song writes 20 times a second.
  const put = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
  // The waveform shows a part of the song (the view). A tap jumps, a drag sets the loop, a drag on an end of the
  // loop moves that end. Two fingers, or the wheel with Ctrl, zoom. The strip under it shows the whole song with
  // the view as a box: a drag there moves the view.
  function setView(start, span) {
    if (!P.duration) return;
    span = clamp(span, Math.min(MIN_SPAN, P.duration), P.duration);
    P.view = { span, start: clamp(start, 0, P.duration - span) };
    showZoom();
    paint();
  }
  // around: the second that stays where it is on the screen. Without it, the playhead if you see it.
  function zoom(factor, around) {
    const v = P.view, pos = heard();
    if (around === undefined) around = pos >= v.start && pos <= v.start + v.span ? pos : v.start + v.span / 2;
    const span = clamp(v.span * factor, Math.min(MIN_SPAN, P.duration), P.duration);
    setView(around - (around - v.start) / v.span * span, span);
  }
  // The view of the loop, with a little room on both sides.
  const loopView = () => { const len = P.b - P.a; return { start: P.a - len * 0.1, span: len * 1.2 }; };
  const showsLoop = () => hasLoop() && Math.abs(P.view.span - clamp(loopView().span, Math.min(MIN_SPAN, P.duration), P.duration)) < 0.01 && P.view.start <= P.a && P.view.start + P.view.span >= P.b;
  function fit() {
    P.free = true;
    if (hasLoop() && !showsLoop()) { const v = loopView(); setView(v.start, v.span); } else setView(0, P.duration);
  }
  function showZoom() {
    const u = P.ui;
    if (!u.zoomIn) return;
    u.zoomIn.disabled = P.view.span <= Math.min(MIN_SPAN, P.duration) + 0.001;
    u.zoomOut.disabled = P.view.span >= P.duration - 0.001;
    const toLoop = hasLoop() && !showsLoop();
    put(u.fit, toLoop ? 'Fit' : 'All');
    const fitName = toLoop ? 'Show the loop' : 'Show the whole song';
    if (u.fit.getAttribute('aria-label') !== fitName) u.fit.setAttribute('aria-label', fitName);
    u.fit.disabled = !toLoop && u.zoomOut.disabled;
  }
  // The colors of the drawing come from the style sheet. Reading them is slow, so the page reads them once a second.
  function colors(cv) {
    const u = P.ui, time = performance.now();
    if (u.colors && time - u.colorsAt < 1000) return u.colors;
    const css = getComputedStyle(cv), c = {};
    ['wave', 'played', 'loop', 'mark', 'head', 'edge', 'ink', 'text', 'box'].forEach(k => { c[k] = css.getPropertyValue(`--wave-${k}`).trim(); });
    c.font = css.fontFamily;
    u.colors = c; u.colorsAt = time;
    return c;
  }
  // The bars of a part of the song, white on clear, one column for each pixel: the loudest sample pale, the average
  // solid. The colors come later, so the bars are drawn only when the view changes.
  function bars(cv, cols, rows, start, span) {
    cv.width = cols; cv.height = rows;
    const g = cv.getContext('2d'), mid = rows / 2, rate = P.monoRate, far = span * rate / cols >= BLOCK * 2;
    const { peak, mean } = P.blocks, mono = P.mono, room = mid - 2;
    const pale = new Float32Array(cols), solid = new Float32Array(cols);
    for (let x = 0; x < cols; x++) {
      const i0 = Math.max(0, Math.floor((start + x / cols * span) * rate)), i1 = Math.max(i0 + 1, Math.floor((start + (x + 1) / cols * span) * rate));
      let m = 0, sq = 0, count = 0;
      if (far) for (let k = Math.floor(i0 / BLOCK), end = Math.min(peak.length, Math.ceil(i1 / BLOCK)); k < end; k++) { if (peak[k] > m) m = peak[k]; sq += mean[k] * mean[k]; count++; }
      else for (let i = i0, end = Math.min(mono.length, i1); i < end; i++) { const v = Math.abs(mono[i]); if (v > m) m = v; sq += v * v; count++; }
      pale[x] = m / P.top; solid[x] = count ? Math.sqrt(sq / count) / P.top : 0;
    }
    g.clearRect(0, 0, cols, rows);
    g.fillStyle = 'rgba(255, 255, 255, .45)';
    for (let x = 0; x < cols; x++) { const len = Math.max(0.5, pale[x] * room); g.fillRect(x, mid - len, 1, len * 2); }
    g.fillStyle = '#fff';
    for (let x = 0; x < cols; x++) { const len = Math.max(0.5, solid[x] * room); g.fillRect(x, mid - len, 1, len * 2); }
  }
  // The bars of a view, drawn once and kept until the view or the size changes.
  function shapeOf(slot, cols, rows, start, span) {
    const u = P.ui, key = `${P.key}|${cols}|${rows}|${start.toFixed(4)}|${span.toFixed(4)}`;
    if (!u[slot]) u[slot] = { cv: document.createElement('canvas'), key: '' };
    if (u[slot].key !== key) { bars(u[slot].cv, cols, rows, start, span); u[slot].key = key; }
    return u[slot].cv;
  }
  const RULER = 18;
  function sized(cv) {
    const dpr = root.devicePixelRatio || 1, w = cv.clientWidth, hgt = cv.clientHeight, cols = Math.round(w * dpr), rows = Math.round(hgt * dpr);
    if (cv.width !== cols || cv.height !== rows) { cv.width = cols; cv.height = rows; }
    return { dpr, w, hgt, cols, rows, g: cv.getContext('2d') };
  }
  // Bars in two colors: the part before `split` in one, the rest in the other.
  function fillBars(d, shape, top, hgt, split, before, after) {
    const g = d.g;
    g.setTransform(d.dpr, 0, 0, d.dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = before; g.fillRect(0, top, split, hgt);
    g.fillStyle = after; g.fillRect(split, top, d.w - split, hgt);
    g.globalCompositeOperation = 'destination-in';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(shape, 0, 0);
    g.setTransform(d.dpr, 0, 0, d.dpr, 0, 0);
  }
  function drawWave() {
    const u = P.ui, cv = u.wave;
    if (!cv || !cv.isConnected || !P.mono || !cv.clientWidth) return;
    const pos = heard();
    // The view follows the song: when the playhead leaves it, the view turns the page.
    if (!P.dragging && P.view.span < P.duration) {
      const inside = pos >= P.view.start && pos <= P.view.start + P.view.span;
      if (P.free && inside) P.free = false;
      else if (!P.free && !inside) { P.view = { span: P.view.span, start: clamp(pos - P.view.span * 0.1, 0, P.duration - P.view.span) }; showZoom(); }
    }
    const d = sized(cv), g = d.g, c = colors(cv), { start, span } = P.view, w = d.w, hgt = d.hgt - RULER;
    const x = t => (t - start) / span * w;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, d.cols, d.rows);
    fillBars(d, shapeOf('shape', d.cols, Math.round(hgt * d.dpr), start, span), 0, hgt, clamp(x(pos), 0, w), c.played, c.wave);
    g.globalCompositeOperation = 'destination-over';
    if (hasLoop()) { g.fillStyle = c.loop; g.fillRect(x(P.a), 0, x(P.b) - x(P.a), hgt); }
    g.globalCompositeOperation = 'source-over';
    // The ruler: a mark at round times, far enough from each other to read.
    const step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find(s => s / span * w >= 58) || 600;
    g.font = `12px ${c.font}`; g.textBaseline = 'alphabetic'; g.fillStyle = c.text;
    for (let t = Math.ceil(start / step - 1e-6) * step; t <= start + span + 1e-6; t += step) {
      const px = x(t), text = step < 1 ? fmt1(t + 1e-6) : fmt(t + 1e-6), tw = g.measureText(text).width;
      g.globalAlpha = 0.5; g.fillRect(Math.round(px), hgt, 1, 4); g.globalAlpha = 1;
      g.fillText(text, clamp(px - tw / 2, 4, w - tw - 4), d.hgt - 3);
    }
    drawBeats(g, x, start, span, w, hgt, c.text);
    const lane = drawChords(g, x, start, span, w, c);
    g.fillStyle = c.text;
    // The parts of the song, with their names where there is room.
    P.markers.forEach((m, i) => {
      const px = x(m.t);
      if (px < -1 || px > w + 1) return;
      g.fillStyle = c.mark; g.fillRect(Math.round(px), 0, 1.5, hgt);
      const next = P.markers[i + 1], space = (next ? Math.min(w, x(next.t)) : w) - px - 8;
      if (g.measureText(m.name).width <= space) g.fillText(m.name, px + 5, lane ? 30 : 12);
    });
    // The ends of the loop: a line with a tab to take hold of.
    [['a', 'A', 1], ['b', 'B', -1]].forEach(([k, letter, side]) => {
      if (P[k] === null) return;
      const px = x(P[k]);
      if (px < -16 || px > w + 16) return;
      g.fillStyle = c.edge;
      g.fillRect(Math.round(px) - 1, 0, 2, hgt);
      g.beginPath(); g.roundRect(side > 0 ? px - 1 : px - 15, hgt - 18, 16, 18, 4); g.fill();
      g.fillStyle = c.ink; g.font = `700 12px ${c.font}`;
      g.fillText(letter, (side > 0 ? px + 7 : px - 7) - g.measureText(letter).width / 2, hgt - 5);
      g.font = `12px ${c.font}`;
    });
    g.fillStyle = c.head;
    g.fillRect(Math.round(x(pos)) - 1, 0, 2, hgt);
    drawOverview(pos, c);
  }
  // The strip with the whole song: where you are, the loop, the parts, and the view as a box.
  function drawOverview(pos, c) {
    const cv = P.ui.over;
    if (!cv || !cv.clientWidth) return;
    const d = sized(cv), g = d.g, w = d.w, hgt = d.hgt, x = t => t / P.duration * w;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, d.cols, d.rows);
    fillBars(d, shapeOf('overShape', d.cols, d.rows, 0, P.duration), 0, hgt, clamp(x(pos), 0, w), c.played, c.wave);
    g.globalCompositeOperation = 'destination-over';
    if (hasLoop()) { g.fillStyle = c.loop; g.fillRect(x(P.a), 0, Math.max(2, x(P.b) - x(P.a)), hgt); }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = c.mark;
    P.markers.forEach(m => g.fillRect(Math.round(x(m.t)), 0, 1, hgt));
    g.fillStyle = c.head;
    g.fillRect(Math.round(x(pos)) - 1, 0, 2, hgt);
    if (P.view.span < P.duration - 0.001) {
      const left = x(P.view.start), width = Math.max(6, x(P.view.span));
      g.fillStyle = c.box; g.fillRect(0, 0, left, hgt); g.fillRect(left + width, 0, w - left - width, hgt);
      g.strokeStyle = c.head; g.lineWidth = 1.5;
      g.beginPath(); g.roundRect(left + 0.75, 0.75, width - 1.5, hgt - 1.5, 4); g.stroke();
    }
  }
  // Draw the moving parts at the next frame. While the song plays, the drawing goes on frame after frame.
  function frame() {
    P.raf = 0;
    drawWave();
    liveNotes();
    if (P.playing && isFile() && !reduce() && P.ui.wave && P.ui.wave.isConnected) P.raf = requestAnimationFrame(frame);
  }
  function paint() { if (!P.raf) P.raf = requestAnimationFrame(frame); }
  function waveInput(cv) {
    const fingers = new Map();
    let act = null, pinch = null;
    const box = () => cv.getBoundingClientRect();
    const timeAt = cx => { const r = box(); return P.view.start + clamp((cx - r.left) / r.width, 0, 1) * P.view.span; };
    const xOf = t => { const r = box(); return r.left + (t - P.view.start) / P.view.span * r.width; };
    // The end of the loop under the pointer, if one is close.
    const edgeAt = cx => {
      const da = P.a === null ? Infinity : Math.abs(cx - xOf(P.a)), db = P.b === null ? Infinity : Math.abs(cx - xOf(P.b));
      return Math.min(da, db) > 16 ? null : da <= db ? 'a' : 'b';
    };
    const spread = () => { const [p, q] = [...fingers.values()]; return { d: Math.max(20, Math.abs(p - q)), mid: (p + q) / 2 }; };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      fingers.set(e.pointerId, e.clientX);
      if (fingers.size === 2) {
        // A second finger: the loop that the first finger began goes back, and the two fingers zoom.
        if (act && act.moved) { P.a = act.was.a; P.b = act.was.b; P.loop = act.was.loop; }
        act = null; P.dragging = false;
        const s = spread();
        pinch = { d: s.d, t: timeAt(s.mid), span: P.view.span };
        return;
      }
      act = { x: e.clientX, t: Math.round(timeAt(e.clientX) * 100) / 100, edge: edgeAt(e.clientX), moved: false, was: { a: P.a, b: P.b, loop: P.loop } };
    });
    cv.addEventListener('pointermove', e => {
      if (!fingers.has(e.pointerId)) { cv.style.cursor = edgeAt(e.clientX) ? 'ew-resize' : 'pointer'; return; }
      fingers.set(e.pointerId, e.clientX);
      if (pinch && fingers.size === 2) {
        const s = spread(), r = box(), span = clamp(pinch.span * pinch.d / s.d, Math.min(MIN_SPAN, P.duration), P.duration);
        P.free = true;
        setView(pinch.t - (s.mid - r.left) / r.width * span, span);
        return;
      }
      if (!act || (!act.moved && Math.abs(e.clientX - act.x) < (act.edge ? 3 : 8))) return;
      act.moved = true; P.dragging = true;
      const t = snap(Math.round(timeAt(e.clientX) * 100) / 100);
      if (act.edge === 'a') P.a = clamp(t, 0, (P.b === null ? P.duration : P.b) - 0.05);
      else if (act.edge === 'b') P.b = clamp(t, (P.a || 0) + 0.05, P.duration);
      else { const from = snap(act.t); P.a = Math.min(from, t); P.b = Math.max(from, t); P.loop = true; }
      showEdges();
      paint();
    });
    const end = (e, cancel) => {
      fingers.delete(e.pointerId);
      if (pinch) { if (fingers.size < 2) pinch = null; return; }
      if (!act) return;
      const a = act;
      act = null; P.dragging = false;
      if (cancel) { P.a = a.was.a; P.b = a.was.b; P.loop = a.was.loop; showEdges(); paint(); return; }
      if (!a.moved) { seek(timeAt(e.clientX)); return; }
      if (!hasLoop() && P.b !== null) { P.a = a.was.a; P.b = a.was.b; P.loop = a.was.loop; showEdges(); paint(); return; }
      P.undo = a.was;
      loopChanged(a.edge === 'b' ? Math.max(P.a || 0, P.b - 1) : P.a);
    };
    cv.addEventListener('pointerup', e => end(e, false));
    cv.addEventListener('pointercancel', e => end(e, true));
    // The wheel with Ctrl (or two fingers apart on a trackpad) zooms where the pointer is. A wheel to the side moves the view.
    cv.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); P.free = true; zoom(Math.exp(clamp(e.deltaY, -60, 60) * 0.01), timeAt(e.clientX)); }
      else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); P.free = true; setView(P.view.start + e.deltaX / cv.clientWidth * P.view.span, P.view.span); }
    }, { passive: false });
  }
  function overviewInput(cv) {
    let down = null;
    const timeAt = cx => { const r = cv.getBoundingClientRect(); return clamp((cx - r.left) / r.width, 0, 1) * P.duration; };
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); down = { x: e.clientX, moved: false }; });
    cv.addEventListener('pointermove', e => {
      if (!down || (!down.moved && Math.abs(e.clientX - down.x) < 6)) return;
      down.moved = true; P.free = true;
      setView(timeAt(e.clientX) - P.view.span / 2, P.view.span);
    });
    cv.addEventListener('pointercancel', () => { down = null; });
    cv.addEventListener('pointerup', e => {
      if (!down) return;
      // A tap jumps there, and the view goes with it.
      if (!down.moved) { const t = timeAt(e.clientX); setView(t - P.view.span / 2, P.view.span); seek(t); }
      down = null;
    });
  }
  // Update the moving parts in place: time, playhead, the play button and the speed.
  function show() {
    const u = P.ui;
    put(u.time, `${fmt(P.pos)} / ${fmt(P.duration)}`);
    put(u.play, P.playing ? '❚❚ Pause' : '▶ Play');
    if (u.dock && !u.dock.hidden) {
      put(u.dockPlay, P.playing ? '❚❚ Pause' : '▶ Play');
      put(u.dockTime, fmt(P.pos));
      if (u.dockLoop.getAttribute('aria-pressed') !== String(!!P.loop)) u.dockLoop.setAttribute('aria-pressed', String(!!P.loop));
    }
    put(u.rateOut, `${Math.round(P.rate * 100)}%`);
    if (u.rateIn && document.activeElement !== u.rateIn && !u.rateIn.held) u.rateIn.value = Math.round(P.rate * 100);
    if (u.seek && document.activeElement !== u.seek && !u.seek.held) { u.seek.max = Math.max(1, P.duration); u.seek.value = P.pos; }
    if (u.hold && u.hold.getAttribute('aria-pressed') !== String(!!P.holding)) u.hold.setAttribute('aria-pressed', String(!!P.holding));
    if (!!P.playing !== !!P.awake) { P.awake = !!P.playing; awake(P.awake); if (isFile() && navigator.mediaSession) navigator.mediaSession.playbackState = P.playing ? 'playing' : 'paused'; }
    paint();
  }
  // The screen stays on while a song plays. A phone that sleeps in the middle of a loop stops the practice.
  let wake = null;
  async function awake(on) {
    try {
      if (on && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); }
      else if (!on && wake) { const lock = wake; wake = null; await lock.release(); }
    } catch (e) { /* the browser said no: the screen sleeps as usual */ }
  }
  // The browser drops the lock when the page is hidden: take it again when the page is back and the song plays.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && P.playing) awake(true); });
  // Play, pause and the jumps for the lock screen, a headphone button and the media keys of a keyboard.
  function mediaKeys(on) {
    const ms = navigator.mediaSession;
    if (!ms || !root.MediaMetadata) return;
    ms.metadata = on ? new root.MediaMetadata({ title: P.name, artist: 'Guitar Trainer' }) : null;
    [['play', play], ['pause', stop], ['seekbackward', () => seek(P.pos - 5)], ['seekforward', () => seek(P.pos + 5)], ['previoustrack', () => seek(hasLoop() ? P.a : 0)]]
      .forEach(([name, run]) => { try { ms.setActionHandler(name, on ? run : null); } catch (e) { /* this browser does not know the action */ } });
  }
  // A slider under a finger or the mouse: the song does not move it then. Safari gives a slider no focus on a
  // press, so the focus alone does not tell.
  const grip = el => {
    el.addEventListener('pointerdown', () => {
      el.held = true;
      const up = () => { el.held = false; root.removeEventListener('pointerup', up, true); root.removeEventListener('pointercancel', up, true); };
      root.addEventListener('pointerup', up, true);
      root.addEventListener('pointercancel', up, true);
    });
    return el;
  };
  const chip = (text, on, onclick, title, extra = {}) => h('button', Object.assign({ type: 'button', class: 'chip chip-toggle', 'aria-pressed': String(!!on), title, onclick }, extra), text);
  const btn = (text, onclick, extra = {}) => h('button', Object.assign({ type: 'button', class: 'btn', onclick }, extra), text);
  const set = patch => {
    const drums = patch.cut && patch.cut.drums && !P.cut.drums;
    Object.assign(P, patch);
    remember();
    if (isFile()) {
      if ('cut' in patch || 'boost' in patch) { if (drums) clearDrum(); route(); P.ui.livePos = P.ui.liveKey = null; }
      // In another key each note and chord has another name, and with Repeat the next chord is another one, also
      // while the song stands still.
      if ('semis' in patch || 'loop' in patch) { P.ui.livePos = P.ui.liveKey = null; paint(); }
      if (P.playing) schedule(); else if (P.holding) holdAt();
    }
    GT.keepPlace(draw);
  };
  function setRate(r) {
    r = Math.max(0.25, Math.min(1.5, Math.round(r * 100) / 100));
    if (P.kind === 'youtube') { r = P.ytRates.reduce((best, x) => Math.abs(x - r) < Math.abs(best - r) ? x : best, 1); if (P.yt) P.yt.setPlaybackRate(r); }
    P.rate = r;
    remember();
    if (P.playing && isFile()) schedule();
    show();
  }
  // [ and ]: 5% slower or faster. YouTube has only its own speeds, so there the next one of those.
  function stepRate(dir) {
    if (P.kind !== 'youtube') { setRate(P.rate + dir * 0.05); return; }
    const rates = dir > 0 ? P.ytRates.filter(r => r > P.rate + 0.001) : P.ytRates.filter(r => r < P.rate - 0.001).reverse();
    if (rates.length) setRate(rates[0]);
  }
  // One of the three cuts on or off. Bass cut and Bass up do not go together.
  const toggleCut = k => set({ cut: Object.assign({}, P.cut, { [k]: !P.cut[k] }), boost: k === 'bass' ? false : P.boost });
  // Speed, key, sound and the settings of each pass, back to how a new song starts. The loop and the parts stay.
  const changed = () => P.rate !== 1 || P.semis !== 0 || P.cut.bass || P.cut.drums || P.cut.voice || P.boost || P.gap !== 0 || P.climb !== 0;
  function reset() {
    Object.assign(P, { semis: 0, cut: noCut(), boost: false, gap: 0, climb: 0 });
    if (isFile()) route();
    setRate(1);
    GT.keepPlace(draw);
  }
  // The loop changed: the song takes the new loop at once. jump: where to play on from, so you hear the new end.
  function loopChanged(jump) {
    remember();
    if (P.playing && isFile()) schedule();
    if (P.playing && P.loop && jump !== undefined && jump !== null) seek(jump);
    P.ui.needA = false;
    GT.keepPlace(draw);
    // The chords of the loop and the next chord follow the new loop, also while the song stands still.
    P.ui.livePos = P.ui.liveKey = null;
    paint();
  }
  // Undo: the loop as it was before the last change. Each path that changes the loop keeps it first.
  const keepLoop = () => { P.undo = { a: P.a, b: P.b, loop: P.loop }; };
  function undoLoop() {
    if (!P.undo) return;
    const was = P.undo;
    keepLoop();
    Object.assign(P, was);
    loopChanged(hasLoop() ? P.a : undefined);
  }
  // The times on the A and B buttons, while a finger moves an end of the loop.
  function showEdges() {
    const u = P.ui;
    put(u.edgeA, P.a === null ? 'Set A' : `A ${fmt1(P.a)}`);
    put(u.edgeB, P.b === null ? 'Set B' : `B ${fmt1(P.b)}`);
  }
  // A and B: the loop changes at once, also while the song plays.
  function setA() {
    keepLoop();
    P.a = snap(Math.round(P.pos * 100) / 100);
    if (P.b !== null && P.b <= P.a) P.b = null;
    loopChanged();
  }
  function setB() {
    const b = snap(Math.round(P.pos * 100) / 100);
    if (P.a === null || b <= P.a) return false;
    keepLoop();
    P.b = b; P.loop = true;
    loopChanged();
    return true;
  }
  // An end of the loop a little earlier or later. The song plays on from A, or from a second before B.
  function nudge(k, by) {
    if (P[k] === null) return;
    keepLoop();
    if (k === 'a') P.a = clamp(Math.round((P.a + by) * 100) / 100, 0, (P.b === null ? P.duration : P.b) - 0.05);
    else P.b = clamp(Math.round((P.b + by) * 100) / 100, P.a + 0.05, P.duration);
    loopChanged(k === 'a' ? P.a : Math.max(P.a, P.b - 1));
  }
  // The loop moves on by its own length, to the next phrase (or back), and the view goes with it.
  function moveLoop(dir) {
    if (!hasLoop()) return;
    keepLoop();
    const len = P.b - P.a, a = clamp(P.a + dir * len, 0, P.duration - len);
    P.a = Math.round(a * 100) / 100; P.b = Math.round((a + len) * 100) / 100;
    const v = P.view;
    if (isFile() && (P.a < v.start || P.b > v.start + v.span)) setView(P.a - Math.max(0, v.span - len) / 2, Math.max(v.span, len * 1.2));
    if (P.playing && P.loop) loopChanged(P.a); else { loopChanged(); seek(P.a); }
  }
  // Half as long or twice as long, from the same A.
  function scaleLoop(by) {
    if (!hasLoop()) return;
    keepLoop();
    P.b = Math.round(Math.min(P.duration, P.a + Math.max(0.1, (P.b - P.a) * by)) * 100) / 100;
    loopChanged(by < 1 && P.pos > P.b ? P.a : undefined);
  }
  // The parts of a song. A mark has a start only, and its part ends at the next one. A saved loop has its own end
  // and the speed you practiced it at.
  function addMarker() {
    if (!P.kind) return;
    const n = P.markers.length + 1;
    P.markers = P.markers.concat({ t: Math.round(P.pos * 10) / 10, name: `Part ${n}` }).sort((x, y) => x.t - y.t);
    remember(); draw();
  }
  function saveLoop() {
    if (!hasLoop()) return;
    const name = (root.prompt('Name of the loop', `Loop at ${fmt(P.a)}`) || '').trim();
    if (!name) return;
    P.markers = P.markers.concat({ t: P.a, b: P.b, rate: P.rate, name: name.slice(0, 40) }).sort((x, y) => x.t - y.t);
    remember();
    saved.tab = 'parts'; save();
    GT.keepPlace(draw);
  }
  // A tap on a part loops it: a saved loop as it was saved, a mark up to the next part (or to the end).
  function loopMarker(i) {
    const m = P.markers[i], next = P.markers.find(x => x.t > m.t + 0.01);
    keepLoop();
    P.a = m.t; P.b = m.b || (next ? next.t : P.duration); P.loop = true;
    if (m.b && m.rate) setRate(m.rate);
    remember();
    if (isFile() && P.playing) schedule();
    seek(P.a);
    draw();
  }
  // The media part (the name, the video or the YouTube frame, the waveform, Play and the notes) is drawn once for
  // each song: moving a YouTube frame in the page would load the video again, and Play keeps its place while you
  // change a setting. The panel under it is drawn again after each change.
  function drawMedia() {
    const u = P.ui;
    if (!u.media) return;
    // A video that YouTube will not play here: only the message and a link show, in the panel.
    u.media.hidden = !!P.ytError;
    if (P.ytError && u.ytBox && u.ytBox.isConnected) return;
    const parts = [];
    u.wave = u.over = u.live = u.seek = u.shape = u.overShape = u.hold = null;
    u.liveKey = u.livePos = u.liveLast = null;
    if (P.kind) {
      u.time = h('span', { class: 'player-time' });
      u.name = h('b', null, P.name);
      u.now.replaceChildren(h('span', { class: 'player-name' }, ...[u.name, P.kind === 'youtube' ? h('span', { class: 'muted small' }, ' on YouTube') : null].filter(Boolean)), u.time,
        u.other = h('button', { type: 'button', class: 'btn btn-text', 'aria-expanded': String(u.fold.open), onclick: () => showFold(!u.fold.open) }, u.fold.open ? 'Close' : 'Other song'));
    } else u.now.replaceChildren();
    if (P.kind === 'youtube') { u.ytBox = h('div'); parts.push(h('div', { class: 'player-yt' }, u.ytBox)); }
    if (P.video) parts.push(h('div', { class: 'player-video-box' }, P.video));
    if (isFile()) {
      u.wave = h('canvas', { class: 'player-wave', role: 'img', 'aria-label': 'The song. Tap to jump, drag to set the loop, drag an end of the loop to move it.' });
      waveInput(u.wave);
      u.over = h('canvas', { class: 'player-over', role: 'img', 'aria-label': 'The whole song. Tap to jump, drag to move the view.' });
      overviewInput(u.over);
      u.zoomOut = btn('−', () => zoom(2), { class: 'btn btn-icon', 'aria-label': 'Zoom out', title: 'Key −' });
      u.zoomIn = btn('+', () => zoom(0.5), { class: 'btn btn-icon', 'aria-label': 'Zoom in', title: 'Key +' });
      u.fit = btn('All', () => fit(), { class: 'btn player-fit' });
      parts.push(u.wave, h('div', { class: 'player-zoom' }, u.over, h('span', { class: 'stepper' }, u.zoomOut, u.zoomIn), u.fit));
    } else if (P.kind === 'youtube') {
      u.seek = grip(h('input', { type: 'range', class: 'player-seek', min: 0, max: Math.max(1, P.duration), step: 0.1, value: P.pos, 'aria-label': 'Place in the video', oninput: e => seek(Number(e.target.value)) }));
      parts.push(u.seek);
    }
    if (P.kind) {
      u.play = h('button', { type: 'button', class: 'btn btn-primary player-play', onclick: () => P.playing ? stop() : play() }, '▶ Play');
      // Hold: the song stands still and the sound of that moment goes on, so you can find its notes on the guitar.
      if (isFile()) u.hold = chip('Hold', P.holding, () => hold(!P.holding), 'Key H: the sound of this moment goes on until you tap again');
      const transport = h('div', { class: 'row player-transport' },
        btn('|◀', () => seek(hasLoop() ? P.a : 0), { class: 'btn btn-icon', 'aria-label': 'Back to the start of the loop, or of the song', title: 'Key Home' }),
        btn('−5 s', () => seek(P.pos - 5), { 'aria-label': 'Back 5 seconds' }), u.play, btn('+5 s', () => seek(P.pos + 5), { 'aria-label': 'On 5 seconds' }), u.hold);
      parts.push(transport);
      watchTransport(transport);
    }
    if (isFile()) {
      u.cells = T.PC_PLAIN.map(name => h('span', { class: 'player-pc' }, name));
      u.chord = h('span', { class: 'player-chord', 'aria-live': 'off', title: 'A guess from the sound at the playhead. A full band often confuses it.' });
      u.neck = h('div', { class: 'neck player-neck' });
      const neckChip = chip('Neck', saved.neck, () => { saved.neck = !saved.neck; save(); neckChip.setAttribute('aria-pressed', String(saved.neck)); u.liveKey = u.livePos = null; GT.keepPlace(() => liveNotes()); }, 'Show the notes on the neck');
      const chordChip = chip('Chords', saved.chords, () => { saved.chords = !saved.chords; save(); chordChip.setAttribute('aria-pressed', String(saved.chords)); u.liveKey = u.livePos = null; paint(); }, 'Show a chord guess along the waveform');
      // The chords of the loop: a line at the end of the Loop tab, so it moves no control when it comes.
      u.loopChords = h('p', { class: 'small muted player-loop-chords', hidden: true });
      u.aboutText = h('span', { class: 'player-about-key' });
      u.offText = h('span');
      u.fineChip = chip('Tune to 440', P.fine, () => { set({ fine: !P.fine }); u.liveKey = u.livePos = null; liveNotes(); }, 'Move the pitch of the song to the usual pitch, where the note A is 440 Hz. A guitar in tune then fits the song.');
      u.about = h('p', { class: 'small muted player-about' }, u.aboutText, u.offText, u.fineChip);
      u.live = h('div', { class: 'player-live', role: 'group', 'aria-label': 'The notes at the playhead, as a guess' },
        h('div', { class: 'player-pcs' }, u.cells),
        h('div', { class: 'player-live-line' }, u.chord,
          h('div', { class: 'row player-chips' }, chordChip, neckChip)),
        u.about,
        u.neck);
      parts.push(u.live);
    }
    u.media.replaceChildren(...parts);
    showZoom();
    // The canvas has its size only once the page is in the document.
    paint();
  }
  // The words for the buttons above the tabs and on the open tab.
  const helpLines = tab => [
    isFile() ? ['Hold', 'The song stands still and the sound of that moment goes on, so you can find its notes on the guitar.'] : null,
    isFile() ? ['The note row', 'The notes that sound now, and a chord after "Maybe". Both are a guess, and a full band often confuses it.'] : null,
    tab === 'loop' ? ['− and +', 'Move that end of the loop by a tenth of a second.'] : null,
    tab === 'loop' ? ['Repeat', 'The song goes back to A each time it gets to B.'] : null,
    tab === 'loop' ? ['◀ and ▶', 'Move the loop back or on by its length.'] : null,
    tab === 'loop' ? ['½ and ×2', 'Make the loop half or twice as long.'] : null,
    tab === 'loop' ? ['Undo', 'The loop as it was before the last change.'] : null,
    tab === 'loop' ? ['Save the loop', 'Keep the loop under a name, on the Parts tab.'] : null,
    tab === 'loop' ? ['Each pass', 'A song that plays slower than 100% gets faster each time the loop starts again, up to 100%.'] : null,
    tab === 'speed' || tab === 'sound' ? ['Reset the settings', `${isFile() ? 'Speed, key and sound' : 'The speed'} and the settings of each pass go back to how a song starts. The loop and the parts stay.`] : null,
    tab === 'bars' ? ['Bar 1 here', 'The first beat of a bar is where the song is now.'] : null,
    tab === 'bars' ? ['Snap', 'The ends of a loop go to the nearest beat.'] : null
  ].filter(Boolean);
  // The panel: one group of settings at a time, so the waveform and the group you work with fit on one screen.
  function draw() {
    const box = P.ui.box;
    if (!box) return;
    const u = P.ui;
    const parts = [];
    u.rateOut = u.rateIn = u.edgeA = u.edgeB = null;
    if (P.ytError) {
      if (u.now) u.now.replaceChildren();
      u.time = null;
      parts.push(h('div', { class: 'controls player-blocked' }, h('p', null, P.ytError),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: `https://www.youtube.com/watch?v=${P.ytId}`, target: '_blank', rel: 'noopener' }, 'Open the video on YouTube'),
          btn('Download as a file', () => showGet(P.ytId, 'tab')))));
    } else if (P.kind) {
      if (u.name) u.name.textContent = P.name;
      const tabs = [['loop', 'Loop'], ['speed', 'Speed']].concat(isFile() ? [['sound', 'Sound']] : [], [['parts', 'Parts']], isFile() ? [['bars', 'Bars']] : []);
      const tab = tabs.some(t => t[0] === saved.tab) ? saved.tab : 'loop';
      parts.push(GT.segmented('Settings', tabs, tab, v => { saved.tab = v; save(); GT.keepPlace(draw); }, 'player-tabs'));
      const rows = [];
      const resetRow = () => h('div', { class: 'player-field player-reset' }, btn('Reset the settings', reset, { class: 'btn btn-text', disabled: !changed(), title: `${isFile() ? 'Speed, key, sound' : 'Speed'} and the settings of each pass go back to how a song starts. The loop and the parts stay.` }));
      if (tab === 'speed') {
        u.rateOut = h('output', { class: 'player-rate' });
        if (P.kind === 'youtube') {
          // YouTube plays only its own speeds, so each one is a button.
          rows.push(h('div', { class: 'player-field' }, h('span', { class: 'player-label' }, 'Speed'),
            h('div', { class: 'player-speeds', style: `--n:${P.ytRates.length > 6 ? Math.ceil(P.ytRates.length / 2) : P.ytRates.length}` }, P.ytRates.map(r => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(Math.abs(P.rate - r) < 0.001), onclick: () => { setRate(r); draw(); } }, `${Math.round(r * 100)}%`)))));
          rows.push(h('div', { class: 'player-field' }, btn('Download as a file', () => showGet(P.ytId, 'tab')),
            canRecord() ? btn(P.rec ? '■ Stop recording' : '● Record a part from a tab', () => record()) : null,
            h('p', { class: 'small muted player-hint' }, 'YouTube gives a video only these speeds, and no key change, cuts, waveform or notes. As a file, the song gets every tool. ',
              canRecord() ? 'A recording of a part gets them too: open the video in another tab and share that tab with its sound.' : 'On a computer with Chrome or Edge you can also record a part of it, and the recording gets every tool.')));
        } else {
          u.rateIn = grip(h('input', { type: 'range', min: 25, max: 150, step: 1, value: Math.round(P.rate * 100), 'aria-label': 'Speed in percent', oninput: e => setRate(Number(e.target.value) / 100) }));
          rows.push(h('div', { class: 'player-field' }, h('span', { class: 'player-label' }, 'Speed'), u.rateIn, u.rateOut,
            h('div', { class: 'row player-chips' }, [50, 75, 100].map(v => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(Math.round(P.rate * 100) === v), onclick: () => { setRate(v / 100); draw(); } }, `${v}%`)))));
          rows.push(h('div', { class: 'player-field' }, h('span', { class: 'player-label' }, 'Key'),
            h('span', { class: 'stepper' }, btn('−1', () => set({ semis: Math.max(-12, P.semis - 1) }), { 'aria-label': 'Down a semitone' }),
            h('output', { class: 'player-rate player-key' }, P.semis ? `${P.semis > 0 ? '+' : ''}${P.semis} semitone${Math.abs(P.semis) > 1 ? 's' : ''}` : 'As recorded'),
            btn('+1', () => set({ semis: Math.min(12, P.semis + 1) }), { 'aria-label': 'Up a semitone' }))));
        }
        rows.push(resetRow());
      }
      if (tab === 'loop') {
        // Each end has a button that sets it where the song is, and two that move it by a tenth of a second.
        const edge = (k, letter, setHere) => {
          const here = btn('', setHere, { class: 'btn player-edge-set', title: `Key ${letter}: set ${letter} where the song is now` });
          u[k === 'a' ? 'edgeA' : 'edgeB'] = here;
          return h('div', { class: 'player-edge stepper' },
            btn('−', () => nudge(k, -0.1), { class: 'btn btn-icon', 'aria-label': `${letter} a tenth of a second earlier`, disabled: P[k] === null }), here,
            btn('+', () => nudge(k, 0.1), { class: 'btn btn-icon', 'aria-label': `${letter} a tenth of a second later`, disabled: P[k] === null }));
        };
        rows.push(h('div', { class: 'player-field player-loop' },
          h('div', { class: 'player-edges' }, edge('a', 'A', setA), edge('b', 'B', () => { if (!setB()) { u.needA = true; GT.keepPlace(draw); } })),
          // The hint stands under the two ends, so they do not move when it comes and goes.
          u.needA ? h('p', { class: 'small muted player-hint', role: 'status' }, 'Set A first, then play on and set B after it.') : null,
          h('div', { class: 'row player-chips' },
            chip('Repeat', P.loop, () => set({ loop: !P.loop }), 'Key L: the song goes back to A each time it gets to B'),
            h('span', { class: 'stepper' }, btn('◀', () => moveLoop(-1), { class: 'btn btn-icon', 'aria-label': 'Move the loop back by its length', disabled: !hasLoop() }),
            btn('▶', () => moveLoop(1), { class: 'btn btn-icon', 'aria-label': 'Move the loop on by its length', disabled: !hasLoop() })),
            h('span', { class: 'stepper' }, btn('½', () => scaleLoop(0.5), { class: 'btn btn-icon', 'aria-label': 'Make the loop half as long', disabled: !hasLoop() }),
            btn('×2', () => scaleLoop(2), { class: 'btn btn-icon', 'aria-label': 'Make the loop twice as long', disabled: !hasLoop() }))),
          h('div', { class: 'row player-chips' },
            btn('Save the loop', saveLoop, { disabled: !hasLoop(), title: 'Keep this loop under a name, in Parts' }),
            btn('Undo', undoLoop, { class: 'btn btn-text', disabled: !P.undo, title: 'The loop as it was before the last change' }),
            btn('Clear', () => { keepLoop(); set({ a: null, b: null, loop: false }); }, { class: 'btn btn-text', disabled: P.a === null && P.b === null }))));
        const pair = (label, choice) => h('span', { class: 'player-pair' }, h('span', { class: 'player-label' }, label), choice);
        rows.push(h('div', { class: 'player-field' },
          pair('Between passes', GT.segmented('Pause before each pass', [[0, 'No pause'], [1, '1 s'], [2, '2 s']], P.gap, v => set({ gap: v }))),
          pair('Each pass', GT.segmented('Speed up each pass', P.kind === 'youtube' ? [[0, 'Same speed'], [1, 'Next speed']] : [[0, 'Same speed'], [2, '+2%'], [5, '+5%']], P.kind === 'youtube' ? (P.climb ? 1 : 0) : P.climb, v => set({ climb: v })))));
        if (isFile() && u.loopChords) rows.push(u.loopChords);
      }
      if (tab === 'sound') {
        // Two rows with their names: the cuts, and the bass made louder.
        const named = (label, ...chips) => h('span', { class: 'player-pair is-short' }, h('span', { class: 'player-label' }, label), h('span', { class: 'row player-chips' }, chips));
        rows.push(h('div', { class: 'player-field' },
          named('Cut',
            chip('Bass', P.cut.bass, () => toggleCut('bass'), 'Take out the sound under 200 Hz'),
            chip('Drums', P.cut.drums, () => toggleCut('drums'), 'Take out short hits and keep notes that ring'),
            chip('Voice', P.cut.voice && P.stereo, () => toggleCut('voice'), P.stereo ? 'Take out what is in the middle of the mix' : 'This file has the same sound left and right, so there is no middle to take out', { disabled: !P.stereo })),
          named('Louder',
            chip('Bass up', P.boost, () => set({ boost: !P.boost, cut: Object.assign({}, P.cut, { bass: false }) }), 'Make the bass louder, to hear its line')),
          h('p', { class: 'small muted player-hint' }, 'Choose one or more. A cut makes a part quieter, it cannot take it out completely. Voice also takes out a guitar in the middle of the mix. The note row reads the sound after the Bass and Voice cuts.')));
        rows.push(resetRow());
      }
      if (tab === 'parts') {
        const range = m => m.b ? `${fmt(m.t)} to ${fmt(m.b)}` : fmt(m.t);
        rows.push(h('div', { class: 'player-field' },
          btn('+ Mark here', addMarker, { title: 'Key M: a part starts where the song is now' }),
          btn('+ Save the loop', saveLoop, { disabled: !hasLoop(), title: 'Keep the loop from A to B under a name' })));
        rows.push(P.markers.length ? h('ol', { class: 'player-marks' }, P.markers.map((m, i) => h('li', null,
          h('button', { type: 'button', class: 'btn player-mark', onclick: () => loopMarker(i), title: 'Loop this part' }, h('b', null, m.name),
            h('span', { class: 'player-mark-t' }, range(m) + (m.b && m.rate && m.rate !== 1 ? `, ${Math.round(m.rate * 100)}%` : ''))),
          btn('Rename', () => { const name = (root.prompt('Name of the part', m.name) || '').trim(); if (name) { m.name = name.slice(0, 40); remember(); draw(); } }, { class: 'btn btn-text' }),
          btn('×', () => { P.markers = P.markers.filter((_, k) => k !== i); remember(); draw(); }, { 'aria-label': `Delete ${m.name}` }))))
          : h('p', { class: 'small muted player-hint' }, 'Mark the start of a part (intro, verse, solo), or save a loop under a name. A tap on a part loops it.'));
      }
      if (tab === 'bars') rows.push(...barRows());
      parts.push(h('div', { class: 'controls player-controls' }, rows));
      // A phone shows no tooltip, so the buttons that need a word get it here. The help stands under the box of the
      // tab, with the line about the keys: the box holds settings only.
      const help = helpLines(tab);
      if (help.length) parts.push(h('details', { class: 'drill-help player-help', open: !!u.helpOpen, ontoggle: e => { u.helpOpen = e.target.open; } },
        h('summary', null, 'What the buttons do'), help.map(([name, text]) => h('p', null, h('b', null, name), ': ', text))));
      parts.push(h('p', { class: 'small muted drill-keys' }, `Keys: Space or Page Down play or pause, ← → 5 seconds, Home or Page Up back to the start, A and B set the loop, L repeat on or off, M mark a part, [ and ] slower and faster${isFile() ? ', H hold the sound, + and − zoom' : ''}.`));
    }
    if (!P.kind || P.ytError) watchTransport(null);
    box.replaceChildren(...parts);
    showEdges();
    showZoom();
    show();
  }
  // A new song: the media part and the panel. The box to open a song folds into one line.
  function drawAll() { hideGet(); drawMedia(); draw(); foldSource(); mediaKeys(isFile()); if (P.ui.refreshSongs) P.ui.refreshSongs(); }
  // With a song open, the box to open another one is behind the "Other song" button. It opens under that button,
  // and the same button closes it.
  function showFold(open) {
    const u = P.ui;
    u.fold.open = open;
    if (u.other) { u.other.setAttribute('aria-expanded', String(open)); u.other.textContent = open && P.kind ? 'Close' : 'Other song'; }
    if (open && u.refreshSongs) u.refreshSongs();
    if (u.watch) dock(u.playOff);
  }
  // With a song open, the box to open another one closes and the title of the page goes: the song needs the room.
  function foldSource() {
    const f = P.ui.fold;
    if (!f) return;
    // A song that opens from the box starts at the top of the page.
    if (f.open && P.kind && f.isConnected) root.scrollTo(0, 0);
    f.classList.toggle('is-folded', !!P.kind);
    showFold(!P.kind);
    if (P.ui.page) P.ui.page.classList.toggle('has-song', !!P.kind && !P.ytError);
  }
  // The dock: a small bar at the bottom while Play is off the screen, with back 5 seconds, Play, the time and Loop.
  // It stays away while the box to open another song is open: it would stand on the list.
  function watchTransport(row) {
    const u = P.ui;
    if (u.watch) { u.watch.disconnect(); u.watch = null; }
    u.playOff = false;
    if (!row || !root.IntersectionObserver) { dock(false); return; }
    u.watch = new IntersectionObserver(([e]) => { u.playOff = !e.isIntersecting; dock(u.playOff); });
    u.watch.observe(row);
  }
  function dock(on) {
    const u = P.ui;
    on = on && !(u.fold && u.fold.open);
    if (on && !u.dock) {
      u.dockPlay = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => P.playing ? stop() : play() });
      u.dockTime = h('span', { class: 'player-dock-time' });
      u.dockLoop = h('button', { type: 'button', class: 'chip chip-toggle', title: 'Key L', onclick: () => set({ loop: !P.loop }) }, 'Repeat');
      u.dock = h('div', { class: 'play-bar player-dock', role: 'region', 'aria-label': 'Player' },
        btn('−5 s', () => seek(P.pos - 5), { 'aria-label': 'Back 5 seconds' }), u.dockPlay, u.dockTime, u.dockLoop);
      document.body.append(u.dock);
    }
    if (u.dock) u.dock.hidden = !on;
    document.body.classList.toggle('has-play-bar', !!on);
    show();
  }

  // ---------- keys ----------
  function onKey(e) {
    if (!P.ui.box || !P.ui.box.isConnected || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = document.activeElement || {};
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
    if (el.matches && el.matches('a, summary, button:focus-visible') && (e.key === ' ' || e.key === 'Enter')) return;
    const k = e.key;
    if (k === ' ' || k === 'PageDown') { e.preventDefault(); P.playing ? stop() : play(); }
    else if (k === 'PageUp') { e.preventDefault(); seek(hasLoop() ? P.a : 0); }
    else if (k === 'h' || k === 'H') hold(!P.holding);
    else if (k === 't' || k === 'T') tapBeat();
    else if (k === 'ArrowLeft') { e.preventDefault(); seek(P.pos - 5); }
    else if (k === 'ArrowRight') { e.preventDefault(); seek(P.pos + 5); }
    else if (k === 'a' || k === 'A') setA();
    else if (k === 'b' || k === 'B') setB();
    else if (k === 'l' || k === 'L') set({ loop: !P.loop });
    else if (k === 'm' || k === 'M') addMarker();
    else if (k === '[') stepRate(-1);
    else if (k === ']') stepRate(1);
    else if (k === 'Home') { e.preventDefault(); seek(hasLoop() ? P.a : 0); }
    else if (isFile() && (k === '+' || k === '=')) zoom(0.5);
    else if (isFile() && (k === '-' || k === '_')) zoom(2);
  }

  // ---------- the page ----------
  const view = {
    parse: () => ({}),
    link: () => 'tools/play',
    title: () => 'Slow down',
    // A redraw would cut the video and the YouTube frame: this page keeps its parts and draws only what changes.
    keep: true,
    render() {
      const file = h('input', { type: 'file', accept: 'audio/*,video/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.mp4,.mov,.webm', hidden: true, onchange: e => { const f = e.target.files[0]; if (f) openFile(f, true); e.target.value = ''; } });
      const link = h('input', { type: 'url', class: 'player-link', placeholder: 'Paste a YouTube link', 'aria-label': 'YouTube link', enterkeyhint: 'go',
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); openYouTube(link.value); } } });
      // A dock of an earlier drawing of the page goes.
      if (P.ui && P.ui.box) { watchTransport(null); if (P.ui.dock) P.ui.dock.remove(); }
      P.ui = { box: h('div', { class: 'player' }), media: h('div', { class: 'player-media' }), now: h('div', { class: 'player-now' }), say: h('p', { class: 'player-say say', role: 'status', hidden: true }),
        get: h('div', { class: 'controls player-get', role: 'region', 'aria-label': 'Download with your computer', hidden: true }), pick: () => file.click() };
      const recBtn = canRecord() ? btn(P.rec ? '■ Stop recording' : '● Record a part from a tab', () => record()) : null;
      P.ui.recBtn = recBtn;
      // Your songs, the last one first: each file that you opened (the browser keeps a copy), each recording and
      // each video. One tap opens a song again, with its loop and parts. A file from before the copies has no
      // copy: you choose it one more time.
      const songs = h('div', { class: 'player-recent' });
      const size = r => r.blob.size + (r.picture ? r.picture.size : 0);
      // Five songs show at first.
      const FEW = 5;
      let showAll = false, drawn = 0;
      const refreshSongs = async () => {
        const my = ++drawn, list = await recordings('list') || [];
        if (my !== drawn) return;
        const copy = {};
        list.forEach(r => { copy[songKey(r)] = r; });
        const at = k => saved.songs[k] ? saved.songs[k].at : copy[k].at;
        const keys = [...new Set([...Object.keys(saved.songs), ...Object.keys(copy)])].sort((x, y) => at(y) - at(x));
        // Of the songs without a copy, the list keeps the 30 that you opened last.
        const cut = keys.filter(k => !copy[k]).slice(30);
        if (cut.length) { cut.forEach(k => delete saved.songs[k]); save(); }
        // A recording that the browser did not keep has no row: there is no file to choose again.
        const rows = keys.filter(k => !cut.includes(k) && (copy[k] || !k.startsWith('rec:')));
        if (!rows.length) { songs.replaceChildren(); return; }
        const remove = async some => { for (const k of some) { if (copy[k]) await recordings('delete', copy[k].id); delete saved.songs[k]; } save(); refreshSongs(); };
        // A recording of a tab cannot be made again, so the one button for many songs leaves the recordings.
        const rest = rows.filter(k => !(copy[k] && copy[k].id[0] === 'r')), kept = rest.filter(k => copy[k]).length;
        const all = list.reduce((sum, r) => sum + size(r), 0), shown = showAll ? rows : rows.slice(0, FEW);
        songs.replaceChildren(...[
          h('div', { class: 'player-recent-head' }, h('span', { class: 'small muted' }, h('b', null, 'Your songs'), list.length ? `, ${mb(all)} MB stored` : ''),
            rest.length > 1 ? h('button', { type: 'button', class: 'btn btn-text', onclick: () => { if (root.confirm(`Remove ${rest.length} songs from the list, with their loops and parts?${kept ? ' What the browser keeps of them goes too. Files on your disk stay.' : ''}${rest.length < rows.length ? ' Recordings stay.' : ''}`)) remove(rest); } }, 'Clear the list') : null),
          h('ul', { class: 'player-recent-list' }, shown.map(k => {
            const s = saved.songs[k] || {}, r = copy[k], name = s.name || (r && r.name) || 'Song', video = k.startsWith('yt:'), n = (s.markers || []).length, open = k === P.key;
            const note = [open ? 'open now' : '', video ? 'YouTube' : r ? `${r.id[0] === 'r' ? 'recording, ' : ''}${mb(size(r))} MB` : open ? 'no copy in this browser' : 'choose the file again', n ? `${n} part${n > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ');
            return h('li', null,
              h('button', { type: 'button', class: 'btn player-mark', 'aria-current': open ? 'true' : null, onclick: () => {
                if (open) showFold(false);
                else if (video) openYouTube(k.slice(3));
                else if (r) openRecording(r);
                else { say(`Choose ${name} one more time. After that, the browser has a copy of it.`); file.click(); }
              } }, h('b', null, name), h('span', { class: 'player-mark-t' }, note)),
              // A recording or a download is only in the browser, so the page asks first.
              btn('×', () => { if (!r || r.id.startsWith('file:') || root.confirm(`Delete ${name}?`)) remove([k]); }, { 'aria-label': `Remove ${name} from the list, with its loop and parts` }));
          })),
          rows.length > shown.length ? h('button', { type: 'button', class: 'btn btn-text player-more', onclick: () => { showAll = true; refreshSongs(); } }, `Show all ${rows.length} songs`) : null].filter(Boolean));
      };
      P.ui.refreshSongs = refreshSongs;
      refreshSongs();
      const source = h('div', { class: 'controls player-source', role: 'group', 'aria-label': 'Open a song' },
        songs,
        h('div', { class: 'row player-open' }, btn('Open a song file', () => file.click(), { class: 'btn btn-primary' }), file,
          h('span', { class: 'small muted' }, 'mp3, m4a, wav, flac, or a video (mp4, mov, webm), up to 300 MB.', h('span', { class: 'mouse-only' }, ' Or drop it on this page.'), ' The browser keeps a copy, so the song opens again with one tap.')),
        h('div', { class: 'row player-open' }, link, btn('Open the video', () => openYouTube(link.value)), btn('Download as a file', () => showGet(link.value, 'box'))),
        h('p', { class: 'small muted player-hint' }, 'A video plays in the frame of YouTube, with few tools. As a file, the song gets every tool.'),
        recBtn ? h('div', { class: 'row player-open' }, recBtn, h('span', { class: 'small muted' }, 'Chrome or Edge: share the YouTube tab with its sound, play the part, and the player keeps it.')) : null);
      // The ways to add a song stand together: a file, a video, a recording of a tab. The panel with the download
      // command opens under them.
      P.ui.source = source;
      P.ui.fold = h('details', { class: 'player-fold' }, h('summary', null, 'Open a song'), source);
      foldSource();
      // A file dropped anywhere on the page opens.
      const page = h('div', { class: 'player-page', ondragover: e => { e.preventDefault(); }, ondrop: e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) openFile(f, true); } },
        h('div', { class: 'lib-title' }, h('div', null, h('h1', null, 'Slow down'), h('p', { class: 'muted lib-sub' }, 'Learn a song by ear: slow it down without changing its pitch, loop a part, change its key.'))),
        P.ui.now, P.ui.say, P.ui.fold, P.ui.media, P.ui.box, P.ui.get);
      P.ui.page = page;
      foldSource();
      // Back on the page: a YouTube video opens again (its frame went with the page), a file is still here.
      if (P.kind === 'youtube' && P.ytId) { const at = P.pos; setTimeout(() => openYouTube(P.ytId, at), 0); }
      else drawAll();
      root.removeEventListener('keydown', onKey);
      root.addEventListener('keydown', onKey);
      return [page];
    }
  };
  // Leaving the page: the song stops, the keys stop working and the recording ends.
  function leave() {
    stop();
    watchTransport(null);
    if (P.ui.dock) { P.ui.dock.remove(); P.ui.dock = null; }
    root.removeEventListener('keydown', onKey);
    if (P.rec) P.rec.stop();
    mediaKeys(false);
    // The YouTube frame goes with the page. The link stays, so the video opens again when you come back.
    if (P.kind === 'youtube') { const id = P.ytId; unloadYouTube(); P.ytId = id; }
  }
  root.addEventListener('resize', () => { if (P.ui.wave && P.ui.wave.isConnected) paint(); });
  // A new audio context (an iPhone back from another app, see audio.js): the engine starts again, and the open
  // song loads again from its file, at the same place.
  A.onNewContext = () => {
    if (!P.node) return;
    P.playing = false; clearTimeout(P.waitTimer); P.waiting = false;
    if (P.video) P.video.pause();
    P.node = null; P.out = null; P.chain = []; P.drum = null; P.drumLoad = null;
    show();
    const src = P.source, pos = P.pos;
    if (!isFile() || !src) return;
    const same = () => P.source && (P.source.file || P.source.rec) === (src.file || src.rec);
    (src.file ? openFile(src.file) : openRecording(src.rec)).then(() => { if (same()) { P.pos = Math.min(pos, P.duration); show(); } });
  };
  // The sound switch and the volume of Settings work for the player too.
  A.onVolume = () => { if (P.out) P.out.gain.value = A.volume; };

  // state: the player state, for checks in the browser.
  GT.player = { view, leave, ytIdOf, command, state: () => P };
})(window);
