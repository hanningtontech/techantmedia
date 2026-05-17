import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type DocumentData } from "firebase/firestore";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { isFirebaseConfigured, tryGetFirebaseAuth, tryGetFirestoreDb } from "@/lib/firebase";
import type { UserRole } from "@/lib/firestore/nclexTypes";
import type { AccountStatus, ApprovalStatus, IntakeQuestionnaire, NursingTrack } from "@/lib/userTypes";
import { toast } from "sonner";

const USERS = "users";

export interface AuthUserProfile {
  uid: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  /** New accounts start `pending` until an admin approves. Missing = legacy approved. */
  approvalStatus?: ApprovalStatus;
  intakeQuestionnaire?: IntakeQuestionnaire | null;
  nursingTrack?: NursingTrack | null;
  accountStatus?: AccountStatus;
}

function parseIntakeFromDoc(raw: unknown): IntakeQuestionnaire | null {
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

function mapDocToProfile(u: User, d: DocumentData): AuthUserProfile {
  const role = (d.role as UserRole) ?? "student";
  const rawApproval = d.approvalStatus as ApprovalStatus | undefined;
  const approvalStatus =
    rawApproval === "pending" || rawApproval === "rejected" ? rawApproval : undefined;
  const rawTrack = d.nursingTrack;
  const nursingTrack: NursingTrack | null =
    rawTrack === "rn" || rawTrack === "pn" ? rawTrack : null;
  const rawStatus = d.accountStatus;
  const accountStatus: AccountStatus =
    rawStatus === "disabled" || rawStatus === "disqualified" ? rawStatus : "active";
  return {
    uid: u.uid,
    email: u.email ?? (typeof d.email === "string" ? d.email : null),
    name: u.displayName ?? (typeof d.name === "string" ? d.name : null),
    role,
    approvalStatus,
    intakeQuestionnaire: parseIntakeFromDoc(d.intakeQuestionnaire),
    nursingTrack,
    accountStatus,
  };
}

/** Students who must not use NCLEX routes until approved (pending or rejected). */
export function isStudentNclexBlocked(profile: AuthUserProfile | null): boolean {
  if (!profile || profile.role !== "student") return false;
  if (profile.accountStatus === "disabled" || profile.accountStatus === "disqualified") return true;
  return profile.approvalStatus === "pending" || profile.approvalStatus === "rejected";
}

export function isStudentRejected(profile: AuthUserProfile | null): boolean {
  return profile?.role === "student" && profile.approvalStatus === "rejected";
}

export function isStudentDisabled(profile: AuthUserProfile | null): boolean {
  return profile?.role === "student" && profile.accountStatus === "disabled";
}

export function isStudentDisqualified(profile: AuthUserProfile | null): boolean {
  return profile?.role === "student" && profile.accountStatus === "disqualified";
}

type FirebaseAuthContextValue = {
  firebaseReady: boolean;
  loading: boolean;
  user: User | null;
  profile: AuthUserProfile | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileUnsubRef = useRef<(() => void) | null>(null);

  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    if (!firebaseReady) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }
    const auth = tryGetFirebaseAuth();
    const db = tryGetFirestoreDb();
    if (!auth) {
      setLoading(false);
      return;
    }

    const authUnsub = onAuthStateChanged(auth, (u) => {
      profileUnsubRef.current?.();
      profileUnsubRef.current = null;

      if (!u) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(u);

      if (!db) {
        setProfile({ uid: u.uid, email: u.email, name: u.displayName, role: "student" });
        setLoading(false);
        return;
      }

      setLoading(true);
      const ref = doc(db, USERS, u.uid);

      void (async () => {
        try {
          const initial = await getDoc(ref);
          if (!initial.exists()) {
            await setDoc(
              ref,
              {
                email: u.email ?? "",
                name: u.displayName ?? "",
                role: "student" as UserRole,
                approvalStatus: "pending",
                createdAt: serverTimestamp(),
              },
              { merge: true },
            );
          }

          profileUnsubRef.current = onSnapshot(
            ref,
            (snap) => {
              if (!snap.exists()) {
                setProfile({
                  uid: u.uid,
                  email: u.email,
                  name: u.displayName,
                  role: "student",
                  approvalStatus: "pending",
                });
                setLoading(false);
                return;
              }
              setProfile(mapDocToProfile(u, snap.data()));
              setLoading(false);
            },
            (err) => {
              console.error("User profile subscription error:", err);
              toast.error(formatAuthOrFirestoreError(err));
              setProfile({ uid: u.uid, email: u.email, name: u.displayName, role: "student" });
              setLoading(false);
            },
          );
        } catch (e) {
          console.error("NCLEX auth profile error:", e);
          toast.error(formatAuthOrFirestoreError(e));
          setProfile({ uid: u.uid, email: u.email, name: u.displayName, role: "student" });
          setLoading(false);
        }
      })();
    });

    return () => {
      profileUnsubRef.current?.();
      profileUnsubRef.current = null;
      authUnsub();
    };
  }, [firebaseReady]);

  const signInWithGoogle = useCallback(async () => {
    const auth = tryGetFirebaseAuth();
    if (!auth) throw new Error("Firebase Auth not configured");
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const auth = tryGetFirebaseAuth();
    if (!auth) throw new Error("Firebase Auth not configured");
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    const auth = tryGetFirebaseAuth();
    if (!auth) throw new Error("Firebase Auth not configured");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const db = tryGetFirestoreDb();
    if (db) {
      try {
        await setDoc(
          doc(db, USERS, cred.user.uid),
          {
            email,
            name: displayName,
            role: "student" as UserRole,
            approvalStatus: "pending" as ApprovalStatus,
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (e) {
        throw new Error(formatAuthOrFirestoreError(e));
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    const auth = tryGetFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      firebaseReady,
      loading,
      user,
      profile,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
    }),
    [firebaseReady, loading, user, profile, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut],
  );

  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
}

export function useFirebaseAuth(): FirebaseAuthContextValue {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx) {
    throw new Error("useFirebaseAuth must be used within FirebaseAuthProvider");
  }
  return ctx;
}

export function isTutorOrAdmin(profile: AuthUserProfile | null): boolean {
  return profile?.role === "tutor" || profile?.role === "admin";
}

export function isAdmin(profile: AuthUserProfile | null): boolean {
  return profile?.role === "admin";
}

export function isStudentOrAbove(profile: AuthUserProfile | null): boolean {
  return !!profile;
}
