import type { ExtractionSessionMeta } from "@shared/documentExtraction";
import type { NtsaSessionRow } from "@shared/ntsaExtraction";

export type ExtractionRecordType = "saved" | "cleared";

export type ExtractionRecord = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  type: ExtractionRecordType;
  label: string;
  baseName: string;
  sequence: number;
  rows: NtsaSessionRow[];
  sessionMeta?: ExtractionSessionMeta;
  createdAt: string;
  clearedAt?: string;
  restoreRequested?: boolean;
  restoreRequestedAt?: string;
  restoredAt?: string;
};

export type ExtractionPendingMeta = {
  batchId: string;
  resumableCount: number;
  totalJobs: number;
  updatedAt: string;
};

export type ExtractionAutoDraft = {
  rows: NtsaSessionRow[];
  updatedAt: string;
  pendingExtraction?: ExtractionPendingMeta | null;
};

export type ExtractionUserState = {
  userId: string;
  restoredSession: {
    recordId: string;
    label: string;
    rows: NtsaSessionRow[];
    restoredAt: string;
  } | null;
  savedSessionFingerprint: string | null;
  savedHistoryLabel: string | null;
  autoDraft: ExtractionAutoDraft | null;
};

/** @deprecated Use ExtractionRecord — kept for UI compatibility */
export type ExtractionHistoryEntry = {
  id: string;
  label: string;
  baseName: string;
  sequence: number;
  savedAt: string;
  rows: NtsaSessionRow[];
  sessionMeta?: ExtractionSessionMeta | null;
};

export function recordToHistoryEntry(record: ExtractionRecord): ExtractionHistoryEntry {
  return {
    id: record.id,
    label: record.label,
    baseName: record.baseName,
    sequence: record.sequence,
    savedAt: record.createdAt,
    rows: record.rows,
    sessionMeta: record.sessionMeta ?? null,
  };
}
