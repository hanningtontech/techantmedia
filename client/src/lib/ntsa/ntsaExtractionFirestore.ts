import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import {
  normalizeExtractionSessionRow,
  normalizeSessionMetaFromStorage,
  type ExtractionSessionMeta,
  type ExtractionSessionRow,
} from "@shared/documentExtraction";
import type { NtsaSessionRow } from "@shared/ntsaExtraction";
import { tryGetFirestoreDb } from "@/lib/firebase";
import type {
  ExtractionAutoDraft,
  ExtractionPendingMeta,
  ExtractionRecord,
  ExtractionRecordType,
  ExtractionUserState,
} from "@/lib/ntsa/ntsaExtractionTypes";

const RECORDS = "ntsaExtractionRecords";
const USER_STATE = "ntsaExtractions";

function requireDb() {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firestore is not configured.");
  return db;
}

function slugifyBaseName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
  return cleaned || "extraction";
}

function toIsoString(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string" && value) return value;
  return new Date().toISOString();
}

function sortRecordsNewestFirst(records: ExtractionRecord[]): ExtractionRecord[] {
  return [...records].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function normalizeRow(raw: unknown, index: number): NtsaSessionRow | null {
  return normalizeExtractionSessionRow(raw, index);
}

/** Firestore rejects undefined — serialize extraction rows as plain strings only. */
export function serializeExtractionRowForFirestore(
  row: ExtractionSessionRow,
  index: number,
): Record<string, string | number> {
  const out: Record<string, string | number> = {
    sourcePage: index + 1,
    name: String(row.name ?? ""),
    idNumber: String(row.idNumber ?? ""),
    testApplicationNumber: String(row.testApplicationNumber ?? ""),
    amount: String(row.amount ?? ""),
    date: String(row.date ?? ""),
  };
  if (row.applicationNo != null && row.applicationNo !== "") {
    out.applicationNo = String(row.applicationNo);
  }
  if (row.billReferenceNo != null && row.billReferenceNo !== "") {
    out.billReferenceNo = String(row.billReferenceNo);
  }
  if (row.totalKes != null && row.totalKes !== "") {
    out.totalKes = String(row.totalKes);
  }
  if (row.idlNo != null && row.idlNo !== "") {
    out.idlNo = String(row.idlNo);
  }
  if (
    row.documentType === "ntsa_receipt" ||
    row.documentType === "ntsa_test_form" ||
    row.documentType === "ntsa_interim_license"
  ) {
    out.documentType = row.documentType;
  }
  return out;
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) return value;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (nested !== undefined) out[key] = stripUndefinedDeep(nested);
  }
  return out as T;
}

function mapRecord(id: string, data: Record<string, unknown>): ExtractionRecord {
  const rowsRaw = data.rows;
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw.map((item, i) => normalizeRow(item, i)).filter((r): r is NtsaSessionRow => r !== null)
    : [];

  const sessionMeta = normalizeSessionMetaFromStorage(data.sessionMeta) ?? undefined;

  return {
    id,
    userId: String(data.userId ?? ""),
    userEmail: typeof data.userEmail === "string" ? data.userEmail : null,
    userName: typeof data.userName === "string" ? data.userName : null,
    type: data.type === "cleared" ? "cleared" : "saved",
    label: String(data.label ?? ""),
    baseName: String(data.baseName ?? "extraction"),
    sequence: typeof data.sequence === "number" ? data.sequence : 1,
    rows,
    sessionMeta,
    createdAt: toIsoString(data.createdAt),
    clearedAt: typeof data.clearedAt === "string" ? data.clearedAt : undefined,
    restoreRequested: data.restoreRequested === true,
    restoreRequestedAt: typeof data.restoreRequestedAt === "string" ? data.restoreRequestedAt : undefined,
    restoredAt: typeof data.restoredAt === "string" ? data.restoredAt : undefined,
  };
}

function userStateRef(userId: string) {
  return doc(requireDb(), USER_STATE, userId);
}

function recordsCol() {
  return collection(requireDb(), RECORDS);
}

export async function listUserSavedRecords(userId: string): Promise<ExtractionRecord[]> {
  const q = query(
    recordsCol(),
    where("userId", "==", userId),
    where("type", "==", "saved"),
  );
  const snaps = await getDocs(q);
  const records = snaps.docs.map((s) => mapRecord(s.id, s.data() as Record<string, unknown>));
  return sortRecordsNewestFirst(records);
}

export async function listUserClearedRecords(userId: string): Promise<ExtractionRecord[]> {
  const q = query(
    recordsCol(),
    where("userId", "==", userId),
    where("type", "==", "cleared"),
  );
  const snaps = await getDocs(q);
  const records = snaps.docs.map((s) => mapRecord(s.id, s.data() as Record<string, unknown>));
  return sortRecordsNewestFirst(records);
}

export async function listAllExtractionRecords(): Promise<ExtractionRecord[]> {
  const snaps = await getDocs(recordsCol());
  const records = snaps.docs.map((s) => mapRecord(s.id, s.data() as Record<string, unknown>));
  return sortRecordsNewestFirst(records);
}

async function nextSequence(userId: string, baseName: string): Promise<number> {
  const q = query(
    recordsCol(),
    where("userId", "==", userId),
    where("baseName", "==", baseName),
  );
  const snaps = await getDocs(q);
  let max = 0;
  for (const s of snaps.docs) {
    const seq = (s.data().sequence as number | undefined) ?? 0;
    if (seq > max) max = seq;
  }
  return max + 1;
}

export async function createExtractionRecord(input: {
  userId: string;
  userEmail: string | null;
  userName: string | null;
  type: ExtractionRecordType;
  rows: ExtractionSessionRow[] | NtsaSessionRow[];
  baseNameInput?: string;
  labelOverride?: string;
  sessionMeta?: ExtractionSessionMeta;
}): Promise<ExtractionRecord> {
  const baseName = slugifyBaseName(
    input.baseNameInput ?? (input.type === "cleared" ? "cleared" : "extraction"),
  );
  const sequence = await nextSequence(input.userId, baseName);
  const label = input.labelOverride ?? `${baseName}/${sequence}`;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const rows = input.rows.map((row, index) =>
    serializeExtractionRowForFirestore(row as ExtractionSessionRow, index),
  ) as NtsaSessionRow[];

  const record: ExtractionRecord = {
    id,
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    type: input.type,
    label,
    baseName,
    sequence,
    rows,
    createdAt: now,
    ...(input.sessionMeta ? { sessionMeta: input.sessionMeta } : {}),
    ...(input.type === "cleared" ? { clearedAt: now } : {}),
  };

  await setDoc(
    doc(requireDb(), RECORDS, id),
    stripUndefinedDeep({
      ...record,
      updatedAt: serverTimestamp(),
    }),
  );

  return record;
}

export async function deleteExtractionRecord(recordId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), RECORDS, recordId));
}

export async function repairExtractionRecordSessionMeta(
  recordId: string,
  sessionMeta: ExtractionSessionMeta,
): Promise<void> {
  await repairExtractionRecord(recordId, { sessionMeta });
}

export async function repairExtractionRecord(
  recordId: string,
  patch: {
    sessionMeta?: ExtractionSessionMeta;
    rows?: NtsaSessionRow[];
  },
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.sessionMeta) update.sessionMeta = patch.sessionMeta;
  if (patch.rows) {
    update.rows = patch.rows.map((row, index) =>
      serializeExtractionRowForFirestore(row as ExtractionSessionRow, index),
    );
  }
  if (Object.keys(update).length <= 1) return;
  await updateDoc(doc(requireDb(), RECORDS, recordId), update);
}

export async function requestSessionRestore(recordId: string): Promise<void> {
  await updateDoc(doc(requireDb(), RECORDS, recordId), {
    restoreRequested: true,
    restoreRequestedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export async function adminRestoreSession(record: ExtractionRecord): Promise<void> {
  const now = new Date().toISOString();
  await setDoc(
    userStateRef(record.userId),
    {
      restoredSession: {
        recordId: record.id,
        label: record.label,
        rows: record.rows.map((row, index) => ({ ...row, sourcePage: index + 1 })),
        restoredAt: now,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await updateDoc(doc(requireDb(), RECORDS, record.id), {
    restoredAt: now,
    restoreRequested: false,
    updatedAt: serverTimestamp(),
  });
}

function mapPendingMeta(raw: unknown): ExtractionPendingMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.batchId !== "string") return null;
  return {
    batchId: d.batchId,
    resumableCount: typeof d.resumableCount === "number" ? d.resumableCount : 0,
    totalJobs: typeof d.totalJobs === "number" ? d.totalJobs : 0,
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : new Date().toISOString(),
  };
}

function mapAutoDraft(raw: unknown): ExtractionAutoDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const rowsRaw = d.rows;
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw.map((item, i) => normalizeRow(item, i)).filter((r): r is NtsaSessionRow => r !== null)
    : [];
  const pendingExtraction = mapPendingMeta(d.pendingExtraction);
  if (!rows.length && !pendingExtraction?.resumableCount) return null;
  return {
    rows,
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : new Date().toISOString(),
    pendingExtraction,
  };
}

function mapUserStateDoc(userId: string, d: Record<string, unknown>): ExtractionUserState {
  const restoredRaw = d.restoredSession;
  let restoredSession: ExtractionUserState["restoredSession"] = null;
  if (restoredRaw && typeof restoredRaw === "object") {
    const rs = restoredRaw as Record<string, unknown>;
    const rowsRaw = rs.rows;
    const rows = Array.isArray(rowsRaw)
      ? rowsRaw.map((item, i) => normalizeRow(item, i)).filter((r): r is NtsaSessionRow => r !== null)
      : [];
    if (rows.length) {
      restoredSession = {
        recordId: String(rs.recordId ?? ""),
        label: String(rs.label ?? ""),
        rows,
        restoredAt: String(rs.restoredAt ?? ""),
      };
    }
  }

  return {
    userId,
    restoredSession,
    savedSessionFingerprint:
      typeof d.savedSessionFingerprint === "string" ? d.savedSessionFingerprint : null,
    savedHistoryLabel: typeof d.savedHistoryLabel === "string" ? d.savedHistoryLabel : null,
    autoDraft: mapAutoDraft(d.autoDraft),
  };
}

export async function clearRestoredSessionFlag(userId: string): Promise<void> {
  await setDoc(
    userStateRef(userId),
    { restoredSession: null, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function saveAutoDraft(
  userId: string,
  rows: ExtractionSessionRow[] | NtsaSessionRow[],
  pendingExtraction?: ExtractionPendingMeta | null,
): Promise<void> {
  if (!rows.length && !pendingExtraction?.resumableCount) {
    await clearAutoDraft(userId);
    return;
  }
  await setDoc(
    userStateRef(userId),
    stripUndefinedDeep({
      autoDraft: {
        rows: rows.map((row, index) =>
          serializeExtractionRowForFirestore(row as ExtractionSessionRow, index),
        ),
        updatedAt: new Date().toISOString(),
        pendingExtraction: pendingExtraction ?? null,
      },
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
}

export async function clearAutoDraft(userId: string): Promise<void> {
  await setDoc(
    userStateRef(userId),
    { autoDraft: null, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function markSessionSavedToHistory(
  userId: string,
  fingerprint: string,
  historyLabel: string,
): Promise<void> {
  await setDoc(
    userStateRef(userId),
    {
      savedSessionFingerprint: fingerprint,
      savedHistoryLabel: historyLabel,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearSessionWorkspaceMarkers(userId: string): Promise<void> {
  await setDoc(
    userStateRef(userId),
    {
      savedSessionFingerprint: null,
      savedHistoryLabel: null,
      autoDraft: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeExtractionUserState(
  userId: string,
  onState: (state: ExtractionUserState | null) => void,
): Unsubscribe | undefined {
  const db = tryGetFirestoreDb();
  if (!db) return undefined;

  return onSnapshot(userStateRef(userId), (snap) => {
    if (!snap.exists()) {
      onState({
        userId,
        restoredSession: null,
        savedSessionFingerprint: null,
        savedHistoryLabel: null,
        autoDraft: null,
      });
      return;
    }
    onState(mapUserStateDoc(userId, snap.data() as Record<string, unknown>));
  });
}

export async function getExtractionUserState(userId: string): Promise<ExtractionUserState> {
  const snap = await getDoc(userStateRef(userId));
  if (!snap.exists()) {
    return {
      userId,
      restoredSession: null,
      savedSessionFingerprint: null,
      savedHistoryLabel: null,
      autoDraft: null,
    };
  }
  return mapUserStateDoc(userId, snap.data() as Record<string, unknown>);
}
