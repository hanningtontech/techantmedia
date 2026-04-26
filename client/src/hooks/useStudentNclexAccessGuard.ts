import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  useFirebaseAuth,
  isStudentDisabled,
  isStudentDisqualified,
  isStudentNclexBlocked,
} from "@/contexts/FirebaseAuthContext";

/**
 * Sends students who are not yet approved (or are rejected) to the access wait page.
 */
export function useRedirectStudentIfPending(): void {
  const { profile, loading } = useFirebaseAuth();
  const [, navigate] = useLocation();

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
    if (!isStudentNclexBlocked(profile)) return;
    navigate("/student/pending-approval");
  }, [loading, profile, navigate]);
}
