import { useEffect } from "react";
import { useLocation } from "wouter";
import { STUDENT_NCLEX_HUB } from "@/lib/nclex/studentNclexRoutes";

/** @deprecated Bookmark `/student/nclex` instead; this path redirects to the NCLEX hub. */
export default function StudentNclexTrackSelect() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate(STUDENT_NCLEX_HUB, { replace: true });
  }, [navigate]);

  return (
    <div className="container py-16 text-center text-muted-foreground">
      <p>Redirecting…</p>
    </div>
  );
}
