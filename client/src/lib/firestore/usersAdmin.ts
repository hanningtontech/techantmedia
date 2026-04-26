import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from "firebase/firestore";
import { tryGetFirestoreDb } from "@/lib/firebase";
import type { UserRole } from "@/lib/firestore/nclexTypes";
import type { AccountStatus, ApprovalStatus, IntakeQuestionnaire, NursingTrack, UserListRow } from "@/lib/userTypes";

const COL = "users";

function requireDb() {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firestore is not configured.");
  return db;
}

function parseIntake(raw: unknown): IntakeQuestionnaire | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const strArr = (k: string) => {
    const v = o[k];
    if (Array.isArray(v)) return v.map((x) => String(x)).map((x) => x.trim()).filter(Boolean);
    if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean);
    return [];
  };
  const row: IntakeQuestionnaire = {
    educationLevel: str("educationLevel"),
    examPreparing: str("examPreparing"),
    interestedCategories: strArr("interestedCategories"),
    comfortableTopics: strArr("comfortableTopics"),
    challengingTopics: strArr("challengingTopics"),
    coachingGoals: str("coachingGoals"),
    schoolName: str("schoolName"),
    phoneNumber: str("phoneNumber"),
  };
  const hasAny =
    row.educationLevel.trim() ||
    row.examPreparing.trim() ||
    row.interestedCategories.length ||
    row.comfortableTopics.length ||
    row.challengingTopics.length ||
    row.coachingGoals.trim() ||
    (row.schoolName ?? "").trim() ||
    (row.phoneNumber ?? "").trim();
  return hasAny ? row : null;
}

export async function listUsersForAdmin(): Promise<UserListRow[]> {
  const db = requireDb();
  const snaps = await getDocs(collection(db, COL));
  const rows: UserListRow[] = snaps.docs.map((d) => {
    const x = d.data();
    const role = (x.role as UserRole) ?? "student";
    const as = x.approvalStatus as ApprovalStatus | undefined;
    const rawTrack = x.nursingTrack;
    const nursingTrack: NursingTrack | null = rawTrack === "rn" || rawTrack === "pn" ? rawTrack : null;
    const rawStatus = x.accountStatus;
    const accountStatus: AccountStatus =
      rawStatus === "disabled" || rawStatus === "disqualified" ? rawStatus : "active";
    return {
      uid: d.id,
      email: typeof x.email === "string" ? x.email : "",
      name: typeof x.name === "string" ? x.name : "",
      role,
      approvalStatus: as === "pending" || as === "rejected" ? as : undefined,
      intakeQuestionnaire: parseIntake(x.intakeQuestionnaire),
      nursingTrack,
      accountStatus,
      adminStats: (x.adminStats as UserListRow["adminStats"]) ?? null,
      ratStats: (x.ratStats as UserListRow["ratStats"]) ?? null,
    };
  });
  rows.sort((a, b) => a.email.localeCompare(b.email));
  return rows;
}

export async function getUserForAdmin(userId: string): Promise<UserListRow | null> {
  const db = requireDb();
  const snap = await getDoc(doc(db, COL, userId));
  if (!snap.exists()) return null;
  const x = snap.data();
  const role = (x.role as UserRole) ?? "student";
  const as = x.approvalStatus as ApprovalStatus | undefined;
  const rawTrack = x.nursingTrack;
  const nursingTrack: NursingTrack | null = rawTrack === "rn" || rawTrack === "pn" ? rawTrack : null;
  const rawStatus = x.accountStatus;
  const accountStatus: AccountStatus =
    rawStatus === "disabled" || rawStatus === "disqualified" ? rawStatus : "active";
  return {
    uid: snap.id,
    email: typeof x.email === "string" ? x.email : "",
    name: typeof x.name === "string" ? x.name : "",
    role,
    approvalStatus: as === "pending" || as === "rejected" ? as : undefined,
    intakeQuestionnaire: parseIntake(x.intakeQuestionnaire),
    nursingTrack,
    accountStatus,
    adminStats: (x.adminStats as UserListRow["adminStats"]) ?? null,
    ratStats: (x.ratStats as UserListRow["ratStats"]) ?? null,
  };
}

export type AdminUserFilters = {
  role?: UserRole | "all";
  approvalStatus?: "pending" | "rejected" | "approved" | "all";
  accountStatus?: AccountStatus | "all";
  nursingTrack?: NursingTrack | "all";
};

export type AdminUserCursor = { email: string; uid: string };

export async function listUsersForAdminPage(opts: {
  pageSize: number;
  cursor?: AdminUserCursor | null;
  filters?: AdminUserFilters;
}): Promise<{ rows: UserListRow[]; nextCursor: AdminUserCursor | null }> {
  const db = requireDb();
  const pageSize = Math.max(5, Math.min(100, Math.floor(Number(opts.pageSize) || 25)));
  const f = opts.filters ?? {};

  const wheres = [];
  if (f.role && f.role !== "all") wheres.push(where("role", "==", f.role));
  if (f.approvalStatus && f.approvalStatus !== "all") wheres.push(where("approvalStatus", "==", f.approvalStatus));
  if (f.accountStatus && f.accountStatus !== "all") wheres.push(where("accountStatus", "==", f.accountStatus));
  if (f.nursingTrack && f.nursingTrack !== "all") wheres.push(where("nursingTrack", "==", f.nursingTrack));

  const base = query(
    collection(db, COL),
    ...wheres,
    orderBy("email", "asc"),
    orderBy(documentId(), "asc"),
    ...(opts.cursor ? [startAfter(opts.cursor.email, opts.cursor.uid)] : []),
    limit(pageSize),
  );

  const snaps = await getDocs(base);
  const rows: UserListRow[] = snaps.docs.map((d) => {
    const x = d.data();
    const role = (x.role as UserRole) ?? "student";
    const as = x.approvalStatus as ApprovalStatus | undefined;
    const rawTrack = x.nursingTrack;
    const nursingTrack: NursingTrack | null = rawTrack === "rn" || rawTrack === "pn" ? rawTrack : null;
    const rawStatus = x.accountStatus;
    const accountStatus: AccountStatus =
      rawStatus === "disabled" || rawStatus === "disqualified" ? rawStatus : "active";
    return {
      uid: d.id,
      email: typeof x.email === "string" ? x.email : "",
      name: typeof x.name === "string" ? x.name : "",
      role,
      approvalStatus: as === "pending" || as === "rejected" ? as : undefined,
      intakeQuestionnaire: parseIntake(x.intakeQuestionnaire),
      nursingTrack,
      accountStatus,
      adminStats: (x.adminStats as UserListRow["adminStats"]) ?? null,
      ratStats: (x.ratStats as UserListRow["ratStats"]) ?? null,
    };
  });

  const last = snaps.docs[snaps.docs.length - 1];
  const nextCursor = last
    ? { email: String(last.data().email ?? ""), uid: last.id }
    : null;

  return { rows, nextCursor };
}

export async function setUserApprovalStatus(userId: string, status: "approved" | "rejected"): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, COL, userId), {
    approvalStatus: status,
    approvalUpdatedAt: serverTimestamp(),
  });
}

export async function saveStudentIntakeQuestionnaire(userId: string, data: IntakeQuestionnaire): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, COL, userId), {
    intakeQuestionnaire: {
      educationLevel: data.educationLevel.trim(),
      examPreparing: data.examPreparing.trim(),
      interestedCategories: data.interestedCategories,
      comfortableTopics: data.comfortableTopics,
      challengingTopics: data.challengingTopics,
      coachingGoals: data.coachingGoals.trim(),
      schoolName: (data.schoolName ?? "").trim(),
      phoneNumber: (data.phoneNumber ?? "").trim(),
      completedAt: serverTimestamp(),
    },
  });
}

export async function setStudentNursingTrack(userId: string, track: NursingTrack): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, COL, userId), {
    nursingTrack: track,
    trackUpdatedAt: serverTimestamp(),
  });
}

export async function setUserAccountStatus(userId: string, status: AccountStatus): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, COL, userId), {
    accountStatus: status,
    statusUpdatedAt: serverTimestamp(),
  });
}

export async function resetStudentRatCooldown(userId: string): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, COL, userId), {
    "ratStats.lastRatStartedAtMs": 0,
    "ratStats.lastRatStartedAt": null,
  });
}
