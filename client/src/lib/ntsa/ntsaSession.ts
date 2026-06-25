import type { ExtractionFormRow, ExtractionSessionRow } from "@shared/documentExtraction";
import { normalizeExtractionSessionRow } from "@shared/documentExtraction";
import type { NtsaSessionRow } from "@shared/ntsaExtraction";
import { isDuplicateForm } from "@/lib/ntsa/ntsaDuplicates";

function sessionKey(userId: string): string {
  return `ntsa_extraction_rows_${userId}`;
}

function normalizeSessionRow(raw: unknown, index: number): ExtractionSessionRow | null {
  return normalizeExtractionSessionRow(raw, index);
}

export function loadNtsaRows(userId: string): ExtractionSessionRow[] {
  try {
    const raw = sessionStorage.getItem(sessionKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => normalizeSessionRow(item, index))
      .filter((row): row is ExtractionSessionRow => row !== null);
  } catch {
    return [];
  }
}

export function saveNtsaRows(userId: string, rows: ExtractionSessionRow[]): void {
  try {
    sessionStorage.setItem(sessionKey(userId), JSON.stringify(rows));
  } catch {
    /* ignore quota errors */
  }
}

export type AppendNtsaResult =
  | { added: true; rows: ExtractionSessionRow[] }
  | { added: false; reason: "duplicate"; rows: ExtractionSessionRow[] };

export function appendNtsaRow(userId: string, row: ExtractionFormRow): AppendNtsaResult {
  const existing = loadNtsaRows(userId);
  if (isDuplicateForm(row, existing)) {
    return { added: false, reason: "duplicate", rows: existing };
  }

  const next: ExtractionSessionRow[] = [
    ...existing,
    {
      ...row,
      sourcePage: existing.length + 1,
    },
  ];
  saveNtsaRows(userId, next);
  return { added: true, rows: next };
}

export function clearNtsaRows(userId: string): void {
  try {
    sessionStorage.removeItem(sessionKey(userId));
  } catch {
    /* ignore */
  }
}
