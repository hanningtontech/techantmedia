import type { ExtractionSessionMeta, ExtractionSessionRow } from "@shared/documentExtraction";
import {
  inferSessionMetaFromRows as inferMetaFromRows,
  resolveSessionMetaForRows,
} from "@shared/documentExtraction";

function metaKey(userId: string): string {
  return `extraction_session_meta_${userId}`;
}

export function loadSessionMeta(userId: string): ExtractionSessionMeta | null {
  try {
    const raw = sessionStorage.getItem(metaKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as ExtractionSessionMeta;
  } catch {
    return null;
  }
}

export function saveSessionMeta(userId: string, meta: ExtractionSessionMeta): void {
  try {
    sessionStorage.setItem(metaKey(userId), JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function clearSessionMeta(userId: string): void {
  try {
    sessionStorage.removeItem(metaKey(userId));
  } catch {
    /* ignore */
  }
}

export function inferSessionMetaFromRows(rows: ExtractionSessionRow[]): ExtractionSessionMeta | null {
  return inferMetaFromRows(rows);
}

export function resolveActiveSessionMeta(
  userId: string,
  rows: ExtractionSessionRow[],
): ExtractionSessionMeta | null {
  const stored = loadSessionMeta(userId);
  if (stored) return stored;
  return resolveSessionMetaForRows(rows, null, null);
}
