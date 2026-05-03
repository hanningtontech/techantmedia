import { useCallback, useEffect, useState } from "react";
import type { NursingTrack } from "@/lib/userTypes";

const STORAGE_KEY = "nclex-admin-exam-type";
const CHANGE_EVENT = "nclex-admin-exam-type-changed";

export function readNclexAdminExamType(): NursingTrack | null {
  if (typeof localStorage === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "rn" || v === "pn" ? v : null;
}

export function writeNclexAdminExamType(track: NursingTrack): void {
  localStorage.setItem(STORAGE_KEY, track);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearNclexAdminExamType(): void {
  localStorage.removeItem(STORAGE_KEY);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Tutor/admin NCLEX session track (local only). Required to filter quizzes and content while working. */
export function useNclexAdminExamType(): {
  adminExamType: NursingTrack | null;
  setAdminExamType: (t: NursingTrack) => void;
  clearAdminExamType: () => void;
} {
  const [adminExamType, setState] = useState<NursingTrack | null>(() => readNclexAdminExamType());

  useEffect(() => {
    const on = () => setState(readNclexAdminExamType());
    window.addEventListener(CHANGE_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(CHANGE_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);

  const setAdminExamType = useCallback((t: NursingTrack) => {
    writeNclexAdminExamType(t);
    setState(t);
  }, []);

  const clearAdminExamType = useCallback(() => {
    clearNclexAdminExamType();
    setState(null);
  }, []);

  return { adminExamType, setAdminExamType, clearAdminExamType };
}
