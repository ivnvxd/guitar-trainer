/* Drum cut for Slow down: an AudioWorklet that takes short hits out of the sound and keeps notes that ring.
   The method is harmonic-percussive separation with median filters (Fitzgerald, 2010). In a picture of the sound
   over time, a ringing note is a line along time and a drum hit is a line across the pitches. For each pitch the
   median over time keeps the first kind, and the median over the pitches keeps the second kind. Each part of the
   sound then passes as far as the first kind is the stronger one.
   The sound comes out late, because a hit shows only once the frames after it are known: by N samples and `half`
   steps of HOP samples. A slowed song has slow hits: at half speed a hit lasts twice as long. So the median over
   time looks at more frames when the song is slower, and the sound is later then. */
(function (scope) {
  'use strict';
  // The frame, the step between frames, and how many pitches the median over the pitches looks at.
  const N = 4096, HOP = 1024, BINS = N / 2 + 1, ACROSS = 9;
  // The median over time looks at `half` frames before and after a frame: 4 at full speed, up to 18 for a slow song.
  const MIN_HALF = 4, MAX_HALF = 18, MAX_SPAN = 2 * MAX_HALF + 1, SLOTS = MAX_HALF + 1;
  const halfFor = rate => Math.max(MIN_HALF, Math.min(MAX_HALF, Math.round(MIN_HALF / (rate || 1))));
  // How late the sound is at a speed, in samples.
  const delayFor = rate => N + halfFor(rate) * HOP;
  const DELAY = delayFor(1);
  // Hits count this much more than ringing notes. Above 1 more of the drums goes, but more of a strummed chord too.
  // With these numbers a test mix made of sines and noise lost 19 dB of its drums and 2 dB of its guitar. A real
  // recording loses less of its drums: a cymbal rings, and it stays.
  const BIAS = 1;

  class DrumCut {
    constructor() {
      this.win = new Float32Array(N);
      for (let i = 0; i < N; i++) this.win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
      this.cos = new Float32Array(N / 2); this.sin = new Float32Array(N / 2);
      for (let i = 0; i < N / 2; i++) { this.cos[i] = Math.cos(2 * Math.PI * i / N); this.sin[i] = Math.sin(2 * Math.PI * i / N); }
      this.rev = new Uint16Array(N);
      for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; this.rev[i] = j; }
      // The last N samples that came in and the sound that goes out, as rings. Both start at `at`.
      this.inp = [new Float32Array(N), new Float32Array(N)];
      this.out = [new Float32Array(N), new Float32Array(N)];
      this.at = 0; this.filled = 0; this.frames = 0;
      // The spectra of the last SLOTS frames of each side, and the loudness of the last MAX_SPAN frames.
      this.re = [new Float32Array(SLOTS * N), new Float32Array(SLOTS * N)];
      this.im = [new Float32Array(SLOTS * N), new Float32Array(SLOTS * N)];
      this.mag = new Float32Array(MAX_SPAN * BINS);
      this.half = MIN_HALF;
      this.wr = new Float32Array(N); this.wi = new Float32Array(N);
      this.sort = new Float32Array(MAX_SPAN);
      this.mask = new Float32Array(BINS);
      // 1 cuts the hits, 0 lets all sound pass (late by DELAY, as with the cut).
      this.amount = 1;
    }
    // An FFT in place. sign -1 goes from sound to spectrum, +1 goes back (without the division by N).
    fft(re, im, sign) {
      const rev = this.rev, cos = this.cos, sin = this.sin;
      for (let i = 1; i < N; i++) { const j = rev[i]; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (let len = 2; len <= N; len <<= 1) {
        const half = len >> 1, step = N / len;
        for (let i = 0; i < N; i += len) {
          for (let k = 0; k < half; k++) {
            const cr = cos[k * step], ci = sign * sin[k * step], a = i + k, b = a + half;
            const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
            re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          }
        }
      }
    }
    // The speed of the song, 1 for as recorded.
    setRate(rate) { this.half = halfFor(rate); }
    // Put a value in its place among the first n sorted values.
    place(v, n) {
      const s = this.sort;
      let j = n - 1;
      while (j >= 0 && s[j] > v) { s[j + 1] = s[j]; j--; }
      s[j + 1] = v;
    }
    // A new frame came in: keep its spectrum, and send out the frame of HALF steps ago with the hits taken out.
    frame() {
      const slot = this.frames % SLOTS, row = (this.frames % MAX_SPAN) * BINS, wr = this.wr, wi = this.wi, win = this.win;
      for (let ch = 0; ch < 2; ch++) {
        const inp = this.inp[ch];
        for (let i = 0; i < N; i++) { wr[i] = inp[(this.at + i) % N] * win[i]; wi[i] = 0; }
        this.fft(wr, wi, -1);
        this.re[ch].set(wr, slot * N); this.im[ch].set(wi, slot * N);
        for (let k = 0; k < BINS; k++) { const p = wr[k] * wr[k] + wi[k] * wi[k]; this.mag[row + k] = ch ? Math.sqrt(this.mag[row + k] + p) : p; }
      }
      const half = this.half, span = 2 * half + 1, last = this.frames, mid = last - half;
      this.frames++;
      if (mid < 0) return;
      const mrow = (mid % MAX_SPAN) * BINS, mslot = (mid % SLOTS) * N, mask = this.mask, mag = this.mag, sort = this.sort;
      // The rows of the frames around the middle one. Before the song has that many frames, a row counts as silence.
      const rows = [];
      for (let i = 0; i < span; i++) rows.push(last - i >= 0 ? ((last - i) % MAX_SPAN) * BINS : -1);
      for (let k = 0; k < BINS; k++) {
        for (let i = 0; i < span; i++) this.place(rows[i] < 0 ? 0 : mag[rows[i] + k], i);
        const ring = sort[span >> 1];
        const lo = Math.max(0, Math.min(BINS - ACROSS, k - (ACROSS >> 1)));
        for (let i = 0; i < ACROSS; i++) this.place(mag[mrow + lo + i], i);
        const hit = sort[ACROSS >> 1] * BIAS;
        const keep = ring * ring / (ring * ring + hit * hit + 1e-20);
        mask[k] = 1 - this.amount * (1 - keep);
      }
      for (let ch = 0; ch < 2; ch++) {
        const re = this.re[ch], im = this.im[ch], out = this.out[ch];
        for (let k = 0; k < BINS; k++) { wr[k] = re[mslot + k] * mask[k]; wi[k] = im[mslot + k] * mask[k]; }
        for (let k = 1; k < N / 2; k++) { wr[N - k] = wr[k]; wi[N - k] = -wi[k]; }
        this.fft(wr, wi, 1);
        // Four frames lie over each sample, and their windows add up to 1.5 there.
        for (let i = 0; i < N; i++) out[(this.at + i) % N] += wr[i] * win[i] / (N * 1.5);
      }
    }
    // Take a block of sound in and give a block out. The sides are Float32Arrays of the same length.
    run(inL, inR, outL, outR) {
      const n = outL.length, iL = this.inp[0], iR = this.inp[1], oL = this.out[0], oR = this.out[1];
      for (let i = 0; i < n; i++) {
        const at = this.at;
        outL[i] = oL[at]; outR[i] = oR[at]; oL[at] = 0; oR[at] = 0;
        iL[at] = inL ? inL[i] : 0; iR[at] = inR ? inR[i] : inL ? inL[i] : 0;
        this.at = (at + 1) % N;
        if (++this.filled === HOP) { this.filled = 0; this.frame(); }
      }
    }
  }

  if (typeof registerProcessor === 'function') {
    registerProcessor('gt-drum-cut', class extends AudioWorkletProcessor {
      constructor() {
        super();
        this.core = new DrumCut();
        // The page sends the speed of the song. After a jump in the song it asks for a clean start: the sound that
        // is still inside is from before.
        this.port.onmessage = e => {
          if (e.data && e.data.rate) { this.core.setRate(e.data.rate); return; }
          const half = this.core.half;
          this.core = new DrumCut();
          this.core.half = half;
        };
      }
      process(inputs, outputs) {
        const inp = inputs[0] || [], out = outputs[0];
        this.core.run(inp[0], inp[1], out[0], out[1] || new Float32Array(out[0].length));
        return true;
      }
    });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { DrumCut, DELAY, delayFor };
})(this);
