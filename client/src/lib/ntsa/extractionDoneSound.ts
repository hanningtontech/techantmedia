const EXTRACTION_DONE_SOUND_URL = "/sounds/extraction-done.mp3";
const EXTRACTION_ERROR_SOUND_URL = "/sounds/extraction-error.mp3";

let doneAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;

function getDoneAudio(): HTMLAudioElement {
  if (!doneAudio) {
    doneAudio = new Audio(EXTRACTION_DONE_SOUND_URL);
    doneAudio.preload = "auto";
  }
  return doneAudio;
}

function getErrorAudio(): HTMLAudioElement {
  if (!errorAudio) {
    errorAudio = new Audio(EXTRACTION_ERROR_SOUND_URL);
    errorAudio.preload = "auto";
  }
  return errorAudio;
}

function playSound(audio: HTMLAudioElement): void {
  try {
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* Autoplay policy or missing file — ignore. */
    });
  } catch {
    /* ignore */
  }
}

/** Play the extraction-complete chime (best-effort; browsers may block autoplay). */
export function playExtractionDoneSound(): void {
  playSound(getDoneAudio());
}

/** Play when extraction fails, pauses for confirmation, or stops with errors. */
export function playExtractionErrorSound(): void {
  playSound(getErrorAudio());
}

export const UNSAVED_EXTRACTION_REMINDER_MS = 7 * 60 * 1000;
