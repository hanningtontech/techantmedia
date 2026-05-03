/**
 * Firestore data layer for the integrated NCLEX module.
 * All operations require a configured Firebase project and signed-in user where applicable.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import { tryGetFirestoreDb } from "@/lib/firebase";
import {
  calculateExplanationScore,
  extractKeywords,
  scoreExplanationFull,
} from "@/lib/nclex/keywordExtractor";
import { computeCatScoreFromAttempt } from "@/lib/nclex/catScoring";
import { questionTextSuggestsMultipleAnswers } from "@/lib/nclex/sataPrompt";
import {
  questionMatchesStudentTrack,
  questionMatchesTemplatePool,
  templateMatchesAdminSession,
  templateVisibleToStudent,
  parseNclexExamType,
} from "@/lib/nclex/examTypeFilters";
import { normalizeHttpUrlForMedia } from "@/lib/nclex/nclexQuestionMedia";
import type { NursingTrack } from "@/lib/userTypes";
import type {
  AdminNotification,
  NclexExamType,
  Question,
  QuestionAdminOnly,
  QuestionInput,
  QuestionOption,
  QuizResponseItem,
  QuizSession,
  QuizTemplate,
  QuizTemplateInput,
  RatResponseItem,
  RatSession,
  RatStats,
  StudentNotification,
  StudentQuestion,
  StudentScoreRow,
} from "./nclexTypes";

const COL_QUESTIONS = "questions";
const SUBCOL_QUESTION_ADMIN_ONLY = "adminOnly";
const DOC_QUESTION_ADMIN_ONLY_DEFAULT = "default";
const COL_SESSIONS = "quizSessions";
const COL_QUIZ_TEMPLATES = "quizTemplates";
const COL_QUIZ_ASSIGNMENTS = "quizAssignments";
const COL_STUDENT_NOTIFICATIONS = "studentNotifications";
const COL_RAT_SESSIONS = "ratSessions";
const COL_USERS = "users";

function requireDb() {
  const db = tryGetFirestoreDb();
  if (!db) {
    throw new Error("Firestore is not configured. Add VITE_FIREBASE_* variables.");
  }
  return db;
}

function questionAdminOnlyDocRef(db: Firestore, questionId: string) {
  return doc(db, COL_QUESTIONS, questionId, SUBCOL_QUESTION_ADMIN_ONLY, DOC_QUESTION_ADMIN_ONLY_DEFAULT);
}

/** Persists or clears admin-only distractor explanations (separate doc; students cannot read). */
export async function writeQuestionAdminOnly(questionId: string, whyOthersIncorrect: string | null): Promise<void> {
  const db = requireDb();
  const ref = questionAdminOnlyDocRef(db, questionId);
  const trimmed = whyOthersIncorrect?.trim() ?? "";
  if (!trimmed) {
    await deleteDoc(ref).catch(() => undefined);
    return;
  }
  await setDoc(ref, { whyOthersIncorrect: trimmed, updatedAt: serverTimestamp() });
}

export async function getQuestionAdminOnly(questionId: string): Promise<QuestionAdminOnly | null> {
  const db = requireDb();
  const snap = await getDoc(questionAdminOnlyDocRef(db, questionId));
  if (!snap.exists()) return null;
  const data = snap.data();
  const w = typeof data.whyOthersIncorrect === "string" ? data.whyOthersIncorrect.trim() : "";
  if (!w) return null;
  return { whyOthersIncorrect: w };
}

function snapToQuestion(id: string, data: DocumentData): Question {
  const correctAnswerIds = Array.isArray(data.correctAnswerIds)
    ? (data.correctAnswerIds as unknown[]).map((x) => String(x).toLowerCase().trim()).filter(Boolean)
    : undefined;
  const fromStem = typeof data.stemImageUrl === "string" ? data.stemImageUrl.trim() : "";
  const fromLegacy =
    typeof (data as { imageUrl?: unknown }).imageUrl === "string"
      ? String((data as { imageUrl?: string }).imageUrl).trim()
      : "";
  const siu = fromStem || fromLegacy;
  const ex = parseNclexExamType(data.examType);
  const ncc = typeof data.nclexCategory === "string" ? data.nclexCategory.trim() : "";
  const nct = typeof data.nclexTopic === "string" ? data.nclexTopic.trim() : "";
  const ncs = typeof data.nclexSubtopic === "string" ? data.nclexSubtopic.trim() : "";
  return {
    id,
    title: String(data.title ?? ""),
    questionText: String(data.questionText ?? ""),
    ...(siu ? { stemImageUrl: siu } : {}),
    topic: typeof data.topic === "string" && data.topic.trim() ? data.topic.trim() : undefined,
    options: Array.isArray(data.options) ? data.options : [],
    correctAnswerId: String(data.correctAnswerId ?? ""),
    correctAnswerIds: correctAnswerIds?.length ? correctAnswerIds : undefined,
    allowMultipleAnswers: Boolean(data.allowMultipleAnswers),
    rationale: String(data.rationale ?? ""),
    keywordsList: Array.isArray(data.keywordsList) ? data.keywordsList.map(String) : [],
    category: String(data.category ?? ""),
    ...(ex ? { examType: ex } : {}),
    ...(ncc ? { nclexCategory: ncc } : {}),
    ...(nct ? { nclexTopic: nct } : {}),
    ...(ncs ? { nclexSubtopic: ncs } : {}),
    ...(data.isGeneral === true ? { isGeneral: true } : {}),
    createdBy: String(data.createdBy ?? ""),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    isActive: Boolean(data.isActive ?? true),
  };
}

function snapToSession(id: string, data: DocumentData): QuizSession {
  const resultsReleasedToStudent =
    typeof data.resultsReleasedToStudent === "boolean" ? data.resultsReleasedToStudent : undefined;
  const ao = String(data.adminOutcome ?? "").toLowerCase().trim();
  const adminOutcome = ao === "pass" || ao === "fail" || ao === "borderline" ? (ao as QuizSession["adminOutcome"]) : undefined;
  const aon = typeof data.adminOutcomeNote === "string" ? data.adminOutcomeNote : null;
  return {
    id,
    studentId: String(data.studentId ?? ""),
    studentName: String(data.studentName ?? ""),
    tutorId: String(data.tutorId ?? ""),
    templateId: data.templateId != null ? String(data.templateId) : null,
    filterCategory: data.filterCategory != null ? String(data.filterCategory) : null,
    quizTitle: data.quizTitle != null ? String(data.quizTitle) : null,
    questionLimit:
      data.questionLimit != null && Number(data.questionLimit) > 0 ? Number(data.questionLimit) : null,
    startedAt: data.startedAt ?? null,
    submittedAt: data.submittedAt ?? null,
    totalQuestions: Number(data.totalQuestions ?? 0),
    totalCorrect: Number(data.totalCorrect ?? 0),
    percentageScore: Number(data.percentageScore ?? 0),
    status: (data.status as QuizSession["status"]) ?? "in_progress",
    questionIds: Array.isArray(data.questionIds) ? data.questionIds.map(String) : undefined,
    responses: Array.isArray(data.responses) ? data.responses : [],
    resultsReleasedToStudent,
    resultsReleasedAt: data.resultsReleasedAt ?? null,
    linearPercentScore:
      data.linearPercentScore != null && !Number.isNaN(Number(data.linearPercentScore))
        ? Number(data.linearPercentScore)
        : undefined,
    catTheta: data.catTheta != null && !Number.isNaN(Number(data.catTheta)) ? Number(data.catTheta) : null,
    catStandardError:
      data.catStandardError != null && !Number.isNaN(Number(data.catStandardError))
        ? Number(data.catStandardError)
        : null,
    sectionScoreRequestedUpTo:
      data.sectionScoreRequestedUpTo != null && Number(data.sectionScoreRequestedUpTo) > 0
        ? Number(data.sectionScoreRequestedUpTo)
        : undefined,
    sectionScoreReleasedUpTo:
      data.sectionScoreReleasedUpTo != null && Number(data.sectionScoreReleasedUpTo) > 0
        ? Number(data.sectionScoreReleasedUpTo)
        : undefined,
    sectionLinearPercentScoreUpTo:
      data.sectionLinearPercentScoreUpTo != null && !Number.isNaN(Number(data.sectionLinearPercentScoreUpTo))
        ? Number(data.sectionLinearPercentScoreUpTo)
        : undefined,
    adminOutcome,
    adminOutcomeNote: aon,
    adminOutcomeSetAt: data.adminOutcomeSetAt ?? null,
  };
}

function snapToRatSession(id: string, data: DocumentData): RatSession {
  const questionIds = Array.isArray(data.questionIds) ? data.questionIds.map(String).filter(Boolean) : [];
  const responses = Array.isArray(data.responses)
    ? (data.responses as any[]).map((r) => ({
        questionId: String(r?.questionId ?? ""),
        selectedAnswerIds: Array.isArray(r?.selectedAnswerIds) ? r.selectedAnswerIds.map(String) : [],
        isCorrect: Boolean(r?.isCorrect),
      }))
    : [];
  const statusRaw = String(data.status ?? "").toLowerCase().trim();
  const status: RatSession["status"] = statusRaw === "submitted" ? "submitted" : "in_progress";
  return {
    id,
    studentId: String(data.studentId ?? ""),
    studentName: String(data.studentName ?? ""),
    createdAt: data.createdAt ?? null,
    startedAt: data.startedAt ?? null,
    submittedAt: data.submittedAt ?? null,
    endsAtMs: Number(data.endsAtMs ?? 0),
    questionCount: Math.max(0, Number(data.questionCount ?? questionIds.length)),
    durationSeconds: Math.max(0, Number(data.durationSeconds ?? 0)),
    status,
    questionIds,
    responses,
    totalQuestions: Math.max(0, Number(data.totalQuestions ?? questionIds.length)),
    totalCorrect: Math.max(0, Number(data.totalCorrect ?? 0)),
    percentageScore: Math.max(0, Number(data.percentageScore ?? 0)),
  };
}

function secureRandomInt(maxExclusive: number): number {
  const max = Math.floor(Number(maxExclusive));
  if (!Number.isFinite(max) || max <= 0) return 0;
  // Rejection sampling for unbiased modulo.
  const cryptoObj = typeof crypto !== "undefined" ? crypto : null;
  if (!cryptoObj?.getRandomValues) return Math.floor(Math.random() * max);
  const range = 0x100000000;
  const bucket = Math.floor(range / max) * max;
  const u = new Uint32Array(1);
  while (true) {
    cryptoObj.getRandomValues(u);
    const x = u[0]!;
    if (x < bucket) return x % max;
  }
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const tmp = arr[i];
    arr[i] = arr[j]!;
    arr[j] = tmp!;
  }
  return arr;
}

function normalizeSelectedIds(ids: unknown): string[] {
  const raw = Array.isArray(ids) ? ids : [];
  const out = raw
    .map((x) => String(x).toLowerCase().trim())
    .filter(Boolean);
  return Array.from(new Set(out)).sort();
}

function areArraysEqualSorted(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export async function getRatStats(studentId: string): Promise<RatStats | null> {
  const db = requireDb();
  const snap = await getDoc(doc(db, COL_USERS, studentId));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  const rs = data?.ratStats ?? null;
  if (!rs || typeof rs !== "object") return null;
  return {
    count: Math.max(0, Number(rs.count ?? 0)),
    sumScore: Math.max(0, Number(rs.sumScore ?? 0)),
    meanScore: Math.max(0, Number(rs.meanScore ?? 0)),
    lastRatStartedAtMs: Math.max(0, Number(rs.lastRatStartedAtMs ?? 0)),
    lastRatStartedAt: rs.lastRatStartedAt ?? null,
  };
}

export function subscribeRatSession(ratId: string, callback: (s: RatSession | null) => void): () => void {
  const db = requireDb();
  const ref = doc(db, COL_RAT_SESSIONS, ratId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(snapToRatSession(snap.id, snap.data()));
    },
    () => callback(null),
  );
}

export async function listRatSessionsForStudent(studentId: string, take = 25): Promise<RatSession[]> {
  const db = requireDb();
  const n = Math.max(1, Math.min(50, Math.floor(Number(take) || 25)));
  const qy = query(
    collection(db, COL_RAT_SESSIONS),
    where("studentId", "==", studentId),
    orderBy("startedAt", "desc"),
    limit(n),
  );
  const snaps = await getDocs(qy);
  return snaps.docs.map((d) => snapToRatSession(d.id, d.data()));
}

export async function createRatSessionFromHistory(opts: {
  studentId: string;
  studentName: string;
  questionCount: 5 | 10 | 15 | 20;
  /** When set, only questions aligned with this track are eligible. */
  nursingTrack?: NursingTrack | null;
}): Promise<string> {
  const db = requireDb();
  const n = Number(opts.questionCount);
  if (![5, 10, 15, 20].includes(n)) throw new Error("Invalid RAT size");

  // Cooldown check (best-effort; server rules also enforce ownership, but cooldown is client-side on Spark).
  const stats = await getRatStats(opts.studentId);
  const lastMs = stats?.lastRatStartedAtMs ?? 0;
  if (lastMs > 0 && Date.now() - lastMs < 24 * 60 * 60 * 1000) {
    throw new Error("You can only take one random assessment every 24 hours.");
  }

  const sessions = await getStudentQuizzes(opts.studentId);
  const doneReleased = sessions.filter(
    (s) =>
      (s.status === "submitted" || s.status === "reviewed") &&
      areQuizResultsReleasedToStudent(s) &&
      Array.isArray(s.responses) &&
      s.responses.length > 0,
  );
  if (!doneReleased.length) throw new Error("Complete at least one quiz first.");

  // Latest correctness per questionId.
  const sorted = [...doneReleased].sort((a, b) => tsMillis(b.submittedAt ?? b.startedAt) - tsMillis(a.submittedAt ?? a.startedAt));
  const byQ = new Map<string, boolean>();
  for (const s of sorted) {
    for (const r of s.responses) {
      const qid = String(r.questionId ?? "").trim();
      if (!qid) continue;
      if (byQ.has(qid)) continue;
      byQ.set(qid, Boolean(r.isCorrect));
    }
  }
  const wrongPool = Array.from(byQ.entries())
    .filter(([, ok]) => ok === false)
    .map(([id]) => id);
  const rightPool = Array.from(byQ.entries())
    .filter(([, ok]) => ok === true)
    .map(([id]) => id);

  const wrongTake = Math.floor(n * 0.7);
  const rightTake = n - wrongTake;

  shuffleInPlace(wrongPool);
  shuffleInPlace(rightPool);
  const picked: string[] = [];
  picked.push(...wrongPool.slice(0, wrongTake));
  picked.push(...rightPool.slice(0, rightTake));

  // Fill shortages.
  if (picked.length < n) {
    const need = n - picked.length;
    const extraWrong = wrongPool.slice(wrongTake);
    const extraRight = rightPool.slice(rightTake);
    const extra = shuffleInPlace([...extraWrong, ...extraRight]).filter((id) => !picked.includes(id));
    picked.push(...extra.slice(0, need));
  }

  // Final fallback: any questionIds seen in history.
  if (picked.length < n) {
    const need = n - picked.length;
    const any = shuffleInPlace(Array.from(byQ.keys())).filter((id) => !picked.includes(id));
    picked.push(...any.slice(0, need));
  }

  let questionIds = shuffleInPlace(Array.from(new Set(picked))).slice(0, n);
  if (opts.nursingTrack) {
    const qs = await listQuestionsByIds(questionIds);
    const allow = new Set(
      qs.filter((q) => questionMatchesStudentTrack(q.examType, opts.nursingTrack)).map((q) => q.id),
    );
    questionIds = questionIds.filter((id) => allow.has(id));
  }
  if (questionIds.length < n) {
    throw new Error(
      opts.nursingTrack
        ? "Not enough NCLEX track–aligned questions in your history. Complete more quizzes for your track first."
        : "Not enough question history to generate this assessment.",
    );
  }

  const durationSeconds = n * 60;
  const endsAtMs = Date.now() + durationSeconds * 1000;

  const ref = await addDoc(collection(db, COL_RAT_SESSIONS), {
    studentId: opts.studentId,
    studentName: opts.studentName,
    createdAt: serverTimestamp(),
    startedAt: serverTimestamp(),
    submittedAt: null,
    endsAtMs,
    questionCount: n,
    durationSeconds,
    status: "in_progress",
    questionIds,
    responses: [],
    totalQuestions: n,
    totalCorrect: 0,
    percentageScore: 0,
  });

  // Record cooldown anchor (client-side best-effort).
  await updateDoc(doc(db, COL_USERS, opts.studentId), {
    "ratStats.lastRatStartedAtMs": Date.now(),
    "ratStats.lastRatStartedAt": serverTimestamp(),
  }).catch(() => undefined);

  return ref.id;
}

export async function submitRatSession(opts: {
  ratId: string;
  studentId: string;
  answersByQuestionId: Record<string, string[]>;
}): Promise<void> {
  const db = requireDb();
  const ref = doc(db, COL_RAT_SESSIONS, opts.ratId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("RAT not found");
    const s = snapToRatSession(snap.id, snap.data());
    if (s.studentId !== opts.studentId) throw new Error("Not allowed");
    if (s.status === "submitted") return;

    // Read everything up-front (Firestore transactions require all reads before any writes).
    const userRef = doc(db, COL_USERS, opts.studentId);
    const uSnap = await tx.get(userRef);
    const cur = uSnap.exists() ? (uSnap.data() as any)?.ratStats : null;

    const ids = s.questionIds;
    if (!ids.length) throw new Error("RAT has no questions");

    const qSnaps = await Promise.all(ids.map((id) => tx.get(doc(db, COL_QUESTIONS, id))));
    const questions = qSnaps
      .filter((qs) => qs.exists())
      .map((qs) => snapToQuestion(qs.id, qs.data()));

    const responses: RatResponseItem[] = [];
    for (const q of questions) {
      const selected = normalizeSelectedIds(opts.answersByQuestionId[q.id] ?? []);
      const correctIds = Array.isArray(q.correctAnswerIds) && q.correctAnswerIds.length
        ? q.correctAnswerIds.map((x) => String(x).toLowerCase().trim()).filter(Boolean).sort()
        : [String(q.correctAnswerId ?? "").toLowerCase().trim()].filter(Boolean);
      const isCorrect = areArraysEqualSorted(selected, correctIds);
      responses.push({ questionId: q.id, selectedAnswerIds: selected, isCorrect });
    }

    const totalQuestions = ids.length;
    const totalCorrect = responses.reduce((a, r) => a + (r.isCorrect ? 1 : 0), 0);
    const pct = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    tx.update(ref, {
      responses,
      totalQuestions,
      totalCorrect,
      percentageScore: pct,
      status: "submitted",
      submittedAt: serverTimestamp(),
    });

    // Update ratStats on user doc.
    const prevCount = Math.max(0, Number(cur?.count ?? 0));
    const prevSum = Math.max(0, Number(cur?.sumScore ?? 0));
    const nextCount = prevCount + 1;
    const nextSum = prevSum + pct;
    const nextMean = nextCount ? Math.round(nextSum / nextCount) : 0;
    tx.set(
      userRef,
      {
        ratStats: {
          count: nextCount,
          sumScore: nextSum,
          meanScore: nextMean,
          lastRatStartedAtMs: cur?.lastRatStartedAtMs ?? 0,
          lastRatStartedAt: cur?.lastRatStartedAt ?? null,
        },
      },
      { merge: true },
    );
  });
}

/** Legacy sessions omit the field — treat as already released. */
export function areQuizResultsReleasedToStudent(s: Pick<QuizSession, "resultsReleasedToStudent">): boolean {
  return s.resultsReleasedToStudent !== false;
}

/**
 * Question count through which a section release must cover to satisfy the student's latest request
 * (capped to locked question ids on the session).
 */
export function sectionScoreNeededUpTo(
  s: Pick<QuizSession, "sectionScoreRequestedUpTo" | "questionIds" | "totalQuestions">,
): number {
  const req = s.sectionScoreRequestedUpTo ?? 0;
  if (req <= 0) return 0;
  const cap = s.questionIds?.length ?? s.totalQuestions ?? 0;
  return cap > 0 ? Math.min(req, cap) : req;
}

/** Student asked for a section score and the tutor has not released through the needed question yet. */
export function hasPendingSectionScoreRequest(
  s: Pick<
    QuizSession,
    "status" | "sectionScoreRequestedUpTo" | "sectionScoreReleasedUpTo" | "questionIds" | "totalQuestions"
  >,
): boolean {
  if (s.status !== "in_progress") return false;
  const needed = sectionScoreNeededUpTo(s);
  if (needed <= 0) return false;
  return (s.sectionScoreReleasedUpTo ?? 0) < needed;
}

/** In-progress attempt: tutor released item-level review through the student's requested section (or legacy release). */
export function canViewInProgressSectionResults(
  s: Pick<
    QuizSession,
    "status" | "sectionScoreReleasedUpTo" | "sectionScoreRequestedUpTo" | "questionIds" | "totalQuestions"
  >,
): boolean {
  if (s.status !== "in_progress") return false;
  const rel = s.sectionScoreReleasedUpTo ?? 0;
  if (rel <= 0) return false;
  const needed = sectionScoreNeededUpTo(s);
  if (needed <= 0) return true;
  return rel >= needed;
}

export function getCorrectAnswerIds(q: Pick<Question, "correctAnswerId" | "correctAnswerIds">): string[] {
  if (q.correctAnswerIds?.length) {
    return Array.from(new Set(q.correctAnswerIds.map((x) => x.toLowerCase().trim()))).filter(Boolean).sort();
  }
  const one = q.correctAnswerId?.trim().toLowerCase();
  return one ? [one] : [];
}

export function arraysEqualSorted(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].sort();
  const bs = [...b].sort();
  return as.every((v, i) => v === bs[i]);
}

export function responseSelectedIds(r: Pick<QuizResponseItem, "selectedAnswerId" | "selectedAnswerIds">): string[] {
  if (r.selectedAnswerIds?.length) {
    return Array.from(new Set(r.selectedAnswerIds.map((x) => String(x).toLowerCase().trim()))).filter(Boolean).sort();
  }
  const s = r.selectedAnswerId?.trim().toLowerCase() ?? "";
  if (!s) return [];
  if (s.includes(",")) return Array.from(new Set(s.split(",").map((x) => x.trim().toLowerCase()))).filter(Boolean).sort();
  return [s];
}

function studentAllowsMultipleAnswers(q: Question): boolean {
  if (q.allowMultipleAnswers === true) return true;
  if ((q.correctAnswerIds?.length ?? 0) > 1) return true;
  return questionTextSuggestsMultipleAnswers(q.questionText);
}

export function toStudentQuestion(q: Question): StudentQuestion {
  const stem = q.stemImageUrl?.trim() ? normalizeHttpUrlForMedia(q.stemImageUrl) : "";
  return {
    id: q.id,
    title: q.title,
    questionText: q.questionText,
    ...(stem ? { stemImageUrl: stem } : {}),
    options: q.options,
    category: q.category,
    topic: q.topic,
    allowMultipleAnswers: studentAllowsMultipleAnswers(q),
  };
}

/** Creates a question; auto-builds keywords from rationale when omitted. */
export async function createQuestion(data: QuestionInput, tutorId: string): Promise<string> {
  const db = requireDb();
  const keywordsList =
    data.keywordsList?.length ? data.keywordsList : extractKeywords(data.rationale || data.questionText);
  const caIds = data.correctAnswerIds?.length
    ? Array.from(new Set(data.correctAnswerIds.map((x) => String(x).toLowerCase().trim()))).filter(Boolean)
    : undefined;
  const stemImageUrl = data.stemImageUrl?.trim() || null;
  const ref = await addDoc(collection(db, COL_QUESTIONS), {
    title: data.title,
    questionText: data.questionText,
    stemImageUrl,
    topic: data.topic?.trim() || null,
    options: data.options,
    correctAnswerId: data.correctAnswerId,
    correctAnswerIds: caIds?.length ? caIds : null,
    allowMultipleAnswers: Boolean(data.allowMultipleAnswers),
    rationale: data.rationale,
    keywordsList,
    category: data.category ?? "",
    examType: data.examType ?? null,
    nclexCategory: data.nclexCategory?.trim() || null,
    nclexTopic: data.nclexTopic?.trim() || null,
    nclexSubtopic: data.nclexSubtopic?.trim() || null,
    isGeneral: data.isGeneral === true,
    createdBy: tutorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isActive: data.isActive ?? true,
  });
  const extra = data.whyOthersIncorrect?.trim();
  if (extra) {
    await setDoc(questionAdminOnlyDocRef(db, ref.id), { whyOthersIncorrect: extra, updatedAt: serverTimestamp() });
  }
  return ref.id;
}

function documentDataOmitUndefined(raw: Record<string, unknown>): DocumentData {
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)) as DocumentData;
}

export async function updateQuestion(questionId: string, data: Partial<QuestionInput>): Promise<void> {
  const db = requireDb();
  const {
    whyOthersIncorrect,
    stemImageUrl,
    examType,
    nclexCategory,
    nclexTopic,
    nclexSubtopic,
    isGeneral,
    ...fields
  } = data;
  const next: Record<string, unknown> = { ...fields, updatedAt: serverTimestamp() };
  if (stemImageUrl !== undefined) {
    next.stemImageUrl = typeof stemImageUrl === "string" && stemImageUrl.trim() ? stemImageUrl.trim() : null;
  }
  if (examType !== undefined) {
    next.examType = examType === null || examType === undefined ? null : examType;
  }
  if (nclexCategory !== undefined) next.nclexCategory = nclexCategory?.trim() || null;
  if (nclexTopic !== undefined) next.nclexTopic = nclexTopic?.trim() || null;
  if (nclexSubtopic !== undefined) next.nclexSubtopic = nclexSubtopic?.trim() || null;
  if (isGeneral !== undefined) next.isGeneral = Boolean(isGeneral);
  if (fields.rationale && fields.keywordsList === undefined) {
    next.keywordsList = extractKeywords(fields.rationale);
  }
  await updateDoc(doc(db, COL_QUESTIONS, questionId), documentDataOmitUndefined(next));
  if (whyOthersIncorrect !== undefined) {
    await writeQuestionAdminOnly(questionId, whyOthersIncorrect?.trim() ? whyOthersIncorrect.trim() : null);
  }
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const db = requireDb();
  const batch = writeBatch(db);
  batch.delete(questionAdminOnlyDocRef(db, questionId));
  batch.delete(doc(db, COL_QUESTIONS, questionId));
  await batch.commit();
}

export async function getQuestionById(questionId: string): Promise<Question | null> {
  const db = requireDb();
  const snap = await getDoc(doc(db, COL_QUESTIONS, questionId));
  if (!snap.exists()) return null;
  return snapToQuestion(snap.id, snap.data());
}

export async function listQuestions(tutorId?: string): Promise<Question[]> {
  const db = requireDb();
  const qy = query(collection(db, COL_QUESTIONS), where("isActive", "==", true));
  const snaps = await getDocs(qy);
  let rows = snaps.docs.map((d) => snapToQuestion(d.id, d.data()));
  rows.sort((a, b) => {
    const ta = (a.updatedAt as Timestamp | null)?.toMillis?.() ?? 0;
    const tb = (b.updatedAt as Timestamp | null)?.toMillis?.() ?? 0;
    return tb - ta;
  });
  if (tutorId) {
    rows = rows.filter((r) => r.createdBy === tutorId);
  }
  return rows;
}

export async function searchQuestions(searchTerm: string): Promise<Question[]> {
  const all = await listQuestions();
  const t = searchTerm.trim().toLowerCase();
  if (!t) return all;
  return all.filter(
    (q) =>
      q.title.toLowerCase().includes(t) ||
      q.questionText.toLowerCase().includes(t) ||
      q.category.toLowerCase().includes(t) ||
      (q.topic?.toLowerCase().includes(t) ?? false),
  );
}

export async function bulkImportQuestions(questions: QuestionInput[], tutorId: string): Promise<string[]> {
  const ids: string[] = [];
  const db = requireDb();
  const batchSize = 400;
  for (let i = 0; i < questions.length; i += batchSize) {
    const slice = questions.slice(i, i + batchSize);
    const batch = writeBatch(db);
    for (const q of slice) {
      const ref = doc(collection(db, COL_QUESTIONS));
      const keywordsList = q.keywordsList?.length ? q.keywordsList : extractKeywords(q.rationale || q.questionText);
      const caIds = q.correctAnswerIds?.length
        ? Array.from(new Set(q.correctAnswerIds.map((x) => String(x).toLowerCase().trim()))).filter(Boolean)
        : null;
      batch.set(ref, {
        title: q.title,
        questionText: q.questionText,
        stemImageUrl: q.stemImageUrl?.trim() || null,
        topic: q.topic?.trim() || null,
        options: q.options,
        correctAnswerId: q.correctAnswerId,
        correctAnswerIds: caIds,
        allowMultipleAnswers: Boolean(q.allowMultipleAnswers),
        rationale: q.rationale,
        keywordsList,
        category: q.category ?? "",
        examType: q.examType ?? null,
        nclexCategory: q.nclexCategory?.trim() || null,
        nclexTopic: q.nclexTopic?.trim() || null,
        nclexSubtopic: q.nclexSubtopic?.trim() || null,
        isGeneral: q.isGeneral === true,
        createdBy: tutorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: q.isActive ?? true,
      });
      const distractor = q.whyOthersIncorrect?.trim();
      if (distractor) {
        batch.set(questionAdminOnlyDocRef(db, ref.id), {
          whyOthersIncorrect: distractor,
          updatedAt: serverTimestamp(),
        });
      }
      ids.push(ref.id);
    }
    await batch.commit();
  }
  return ids;
}

export type CreateQuizSessionOptions = {
  templateId?: string | null;
  filterCategory?: string | null;
  quizTitle?: string | null;
  /** When set, the attempt includes at most this many questions (after category filter). */
  questionLimit?: number | null;
};

function parseContentKind(raw: unknown): QuizTemplate["contentKind"] {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "quiz" || s === "exam" || s === "notes" || s === "presentation" || s === "video") return s;
  return undefined;
}

function snapToQuizTemplate(id: string, data: DocumentData): QuizTemplate {
  const fc = data.filterCategory;
  const ex = parseNclexExamType(data.examType);
  const ncc = typeof data.nclexCategory === "string" ? data.nclexCategory.trim() : "";
  const nct = typeof data.nclexTopic === "string" ? data.nclexTopic.trim() : "";
  const ncs = typeof data.nclexSubtopic === "string" ? data.nclexSubtopic.trim() : "";
  const ck = parseContentKind(data.contentKind);
  const fixedRaw = Array.isArray(data.fixedQuestionIds)
    ? (data.fixedQuestionIds as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  return {
    id,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    filterCategory: fc != null && String(fc).trim() !== "" ? String(fc).trim() : null,
    questionLimit: Math.max(0, Number(data.questionLimit ?? 0)),
    estimatedMinutes:
      data.estimatedMinutes != null && Number(data.estimatedMinutes) > 0 ? Number(data.estimatedMinutes) : null,
    sortOrder: Number(data.sortOrder ?? 0),
    isActive: Boolean(data.isActive ?? true),
    createdBy: String(data.createdBy ?? ""),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    ...(ex ? { examType: ex } : {}),
    ...(ncc ? { nclexCategory: ncc } : {}),
    ...(nct ? { nclexTopic: nct } : {}),
    ...(ncs ? { nclexSubtopic: ncs } : {}),
    ...(data.isGeneral === true ? { isGeneral: true } : {}),
    ...(ck ? { contentKind: ck } : {}),
    ...(fixedRaw.length ? { fixedQuestionIds: fixedRaw } : {}),
  };
}

export async function createQuizSession(
  studentId: string,
  studentName: string,
  tutorId: string,
  options?: CreateQuizSessionOptions,
): Promise<string> {
  const db = requireDb();
  const templateId = options?.templateId != null ? String(options.templateId) : null;
  const filter = options?.filterCategory?.trim() || null;
  const title = options?.quizTitle?.trim() || (filter ? `${filter} quiz` : "NCLEX practice quiz");
  const lim = options?.questionLimit;
  const questionLimit = lim != null && Number(lim) > 0 ? Number(lim) : null;
  const ref = await addDoc(collection(db, COL_SESSIONS), {
    studentId,
    studentName,
    tutorId,
    templateId,
    filterCategory: filter,
    quizTitle: title,
    questionLimit,
    startedAt: serverTimestamp(),
    submittedAt: null,
    totalQuestions: 0,
    totalCorrect: 0,
    percentageScore: 0,
    status: "in_progress",
    responses: [],
  });
  return ref.id;
}

/** Active quizzes for the student home (all tutors’ templates; small-team MVP). */
export async function listPublishedQuizTemplates(opts?: { adminExamType?: NursingTrack | null }): Promise<QuizTemplate[]> {
  const db = requireDb();
  const qy = query(collection(db, COL_QUIZ_TEMPLATES), where("isActive", "==", true));
  const snaps = await getDocs(qy);
  let rows = snaps.docs.map((d) => snapToQuizTemplate(d.id, d.data()));
  if (opts?.adminExamType) {
    rows = rows.filter((t) => templateMatchesAdminSession(t.examType, opts.adminExamType ?? null));
  }
  rows.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  return rows;
}

export async function getQuizTemplateById(templateId: string): Promise<QuizTemplate | null> {
  const db = requireDb();
  const snap = await getDoc(doc(db, COL_QUIZ_TEMPLATES, templateId));
  if (!snap.exists()) return null;
  return snapToQuizTemplate(snap.id, snap.data());
}

/**
 * Questions for a template: when `fixedQuestionIds` is set, uses that ordered list; otherwise the category pool
 * (same rules as a live student attempt).
 */
export async function resolveQuizTemplateQuestions(
  template: Pick<QuizTemplate, "filterCategory" | "questionLimit" | "examType" | "fixedQuestionIds">,
  opts: { isAdmin: boolean; tutorUid: string; studentTrack?: NursingTrack | null },
): Promise<Question[]> {
  const fixed = (template.fixedQuestionIds ?? []).map((x) => String(x).trim()).filter(Boolean);
  if (fixed.length) {
    const loaded = await listQuestionsByIds(fixed);
    const byId = new Map(loaded.map((q) => [q.id, q]));
    const ordered: Question[] = [];
    for (const id of fixed) {
      const q = byId.get(id);
      if (!q || !q.isActive) continue;
      if (opts.studentTrack && !questionMatchesStudentTrack(q.examType, opts.studentTrack)) continue;
      if (template.examType != null && !questionMatchesTemplatePool(q.examType, template.examType)) continue;
      if (!opts.isAdmin && opts.tutorUid && q.createdBy !== opts.tutorUid) continue;
      ordered.push(q);
    }
    const lim = template.questionLimit > 0 ? template.questionLimit : ordered.length;
    return ordered.slice(0, lim);
  }
  const rows = await filterQuestionsForQuizPool({
    filterCategory: template.filterCategory,
    studentTrack: opts.studentTrack ?? null,
    templateExam: template.examType ?? null,
    tutorScope: { isAdmin: opts.isAdmin, tutorUid: opts.tutorUid },
  });
  const lim = template.questionLimit != null && template.questionLimit > 0 ? template.questionLimit : null;
  return lim != null ? rows.slice(0, lim) : rows;
}

/**
 * Same question pool and cap as a student attempt from this template (admin: uses full bank; tutors: own items only).
 * Order matches `listStudentQuizQuestions` when using category pool; fixed-ID templates preserve ID order.
 */
export async function listPreviewQuestionsForQuizTemplate(
  template: Pick<QuizTemplate, "filterCategory" | "questionLimit" | "examType" | "fixedQuestionIds">,
  opts: { isAdmin: boolean; tutorUid: string; studentTrack?: NursingTrack | null },
): Promise<Question[]> {
  return resolveQuizTemplateQuestions(template, opts);
}

/** How many questions a student would see for this template (category pool or fixed list). */
export async function countQuestionsForQuizTemplate(
  template: Pick<QuizTemplate, "filterCategory" | "questionLimit" | "examType" | "fixedQuestionIds">,
  opts?: { studentTrack?: NursingTrack | null; tutorUid?: string; isAdmin?: boolean },
): Promise<number> {
  const rows = await resolveQuizTemplateQuestions(template, {
    isAdmin: opts?.isAdmin ?? true,
    tutorUid: opts?.tutorUid ?? "",
    studentTrack: opts?.studentTrack,
  });
  return rows.length;
}

function assignmentDocId(studentId: string, templateId: string): string {
  return `${studentId}_${templateId}`;
}

export async function assignQuizTemplateToStudent(studentId: string, templateId: string, assignedBy: string): Promise<void> {
  const db = requireDb();
  const id = assignmentDocId(studentId, templateId);
  await setDoc(
    doc(db, COL_QUIZ_ASSIGNMENTS, id),
    {
    studentId,
    templateId,
    assignedBy,
    assignedAt: serverTimestamp(),
    isActive: true,
    },
    { merge: true },
  );
}

export async function unassignQuizTemplateFromStudent(studentId: string, templateId: string): Promise<void> {
  const db = requireDb();
  const id = assignmentDocId(studentId, templateId);
  await setDoc(doc(db, COL_QUIZ_ASSIGNMENTS, id), { isActive: false }, { merge: true }).catch(() => {});
}

export async function listAssignedQuizTemplates(
  studentId: string,
  studentTrack?: NursingTrack | null,
): Promise<QuizTemplate[]> {
  const db = requireDb();
  const qy = query(
    collection(db, COL_QUIZ_ASSIGNMENTS),
    where("studentId", "==", studentId),
    where("isActive", "==", true),
  );
  const snaps = await getDocs(qy);
  const templateIds = snaps.docs.map((d) => String(d.data().templateId ?? "")).filter(Boolean);
  const out: QuizTemplate[] = [];
  for (const tid of templateIds) {
    const tSnap = await getDoc(doc(db, COL_QUIZ_TEMPLATES, tid));
    if (!tSnap.exists()) continue;
    const t = snapToQuizTemplate(tSnap.id, tSnap.data());
    if (!t.isActive) continue;
    if (studentTrack && !templateVisibleToStudent(t.examType, studentTrack)) continue;
    out.push(t);
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  return out;
}

/** Admin/tutor: return assigned template ids (active assignments only). */
export async function listAssignedTemplateIds(studentId: string): Promise<Set<string>> {
  const db = requireDb();
  const qy = query(
    collection(db, COL_QUIZ_ASSIGNMENTS),
    where("studentId", "==", studentId),
    where("isActive", "==", true),
  );
  const snaps = await getDocs(qy);
  const ids = snaps.docs.map((d) => String(d.data().templateId ?? "")).filter(Boolean);
  return new Set(ids);
}

/** Admin/tutor: count active quiz assignments per student (active assignments only). */
export async function getActiveQuizAssignmentCountsByStudent(): Promise<Map<string, number>> {
  const db = requireDb();
  const qy = query(collection(db, COL_QUIZ_ASSIGNMENTS), where("isActive", "==", true));
  const snaps = await getDocs(qy);
  const map = new Map<string, number>();
  for (const d of snaps.docs) {
    const studentId = String(d.data().studentId ?? "");
    if (!studentId) continue;
    map.set(studentId, (map.get(studentId) ?? 0) + 1);
  }
  return map;
}

export async function listQuizTemplatesForEditor(opts: {
  tutorUid: string;
  isAdmin: boolean;
  /** When set (recommended for admins), only templates for this NCLEX track (+ legacy/both). */
  adminExamType?: NursingTrack | null;
}): Promise<QuizTemplate[]> {
  const db = requireDb();
  const snaps = await getDocs(collection(db, COL_QUIZ_TEMPLATES));
  let rows = snaps.docs.map((d) => snapToQuizTemplate(d.id, d.data()));
  if (!opts.isAdmin) {
    rows = rows.filter((r) => r.createdBy === opts.tutorUid);
  }
  if (opts.adminExamType) {
    rows = rows.filter((r) => templateMatchesAdminSession(r.examType, opts.adminExamType ?? null));
  }
  rows.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  return rows;
}

export async function createQuizTemplate(data: QuizTemplateInput, tutorId: string): Promise<string> {
  const db = requireDb();
  const fc = data.filterCategory?.trim();
  const nextTitle = data.title.trim();
  const nextFilter = (fc || "").toLowerCase();
  const nextLimit = Math.max(0, Number(data.questionLimit ?? 0));
  const nextExam = data.examType ?? "legacy";
  const fixedIds = Array.isArray(data.fixedQuestionIds)
    ? data.fixedQuestionIds.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const nextKey = `${nextTitle.toLowerCase()}::${nextFilter}::${nextLimit}::${nextExam}`;
  // Prevent accidental duplicates (same title + category + cap + exam type) — skipped for fixed-ID extracts.
  if (!fixedIds.length) {
    const existing = await getDocs(collection(db, COL_QUIZ_TEMPLATES));
    for (const d of existing.docs) {
      const t = snapToQuizTemplate(d.id, d.data());
      const key = `${t.title.trim().toLowerCase()}::${(t.filterCategory ?? "").trim().toLowerCase()}::${Math.max(
        0,
        Number(t.questionLimit ?? 0),
      )}::${t.examType ?? "legacy"}`;
      if (key === nextKey) {
        throw new Error(`A quiz with the same title/category/limit/track already exists ("${t.title}").`);
      }
    }
  }
  const ref = await addDoc(collection(db, COL_QUIZ_TEMPLATES), {
    title: nextTitle,
    description: (data.description ?? "").trim(),
    filterCategory: fc || null,
    questionLimit: nextLimit,
    estimatedMinutes:
      data.estimatedMinutes != null && Number(data.estimatedMinutes) > 0 ? Number(data.estimatedMinutes) : null,
    sortOrder: Number(data.sortOrder ?? 0),
    isActive: data.isActive ?? true,
    examType: data.examType ?? null,
    nclexCategory: data.nclexCategory?.trim() || null,
    nclexTopic: data.nclexTopic?.trim() || null,
    nclexSubtopic: data.nclexSubtopic?.trim() || null,
    isGeneral: data.isGeneral === true,
    contentKind: data.contentKind ?? null,
    fixedQuestionIds: fixedIds.length ? fixedIds : null,
    createdBy: tutorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuizTemplate(quizId: string, data: Partial<QuizTemplateInput>): Promise<void> {
  const db = requireDb();
  const payload: DocumentData = { updatedAt: serverTimestamp() };
  if (data.title != null) payload.title = data.title.trim();
  if (data.description != null) payload.description = data.description.trim();
  if (data.filterCategory !== undefined) {
    const fc = data.filterCategory?.trim();
    payload.filterCategory = fc || null;
  }
  if (data.questionLimit != null) payload.questionLimit = Math.max(0, Number(data.questionLimit));
  if (data.estimatedMinutes !== undefined) {
    payload.estimatedMinutes =
      data.estimatedMinutes != null && Number(data.estimatedMinutes) > 0 ? Number(data.estimatedMinutes) : null;
  }
  if (data.sortOrder != null) payload.sortOrder = Number(data.sortOrder);
  if (data.isActive != null) payload.isActive = Boolean(data.isActive);
  if (data.examType !== undefined) payload.examType = data.examType;
  if (data.nclexCategory !== undefined) payload.nclexCategory = data.nclexCategory?.trim() || null;
  if (data.nclexTopic !== undefined) payload.nclexTopic = data.nclexTopic?.trim() || null;
  if (data.nclexSubtopic !== undefined) payload.nclexSubtopic = data.nclexSubtopic?.trim() || null;
  if (data.isGeneral !== undefined) payload.isGeneral = Boolean(data.isGeneral);
  if (data.contentKind !== undefined) payload.contentKind = data.contentKind ?? null;
  if (data.fixedQuestionIds !== undefined) {
    const f = (data.fixedQuestionIds ?? []).map((x) => String(x).trim()).filter(Boolean);
    payload.fixedQuestionIds = f.length ? f : null;
  }
  await updateDoc(doc(db, COL_QUIZ_TEMPLATES, quizId), payload);
}

export async function deleteQuizTemplate(quizId: string): Promise<void> {
  const db = requireDb();
  await deleteDoc(doc(db, COL_QUIZ_TEMPLATES, quizId));
}

export async function setQuizTemplateActive(quizId: string, isActive: boolean): Promise<void> {
  return updateQuizTemplate(quizId, { isActive });
}

/** How many questions a student would see for this filter + limit (same logic as the live quiz). */
export async function countQuizQuestionPool(
  filterCategory: string | null,
  questionLimit?: number | null,
  opts?: { studentTrack?: NursingTrack | null; templateExam?: NclexExamType | null },
): Promise<number> {
  const rows = await filterQuestionsForQuizPool({
    filterCategory,
    studentTrack: opts?.studentTrack ?? null,
    templateExam: opts?.templateExam ?? null,
  });
  const n = rows.length;
  if (questionLimit != null && questionLimit > 0) return Math.min(questionLimit, n);
  return n;
}

export type QuizAnswerDraft = {
  questionId: string;
  /** Selected option letter(s), lowercase, unique. */
  selectedAnswerIds: string[];
  studentExplanation?: string;
};

/** Questions per partial submit section (first 10, next 10, …). */
export const QUIZ_CHUNK_SIZE = 10;

/** Persist the ordered question id list once per session so partial submits stay aligned. */
export async function ensureQuizQuestionIds(sessionId: string, questionIds: string[]): Promise<void> {
  const db = requireDb();
  const sessionRef = doc(db, COL_SESSIONS, sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) throw new Error("Quiz session not found");
  const data = sessionSnap.data();
  const existing = Array.isArray(data.questionIds) ? data.questionIds.map(String) : [];
  if (existing.length) return;
  const ids = questionIds.map(String).filter(Boolean);
  if (!ids.length) return;
  await updateDoc(sessionRef, {
    questionIds: ids,
    totalQuestions: ids.length,
  });
}

function draftToResponseItem(a: QuizAnswerDraft, q: Question): QuizResponseItem {
  const selected = Array.from(new Set((a.selectedAnswerIds ?? []).map((x) => String(x).toLowerCase().trim()))).filter(
    Boolean,
  ).sort();
  const correct = getCorrectAnswerIds(q);
  const isCorrect = arraysEqualSorted(selected, correct);
  const expl = a.studentExplanation?.trim() ?? "";
  const scored = scoreExplanationFull(expl, q.rationale, q.keywordsList);
  const item: Record<string, unknown> = {
    questionId: a.questionId,
    selectedAnswerId: selected.length ? selected.join(",") : "",
    isCorrect,
    explanationScore: scored.finalScore,
    matchedKeywords: scored.matchedKeywords,
    explanationTag: null,
  };
  if (selected.length) item.selectedAnswerIds = selected;
  if (expl) item.studentExplanation = expl;
  return item as unknown as QuizResponseItem;
}

function emptyResponseRow(questionId: string): QuizResponseItem {
  return {
    questionId,
    selectedAnswerId: "",
    isCorrect: false,
    explanationScore: 0,
    matchedKeywords: [],
    explanationTag: null,
  };
}

/**
 * Submit answers for a chunk (e.g. first 10) while keeping the session in progress, or finalize the full attempt.
 * Cumulative scoring: totals use full `questionIds` length; each chunk merges into `responses`.
 */
export async function submitQuizChunk(
  sessionId: string,
  chunkAnswers: QuizAnswerDraft[],
  options: { finalize: boolean },
): Promise<void> {
  const db = requireDb();
  const sessionRef = doc(db, COL_SESSIONS, sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) throw new Error("Quiz session not found");
  const session = snapToSession(sessionSnap.id, sessionSnap.data());
  if (session.status !== "in_progress") throw new Error("This quiz is no longer in progress.");
  const questionIds = session.questionIds?.length ? session.questionIds.map(String) : [];
  if (!questionIds.length) throw new Error("Question list not ready. Reload the quiz and try again.");

  const byId = new Map<string, QuizResponseItem>();
  for (const r of session.responses) {
    if (r?.questionId) byId.set(String(r.questionId), r);
  }

  for (const a of chunkAnswers) {
    const qSnap = await getDoc(doc(db, COL_QUESTIONS, a.questionId));
    if (!qSnap.exists()) continue;
    const q = snapToQuestion(qSnap.id, qSnap.data());
    byId.set(a.questionId, draftToResponseItem(a, q));
  }

  let ordered: QuizResponseItem[];
  if (options.finalize) {
    ordered = questionIds.map((id) => byId.get(id) ?? emptyResponseRow(id));
  } else {
    ordered = questionIds.map((id) => byId.get(id)).filter((x): x is QuizResponseItem => Boolean(x));
  }

  const totalQuestions = questionIds.length;
  /** Cumulative over the full quiz: unanswered questions count as not correct yet. */
  const totalCorrect = questionIds.reduce((acc, id) => {
    const r = byId.get(id);
    return acc + (r?.isCorrect === true ? 1 : 0);
  }, 0);
  const linearPercentScore = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  if (options.finalize) {
    await updateDoc(sessionRef, {
      responses: ordered,
      totalQuestions,
      totalCorrect,
      percentageScore: linearPercentScore,
      linearPercentScore,
      resultsReleasedToStudent: false,
      status: "submitted",
      submittedAt: serverTimestamp(),
    });
    return;
  }

  await updateDoc(sessionRef, {
    responses: ordered,
    totalQuestions,
    totalCorrect,
    percentageScore: linearPercentScore,
    linearPercentScore,
  });
}

/** Final submit: entire quiz, unanswered scored incorrect (legacy behaviour). */
export async function submitQuizSession(sessionId: string, answers: QuizAnswerDraft[]): Promise<void> {
  return submitQuizChunk(sessionId, answers, { finalize: true });
}

export async function requestSectionScore(sessionId: string, upToQuestionNumber: number): Promise<void> {
  const db = requireDb();
  const n = Math.max(1, Math.floor(Number(upToQuestionNumber) || 0));
  await updateDoc(doc(db, COL_SESSIONS, sessionId), {
    sectionScoreRequestedUpTo: n,
  });
}

export async function releaseSectionScore(sessionId: string): Promise<void> {
  const db = requireDb();
  const sessionRef = doc(db, COL_SESSIONS, sessionId);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) throw new Error("Quiz session not found");
  const s = snapToSession(snap.id, snap.data());
  if (s.status !== "in_progress") throw new Error("Section scores are only for in-progress quizzes.");
  const ids = s.questionIds?.length ? s.questionIds : [];
  const req = s.sectionScoreRequestedUpTo ?? 0;
  if (!ids.length || req <= 0) throw new Error("No section score requested.");
  const upTo = Math.min(req, ids.length);
  const byId = new Map((s.responses ?? []).map((r) => [String(r.questionId ?? ""), r] as const));
  let correct = 0;
  for (let i = 0; i < upTo; i++) {
    const r = byId.get(String(ids[i]));
    if (r?.isCorrect === true) correct++;
  }
  const pct = upTo ? Math.round((correct / upTo) * 100) : 0;
  await updateDoc(sessionRef, {
    sectionScoreReleasedUpTo: upTo,
    sectionLinearPercentScoreUpTo: pct,
  });
}

/**
 * Tutor/admin: apply CAT-style scoring and allow the student to see results.
 * Overwrites `percentageScore` with the CAT estimate; keeps `linearPercentScore` from submit.
 */
export async function conveyResultsToStudent(
  sessionId: string,
  opts?: { adminOutcome?: "pass" | "fail" | "borderline"; adminOutcomeNote?: string | null },
): Promise<void> {
  const db = requireDb();
  const sessionRef = doc(db, COL_SESSIONS, sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) throw new Error("Quiz session not found");
  const s = snapToSession(sessionSnap.id, sessionSnap.data());
  if (s.status !== "submitted" && s.status !== "reviewed") {
    throw new Error("Session must be submitted before conveying results");
  }
  if (s.resultsReleasedToStudent === true) return;
  // Legacy sessions had no flag; student already saw linear %. Only normalize the flag.
  if (s.resultsReleasedToStudent === undefined) {
    await updateDoc(sessionRef, {
      resultsReleasedToStudent: true,
      resultsReleasedAt: serverTimestamp(),
      ...(opts?.adminOutcome ? { adminOutcome: opts.adminOutcome } : {}),
      ...(opts?.adminOutcomeNote !== undefined ? { adminOutcomeNote: (opts.adminOutcomeNote ?? "").trim() || null } : {}),
      ...(opts?.adminOutcome ? { adminOutcomeSetAt: serverTimestamp() } : {}),
    });
    return;
  }
  const responses = Array.isArray(s.responses) ? s.responses : [];
  const items = responses.map((r) => ({
    questionId: String(r.questionId ?? ""),
    isCorrect: Boolean(r.isCorrect),
  }));
  const cat = computeCatScoreFromAttempt(items);
  await updateDoc(sessionRef, {
    percentageScore: cat.score0to100,
    catTheta: cat.theta,
    catStandardError: cat.standardError,
    resultsReleasedToStudent: true,
    resultsReleasedAt: serverTimestamp(),
    ...(opts?.adminOutcome ? { adminOutcome: opts.adminOutcome } : {}),
    ...(opts?.adminOutcomeNote !== undefined ? { adminOutcomeNote: (opts.adminOutcomeNote ?? "").trim() || null } : {}),
    ...(opts?.adminOutcome ? { adminOutcomeSetAt: serverTimestamp() } : {}),
  });
}

export function subscribeQuizSession(
  sessionId: string,
  cb: (session: QuizSession | null) => void,
): () => void {
  const db = requireDb();
  return onSnapshot(
    doc(db, COL_SESSIONS, sessionId),
    (snap) => {
      if (!snap.exists()) cb(null);
      else cb(snapToSession(snap.id, snap.data()));
    },
    () => {
      cb(null);
    },
  );
}

export async function getQuizSession(sessionId: string): Promise<QuizSession | null> {
  const db = requireDb();
  const snap = await getDoc(doc(db, COL_SESSIONS, sessionId));
  if (!snap.exists()) return null;
  return snapToSession(snap.id, snap.data());
}

export async function getStudentQuizzes(studentId: string): Promise<QuizSession[]> {
  const db = requireDb();
  const qy = query(collection(db, COL_SESSIONS), where("studentId", "==", studentId));
  const snaps = await getDocs(qy);
  const rows = snaps.docs.map((d) => snapToSession(d.id, d.data()));
  rows.sort((a, b) => {
    const ta = (a.submittedAt ?? a.startedAt)?.toMillis?.() ?? 0;
    const tb = (b.submittedAt ?? b.startedAt)?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return rows;
}

/** Admin/tutor: attach an existing attempt to a template so it shows as "Done" for that quiz. */
export async function linkSessionToTemplate(sessionId: string, templateId: string | null): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, COL_SESSIONS, sessionId), {
    templateId: templateId ? String(templateId) : null,
  });
}

export async function getAllStudentScores(tutorId: string): Promise<StudentScoreRow[]> {
  const db = requireDb();
  const qy = query(collection(db, COL_SESSIONS), where("tutorId", "==", tutorId));
  const snaps = await getDocs(qy);
  return snaps.docs.map((d) => {
    const s = snapToSession(d.id, d.data());
    return {
      sessionId: s.id,
      studentId: s.studentId,
      studentName: s.studentName,
      tutorId: s.tutorId,
      quizTitle: s.quizTitle,
      percentageScore: s.percentageScore,
      totalCorrect: s.totalCorrect,
      totalQuestions: s.totalQuestions,
      submittedAt: s.submittedAt,
      status: s.status,
      resultsReleasedToStudent: s.resultsReleasedToStudent,
      linearPercentScore: s.linearPercentScore,
    };
  });
}

/** Admin overview — all quiz sessions (may require Firestore composite index on `startedAt`). */
export async function listAllQuizSessions(): Promise<StudentScoreRow[]> {
  const db = requireDb();
  const qy = query(collection(db, COL_SESSIONS), orderBy("startedAt", "desc"));
  const snaps = await getDocs(qy);
  return snaps.docs.map((d) => {
    const s = snapToSession(d.id, d.data());
    return {
      sessionId: s.id,
      studentId: s.studentId,
      studentName: s.studentName,
      tutorId: s.tutorId,
      quizTitle: s.quizTitle,
      percentageScore: s.percentageScore,
      totalCorrect: s.totalCorrect,
      totalQuestions: s.totalQuestions,
      submittedAt: s.submittedAt,
      status: s.status,
      resultsReleasedToStudent: s.resultsReleasedToStudent,
      linearPercentScore: s.linearPercentScore,
    };
  });
}

export type AdminScoreNotification =
  | {
      kind: "final_results";
      sessionId: string;
      studentId: string;
      studentName: string;
      quizTitle?: string | null;
      submittedAt: Timestamp | null;
    }
  | {
      kind: "section_results";
      sessionId: string;
      studentId: string;
      studentName: string;
      quizTitle?: string | null;
      requestedUpTo: number;
      startedAt: Timestamp | null;
    };

function tsMillis(t: Timestamp | null | undefined): number {
  return t && typeof t.toMillis === "function" ? t.toMillis() : 0;
}

/** Admin/tutor: recent notifications when students request results/section results. */
export async function listAdminScoreNotifications(opts?: { limit?: number; scanLimit?: number }): Promise<AdminScoreNotification[]> {
  const db = requireDb();
  const scan = Math.max(50, Math.min(500, Number(opts?.scanLimit ?? 200)));
  const take = Math.max(1, Math.min(50, Number(opts?.limit ?? 15)));
  const qy = query(collection(db, COL_SESSIONS), orderBy("startedAt", "desc"), limit(scan));
  const snaps = await getDocs(qy);
  const sessions = snaps.docs.map((d) => snapToSession(d.id, d.data()));
  const out: AdminScoreNotification[] = [];
  for (const s of sessions) {
    if (s.status === "submitted" || s.status === "reviewed") {
      if (s.resultsReleasedToStudent === false) {
        out.push({
          kind: "final_results",
          sessionId: s.id,
          studentId: s.studentId,
          studentName: s.studentName,
          quizTitle: s.quizTitle,
          submittedAt: s.submittedAt ?? null,
        });
      }
    } else if (s.status === "in_progress") {
      if (hasPendingSectionScoreRequest(s)) {
        out.push({
          kind: "section_results",
          sessionId: s.id,
          studentId: s.studentId,
          studentName: s.studentName,
          quizTitle: s.quizTitle,
          requestedUpTo: s.sectionScoreRequestedUpTo ?? 0,
          startedAt: s.startedAt ?? null,
        });
      }
    }
    if (out.length >= take) break;
  }
  out.sort((a, b) => {
    const ta = a.kind === "final_results" ? tsMillis(a.submittedAt) : tsMillis(a.startedAt);
    const tb = b.kind === "final_results" ? tsMillis(b.submittedAt) : tsMillis(b.startedAt);
    return tb - ta;
  });
  return out.slice(0, take);
}

function snapToAdminNotification(id: string, data: DocumentData): AdminNotification {
  const typeRaw = String(data.type ?? "");
  const type = typeRaw === "section_results" ? "section_results" : "final_results";
  const statusRaw = String(data.status ?? "");
  const status = statusRaw === "resolved" ? "resolved" : "open";
  const requestedUpTo = data.requestedUpTo != null ? Number(data.requestedUpTo) : null;
  const read = Boolean(data.read ?? false);
  return {
    id,
    type,
    status,
    read,
    readAt: data.readAt ?? null,
    createdAt: data.createdAt ?? null,
    resolvedAt: data.resolvedAt ?? null,
    sessionId: String(data.sessionId ?? ""),
    studentId: String(data.studentId ?? ""),
    studentName: String(data.studentName ?? ""),
    quizTitle: typeof data.quizTitle === "string" ? data.quizTitle : null,
    requestedUpTo: requestedUpTo && requestedUpTo > 0 ? requestedUpTo : null,
  };
}

export async function listAdminNotifications(opts?: {
  limit?: number;
  status?: "open" | "resolved" | "all";
  unreadOnly?: boolean;
}): Promise<AdminNotification[]> {
  const db = requireDb();
  const take = Math.max(1, Math.min(50, Number(opts?.limit ?? 20)));
  const status = opts?.status ?? "open";
  const unreadOnly = Boolean(opts?.unreadOnly);
  const col = collection(db, "adminNotifications");
  const clauses: any[] = [];
  if (status !== "all") clauses.push(where("status", "==", status));
  if (unreadOnly) clauses.push(where("read", "==", false));
  clauses.push(orderBy("createdAt", "desc"), limit(take));
  const qy = query(col, ...clauses);
  const snaps = await getDocs(qy);
  return snaps.docs.map((d) => snapToAdminNotification(d.id, d.data()));
}

export async function markAdminNotificationRead(id: string): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, "adminNotifications", id), {
    read: true,
    readAt: serverTimestamp(),
  });
}

/** Keyword-only score (0–100) for quick checks. */
export async function scoreExplanation(explanation: string, keywords: string[]): Promise<number> {
  return calculateExplanationScore(explanation, keywords).score;
}

export async function overrideExplanationScore(
  sessionId: string,
  responseIndex: number,
  score: number,
  notes: string,
): Promise<void> {
  const db = requireDb();
  const sessionRef = doc(db, COL_SESSIONS, sessionId);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) throw new Error("Session not found");
  const data = snap.data();
  const responses = [...(Array.isArray(data.responses) ? data.responses : [])];
  const row = responses[responseIndex];
  if (!row) throw new Error("Invalid response index");
  responses[responseIndex] = {
    ...row,
    adminOverrideScore: score,
    adminNotes: notes,
  };
  await updateDoc(sessionRef, { responses });
}

export async function tagExplanation(
  sessionId: string,
  responseIndex: number,
  tag: "acceptable" | "not acceptable",
): Promise<void> {
  const db = requireDb();
  const sessionRef = doc(db, COL_SESSIONS, sessionId);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) throw new Error("Session not found");
  const data = snap.data();
  const responses = [...(Array.isArray(data.responses) ? data.responses : [])];
  const row = responses[responseIndex];
  if (!row) throw new Error("Invalid response index");
  responses[responseIndex] = { ...row, explanationTag: tag };
  await updateDoc(sessionRef, { responses, status: "reviewed" });
}

export async function extractKeywordsFromRationale(rationale: string): Promise<string[]> {
  return extractKeywords(rationale);
}

/** Questions matching category, optional student NCLEX track, and optional template exam tag. */
export async function filterQuestionsForQuizPool(args: {
  filterCategory: string | null | undefined;
  studentTrack?: NursingTrack | null;
  templateExam?: NclexExamType | null;
  tutorScope?: { isAdmin: boolean; tutorUid: string };
}): Promise<Question[]> {
  const all = await listQuestions(args.tutorScope?.isAdmin ? undefined : args.tutorScope?.tutorUid);
  const f = args.filterCategory?.trim().toLowerCase();
  let rows = f
    ? all.filter((q) => (q.category?.trim() || "General").toLowerCase() === f)
    : all;
  if (args.studentTrack) {
    rows = rows.filter((q) => questionMatchesStudentTrack(q.examType, args.studentTrack));
  }
  if (args.templateExam != null) {
    rows = rows.filter((q) => questionMatchesTemplatePool(q.examType, args.templateExam));
  }
  return rows;
}

/** Match questions tagged with NCLEX blueprint fields (or “General” bucket). */
export function questionMatchesNclexBlueprintFilter(
  q: Question,
  blueprint: { nclexCategory: string; nclexTopic: string; nclexSubtopic: string; isGeneral: boolean },
): boolean {
  if (blueprint.isGeneral) return q.isGeneral === true;
  const cat = blueprint.nclexCategory.trim();
  const top = blueprint.nclexTopic.trim();
  const sub = blueprint.nclexSubtopic.trim();
  if (cat && (q.nclexCategory ?? "").trim() !== cat) return false;
  if (top && (q.nclexTopic ?? "").trim() !== top) return false;
  if (sub && (q.nclexSubtopic ?? "").trim() !== sub) return false;
  return true;
}

/** Distinct question-bank categories (test banks) for questions matching a blueprint slice. */
export async function listBankCategoryCountsForBlueprint(args: {
  nclexCategory: string;
  nclexTopic: string;
  nclexSubtopic: string;
  isGeneral: boolean;
  templateExam: NclexExamType | null;
  tutorUid: string;
  isAdmin: boolean;
}): Promise<{ category: string; count: number }[]> {
  const all = await listQuestions(args.isAdmin ? undefined : args.tutorUid);
  let rows = all.filter((q) => q.isActive);
  rows = rows.filter((q) =>
    questionMatchesNclexBlueprintFilter(q, {
      nclexCategory: args.nclexCategory,
      nclexTopic: args.nclexTopic,
      nclexSubtopic: args.nclexSubtopic,
      isGeneral: args.isGeneral,
    }),
  );
  if (args.templateExam != null) {
    rows = rows.filter((q) => questionMatchesTemplatePool(q.examType, args.templateExam));
  }
  const map = new Map<string, number>();
  for (const q of rows) {
    const c = (q.category ?? "").trim() || "General";
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/** Questions in one bank category that also match the blueprint filter. */
export async function listBankQuestionsForCategoryAndBlueprint(args: {
  nclexCategory: string;
  nclexTopic: string;
  nclexSubtopic: string;
  isGeneral: boolean;
  filterCategory: string;
  templateExam: NclexExamType | null;
  tutorUid: string;
  isAdmin: boolean;
}): Promise<Question[]> {
  const catNorm = args.filterCategory.trim().toLowerCase();
  const all = await listQuestions(args.isAdmin ? undefined : args.tutorUid);
  return all.filter((q) => {
    if (!q.isActive) return false;
    if (!questionMatchesNclexBlueprintFilter(q, {
      nclexCategory: args.nclexCategory,
      nclexTopic: args.nclexTopic,
      nclexSubtopic: args.nclexSubtopic,
      isGeneral: args.isGeneral,
    })) {
      return false;
    }
    if (args.templateExam != null && !questionMatchesTemplatePool(q.examType, args.templateExam)) return false;
    return (q.category ?? "").trim().toLowerCase() === catNorm;
  });
}

/** Active questions for quiz UI (strip sensitive fields before render). */
export async function listStudentQuizQuestions(
  filterCategory?: string | null,
  opts?: { studentTrack?: NursingTrack | null; templateExam?: NclexExamType | null },
): Promise<StudentQuestion[]> {
  const filtered = await filterQuestionsForQuizPool({
    filterCategory,
    studentTrack: opts?.studentTrack ?? null,
    templateExam: opts?.templateExam ?? null,
  });
  return filtered.map(toStudentQuestion);
}

export async function listStudentQuestionsByIds(questionIds: string[]): Promise<StudentQuestion[]> {
  const db = requireDb();
  const ids = questionIds.map(String).filter(Boolean);
  if (!ids.length) return [];
  const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, COL_QUESTIONS, id))));
  const qs = snaps.filter((s) => s.exists()).map((s) => snapToQuestion(s.id, s.data()));
  const byId = new Map(qs.map((q) => [q.id, toStudentQuestion(q)] as const));
  return ids.map((id) => byId.get(id)).filter(Boolean) as StudentQuestion[];
}

export async function listQuestionsByIds(questionIds: string[]): Promise<Question[]> {
  const db = requireDb();
  const ids = questionIds.map(String).filter(Boolean);
  if (!ids.length) return [];
  const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, COL_QUESTIONS, id))));
  const qs = snaps.filter((s) => s.exists()).map((s) => snapToQuestion(s.id, s.data()));
  const byId = new Map(qs.map((q) => [q.id, q] as const));
  return ids.map((id) => byId.get(id)).filter(Boolean) as Question[];
}

/** Category label + count for quiz picker cards. */
export async function getQuestionCategorySummaries(): Promise<{ category: string; count: number }[]> {
  const qs = await listQuestions();
  const map = new Map<string, number>();
  for (const q of qs) {
    const c = q.category?.trim() || "General";
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  const rows = Array.from(map.entries()).map(([category, count]) => ({ category, count }));
  rows.sort((a, b) => b.count - a.count);
  return rows;
}

export function summarizeStudentProgress(sessions: QuizSession[]): {
  totalQuizzes: number;
  averageScore: number;
  lastAttemptLabel: string;
} {
  const done = sessions.filter((s) => (s.status === "submitted" || s.status === "reviewed") && (s.templateId ?? "").trim());

  // Only count the *first* released attempt per quiz template toward the main progress summary.
  // A later reattempt is still visible in history, but should not overwrite the main score.
  const firstReleasedByTemplate = new Map<string, QuizSession>();
  for (const s of done) {
    const tid = String(s.templateId ?? "").trim();
    if (!tid) continue;
    if (!areQuizResultsReleasedToStudent(s) || (s.totalQuestions ?? 0) <= 0) continue;
    const existing = firstReleasedByTemplate.get(tid) ?? null;
    if (!existing) {
      firstReleasedByTemplate.set(tid, s);
      continue;
    }
    const te = tsMillis(existing.startedAt ?? existing.submittedAt);
    const ts = tsMillis(s.startedAt ?? s.submittedAt);
    if (te === 0 || (ts > 0 && ts < te)) firstReleasedByTemplate.set(tid, s);
  }

  const scored = Array.from(firstReleasedByTemplate.values());
  const totalQuizzes = scored.length;
  const averageScore = scored.length
    ? Math.round(scored.reduce((a, s) => a + (Number(s.percentageScore) || 0), 0) / scored.length)
    : 0;

  // "Last quiz" is still based on the student's most recent submission across all attempts.
  const sorted = [...done].sort((a, b) => tsMillis(b.submittedAt) - tsMillis(a.submittedAt));
  const last = sorted[0]?.submittedAt;
  let lastAttemptLabel = "—";
  if (last && typeof last.toDate === "function") {
    const d = last.toDate();
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / (86400000));
    if (days <= 0) lastAttemptLabel = "Today";
    else if (days === 1) lastAttemptLabel = "1 day ago";
    else lastAttemptLabel = `${days} days ago`;
  }
  return { totalQuizzes, averageScore, lastAttemptLabel };
}

export async function getTutorDashboardSnapshot(opts: {
  isAdmin: boolean;
  tutorUid: string;
}): Promise<{
  questionCount: number;
  activeStudents: number;
  pendingReviews: number;
  totalAttempts: number;
  averageClassScore: number;
  recentSubmissions: StudentScoreRow[];
}> {
  const questions = await listQuestions(opts.isAdmin ? undefined : opts.tutorUid);
  const sessionsRaw = await listAllQuizSessions();
  const sessions = sessionsRaw.filter(
    (r) => opts.isAdmin || r.tutorId === opts.tutorUid || r.tutorId === "" || !r.tutorId,
  );
  const submitted = sessions.filter((s) => s.status === "submitted" || s.status === "reviewed");
  const pendingReviews = sessions.filter(
    (s) => s.status === "submitted" && !areQuizResultsReleasedToStudent({ resultsReleasedToStudent: s.resultsReleasedToStudent }),
  ).length;
  const students = new Set(sessions.map((s) => s.studentId));
  const totalAttempts = submitted.length;
  const releasedWithScore = submitted.filter((s) => areQuizResultsReleasedToStudent({ resultsReleasedToStudent: s.resultsReleasedToStudent }) && s.totalQuestions > 0);
  const averageClassScore = releasedWithScore.length
    ? Math.round(releasedWithScore.reduce((a, s) => a + s.percentageScore, 0) / releasedWithScore.length)
    : 0;
  const recentSubmissions = [...sessions]
    .sort((a, b) => tsMillis(b.submittedAt) - tsMillis(a.submittedAt) || b.sessionId.localeCompare(a.sessionId))
    .slice(0, 8);
  return {
    questionCount: questions.length,
    activeStudents: students.size,
    pendingReviews,
    totalAttempts,
    averageClassScore,
    recentSubmissions,
  };
}

export type StudentPerformanceRow = {
  studentId: string;
  studentName: string;
  attempts: number;
  averageScore: number;
  lastSubmitted: Timestamp | null;
};

export async function getStudentPerformanceAggregates(): Promise<StudentPerformanceRow[]> {
  const sessions = await listAllQuizSessions();
  const done = sessions.filter((s) => s.status === "submitted" || s.status === "reviewed");
  const byStudent = new Map<string, { name: string; scores: number[]; last: Timestamp | null }>();
  for (const s of done) {
    const cur = byStudent.get(s.studentId) ?? { name: s.studentName, scores: [], last: null };
    const t = s.submittedAt;
    if (t && (!cur.last || tsMillis(t) > tsMillis(cur.last))) cur.last = t;
    cur.name = s.studentName || cur.name;
    if (areQuizResultsReleasedToStudent({ resultsReleasedToStudent: s.resultsReleasedToStudent }) && s.totalQuestions) {
      cur.scores.push(s.percentageScore);
    }
    byStudent.set(s.studentId, cur);
  }
  return Array.from(byStudent.entries()).map(([studentId, v]) => ({
    studentId,
    studentName: v.name,
    attempts: v.scores.length,
    averageScore: v.scores.length ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : 0,
    lastSubmitted: v.last,
  }));
}

function snapToStudentNotification(id: string, data: DocumentData): StudentNotification {
  const options = Array.isArray(data.options) ? (data.options as QuestionOption[]) : [];
  const noteRaw = data.noteBody;
  const noteBody =
    typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : undefined;
  return {
    id,
    studentId: String(data.studentId ?? ""),
    studentEmail: typeof data.studentEmail === "string" && data.studentEmail.trim() ? data.studentEmail.trim() : undefined,
    createdBy: String(data.createdBy ?? ""),
    createdAt: data.createdAt ?? null,
    read: Boolean(data.read),
    readAt: data.readAt ?? null,
    title: String(data.title ?? ""),
    noteBody,
    questionText: String(data.questionText ?? ""),
    options,
    explanationsText: String(data.explanationsText ?? ""),
  };
}

export type StudentNotificationInput = {
  studentId: string;
  studentEmail?: string;
  title: string;
  /** Plain text only, or combined with a question block. */
  noteBody?: string;
  questionText: string;
  options: QuestionOption[];
  explanationsText: string;
};

export async function createStudentNotification(input: StudentNotificationInput, adminUid: string): Promise<string> {
  const db = requireDb();
  const noteTrim = input.noteBody?.trim() ?? "";
  const payload: Record<string, unknown> = {
    studentId: input.studentId,
    studentEmail: input.studentEmail?.trim() || null,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    read: false,
    title: input.title.trim() || "Message from your instructor",
    questionText: input.questionText.trim(),
    options: input.options,
    explanationsText: input.explanationsText.trim(),
  };
  if (noteTrim) payload.noteBody = noteTrim;
  const ref = await addDoc(collection(db, COL_STUDENT_NOTIFICATIONS), payload);
  return ref.id;
}

export async function listStudentNotifications(studentId: string): Promise<StudentNotification[]> {
  const db = requireDb();
  const qy = query(collection(db, COL_STUDENT_NOTIFICATIONS), where("studentId", "==", studentId));
  const snaps = await getDocs(qy);
  const rows = snaps.docs.map((d) => snapToStudentNotification(d.id, d.data()));
  rows.sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
  return rows;
}

export function subscribeStudentNotifications(
  studentId: string,
  callback: (rows: StudentNotification[]) => void,
): () => void {
  const db = tryGetFirestoreDb();
  if (!db) return () => {};
  const qy = query(collection(db, COL_STUDENT_NOTIFICATIONS), where("studentId", "==", studentId));
  return onSnapshot(
    qy,
    (snap) => {
      const rows = snap.docs.map((d) => snapToStudentNotification(d.id, d.data()));
      rows.sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
      callback(rows);
    },
    () => {
      callback([]);
    },
  );
}

export async function markStudentNotificationRead(notificationId: string): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, COL_STUDENT_NOTIFICATIONS, notificationId), {
    read: true,
    readAt: serverTimestamp(),
  });
}
