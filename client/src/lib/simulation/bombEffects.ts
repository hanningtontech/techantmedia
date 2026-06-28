const BOMB_SOUND_URL = "/sounds/bomb-explosion.mpeg";
const BOMB_REVEAL_SOUND_URL = "/sounds/bomb-reveal.mp3";
const MUTE_KEY = "block-game-sound-muted";

/** Stable, moderate level for per-cell reveal ticks (not the hit explosion). */
const BOMB_REVEAL_VOLUME = 0.26;
const REVEAL_AUDIO_POOL_SIZE = 6;

let explosionAudio: HTMLAudioElement | null = null;
let revealAudioSlots: HTMLAudioElement[] = [];
let revealSlotCursor = 0;
let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

/** Resume audio after a user gesture (mobile browsers require this). */
export function unlockGameAudio(): void {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    getBombAudio().load();
    ensureRevealAudioPool().forEach((a) => a.load());
  } catch {
    /* ignore */
  }
}

/** Original bomb-hit explosion — unchanged from before. */
function getBombAudio(): HTMLAudioElement {
  if (!explosionAudio) {
    explosionAudio = new Audio(BOMB_SOUND_URL);
    explosionAudio.preload = "auto";
    explosionAudio.volume = 0.85;
  }
  return explosionAudio;
}

function ensureRevealAudioPool(): HTMLAudioElement[] {
  if (revealAudioSlots.length === 0) {
    revealAudioSlots = Array.from({ length: REVEAL_AUDIO_POOL_SIZE }, () => {
      const audio = new Audio(BOMB_REVEAL_SOUND_URL);
      audio.preload = "auto";
      audio.volume = BOMB_REVEAL_VOLUME;
      return audio;
    });
  }
  return revealAudioSlots;
}

function takeRevealAudioSlot(): HTMLAudioElement {
  const pool = ensureRevealAudioPool();
  const audio = pool[revealSlotCursor % pool.length]!;
  revealSlotCursor += 1;
  return audio;
}

/**
 * Card-flip tick for one bomb cell during the reveal cascade only.
 * Short clip; does not cut off the original explosion sound.
 */
export function playBombRevealTickSound(paceMs = 28): void {
  if (isBombSoundMuted()) return;
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
  const clipMs = Math.max(48, Math.min(100, Math.round(paceMs * 2.2)));
  try {
    const audio = takeRevealAudioSlot();
    audio.volume = BOMB_REVEAL_VOLUME;
    audio.pause();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise) void playPromise.catch(() => {});
    window.setTimeout(() => {
      if (!audio.paused && audio.currentTime > 0) {
        audio.pause();
      }
    }, clipMs);
  } catch {
    /* ignore */
  }
}

export function stopBombRevealTickSound(): void {
  try {
    for (const audio of revealAudioSlots) {
      audio.pause();
      audio.currentTime = 0;
    }
  } catch {
    /* ignore */
  }
}

export function isBombSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBombSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function playSynthBombExplosion(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.55, now);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  master.connect(ctx.destination);

  const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(900, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(120, now + 0.3);
  noise.connect(noiseFilter);
  noiseFilter.connect(master);
  noise.start(now);
  noise.stop(now + 0.4);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.35, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  osc.connect(oscGain);
  oscGain.connect(master);
  osc.start(now);
  osc.stop(now + 0.5);
}

/** Short positive blip when a safe cell is revealed. */
export function playSafeRevealSound(): void {
  if (isBombSoundMuted()) return;
  unlockGameAudio();
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

/** Original bomb-hit explosion on the cell you tapped — not the cascade reveal. */
export function playBombExplosionSound(): void {
  if (isBombSoundMuted()) return;
  unlockGameAudio();
  try {
    const audio = getBombAudio();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise) {
      void playPromise.catch(() => playSynthBombExplosion());
    }
  } catch {
    playSynthBombExplosion();
  }
}

export function preloadBombSound(): void {
  unlockGameAudio();
  try {
    const audio = getBombAudio();
    audio.preload = "auto";
    audio.load();
    audio.addEventListener(
      "error",
      () => {
        /* file missing — synth fallback used on play */
      },
      { once: true },
    );
    ensureRevealAudioPool().forEach((reveal) => {
      reveal.preload = "auto";
      reveal.load();
    });
  } catch {
    /* ignore */
  }
}
