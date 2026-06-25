import type { ExtractionSessionMeta, ExtractionSessionRow } from "@shared/documentExtraction";
import {
  defaultSessionMeta,
  historySaveBaseName,
  inferDocumentTypeFromRows,
  normalizeInterimSessionMeta,
  resolveSessionMetaForRows,
} from "@shared/documentExtraction";
import {
  validateAndCombineHistoryRows,
  type HistoryCombineResult,
} from "@shared/extractionFormat";
import type { NtsaSessionRow } from "@shared/ntsaExtraction";
import {
  createExtractionRecord,
  deleteExtractionRecord,
  listUserSavedRecords,
  repairExtractionRecord,
} from "@/lib/ntsa/ntsaExtractionFirestore";
import {
  loadExtractionPreferences,
  type ExtractionPreferences,
} from "@/lib/ntsa/extractionPreferences";
import {
  recordToHistoryEntry,
  type ExtractionHistoryEntry,
} from "@/lib/ntsa/ntsaExtractionTypes";

export type { ExtractionHistoryEntry };
export type { HistoryCombineResult };

export function enrichHistoryEntry(
  entry: ExtractionHistoryEntry,
  prefs?: ExtractionPreferences,
): ExtractionHistoryEntry {
  const documentType = inferDocumentTypeFromRows(entry.rows as ExtractionSessionRow[]);
  const savedFields = prefs?.[documentType]?.enabledFields ?? null;
  const sessionMeta = resolveSessionMetaForRows(
    entry.rows as ExtractionSessionRow[],
    entry.sessionMeta,
    savedFields,
  );
  return sessionMeta ? { ...entry, sessionMeta } : entry;
}

export function resolveHistoryEntryMeta(
  entry: ExtractionHistoryEntry,
  prefs?: ExtractionPreferences,
): ExtractionSessionMeta {
  const enriched = enrichHistoryEntry(entry, prefs);
  if (enriched.sessionMeta) return enriched.sessionMeta;
  const rows = entry.rows as ExtractionSessionRow[];
  return (
    resolveSessionMetaForRows(rows, null, null) ??
    defaultSessionMeta(inferDocumentTypeFromRows(rows))
  );
}

function interimMetaNeedsRepair(
  recordMeta: ExtractionSessionMeta | undefined,
  enrichedMeta: ExtractionSessionMeta | null | undefined,
): boolean {
  if (enrichedMeta?.documentType !== "ntsa_interim_license") return false;
  if (!recordMeta) return Boolean(enrichedMeta);
  return (
    recordMeta.enabledFields.includes("amount") ||
    JSON.stringify(normalizeInterimSessionMeta(recordMeta).enabledFields) !==
      JSON.stringify(enrichedMeta.enabledFields)
  );
}

export async function loadExtractionHistory(userId: string): Promise<ExtractionHistoryEntry[]> {
  const prefs = loadExtractionPreferences(userId);
  const records = await listUserSavedRecords(userId);
  const entries = records.map((record) => enrichHistoryEntry(recordToHistoryEntry(record), prefs));

  for (const record of records) {
    const enriched = enrichHistoryEntry(recordToHistoryEntry(record), prefs);
    if (interimMetaNeedsRepair(record.sessionMeta, enriched.sessionMeta)) {
      void repairExtractionRecord(record.id, {
        sessionMeta: enriched.sessionMeta ?? undefined,
      }).catch(() => {
        /* best-effort repair for legacy saves */
      });
    }
  }

  return entries;
}

export async function saveSessionToHistory(
  userId: string,
  rows: NtsaSessionRow[],
  baseNameInput = "extraction",
  profile?: { email: string | null; name: string | null },
  sessionMeta?: ExtractionSessionMeta,
): Promise<ExtractionHistoryEntry> {
  const meta =
    sessionMeta ??
    resolveSessionMetaForRows(rows as ExtractionSessionRow[], null, null) ??
    undefined;
  const folderBaseName = meta ? historySaveBaseName(meta.documentType, baseNameInput) : baseNameInput;

  const record = await createExtractionRecord({
    userId,
    userEmail: profile?.email ?? null,
    userName: profile?.name ?? null,
    type: "saved",
    rows,
    baseNameInput: folderBaseName,
    sessionMeta: meta ? normalizeInterimSessionMeta(meta) : undefined,
  });
  return enrichHistoryEntry(recordToHistoryEntry(record), loadExtractionPreferences(userId));
}

export async function removeHistoryEntry(recordId: string): Promise<void> {
  await deleteExtractionRecord(recordId);
}

export function combineHistoryRows(entries: ExtractionHistoryEntry[]): HistoryCombineResult {
  return validateAndCombineHistoryRows(
    entries.map((entry) => ({
      label: entry.label,
      rows: entry.rows as ExtractionSessionRow[],
      sessionMeta: resolveHistoryEntryMeta(entry),
    })),
  );
}
