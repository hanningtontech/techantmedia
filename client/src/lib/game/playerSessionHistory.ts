import type { SessionOutcome } from "@/lib/simulation/types";

export const PLAYER_SESSION_HISTORY_KEY = "block-game-session-history-v1";
export const PLAYER_SESSION_HISTORY_PATH = "/game/history";
export const PLAYER_SESSION_ANALYSIS_PATH = "/game/history/analysis";
export const DESKTOP_PREVIEW_ROWS = 10;

export interface PlayerSessionRecord {
  id: string;
  gameIndex: number;
  outcome: SessionOutcome;
  stake: number;
  payout: number;
  netProfit: number;
  endingBalance: number;
  round: number;
  multiplier: number;
  gridLabel: string;
  playedAt: string;
  /** Bombs on the board for this round */
  bombCount?: number;
  totalCells?: number;
  /** House edge active when the round was played */
  houseEdge?: number;
  /** Bomb cell indices — used for placement randomness analysis */
  bombIndices?: number[];
}

const MAX_RECORDS = 250;

function storageKey(uid: string) {
  return `${PLAYER_SESSION_HISTORY_KEY}:${uid}`;
}

export function loadPlayerSessionHistory(uid: string): PlayerSessionRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlayerSessionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlayerSessionHistory(uid: string, records: PlayerSessionRecord[]): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(records.slice(-MAX_RECORDS)));
  } catch {
    /* quota */
  }
}

export function appendPlayerSessionRecord(
  uid: string,
  record: PlayerSessionRecord,
  existing?: PlayerSessionRecord[],
): PlayerSessionRecord[] {
  const prev = existing ?? loadPlayerSessionHistory(uid);
  const next = [...prev, record].slice(-MAX_RECORDS);
  savePlayerSessionHistory(uid, next);
  return next;
}

export function outcomeLabel(outcome: SessionOutcome): string {
  switch (outcome) {
    case "won":
      return "Won";
    case "lost":
      return "Lost";
    case "cashed_out":
      return "Withdrawn";
    case "stopped":
      return "Stopped";
    default:
      return outcome;
  }
}
