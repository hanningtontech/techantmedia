import type { Timestamp } from "firebase/firestore";

export type UserRole = "tutor" | "student" | "admin";

export type QuizSessionStatus = "in_progress" | "submitted" | "reviewed";

export type ExplanationTag = "acceptable" | "not acceptable" | null;

export interface QuestionOption {
  id: string;
  text: string;
}

/** Firestore document in `questions/{questionId}` */
export interface Question {
  id: string;
  title: string;
  questionText: string;
  /** Optional sub-label (e.g. NCLEX topic) for tutor views and search. */
  topic?: string;
  options: QuestionOption[];
  correctAnswerId: string;
  /** For SATA: all correct option ids (lowercase). When absent, use `correctAnswerId` only. */
  correctAnswerIds?: string[];
  /** Tutor override: allow multi-select even without SATA phrasing in the stem. */
  allowMultipleAnswers?: boolean;
  rationale: string;
  keywordsList: string[];
  category: string;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  isActive: boolean;
}

/** Student-safe projection (omit correct answer + rationale in UI; still rely on rules for real secrecy). */
export interface StudentQuestion {
  id: string;
  title: string;
  questionText: string;
  options: QuestionOption[];
  category: string;
  topic?: string;
  /** When true, student may select more than one checkbox. */
  allowMultipleAnswers: boolean;
}

export interface QuizResponseItem {
  questionId: string;
  /** Legacy: single letter, or comma-separated for SATA (e.g. "a,c"). */
  selectedAnswerId: string;
  /** Canonical ordered ids when SATA; optional for older sessions. */
  selectedAnswerIds?: string[];
  isCorrect: boolean;
  studentExplanation?: string;
  explanationScore: number;
  matchedKeywords: string[];
  adminOverrideScore?: number;
  adminNotes?: string;
  explanationTag: ExplanationTag;
}

/** Firestore document in `quizTemplates/{id}` — curated quizzes shown on the student home. */
export interface QuizTemplate {
  id: string;
  title: string;
  description: string;
  /** When null, all active questions are eligible (subject to questionLimit). */
  filterCategory: string | null;
  /** Max questions in the attempt; 0 means no cap (all matching questions). */
  questionLimit: number;
  /** Optional fixed duration hint (minutes); when null, UI estimates from question count. */
  estimatedMinutes: number | null;
  sortOrder: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface QuizTemplateInput {
  title: string;
  description?: string;
  filterCategory?: string | null;
  questionLimit?: number;
  estimatedMinutes?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

/** Firestore document in `quizSessions/{sessionId}` */
export interface QuizSession {
  id: string;
  studentId: string;
  studentName: string;
  tutorId: string;
  /** When set, this attempt was launched from a curated quiz template. */
  templateId?: string | null;
  /** When set, quiz only includes questions in this category (label match). */
  filterCategory?: string | null;
  /** Display name for the quiz attempt (e.g. "Pharmacology"). */
  quizTitle?: string | null;
  /** When set, only this many questions (first N after filter) are included in the attempt. */
  questionLimit?: number | null;
  startedAt: Timestamp | null;
  submittedAt: Timestamp | null;
  /** Locked order of question ids for this attempt (set on first load); enables partial chunk submits. */
  questionIds?: string[];
  totalQuestions: number;
  totalCorrect: number;
  /** Primary score shown to students after release (CAT-style). Tutor may see linear until convey. */
  percentageScore: number;
  status: QuizSessionStatus;
  responses: QuizResponseItem[];
  /**
   * When `false`, the student UI waits for tutor release. Legacy docs without this field are treated as released.
   */
  resultsReleasedToStudent?: boolean;
  resultsReleasedAt?: Timestamp | null;
  /** Classical percent correct at submit (0–100), kept for tutor reference. */
  linearPercentScore?: number;
  /** Final ability estimate when CAT score is applied. */
  catTheta?: number | null;
  catStandardError?: number | null;
  /** Student request: show section score up to question N (in order). */
  sectionScoreRequestedUpTo?: number;
  /** Tutor release: section score up to question N (in order). */
  sectionScoreReleasedUpTo?: number;
  /** Tutor released section linear % (0–100) for `sectionScoreReleasedUpTo`. */
  sectionLinearPercentScoreUpTo?: number;
  /** Admin/tutor-assigned outcome label shown to the student. */
  adminOutcome?: "pass" | "fail" | "borderline";
  /** Admin note explaining the outcome (student-visible). */
  adminOutcomeNote?: string | null;
  adminOutcomeSetAt?: Timestamp | null;
}

/** Firestore document in `quizAssignments/{id}` (id typically `${studentId}_${templateId}`) */
export interface QuizAssignment {
  id: string;
  studentId: string;
  templateId: string;
  assignedBy: string;
  assignedAt: Timestamp | null;
  isActive: boolean;
}

/** Admin-authored teaching note for a student (not part of scored quizzes). Stored in `studentNotifications/{id}`. */
export interface StudentNotification {
  id: string;
  studentId: string;
  studentEmail?: string;
  createdBy: string;
  createdAt: Timestamp | null;
  read: boolean;
  readAt: Timestamp | null;
  title: string;
  /** Optional plain message (with or without a question block below). */
  noteBody?: string;
  questionText: string;
  options: QuestionOption[];
  explanationsText: string;
}

export type AdminNotificationStatus = "open" | "resolved";

export type AdminNotificationType = "final_results" | "section_results";

/** Cloud Function-authored admin queue item stored in `adminNotifications/{id}`. */
export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  status: AdminNotificationStatus;
  read: boolean;
  readAt: Timestamp | null;
  createdAt: Timestamp | null;
  resolvedAt: Timestamp | null;
  sessionId: string;
  studentId: string;
  studentName: string;
  quizTitle?: string | null;
  requestedUpTo?: number | null;
}

export interface QuestionInput {
  title: string;
  questionText: string;
  options: QuestionOption[];
  correctAnswerId: string;
  /** Use `null` on update to clear multi-select answers and store single-key only. */
  correctAnswerIds?: string[] | null;
  allowMultipleAnswers?: boolean;
  rationale: string;
  keywordsList?: string[];
  category?: string;
  topic?: string;
  isActive?: boolean;
  /**
   * Stored under `questions/{id}/adminOnly/default` (not on the question root).
   * Readable by admins only; tutors may set via create/import/update.
   */
  whyOthersIncorrect?: string | null;
}

/** Admin-only supplement document (Firestore `questions/{id}/adminOnly/default`). */
export interface QuestionAdminOnly {
  whyOthersIncorrect: string;
}

export interface StudentScoreRow {
  sessionId: string;
  studentId: string;
  studentName: string;
  tutorId?: string;
  quizTitle?: string | null;
  percentageScore: number;
  totalCorrect: number;
  totalQuestions: number;
  submittedAt: Timestamp | null;
  status: QuizSessionStatus;
  /** Mirrors session: when false, student has not received scores yet. */
  resultsReleasedToStudent?: boolean;
  linearPercentScore?: number;
}

export type RatSessionStatus = "in_progress" | "submitted";

export interface RatResponseItem {
  questionId: string;
  selectedAnswerIds: string[];
  isCorrect: boolean;
}

/** Firestore document in `ratSessions/{ratId}` */
export interface RatSession {
  id: string;
  studentId: string;
  studentName: string;
  createdAt: Timestamp | null;
  startedAt: Timestamp | null;
  submittedAt: Timestamp | null;
  /** Client timestamp for reliable countdown. */
  endsAtMs: number;
  questionCount: number;
  durationSeconds: number;
  status: RatSessionStatus;
  questionIds: string[];
  responses: RatResponseItem[];
  totalQuestions: number;
  totalCorrect: number;
  percentageScore: number;
}

export interface RatStats {
  count: number;
  sumScore: number;
  meanScore: number;
  /** Client timestamp for cooldown checks. */
  lastRatStartedAtMs: number;
  lastRatStartedAt: Timestamp | null;
}
