const BOMB_SOUND_URL = "/sounds/bomb-explosion.mpeg";
const MUTE_KEY = "block-game-sound-muted";

let audioPool: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;

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
  try {
    getBombAudio().load();
  } catch {
    /* ignore */
  }
}

function getBombAudio(): HTMLAudioElement {
  if (!audioPool) {
    audioPool = new Audio(BOMB_SOUND_URL);
    audioPool.preload = "auto";
  }
  return audioPool;
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

/** Play the bomb explosion sound unless muted. Falls back to Web Audio if the file is missing. */
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
  } catch {
    /* ignore */
  }
}
