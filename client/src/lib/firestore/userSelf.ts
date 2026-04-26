import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { tryGetFirestoreDb } from "@/lib/firebase";
import type { IntakeQuestionnaire, NursingTrack } from "@/lib/userTypes";

const USERS = "users";

function requireDb() {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firestore is not configured.");
  return db;
}

export async function updateMyProfile(uid: string, data: { name?: string | null; nursingTrack?: NursingTrack | null }): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, USERS, uid), {
    ...(data.name !== undefined ? { name: (data.name ?? "").trim() } : {}),
    ...(data.nursingTrack !== undefined ? { nursingTrack: data.nursingTrack } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function updateMyIntakeQuestionnaire(uid: string, intake: IntakeQuestionnaire): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, USERS, uid), {
    intakeQuestionnaire: {
      educationLevel: intake.educationLevel.trim(),
      examPreparing: intake.examPreparing.trim(),
      interestedCategories: intake.interestedCategories,
      comfortableTopics: intake.comfortableTopics,
      challengingTopics: intake.challengingTopics,
      coachingGoals: intake.coachingGoals.trim(),
      schoolName: (intake.schoolName ?? "").trim(),
      phoneNumber: (intake.phoneNumber ?? "").trim(),
      completedAt: serverTimestamp(),
    },
  });
}

