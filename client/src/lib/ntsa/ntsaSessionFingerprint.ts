import type { NtsaSessionRow } from "@shared/ntsaExtraction";

/** Stable fingerprint so we can tell if the live session still matches a saved history copy. */
export function fingerprintSessionRows(rows: NtsaSessionRow[]): string {
  const normalized = rows.map((row) => ({
    sourcePage: row.sourcePage,
    name: row.name.trim().toUpperCase(),
    idNumber: row.idNumber.trim(),
    testApplicationNumber: row.testApplicationNumber.trim(),
    amount: row.amount.trim(),
    date: row.date.trim(),
  }));
  return JSON.stringify(normalized);
}

export function isSessionAlreadySaved(
  rows: NtsaSessionRow[],
  savedFingerprint: string | null,
): boolean {
  if (!savedFingerprint || !rows.length) return false;
  return fingerprintSessionRows(rows) === savedFingerprint;
}
