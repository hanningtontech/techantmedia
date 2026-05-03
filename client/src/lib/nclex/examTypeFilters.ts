import type { NclexExamType } from "@/lib/firestore/nclexTypes";
import type { NursingTrack } from "@/lib/userTypes";

export function parseNclexExamType(raw: unknown): NclexExamType | null {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "rn" || s === "pn" || s === "both") return s;
  return null;
}

/** Student home / RAT: question is usable for this track. Legacy (null) and `both` = all tracks. */
export function questionMatchesStudentTrack(
  questionExam: NclexExamType | null | undefined,
  studentTrack: NursingTrack | null | undefined,
): boolean {
  if (!studentTrack) return true;
  if (questionExam == null || questionExam === "both") return true;
  return questionExam === studentTrack;
}

/** Assigned quiz template visible to student on this track. Legacy templates (null) and `both` = everyone. */
export function templateVisibleToStudent(
  templateExam: NclexExamType | null | undefined,
  studentTrack: NursingTrack | null | undefined,
): boolean {
  if (!studentTrack) return false;
  if (templateExam == null || templateExam === "both") return true;
  return templateExam === studentTrack;
}

/** Question pool for a template: which questions qualify. */
export function questionMatchesTemplatePool(
  questionExam: NclexExamType | null | undefined,
  templateExam: NclexExamType | null | undefined,
): boolean {
  if (templateExam == null) return true;
  if (templateExam === "both") {
    return questionExam == null || questionExam === "both" || questionExam === "rn" || questionExam === "pn";
  }
  if (questionExam == null || questionExam === "both") return true;
  return questionExam === templateExam;
}

/** Tutor library: template was created for this admin session track. Legacy = show under any admin track. */
export function templateMatchesAdminSession(
  templateExam: NclexExamType | null | undefined,
  adminTrack: NursingTrack | null | undefined,
): boolean {
  if (!adminTrack) return true;
  if (templateExam == null || templateExam === "both") return true;
  return templateExam === adminTrack;
}

export function noteMatchesStudentTrack(
  noteExam: NclexExamType | null | undefined,
  studentTrack: NursingTrack | null | undefined,
): boolean {
  return questionMatchesStudentTrack(noteExam, studentTrack);
}
