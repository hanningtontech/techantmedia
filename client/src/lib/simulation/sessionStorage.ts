import { nanoid } from "nanoid";
import type { SimulationSessionRecord } from "./types";

const STORAGE_KEY = "block-game-simulation-sessions";
const MAX_SAVED = 50;

export function loadSavedSessions(): SimulationSessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SimulationSessionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedSessions(sessions: SimulationSessionRecord[]): SimulationSessionRecord[] {
  const trimmed = sessions.slice(0, MAX_SAVED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function addSavedSession(record: SimulationSessionRecord): SimulationSessionRecord[] {
  const next = [record, ...loadSavedSessions()].slice(0, MAX_SAVED);
  return persistSavedSessions(next);
}

export function deleteSavedSession(id: string): SimulationSessionRecord[] {
  return persistSavedSessions(loadSavedSessions().filter((s) => s.id !== id));
}

export function sanitizeSessionFileName(name: string): string {
  return name
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60) || "simulation-session";
}

export function defaultSessionName(): string {
  const d = new Date();
  const stamp = d.toISOString().slice(0, 16).replace("T", " ");
  return `Session ${stamp}`;
}

export function createSessionId(): string {
  return nanoid(10);
}
