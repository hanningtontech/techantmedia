import { unlockGameAudio } from "@/lib/simulation/bombEffects";

const APPLAUSE_SRC = "/sounds/target-applause.mp3";

let audio: HTMLAudioElement | null = null;

function playSynthApplause(): void {
  unlockGameAudio();
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const t = now + i * 0.09;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
  window.setTimeout(() => void ctx.close().catch(() => {}), 800);
}

export function playTargetApplause(): void {
  unlockGameAudio();
  try {
    if (!audio) {
      audio = new Audio(APPLAUSE_SRC);
      audio.preload = "auto";
    }
    audio.currentTime = 0;
    void audio.play().catch(() => playSynthApplause());
  } catch {
    playSynthApplause();
  }
}

export function preloadTargetApplause(): void {
  try {
    if (!audio) audio = new Audio(APPLAUSE_SRC);
    audio.preload = "auto";
  } catch {
    /* ignore */
  }
}
