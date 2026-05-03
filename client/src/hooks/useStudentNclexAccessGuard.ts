import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  useFirebaseAuth,
  isStudentDisabled,
  isStudentDisqualified,
  isStudentNclexBlocked,
} from "@/contexts/FirebaseAuthContext";
import { STUDENT_NCLEX_HUB } from "@/lib/nclex/studentNclexRoutes";

/**
 * Sends students who are not yet approved (or are rejected) to the access wait page,
 * then requires an NCLEX-RN vs NCLEX-PN choice (via `/student/nclex` hub) before other `/student/nclex/*` routes.
 */
export function useRedirectStudentIfPending(): void {
  const { profile, loading } = useFirebaseAuth();
  const [loc, navigate] = useLocation();

  useEffect(() => {
    if (loading || !profile) return;
    if (isStudentDisqualified(profile)) {
      navigate("/student/disqualified");
      return;
    }
    if (isStudentDisabled(profile)) {
      navigate("/student/disabled");
      return;
    }
    if (isStudentNclexBlocked(profile)) {
      navigate("/student/pending-approval");
      return;
    }
    if (profile.role !== "student") return;
    if (!loc.startsWith("/student/nclex")) return;
    const path = loc.replace(/\/$/, "") || "/";
    if (path === STUDENT_NCLEX_HUB || path.startsWith(`${STUDENT_NCLEX_HUB}/track`)) return;
    if (profile.nursingTrack === "rn" || profile.nursingTrack === "pn") return;
    navigate(STUDENT_NCLEX_HUB);
  }, [loading, profile, navigate, loc]);
}
