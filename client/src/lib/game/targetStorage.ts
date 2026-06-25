const TARGET_KEY = "block-game-player-target-v1";

export interface PlayerTargetRecord {
  uid: string;
  targetBalance: number;
  baselineBalance: number;
  setAt: string;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadPlayerTarget(uid: string): PlayerTargetRecord | null {
  const stored = safeParse<PlayerTargetRecord>(localStorage.getItem(TARGET_KEY));
  if (!stored || stored.uid !== uid) return null;
  return stored;
}

export function savePlayerTarget(record: PlayerTargetRecord): void {
  localStorage.setItem(TARGET_KEY, JSON.stringify(record));
}

export function clearPlayerTargetStorage(): void {
  localStorage.removeItem(TARGET_KEY);
}
