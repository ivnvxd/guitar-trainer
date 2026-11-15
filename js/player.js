/* Slow down: a player to learn songs by ear, the Tools page tools/play.
   Open a song file (audio or video), a YouTube link, or record a part of a browser tab. Slow it down without
   changing its pitch, transpose it, loop a part, mark the parts of a song, filter the sound and guess the notes at a
   spot. A file never leaves this device. The page keeps the markers and the settings of each song in the browser,
   and a recording until you delete it.
   The sound of a file goes through Signalsmith Stretch (js/vendor), which the page loads when you open a file.
   A YouTube video plays in YouTube's own frame: the page can only ask it for a speed from its list and jump back for
   a loop, so the other tools work only on files and recordings. */
(function (root) {
  'use strict';
  const GT = root.GT, A = GT.audio, T = GT.theory, FB = GT.fretboard;
  const { h, store, settings } = GT;

  // Longer songs need too much memory on a phone: the sound of a 10-minute song is about 200 MB.
  const MAX_SECONDS = 600;
  // A mono copy at a lower rate draws the waveform and feeds the note guess.
  const MONO_RATE = 22050;
  const saved = Object.assign({ songs: {} }, store.get('player', {}));
  const save = () => store.set('player', saved);

  // The state of the player. It lives as long as the page is open, so you can look at another page and come back.
  const P = {
    kind: null, key: null, name: '', duration: 0, pos: 0, playing: false,
    rate: 1, semis: 0, cents: 0, filter: 'none', a: null, b: null, loop: false, gap: 0, climb: 0, markers: [],
    node: null, out: null, mono: null, peaks: null, video: null, videoUrl: null,
    yt: null, ytId: null, ytRates: [1], ytTimer: null, waitTimer: null, lastT: 0,
    rec: null, ui: {}
  };
  const fmt = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; };
  const isFile = () => P.kind === 'file';
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- saved songs ----------
  function remember() {
    if (!P.key) return;
    saved.songs[P.key] = { name: P.name, markers: P.markers, a: P.a, b: P.b, loop: P.loop, rate: P.rate, semis: P.semis, cents: P.cents, filter: P.filter, gap: P.gap, climb: P.climb, at: Date.now() };
    // The 30 songs you opened last.
    const keys = Object.keys(saved.songs).sort((x, y) => saved.songs[y].at - saved.songs[x].at);
    keys.slice(30).forEach(k => delete saved.songs[k]);
    save();
  }
  function restore(key) {
    const s = saved.songs[key] || {};
    Object.assign(P, { rate: s.rate || 1, semis: s.semis || 0, cents: s.cents || 0, filter: s.filter || 'none', a: s.a ?? null, b: s.b ?? null,
      loop: !!s.loop, gap: s.gap || 0, climb: s.climb || 0, markers: Array.isArray(s.markers) ? s.markers : [], pos: 0 });
  }

  // ---------- recordings, kept in IndexedDB ----------
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
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
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
  // The filters between the player and the speakers. Voice cut keeps what differs between left and right:
  // a voice in the middle of a stereo mix goes, and so does a bass or a drum in the middle.
  function route() {
    if (!P.node) return;
    const c = A.context();
    try { P.node.disconnect(); } catch (e) { /* not connected */ }
    if (P.chain) P.chain.forEach(n => { try { n.disconnect(); } catch (e) { /* gone */ } });
    P.chain = [];
    P.out.gain.value = A.volume;
    if (P.filter === 'bass-up' || P.filter === 'bass-cut') {
      const f = c.createBiquadFilter();
      if (P.filter === 'bass-up') { f.type = 'lowshelf'; f.frequency.value = 220; f.gain.value = 10; } else { f.type = 'highpass'; f.frequency.value = 220; f.Q.value = 0.7; }
      const g = c.createGain(); g.gain.value = P.filter === 'bass-up' ? 0.6 : 1;
      P.node.connect(f); f.connect(g); g.connect(P.out);
      P.chain.push(f, g);
    } else if (P.filter === 'voice-cut') {
      const split = c.createChannelSplitter(2), left = c.createGain(), right = c.createGain(), merge = c.createChannelMerger(2);
      right.gain.value = -1; left.gain.value = 1;
      const diff = c.createGain(); diff.gain.value = 0.8;
      P.node.connect(split); split.connect(left, 0); split.connect(right, 1); left.connect(diff); right.connect(diff);
      diff.connect(merge, 0, 0); diff.connect(merge, 0, 1); merge.connect(P.out);
      P.chain.push(split, left, right, diff, merge);
    } else P.node.connect(P.out);
  }
  // A mono copy at about 22 kHz, and the peaks of the waveform.
  function keepMono(buf) {
    const step = Math.max(1, Math.round(buf.sampleRate / MONO_RATE)), n = Math.floor(buf.length / step);
    const l = buf.getChannelData(0), r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
    const mono = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < step; k++) s += l[i * step + k] + r[i * step + k]; mono[i] = s / (2 * step); }
    P.mono = mono;
    P.monoRate = buf.sampleRate / step;
    const cols = 1200, per = Math.max(1, Math.floor(n / cols)), peaks = new Float32Array(cols);
    for (let c = 0; c < cols; c++) { let m = 0; for (let i = c * per; i < Math.min(n, (c + 1) * per); i++) m = Math.max(m, Math.abs(mono[i])); peaks[c] = m; }
    const top = Math.max(...peaks) || 1;
    P.peaks = peaks.map(p => p / top);
  }
  // Decoded sound into the player: both channels go to the engine, and only the mono copy stays here.
  const tooLong = seconds => `This song is ${fmt(seconds)} long. The player takes up to 10 minutes: cut the file shorter, or open a part of it.`;
  // False when a later open started meanwhile: that one wins.
  async function loadDecoded(buf, name, key, media, my) {
    if (buf.duration > MAX_SECONDS) throw new Error(tooLong(buf.duration));
    const node = await engine();
    if (my !== opening) return false;
    const chans = [0, buf.numberOfChannels > 1 ? 1 : 0].map(ch => buf.getChannelData(ch).slice());
    await node.dropBuffers();
    await node.addBuffers(chans, chans.map(c => c.buffer));
    if (my !== opening) return false;
    keepMono(buf);
    unloadYouTube();
    Object.assign(P, { kind: 'file', name, key, duration: buf.duration, ytError: null });
    restore(key);
    if (P.videoUrl) URL.revokeObjectURL(P.videoUrl);
    P.video = null; P.videoUrl = null;
    if (media) {
      P.videoUrl = URL.createObjectURL(media);
      P.video = h('video', { class: 'player-video', src: P.videoUrl, muted: true, playsinline: true, preload: 'auto' });
      P.video.muted = true;
    }
    route();
    remember();
    return true;
  }
  // A file over 300 MB is a long video: its sound would not fit in a phone's memory.
  const MAX_BYTES = 300 * 1024 * 1024;
  // Each open counts. When a later open starts while an earlier one still decodes, the earlier one gives up.
  let opening = 0;
  // The length of a file from its header, before the page decodes it: a long mp3 is small as a file but large
  // when decoded. NaN when the browser cannot tell.
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
  async function openFile(file) {
    stop();
    const my = ++opening;
    if (file.size > MAX_BYTES) { say(`${file.name} is ${Math.round(file.size / 1048576)} MB. The player takes files up to 300 MB: use the sound only (mp3 or m4a), or a shorter part.`); return; }
    say(`Opening ${file.name}…`);
    try {
      const c = A.context();
      if (!c) throw new Error('This browser cannot play sound.');
      if (c.state !== 'running') c.resume().catch(() => {});
      const length = await lengthOf(file);
      if (my !== opening) return;
      if (isFinite(length) && length > MAX_SECONDS) throw new Error(tooLong(length));
      let buf;
      try { buf = await c.decodeAudioData(await file.arrayBuffer()); } catch (e) { throw new Error(`The browser cannot read the sound of ${file.name}. Try an mp3, m4a, wav or mp4 file.`); }
      if (my !== opening) return;
      if (!await loadDecoded(buf, file.name, `file:${file.name}:${Math.round(buf.duration)}`, /^video\//.test(file.type) ? file : null, my)) return;
      say('');
      drawAll();
    } catch (e) { if (my === opening) say(e.message || 'The file did not open.'); }
  }

  // ---------- playing a file ----------
  const pitch = () => P.semis + P.cents / 100;
  // The engine loops by itself when there is no pause between the passes; with a pause the page stops and starts it.
  const ownLoop = () => P.loop && P.a !== null && P.b !== null && P.b > P.a && !P.gap;
  function schedule(extra = {}) {
    if (!P.node) return;
    P.node.schedule(Object.assign({ rate: P.rate, semitones: pitch(), loopStart: ownLoop() ? P.a : 0, loopEnd: ownLoop() ? P.b : 0 }, extra));
  }
  function play() {
    if (P.kind === 'youtube') { if (P.yt && P.yt.playVideo) P.yt.playVideo(); return; }
    if (!isFile() || !P.node) return;
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
    if (P.video) { P.video.currentTime = P.pos; P.video.playbackRate = Math.max(0.25, P.rate); P.video.play().catch(() => {}); }
    show();
  }
  function stop() {
    clearTimeout(P.waitTimer);
    P.waiting = false;
    if (P.kind === 'youtube' && P.yt && P.yt.pauseVideo) P.yt.pauseVideo();
    if (P.node && P.playing) P.node.stop();
    P.playing = false;
    if (P.video) P.video.pause();
    show();
  }
  function seek(t) {
    P.pos = Math.max(0, Math.min(P.duration, t));
    if (P.kind === 'youtube') { if (P.yt && P.yt.seekTo) P.yt.seekTo(P.pos, true); show(); return; }
    if (P.playing) schedule({ input: P.pos });
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
        P.waiting = false; P.lastT = P.a;
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
    if (P.loop && P.a !== null && P.b !== null && P.b > P.a) {
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
    if (!id) { say('That is not a YouTube link. Copy the address of the video, for example https://youtu.be/…'); return; }
    stop();
    const my = ++opening;
    say('Opening the video…');
    try { await loadYouTubeApi(); } catch (e) { if (my === opening) say(e.message); return; }
    if (my !== opening) return;
    unloadYouTube();
    if (P.node) { try { await P.node.dropBuffers(); } catch (e) { /* none */ } }
    if (my !== opening) return;
    P.mono = null; P.peaks = null; P.video = null;
    Object.assign(P, { kind: 'youtube', ytId: id, ytError: null, key: `yt:${id}`, name: (saved.songs[`yt:${id}`] || {}).name || 'YouTube video', duration: 0 });
    restore(P.key);
    P.semis = 0; P.cents = 0; P.filter = 'none';
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
    } catch (e) { say('Recording did not start. Pick the tab with the video, and tick "Share tab audio".'); return; }
    const tracks = stream.getAudioTracks();
    if (!tracks.length) {
      stream.getTracks().forEach(t => t.stop());
      say('The share had no sound. Share a browser tab, not a window or the screen, and tick "Share tab audio". Chrome and Edge can do this; Safari and Firefox cannot.');
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
      say('Opening the recording…');
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      const id = `r${Date.now()}`, name = `Recording ${new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
      await recordings('put', { id, name, blob, at: Date.now() });
      if (P.ui.refreshRecs) P.ui.refreshRecs();
      await openRecording({ id, name, blob });
    };
    stream.getTracks().forEach(t => t.addEventListener('ended', () => { if (rec.state === 'recording') rec.stop(); }));
    rec.start(1000);
    P.rec = rec;
    if (P.ui.recBtn) P.ui.recBtn.textContent = '■ Stop recording';
    P.recTimer = setInterval(() => say(`Recording… ${fmt((Date.now() - started) / 1000)}. Play the part in the other tab, then come back and tap Stop recording.`), 500);
  }
  async function openRecording(r) {
    stop();
    const my = ++opening;
    say(`Opening ${r.name}…`);
    try {
      const c = A.context();
      const buf = await c.decodeAudioData(await r.blob.arrayBuffer());
      if (my !== opening || !await loadDecoded(buf, r.name, `rec:${r.id}`, null, my)) return;
      say('');
    } catch (e) { if (my === opening) say(e.message || 'The recording did not open.'); }
    drawAll();
  }

  // ---------- the note guess ----------
  function notesHere() {
    if (!P.mono) return null;
    const at = Math.max(0, Math.floor((P.pos - 0.05) * P.monoRate)), part = P.mono.subarray(at, at + 8192);
    const shift = Math.round(pitch());
    const notes = T.notesAt(part, P.monoRate).map(n => Object.assign({}, n, { midi: n.midi + shift, pc: T.mod(n.pc + shift) }));
    if (!notes.length) return { notes: [], chord: null };
    const pcs = [...new Set(notes.map(n => n.pc))], bass = notes.reduce((lo, n) => n.midi < lo.midi ? n : lo).pc;
    const chord = pcs.length >= 2 ? (T.chordsFrom(pcs, bass)[0] || null) : null;
    return { notes, chord, bass };
  }

  // ---------- drawing ----------
  function say(text) { if (P.ui.say) P.ui.say.textContent = text; }
  // The waveform: the whole song, the loop, the markers and where you are. A tap jumps, a drag sets the loop.
  function drawWave() {
    const cv = P.ui.wave;
    if (!cv || !P.peaks) return;
    const dpr = root.devicePixelRatio || 1, w = cv.clientWidth, hgt = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
    const g = cv.getContext('2d'), css = getComputedStyle(cv);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    const x = t => P.duration ? t / P.duration * w : 0;
    if (P.a !== null && P.b !== null && P.b > P.a) { g.fillStyle = css.getPropertyValue('--wave-loop'); g.fillRect(x(P.a), 0, x(P.b) - x(P.a), hgt); }
    const mid = hgt / 2, played = x(P.pos);
    for (let px = 0; px < w; px++) {
      const p = P.peaks[Math.floor(px / w * P.peaks.length)] || 0, len = Math.max(1, p * (mid - 3));
      g.fillStyle = px < played ? css.getPropertyValue('--wave-played') : css.getPropertyValue('--wave');
      g.fillRect(px, mid - len, 1, len * 2);
    }
    g.fillStyle = css.getPropertyValue('--wave-mark');
    P.markers.forEach(m => g.fillRect(Math.round(x(m.t)), 0, 1.5, hgt));
    g.fillStyle = css.getPropertyValue('--wave-head');
    g.fillRect(Math.round(played) - 1, 0, 2, hgt);
  }
  function waveInput(cv) {
    let down = null;
    const at = e => { const r = cv.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * P.duration; };
    cv.addEventListener('pointerdown', e => { down = { x: e.clientX, t: at(e) }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!down || Math.abs(e.clientX - down.x) < 8) return;
      const t = at(e);
      P.a = Math.min(down.t, t); P.b = Math.max(down.t, t); P.loop = true;
      drawWave();
    });
    cv.addEventListener('pointercancel', () => { down = null; });
    cv.addEventListener('pointerup', e => {
      if (!down) return;
      if (Math.abs(e.clientX - down.x) < 8) seek(at(e)); else { remember(); if (P.playing) { schedule(); seek(P.a); } draw(); }
      down = null;
    });
  }
  // Update the moving parts in place: time, playhead, the play button and the speed.
  function show() {
    const u = P.ui;
    if (u.time) u.time.textContent = `${fmt(P.pos)} / ${fmt(P.duration)}`;
    if (u.play) u.play.textContent = P.playing ? '❚❚ Pause' : '▶ Play';
    if (u.dock && !u.dock.hidden) {
      u.dockPlay.textContent = P.playing ? '❚❚ Pause' : '▶ Play';
      u.dockTime.textContent = fmt(P.pos);
      u.dockLoop.setAttribute('aria-pressed', String(!!P.loop));
    }
    if (u.rateOut) u.rateOut.textContent = `${Math.round(P.rate * 100)}%`;
    if (u.rateIn && document.activeElement !== u.rateIn) u.rateIn.value = Math.round(P.rate * 100);
    if (u.seek && document.activeElement !== u.seek) { u.seek.max = Math.max(1, P.duration); u.seek.value = P.pos; }
    drawWave();
  }
  const chip = (text, on, onclick, title) => h('button', { type: 'button', class: 'chip chip-toggle', 'aria-pressed': String(!!on), title, onclick }, text);
  const btn = (text, onclick, extra = {}) => h('button', Object.assign({ type: 'button', class: 'btn', onclick }, extra), text);
  const set = patch => { Object.assign(P, patch); remember(); if (isFile()) { if ('filter' in patch) route(); if (P.playing) schedule(); } GT.keepPlace(draw); };
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
  // A and B: the loop changes at once, also while the song plays.
  function setA() {
    P.a = P.pos;
    if (P.b !== null && P.b <= P.a) P.b = null;
    remember();
    if (P.playing && isFile()) schedule();
    draw();
  }
  function setB() {
    if (P.a === null || P.pos <= P.a) return false;
    P.b = P.pos; P.loop = true;
    remember();
    if (P.playing && isFile()) schedule();
    draw();
    return true;
  }
  function addMarker() {
    if (!P.kind) return;
    const n = P.markers.length + 1;
    P.markers = P.markers.concat({ t: Math.round(P.pos * 10) / 10, name: `Part ${n}` }).sort((x, y) => x.t - y.t);
    remember(); draw();
  }
  // The part from a marker to the next one (or to the end) becomes the loop.
  function loopMarker(i) {
    const m = P.markers[i], next = P.markers[i + 1];
    P.a = m.t; P.b = next ? next.t : P.duration; P.loop = true;
    remember();
    if (isFile() && P.playing) schedule();
    seek(P.a);
    draw();
  }
  // The media part (the video, the YouTube frame, the waveform) is drawn once for each song: moving a YouTube frame
  // in the page would load the video again. The panel under it is drawn again after each change.
  function drawMedia() {
    const u = P.ui;
    if (!u.media) return;
    // A video that YouTube will not play here: only the message and a link show, in the panel.
    u.media.hidden = !!P.ytError;
    if (P.ytError && u.ytBox && u.ytBox.isConnected) return;
    const parts = [];
    if (P.kind === 'youtube') { u.ytBox = h('div'); parts.push(h('div', { class: 'player-yt' }, u.ytBox)); }
    if (P.video) parts.push(h('div', { class: 'player-video-box' }, P.video));
    if (isFile()) {
      u.wave = h('canvas', { class: 'player-wave', role: 'img', 'aria-label': 'The song. Tap to jump, drag to set the loop.' });
      waveInput(u.wave);
      parts.push(u.wave);
    } else if (P.kind === 'youtube') {
      u.seek = h('input', { type: 'range', class: 'player-seek', min: 0, max: Math.max(1, P.duration), step: 0.1, value: P.pos, 'aria-label': 'Place in the video', oninput: e => seek(Number(e.target.value)) });
      parts.push(u.seek);
    }
    u.media.replaceChildren(...parts);
    // The canvas has its size only once the page is in the document.
    requestAnimationFrame(() => drawWave());
  }
  function draw() {
    const box = P.ui.box;
    if (!box) return;
    const u = P.ui;
    const parts = [];
    if (P.ytError) {
      if (u.now) u.now.replaceChildren();
      u.time = u.play = null;
      parts.push(h('div', { class: 'controls player-blocked' }, h('p', null, P.ytError),
        h('a', { class: 'btn', href: `https://www.youtube.com/watch?v=${P.ytId}`, target: '_blank', rel: 'noopener' }, 'Open the video on YouTube')));
    } else if (P.kind) {
      u.time = h('span', { class: 'player-time' });
      if (u.now) u.now.replaceChildren(h('span', { class: 'player-name' }, ...[h('b', null, P.name), P.kind === 'youtube' ? h('span', { class: 'muted small' }, ' on YouTube') : null].filter(Boolean)), u.time);
      u.play = h('button', { type: 'button', class: 'btn btn-primary player-play', onclick: () => P.playing ? stop() : play() }, '▶ Play');
      const transport = h('div', { class: 'row player-transport' },
        btn('−5 s', () => seek(P.pos - 5), { 'aria-label': 'Back 5 seconds' }), u.play, btn('+5 s', () => seek(P.pos + 5), { 'aria-label': 'On 5 seconds' }));
      parts.push(transport);
      watchTransport(transport);
      // Speed
      u.rateOut = h('output', { class: 'player-rate' });
      u.rateIn = h('input', { type: 'range', min: 25, max: 150, step: P.kind === 'youtube' ? 25 : 1, value: Math.round(P.rate * 100), 'aria-label': 'Speed in percent', oninput: e => setRate(Number(e.target.value) / 100) });
      const rows = [h('div', { class: 'player-field' }, h('span', { class: 'player-label' }, 'Speed'), u.rateIn, u.rateOut,
        h('div', { class: 'row player-chips' }, [50, 75, 100].map(v => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(Math.round(P.rate * 100) === v), onclick: () => { setRate(v / 100); draw(); } }, `${v}%`))))];
      // Pitch: files and recordings only
      if (isFile()) {
        rows.push(h('div', { class: 'player-field' }, h('span', { class: 'player-label' }, 'Key'),
          btn('−1', () => set({ semis: Math.max(-12, P.semis - 1) }), { 'aria-label': 'Down a semitone' }),
          h('output', { class: 'player-rate' }, P.semis ? `${P.semis > 0 ? '+' : ''}${P.semis} semitone${Math.abs(P.semis) > 1 ? 's' : ''}` : 'As recorded'),
          btn('+1', () => set({ semis: Math.min(12, P.semis + 1) }), { 'aria-label': 'Up a semitone' }),
          h('label', { class: 'player-cents' }, 'Fine', h('input', { type: 'range', min: -50, max: 50, step: 1, value: P.cents, 'aria-label': 'Fine tune in cents', onchange: e => set({ cents: Number(e.target.value) }) }), h('span', null, `${P.cents > 0 ? '+' : ''}${P.cents} cents`))));
      }
      // Loop
      rows.push(h('div', { class: 'player-field' }, h('span', { class: 'player-label' }, 'Loop'),
        h('div', { class: 'row player-chips' },
          btn(P.a === null ? 'Set A' : `A ${fmt(P.a)}`, setA, { title: 'Key A' }),
          btn(P.b === null ? 'Set B' : `B ${fmt(P.b)}`, () => { if (!setB()) say('Set A first, then play on and set B after it.'); }, { title: 'Key B' }),
          chip('Loop', P.loop, () => set({ loop: !P.loop }), 'Key L'),
          P.a !== null || P.b !== null ? btn('Clear', () => set({ a: null, b: null, loop: false })) : null)));
      rows.push(h('div', { class: 'player-field' }, h('span', { class: 'player-label' }, 'Each pass'),
        GT.segmented('Pause before each pass', [[0, 'No pause'], [1, 'Pause 1 s'], [2, '2 s']], P.gap, v => set({ gap: v })),
        GT.segmented('Speed up each pass', P.kind === 'youtube' ? [[0, 'Same speed'], [1, 'Next speed each pass']] : [[0, 'Same speed'], [2, '+2%'], [5, '+5%']], P.kind === 'youtube' ? (P.climb ? 1 : 0) : P.climb, v => set({ climb: v }))));
      if (isFile()) rows.push(h('div', { class: 'player-field' }, h('span', { class: 'player-label' }, 'Sound'),
        GT.segmented('Sound filter', [['none', 'Off'], ['bass-up', 'Bass up'], ['bass-cut', 'Bass cut'], ['voice-cut', 'Voice cut']], P.filter, v => set({ filter: v }), 'player-filter')));
      else rows.push(h('p', { class: 'small muted' }, 'YouTube does not let other sites change its sound, so a video has its own speeds and no key change, filters or note guess. On a computer you can record a part of it and get every tool.'));
      parts.push(h('div', { class: 'controls player-controls' }, rows));
      // Markers
      parts.push(h('section', { class: 'lib-section' }, h('div', { class: 'section-head' }, h('h2', null, 'Parts of the song'), btn('+ Mark here', addMarker, { title: 'Key M' })),
        P.markers.length ? h('ol', { class: 'player-marks' }, P.markers.map((m, i) => h('li', null,
          h('button', { type: 'button', class: 'btn player-mark', onclick: () => loopMarker(i), title: 'Loop this part' }, h('span', { class: 'player-mark-t' }, fmt(m.t)), h('b', null, m.name)),
          btn('Rename', () => { const name = (root.prompt('Name of the part', m.name) || '').trim(); if (name) { m.name = name.slice(0, 40); remember(); draw(); } }),
          btn('×', () => { P.markers = P.markers.filter((_, k) => k !== i); remember(); draw(); }, { 'aria-label': `Delete ${m.name}` }))))
          : h('p', { class: 'small muted' }, 'Play to the start of a part (intro, verse, solo) and tap Mark here. A tap on a part loops it up to the next one.')));
      // Notes here
      if (isFile()) {
        // The last guess stays when the panel is drawn again.
        const last = u.notes ? [...u.notes.childNodes] : [];
        u.notes = h('div', { class: 'player-notes' }, last);
        parts.push(h('section', { class: 'lib-section' }, h('div', { class: 'section-head' }, h('h2', null, 'Notes here'), btn('What notes are here?', () => showNotes())),
          h('p', { class: 'small muted' }, 'Pause where a chord or a note rings, then tap. The page lists the loudest notes at that spot and guesses the chord. It is a guess: a full band often confuses it.'), u.notes));
      }
      parts.push(h('p', { class: 'small muted drill-keys' }, 'Keys: Space play or pause, ← → 5 seconds, A and B set the loop, L loop on or off, M mark a part, [ and ] slower and faster.'));
    }
    if (!P.kind || P.ytError) watchTransport(null);
    box.replaceChildren(...parts);
    show();
  }
  // A new song: the media part and the panel. The box to open a song folds into one line.
  function drawAll() { drawMedia(); draw(); foldSource(); }
  function foldSource() {
    const f = P.ui.fold;
    if (!f) return;
    f.classList.toggle('is-folded', !!P.kind);
    f.open = !P.kind;
  }
  // The dock: a small bar at the bottom while Play is off the screen, with back 5 seconds, Play, the time and Loop.
  function watchTransport(row) {
    const u = P.ui;
    if (u.watch) { u.watch.disconnect(); u.watch = null; }
    if (!row || !root.IntersectionObserver) { dock(false); return; }
    u.watch = new IntersectionObserver(([e]) => dock(!e.isIntersecting));
    u.watch.observe(row);
  }
  function dock(on) {
    const u = P.ui;
    if (on && !u.dock) {
      u.dockPlay = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => P.playing ? stop() : play() });
      u.dockTime = h('span', { class: 'player-dock-time' });
      u.dockLoop = h('button', { type: 'button', class: 'chip chip-toggle', title: 'Key L', onclick: () => set({ loop: !P.loop }) }, 'Loop');
      u.dock = h('div', { class: 'play-bar player-dock', role: 'region', 'aria-label': 'Player' },
        btn('−5 s', () => seek(P.pos - 5), { 'aria-label': 'Back 5 seconds' }), u.dockPlay, u.dockTime, u.dockLoop);
      document.body.append(u.dock);
    }
    if (u.dock) u.dock.hidden = !on;
    document.body.classList.toggle('has-play-bar', !!on);
    show();
  }
  function showNotes() {
    const u = P.ui;
    if (!u.notes) return;
    const r = notesHere();
    if (!r || !r.notes.length) { u.notes.replaceChildren(h('p', null, 'No clear notes here. Try a spot where a chord rings.')); return; }
    const names = r.notes.map(n => T.PC_PLAIN[n.pc]);
    const markers = [];
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 12; f++) {
      const pc = T.mod(GT.tuning()[s] + f), n = r.notes.find(x => x.pc === pc);
      if (n) markers.push({ string: s, fret: f, kind: pc === r.bass ? 'root' : 'other', label: T.PC_PLAIN[pc] });
    }
    const neckBox = h('div', { class: 'neck' });
    FB.render(neckBox, { from: 0, to: 12, tuning: GT.tuning(), markers, leftHanded: settings.leftHanded, orientation: settings.orientation, turn: true, label: 'The notes heard here' });
    const list = [...new Set(names)];
    u.notes.replaceChildren(
      h('p', null, ...[r.chord ? h('span', null, 'Maybe ', h('b', null, r.chord.name), '. ') : null, `Loudest note${list.length > 1 ? 's' : ''} at ${fmt(P.pos)}: ${list.join(', ')}.`].filter(Boolean)),
      neckBox);
  }

  // ---------- keys ----------
  function onKey(e) {
    if (!P.ui.box || !P.ui.box.isConnected || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = document.activeElement || {};
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
    if (el.matches && el.matches('a, summary, button:focus-visible') && (e.key === ' ' || e.key === 'Enter')) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); P.playing ? stop() : play(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); seek(P.pos - 5); }
    else if (k === 'ArrowRight') { e.preventDefault(); seek(P.pos + 5); }
    else if (k === 'a' || k === 'A') setA();
    else if (k === 'b' || k === 'B') setB();
    else if (k === 'l' || k === 'L') set({ loop: !P.loop });
    else if (k === 'm' || k === 'M') addMarker();
    else if (k === '[') stepRate(-1);
    else if (k === ']') stepRate(1);
  }

  // ---------- the page ----------
  const view = {
    parse: () => ({}),
    link: () => 'tools/play',
    title: () => 'Slow down',
    // A redraw would cut the video and the YouTube frame: this page keeps its parts and draws only what changes.
    keep: true,
    render() {
      const file = h('input', { type: 'file', accept: 'audio/*,video/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.mp4,.mov,.webm', hidden: true, onchange: e => { const f = e.target.files[0]; if (f) openFile(f); e.target.value = ''; } });
      const link = h('input', { type: 'url', class: 'player-link', placeholder: 'Paste a YouTube link', 'aria-label': 'YouTube link', enterkeyhint: 'go',
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); openYouTube(link.value); } } });
      // A dock of an earlier drawing of the page goes.
      if (P.ui && P.ui.box) { watchTransport(null); if (P.ui.dock) P.ui.dock.remove(); }
      P.ui = { box: h('div', { class: 'player' }), media: h('div', { class: 'player-media' }), now: h('div', { class: 'player-now' }), say: h('p', { class: 'player-say', role: 'status' }) };
      const recBtn = canRecord() ? btn(P.rec ? '■ Stop recording' : '● Record a part from a tab', () => record()) : null;
      P.ui.recBtn = recBtn;
      P.ui.refreshRecs = () => refreshRecs();
      const recList = h('div', { class: 'player-recs' });
      const refreshRecs = () => recordings('list').then(list => {
        if (!list || !list.length) { recList.replaceChildren(); return; }
        recList.replaceChildren(h('p', { class: 'small muted' }, 'Your recordings'), h('ul', { class: 'player-rec-list' }, list.sort((x, y) => y.at - x.at).map(r => h('li', null,
          btn(r.name, () => openRecording(r)),
          btn('×', async () => { if (!root.confirm(`Delete ${r.name}?`)) return; await recordings('delete', r.id); delete saved.songs[`rec:${r.id}`]; save(); refreshRecs(); }, { 'aria-label': `Delete ${r.name}` })))));
      });
      refreshRecs();
      const source = h('div', { class: 'controls player-source', role: 'group', 'aria-label': 'Open a song' },
        h('div', { class: 'row player-open' }, btn('Open a song file', () => file.click(), { class: 'btn btn-primary' }), file,
          h('span', { class: 'small muted' }, 'mp3, m4a, wav, flac or a video.', h('span', { class: 'mouse-only' }, ' Or drop it on this page.'))),
        h('div', { class: 'row player-open' }, link, btn('Open', () => openYouTube(link.value))),
        recBtn ? h('div', { class: 'row player-open' }, recBtn, h('span', { class: 'small muted' }, 'Chrome or Edge: share the YouTube tab with its sound, play the part, and the player keeps it.')) : null,
        recList);
      P.ui.fold = h('details', { class: 'player-fold' }, h('summary', { class: 'btn' }, 'Open another song'), source);
      foldSource();
      // A file dropped anywhere on the page opens.
      const page = h('div', { class: 'player-page', ondragover: e => { e.preventDefault(); }, ondrop: e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) openFile(f); } },
        h('div', { class: 'lib-title' }, h('div', null, h('h1', null, 'Slow down'), h('p', { class: 'muted lib-sub' }, 'Learn a song by ear: slow it down without changing its pitch, loop a part, change its key.'))),
        P.ui.fold, P.ui.say, P.ui.now, P.ui.media, P.ui.box);
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
    // The YouTube frame goes with the page. The link stays, so the video opens again when you come back.
    if (P.kind === 'youtube') { const id = P.ytId; unloadYouTube(); P.ytId = id; }
  }
  root.addEventListener('resize', () => { if (P.ui.wave && P.ui.wave.isConnected) drawWave(); });
  // The sound switch and the volume of Settings work for the player too.
  A.onVolume = () => { if (P.out) P.out.gain.value = A.volume; };

  // state: the player state, for checks in the browser.
  GT.player = { view, leave, ytIdOf, state: () => P };
})(window);
