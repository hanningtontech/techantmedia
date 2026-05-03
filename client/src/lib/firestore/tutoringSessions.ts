import {
  addDoc,
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
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { tryGetFirestoreDb } from "@/lib/firebase";
import { parseNclexExamType, questionMatchesStudentTrack } from "@/lib/nclex/examTypeFilters";
import { assignQuizTemplateToStudent } from "@/lib/firestore/nclex";
import type { NclexExamType } from "@/lib/firestore/nclexTypes";
import type { NursingTrack } from "@/lib/userTypes";

const COL = "tutoringSessions";
const PART = "participants";
const UNLOCK = "unlockRequests";

export type TutoringSession = {
  id: string;
  title: string;
  description: string;
  examType: NclexExamType | null;
  nclexCategory: string;
  nclexTopic: string;
  nclexSubtopic: string;
  isGeneral: boolean;
  templateIds: string[];
  presentationIds: string[];
  /** Linked class note ids (`classNotes`). */
  classNoteIds: string[];
  /** Linked study guide ids (`classStudyGuides`). */
  studyGuideIds: string[];
  assignedStudentIds: string[];
  published: boolean;
  /** Planned session start (calendar). */
  scheduledAt: Timestamp | null;
  /** Countdown length once the live timer is started. */
  durationMinutes: number;
  /** When the visible countdown was started (server time). */
  timerStartedAt: Timestamp | null;
  /** When true, tutors cannot edit; admins still can. */
  locked: boolean;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type TutoringParticipant = {
  studentId: string;
  extraTemplateIds: string[];
  excludedTemplateIds: string[];
  adminNotes: string;
  updatedAt: Timestamp | null;
};

function requireDb() {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firestore is not configured");
  return db;
}

function snapToParticipant(studentId: string, data: DocumentData): TutoringParticipant {
  const ex = Array.isArray(data.extraTemplateIds) ? data.extraTemplateIds.map(String).filter(Boolean) : [];
  const excl = Array.isArray(data.excludedTemplateIds) ? data.excludedTemplateIds.map(String).filter(Boolean) : [];
  return {
    studentId,
    extraTemplateIds: ex,
    excludedTemplateIds: excl,
    adminNotes: String(data.adminNotes ?? ""),
    updatedAt: data.updatedAt ?? null,
  };
}

function snapToSession(id: string, data: DocumentData): TutoringSession {
  const ex = parseNclexExamType(data.examType);
  const tids = Array.isArray(data.templateIds) ? data.templateIds.map(String).filter(Boolean) : [];
  const pids = Array.isArray(data.presentationIds) ? data.presentationIds.map(String).filter(Boolean) : [];
  const cn = Array.isArray(data.classNoteIds) ? data.classNoteIds.map(String).filter(Boolean) : [];
  const sg = Array.isArray(data.studyGuideIds) ? data.studyGuideIds.map(String).filter(Boolean) : [];
  const sids = Array.isArray(data.assignedStudentIds) ? data.assignedStudentIds.map(String).filter(Boolean) : [];
  const dm = typeof data.durationMinutes === "number" && Number.isFinite(data.durationMinutes) ? data.durationMinutes : 120;
  return {
    id,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    examType: ex,
    nclexCategory: typeof data.nclexCategory === "string" ? data.nclexCategory.trim() : "",
    nclexTopic: typeof data.nclexTopic === "string" ? data.nclexTopic.trim() : "",
    nclexSubtopic: typeof data.nclexSubtopic === "string" ? data.nclexSubtopic.trim() : "",
    isGeneral: data.isGeneral === true,
    templateIds: tids,
    presentationIds: pids,
    classNoteIds: cn,
    studyGuideIds: sg,
    assignedStudentIds: sids,
    published: Boolean(data.published),
    scheduledAt: data.scheduledAt ?? null,
    durationMinutes: dm > 0 && dm <= 24 * 60 ? dm : 120,
    timerStartedAt: data.timerStartedAt ?? null,
    locked: data.locked === true,
    createdBy: String(data.createdBy ?? ""),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/** Quiz template ids assigned to this student for this session (session defaults + participant extras − exclusions). */
export function mergeSessionTemplatesForStudent(
  session: TutoringSession,
  participant: TutoringParticipant | null,
): string[] {
  const base = session.templateIds;
  const excl = new Set(participant?.excludedTemplateIds ?? []);
  const extras = participant?.extraTemplateIds ?? [];
  return Array.from(new Set([...base, ...extras])).filter((id) => !excl.has(id));
}

export function getTutoringSessionCountdownEndMs(session: TutoringSession): number | null {
  const start = session.timerStartedAt?.toMillis?.() ?? null;
  if (start == null) return null;
  return start + session.durationMinutes * 60_000;
}

export async function listTutoringSessionsForStudent(
  studentId: string,
  studentTrack: NursingTrack | null,
): Promise<TutoringSession[]> {
  const db = requireDb();
  const qy = query(collection(db, COL), where("published", "==", true), where("assignedStudentIds", "array-contains", studentId));
  const snaps = await getDocs(qy);
  const rows = snaps.docs.map((d) => snapToSession(d.id, d.data()));
  if (!studentTrack) return [];
  return rows.filter((s) => questionMatchesStudentTrack(s.examType, studentTrack));
}

export async function listTutoringSessionsForAdmin(opts?: { adminExamType?: NursingTrack | null }): Promise<TutoringSession[]> {
  const db = requireDb();
  const snaps = await getDocs(collection(db, COL));
  let rows = snaps.docs.map((d) => snapToSession(d.id, d.data()));
  const t = opts?.adminExamType;
  if (t) {
    rows = rows.filter((s) => {
      if (s.examType == null || s.examType === "both") return true;
      return s.examType === t;
    });
  }
  rows.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
  return rows;
}

export type TutoringSessionInput = {
  title: string;
  description?: string;
  examType: NclexExamType | null;
  nclexCategory?: string;
  nclexTopic?: string;
  nclexSubtopic?: string;
  isGeneral?: boolean;
  templateIds: string[];
  presentationIds?: string[];
  classNoteIds?: string[];
  studyGuideIds?: string[];
  assignedStudentIds: string[];
  published?: boolean;
  scheduledAt?: Timestamp | null;
  durationMinutes?: number;
};

export async function createTutoringSession(data: TutoringSessionInput, tutorUid: string): Promise<string> {
  const db = requireDb();
  const dm =
    typeof data.durationMinutes === "number" && Number.isFinite(data.durationMinutes) && data.durationMinutes > 0
      ? Math.min(data.durationMinutes, 24 * 60)
      : 120;
  const ref = await addDoc(collection(db, COL), {
    title: data.title.trim(),
    description: (data.description ?? "").trim(),
    examType: data.examType ?? null,
    nclexCategory: data.nclexCategory?.trim() || null,
    nclexTopic: data.nclexTopic?.trim() || null,
    nclexSubtopic: data.nclexSubtopic?.trim() || null,
    isGeneral: data.isGeneral === true,
    templateIds: data.templateIds.map(String).filter(Boolean),
    presentationIds: (data.presentationIds ?? []).map(String).filter(Boolean),
    classNoteIds: (data.classNoteIds ?? []).map(String).filter(Boolean),
    studyGuideIds: (data.studyGuideIds ?? []).map(String).filter(Boolean),
    assignedStudentIds: data.assignedStudentIds.map(String).filter(Boolean),
    published: Boolean(data.published),
    scheduledAt: data.scheduledAt ?? null,
    durationMinutes: dm,
    timerStartedAt: null,
    locked: false,
    createdBy: tutorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTutoringSession(sessionId: string, data: Partial<TutoringSessionInput>): Promise<void> {
  const db = requireDb();
  const payload: DocumentData = { updatedAt: serverTimestamp() };
  if (data.title != null) payload.title = data.title.trim();
  if (data.description != null) payload.description = data.description.trim();
  if (data.examType !== undefined) payload.examType = data.examType;
  if (data.nclexCategory !== undefined) payload.nclexCategory = data.nclexCategory?.trim() || null;
  if (data.nclexTopic !== undefined) payload.nclexTopic = data.nclexTopic?.trim() || null;
  if (data.nclexSubtopic !== undefined) payload.nclexSubtopic = data.nclexSubtopic?.trim() || null;
  if (data.isGeneral !== undefined) payload.isGeneral = Boolean(data.isGeneral);
  if (data.templateIds != null) payload.templateIds = data.templateIds.map(String).filter(Boolean);
  if (data.presentationIds != null) payload.presentationIds = data.presentationIds.map(String).filter(Boolean);
  if (data.classNoteIds != null) payload.classNoteIds = data.classNoteIds.map(String).filter(Boolean);
  if (data.studyGuideIds != null) payload.studyGuideIds = data.studyGuideIds.map(String).filter(Boolean);
  if (data.assignedStudentIds != null) payload.assignedStudentIds = data.assignedStudentIds.map(String).filter(Boolean);
  if (data.published != null) payload.published = Boolean(data.published);
  if (data.scheduledAt !== undefined) payload.scheduledAt = data.scheduledAt;
  if (data.durationMinutes !== undefined) {
    const dm =
      typeof data.durationMinutes === "number" && Number.isFinite(data.durationMinutes) && data.durationMinutes > 0
        ? Math.min(data.durationMinutes, 24 * 60)
        : 120;
    payload.durationMinutes = dm;
  }
  await updateDoc(doc(db, COL, sessionId), payload);
}

export async function setTutoringSessionLocked(sessionId: string, locked: boolean): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, COL, sessionId), { locked: Boolean(locked), updatedAt: serverTimestamp() });
}

export async function startTutoringSessionTimer(sessionId: string): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, COL, sessionId), { timerStartedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function clearTutoringSessionTimer(sessionId: string): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, COL, sessionId), { timerStartedAt: null, updatedAt: serverTimestamp() });
}

export async function deleteTutoringSession(sessionId: string): Promise<void> {
  const db = requireDb();
  const sub = await getDocs(collection(db, COL, sessionId, PART));
  for (const d of sub.docs) {
    await deleteDoc(d.ref);
  }
  await deleteDoc(doc(db, COL, sessionId));
}

/** Set published and push quiz template assignments to each student (merged per participant row). */
export async function publishAndAssignTutoringSession(sessionId: string, assignedBy: string): Promise<void> {
  const db = requireDb();
  const snap = await getDoc(doc(db, COL, sessionId));
  if (!snap.exists()) throw new Error("Session not found");
  const s = snapToSession(snap.id, snap.data());
  await updateDoc(doc(db, COL, sessionId), { published: true, updatedAt: serverTimestamp() });
  for (const sid of s.assignedStudentIds) {
    const pSnap = await getDoc(doc(db, COL, sessionId, PART, sid));
    const p = pSnap.exists() ? snapToParticipant(sid, pSnap.data()) : null;
    const tids = mergeSessionTemplatesForStudent(s, p);
    for (const tid of tids) {
      await assignQuizTemplateToStudent(sid, tid, assignedBy);
    }
  }
}

export async function getTutoringSession(sessionId: string): Promise<TutoringSession | null> {
  const db = requireDb();
  const snap = await getDoc(doc(db, COL, sessionId));
  if (!snap.exists()) return null;
  return snapToSession(snap.id, snap.data());
}

export function subscribeTutoringSession(sessionId: string, onNext: (session: TutoringSession | null) => void): Unsubscribe {
  const db = requireDb();
  return onSnapshot(doc(db, COL, sessionId), (snap) => {
    if (!snap.exists()) onNext(null);
    else onNext(snapToSession(snap.id, snap.data()));
  });
}

export async function listTutoringParticipants(sessionId: string): Promise<TutoringParticipant[]> {
  const db = requireDb();
  const snaps = await getDocs(collection(db, COL, sessionId, PART));
  return snaps.docs.map((d) => snapToParticipant(d.id, d.data()));
}

export async function getTutoringParticipant(sessionId: string, studentId: string): Promise<TutoringParticipant | null> {
  const db = requireDb();
  const snap = await getDoc(doc(db, COL, sessionId, PART, studentId));
  if (!snap.exists()) return null;
  return snapToParticipant(studentId, snap.data());
}

export async function upsertTutoringParticipant(
  sessionId: string,
  studentId: string,
  patch: Partial<Pick<TutoringParticipant, "extraTemplateIds" | "excludedTemplateIds" | "adminNotes">>,
): Promise<void> {
  const db = requireDb();
  const ref = doc(db, COL, sessionId, PART, studentId);
  const payload: DocumentData = { updatedAt: serverTimestamp() };
  if (patch.extraTemplateIds != null) payload.extraTemplateIds = patch.extraTemplateIds.map(String).filter(Boolean);
  if (patch.excludedTemplateIds != null) payload.excludedTemplateIds = patch.excludedTemplateIds.map(String).filter(Boolean);
  if (patch.adminNotes != null) payload.adminNotes = String(patch.adminNotes);
  await setDoc(ref, payload, { merge: true });
}

/** Create empty participant rows for roster UIDs that do not yet have a row. */
export async function syncTutoringParticipantDocs(sessionId: string): Promise<void> {
  const db = requireDb();
  const s = await getTutoringSession(sessionId);
  if (!s) return;
  const snaps = await getDocs(collection(db, COL, sessionId, PART));
  const have = new Set(snaps.docs.map((d) => d.id));
  for (const sid of s.assignedStudentIds) {
    if (have.has(sid)) continue;
    await setDoc(doc(db, COL, sessionId, PART, sid), {
      extraTemplateIds: [],
      excludedTemplateIds: [],
      adminNotes: "",
      updatedAt: serverTimestamp(),
    });
  }
}

/** One row per student (doc id = studentId) when they ask an admin to unlock a locked session. */
export type TutoringUnlockRequestRow = {
  id: string;
  studentId: string;
  status: "pending" | "resolved";
  message: string;
  createdAt: Timestamp | null;
};

function snapUnlockRow(studentId: string, data: DocumentData): TutoringUnlockRequestRow {
  const st = data.status === "resolved" ? "resolved" : "pending";
  return {
    id: studentId,
    studentId: String(data.studentId ?? studentId),
    status: st,
    message: typeof data.message === "string" ? data.message : "",
    createdAt: data.createdAt ?? null,
  };
}

export async function requestTutoringSessionUnlock(
  sessionId: string,
  studentId: string,
  message?: string,
): Promise<void> {
  const db = requireDb();
  await setDoc(doc(db, COL, sessionId, UNLOCK, studentId), {
    studentId,
    status: "pending",
    message: (message ?? "").trim().slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

export async function getTutoringSessionUnlockRequest(
  sessionId: string,
  studentId: string,
): Promise<TutoringUnlockRequestRow | null> {
  const db = requireDb();
  const snap = await getDoc(doc(db, COL, sessionId, UNLOCK, studentId));
  if (!snap.exists()) return null;
  return snapUnlockRow(studentId, snap.data());
}

export async function listTutoringSessionUnlockRequests(sessionId: string): Promise<TutoringUnlockRequestRow[]> {
  const db = requireDb();
  const snaps = await getDocs(collection(db, COL, sessionId, UNLOCK));
  return snaps.docs.map((d) => snapUnlockRow(d.id, d.data())).filter((r) => r.status === "pending");
}

export async function dismissTutoringSessionUnlockRequest(sessionId: string, studentId: string): Promise<void> {
  const db = requireDb();
  await deleteDoc(doc(db, COL, sessionId, UNLOCK, studentId));
}

export function subscribeTutoringSessionUnlockRequests(
  sessionId: string,
  onNext: (rows: TutoringUnlockRequestRow[]) => void,
): Unsubscribe {
  const db = requireDb();
  return onSnapshot(collection(db, COL, sessionId, UNLOCK), (snap) => {
    onNext(snap.docs.map((d) => snapUnlockRow(d.id, d.data())).filter((r) => r.status === "pending"));
  });
}

/** Live list of published sessions that include this student (same filter as list for dashboard). */
export function subscribeStudentPublishedTutoringSessions(
  studentId: string,
  studentTrack: NursingTrack | null,
  onNext: (sessions: TutoringSession[]) => void,
): Unsubscribe {
  const db = requireDb();
  const qy = query(collection(db, COL), where("published", "==", true), where("assignedStudentIds", "array-contains", studentId));
  return onSnapshot(qy, (snap) => {
    let list = snap.docs.map((d) => snapToSession(d.id, d.data()));
    if (studentTrack) {
      list = list.filter((s) => questionMatchesStudentTrack(s.examType, studentTrack));
    }
    onNext(list);
  });
}
