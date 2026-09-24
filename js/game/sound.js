// Sound for Nebula Run, synthesised with the Web Audio API — no audio files.
//
// Effects are short envelopes on oscillators and filtered noise; the music is
// a tiny step sequencer (bass, arpeggio, hats) scheduled a little ahead of the
// clock so it keeps time even when frames stutter. Browsers only let audio
// start after a gesture, so `unlock()` is called from the first key or click.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note → Hz

export function createSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return silent();
  let ctx = null;
  let master, sfx, musicBus, noiseBuf;
  let muted = false;
  try {
    muted = localStorage.getItem("nebula-run-muted") === "1";
  } catch {
    /* storage may be unavailable */
  }

  function init() {
    if (ctx) return;
    ctx = new Ctx();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(comp);
    sfx = ctx.createGain();
    sfx.gain.value = 0.9;
    sfx.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.32;
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  const now = () => ctx.currentTime;

  // one oscillator with a pitch sweep and an attack/decay envelope
  function tone({ type = "square", from, to = from, dur = 0.12, vol = 0.2, at = now(), bus = sfx, attack = 0.004, filter = null }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type ?? "lowpass";
      f.frequency.value = filter.freq;
      f.Q.value = filter.q ?? 0.8;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(bus);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  // a burst of filtered noise
  function noise({ dur = 0.3, vol = 0.3, from = 3000, to = 200, type = "lowpass", at = now(), bus = sfx, q = 0.7 }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, to), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  /* --- effects --------------------------------------------------------- */
  let lastShot = 0;
  const fx = {
    shoot(kind) {
      if (!ctx) return;
      const t = now();
      if (t - lastShot < 0.05) return; // the laser fires faster than the ear needs
      lastShot = t;
      if (kind === "laser") tone({ type: "sine", from: 1900, to: 700, dur: 0.09, vol: 0.12 });
      else if (kind === "spread") {
        tone({ type: "triangle", from: 700, to: 180, dur: 0.14, vol: 0.18 });
        noise({ dur: 0.06, vol: 0.06, from: 5000, to: 1500, type: "highpass" });
      } else if (kind === "double") tone({ type: "square", from: 1100, to: 380, dur: 0.08, vol: 0.09, filter: { freq: 3000 } });
      else tone({ type: "square", from: 880, to: 240, dur: 0.1, vol: 0.1, filter: { freq: 2600 } });
    },
    hit() {
      if (!ctx) return;
      tone({ type: "triangle", from: 520, to: 300, dur: 0.05, vol: 0.07 });
    },
    explode(size = 1) {
      if (!ctx) return;
      const s = Math.min(3, size);
      noise({ dur: 0.35 + s * 0.25, vol: 0.25 + s * 0.12, from: 2400, to: 90 });
      tone({ type: "sine", from: 140, to: 38, dur: 0.3 + s * 0.2, vol: 0.3 + s * 0.1 });
    },
    bigExplosion() {
      if (!ctx) return;
      noise({ dur: 1.8, vol: 0.6, from: 3000, to: 60 });
      tone({ type: "sine", from: 90, to: 25, dur: 1.6, vol: 0.6 });
      tone({ type: "sawtooth", from: 200, to: 30, dur: 1.2, vol: 0.12, filter: { freq: 600 } });
    },
    hurt() {
      if (!ctx) return;
      tone({ type: "sawtooth", from: 320, to: 70, dur: 0.4, vol: 0.25, filter: { freq: 1400 } });
      noise({ dur: 0.35, vol: 0.3, from: 1800, to: 150 });
    },
    pickup() {
      if (!ctx) return;
      const t = now();
      [72, 76, 79, 84].forEach((n, i) => tone({ type: "triangle", from: NOTE(n), dur: 0.12, vol: 0.16, at: t + i * 0.06 }));
    },
    enemyShot() {
      if (!ctx) return;
      tone({ type: "sine", from: 420, to: 190, dur: 0.18, vol: 0.07 });
    },
    bossWarn() {
      if (!ctx) return;
      const t = now();
      for (let i = 0; i < 3; i++) {
        tone({ type: "sawtooth", from: 440, to: 880, dur: 0.35, vol: 0.12, at: t + i * 0.7, filter: { freq: 1800 } });
        tone({ type: "sawtooth", from: 880, to: 440, dur: 0.35, vol: 0.12, at: t + i * 0.7 + 0.35, filter: { freq: 1800 } });
      }
    },
    win() {
      if (!ctx) return;
      const t = now() + 0.1;
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone({ type: "triangle", from: NOTE(n), dur: 0.2, vol: 0.18, at: t + i * 0.09 }));
      // a held major chord to land on
      [72, 76, 79].forEach((n) => tone({ type: "sawtooth", from: NOTE(n), dur: 1.8, vol: 0.07, at: t + 0.7, attack: 0.05, filter: { freq: 2200 } }));
      tone({ type: "sine", from: NOTE(48), dur: 1.8, vol: 0.2, at: t + 0.7, attack: 0.05 });
    },
    lose() {
      if (!ctx) return;
      const t = now() + 0.4;
      [67, 63, 60, 55].forEach((n, i) => tone({ type: "sawtooth", from: NOTE(n), to: NOTE(n) * 0.97, dur: 0.45, vol: 0.12, at: t + i * 0.4, attack: 0.02, filter: { freq: 1200 } }));
      tone({ type: "sine", from: NOTE(36), dur: 1.8, vol: 0.2, at: t + 1.2, attack: 0.05 });
    },
  };

  /* --- music: a small sequencer ----------------------------------------- */
  const BPM = 112;
  const STEP = 60 / BPM / 4; // sixteenth notes
  // A minor – F – C – G, one bar each
  const CHORDS = [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
  ];
  let seqTimer = null;
  let step = 0;
  let nextTime = 0;
  let intense = false;
  function scheduleStep(i, t) {
    const bar = Math.floor(i / 16) % 4;
    const s = i % 16;
    const chord = CHORDS[bar];
    // bass on the eighths
    if (s % 2 === 0) tone({ type: "sawtooth", from: NOTE(chord[0] - 12), dur: STEP * 1.8, vol: s % 8 === 0 ? 0.22 : 0.14, at: t, bus: musicBus, attack: 0.01, filter: { freq: 500, q: 4 } });
    // arpeggio
    if (s % 2 === 1 || intense) {
      const n = chord[(s >> (intense ? 0 : 1)) % 3] + (s >= 8 ? 12 : 0);
      tone({ type: "square", from: NOTE(n + 12), dur: STEP * 0.9, vol: 0.035, at: t, bus: musicBus, filter: { freq: 2400 } });
    }
    // hats and a kick
    if (s % (intense ? 1 : 2) === 0) noise({ dur: 0.04, vol: s % 4 === 2 ? 0.06 : 0.03, from: 9000, to: 6000, type: "highpass", at: t, bus: musicBus });
    if (s % 4 === 0) tone({ type: "sine", from: 120, to: 45, dur: 0.18, vol: 0.28, at: t, bus: musicBus });
    if (intense && s % 8 === 4) noise({ dur: 0.15, vol: 0.12, from: 2500, to: 800, type: "bandpass", at: t, bus: musicBus, q: 1.2 });
  }
  function tick() {
    while (nextTime < ctx.currentTime + 0.12) {
      scheduleStep(step++, nextTime);
      nextTime += STEP;
    }
  }
  const music = {
    start() {
      if (!ctx || seqTimer) return;
      step = 0;
      nextTime = ctx.currentTime + 0.05;
      seqTimer = setInterval(tick, 25);
    },
    stop() {
      clearInterval(seqTimer);
      seqTimer = null;
    },
    intense(on) {
      intense = on;
    },
  };

  return {
    ...fx,
    music,
    /** Call from a user gesture: creates or resumes the audio context. */
    unlock() {
      init();
      if (ctx.state === "suspended") ctx.resume();
    },
    get muted() {
      return muted;
    },
    /** For tests: the audio context's state and a meter on the master bus. */
    get state() {
      return ctx?.state ?? "none";
    },
    level() {
      if (!ctx) return 0;
      if (!this._an) {
        this._an = ctx.createAnalyser();
        this._an.fftSize = 2048;
        master.connect(this._an);
        this._buf = new Float32Array(this._an.fftSize);
      }
      this._an.getFloatTimeDomainData(this._buf);
      let peak = 0;
      for (const v of this._buf) peak = Math.max(peak, Math.abs(v));
      return peak;
    },
    toggleMute() {
      muted = !muted;
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02);
      try {
        localStorage.setItem("nebula-run-muted", muted ? "1" : "0");
      } catch {
        /* ignore */
      }
      return muted;
    },
    suspend() {
      music.stop();
      ctx?.suspend();
    },
    resume() {
      ctx?.resume();
    },
    dispose() {
      music.stop();
      ctx?.close();
      ctx = null;
    },
  };
}

function silent() {
  const noop = () => {};
  return {
    shoot: noop, hit: noop, explode: noop, bigExplosion: noop, hurt: noop, pickup: noop, enemyShot: noop, bossWarn: noop, win: noop, lose: noop,
    music: { start: noop, stop: noop, intense: noop },
    unlock: noop, muted: true, toggleMute: () => true, suspend: noop, resume: noop, dispose: noop,
  };
}
