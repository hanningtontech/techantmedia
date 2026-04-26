import type { UserRole } from "@/lib/firestore/nclexTypes";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type NursingTrack = "rn" | "pn";

export type AccountStatus = "active" | "disabled" | "disqualified";

/** Intake answers shown to admins when reviewing access. */
export interface IntakeQuestionnaire {
  educationLevel: string;
  examPreparing: string;
  interestedCategories: string[]; // multi-select
  comfortableTopics: string[]; // multi-select
  challengingTopics: string[]; // multi-select
  coachingGoals: string;
  /** Optional: student's current school/university. */
  schoolName?: string;
  /** Optional: student's phone number. */
  phoneNumber?: string;
}

export interface UserListRow {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  approvalStatus?: ApprovalStatus;
  intakeQuestionnaire?: IntakeQuestionnaire | null;
  nursingTrack?: NursingTrack | null;
  accountStatus?: AccountStatus;
  adminStats?: {
    averageScoreReleased?: number;
    releasedScoreCount?: number;
    activeAssignments?: number;
    lastSubmittedAt?: unknown;
  } | null;
  ratStats?: {
    count?: number;
    meanScore?: number;
    lastRatStartedAtMs?: number;
    lastRatStartedAt?: unknown;
  } | null;
}
