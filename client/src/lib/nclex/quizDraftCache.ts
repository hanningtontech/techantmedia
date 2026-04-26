import type { QuizSession, StudentQuestion } from "@/lib/firestore/nclexTypes";

const STORAGE_PREFIX = "nclexQuizDraft";
/** Bump when snapshot shape changes so stale localStorage cannot blank the quiz UI. */
export const QUIZ_DRAFT_CACHE_VERSION = 2 as const;
const CACHE_VERSION = QUIZ_DRAFT_CACHE_VERSION;

export type QuizDraftAnswers = Record<string, { selectedAnswerIds: string[]; studentExplanation: string }>;

export type QuizDraftSnapshot = {
  v: typeof CACHE_VERSION;
  sessionId: string;
  studentId: string;
  savedAt: number;
  idx: number;
  answers: QuizDraftAnswers;
  questions: StudentQuestion[];
  meta: {
    quizTitle?: string | null;
    filterCategory?: string | null;
    questionLimit?: number | null;
  };
};

export function quizDraftStorageKey(studentId: string, sessionId: string): string {
  return `${STORAGE_PREFIX}:v${CACHE_VERSION}:${studentId}:${sessionId}`;
}

function isStudentQuestion(x: unknown): x is StudentQuestion {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.questionText === "string" &&
    Array.isArray(o.options) &&
    typeof o.category === "string" &&
    typeof o.allowMultipleAnswers === "boolean"
  );
}

function isDraftAnswers(x: unknown): x is QuizDraftAnswers {
  if (!x || typeof x !== "object") return false;
  for (const v of Object.values(x)) {
    if (!v || typeof v !== "object") return false;
    const row = v as Record<string, unknown>;
    if (!Array.isArray(row.selectedAnswerIds) || typeof row.studentExplanation !== "string") return false;
    if (!row.selectedAnswerIds.every((id) => typeof id === "string")) return false;
  }
  return true;
}

export function readQuizDraftCache(studentId: string, sessionId: string): QuizDraftSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(quizDraftStorageKey(studentId, sessionId));
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    if (rec.v !== CACHE_VERSION || rec.sessionId !== sessionId || rec.studentId !== studentId) return null;
    if (typeof rec.idx !== "number" || !Array.isArray(rec.questions) || !rec.meta || typeof rec.meta !== "object")
      return null;
    if (!isDraftAnswers(rec.answers)) return null;
    if (!rec.questions.every(isStudentQuestion)) return null;
    return {
      v: CACHE_VERSION,
      sessionId,
      studentId,
      savedAt: typeof rec.savedAt === "number" ? rec.savedAt : 0,
      idx: rec.idx,
      answers: rec.answers,
      questions: rec.questions as StudentQuestion[],
      meta: rec.meta as QuizDraftSnapshot["meta"],
    };
  } catch {
    return null;
  }
}

export function writeQuizDraftCache(snapshot: QuizDraftSnapshot): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(quizDraftStorageKey(snapshot.studentId, snapshot.sessionId), JSON.stringify(snapshot));
  } catch {
    // Quota exceeded or private mode — ignore
  }
}

export function clearQuizDraftCache(studentId: string, sessionId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(quizDraftStorageKey(studentId, sessionId));
  } catch {
    /* ignore */
  }
}

/** Minimal `QuizSession` for UI when resuming from local cache only (offline). */
export function placeholderSessionFromCache(
  sessionId: string,
  studentId: string,
  studentName: string,
  meta: QuizDraftSnapshot["meta"],
  questionCount: number,
): QuizSession {
  return {
    id: sessionId,
    studentId,
    studentName,
    tutorId: "",
    filterCategory: meta.filterCategory ?? null,
    quizTitle: meta.quizTitle ?? null,
    questionLimit: meta.questionLimit ?? null,
    startedAt: null,
    submittedAt: null,
    totalQuestions: questionCount,
    totalCorrect: 0,
    percentageScore: 0,
    status: "in_progress",
    responses: [],
  };
}
