import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebaseAuth, isStudentNclexBlocked } from "@/contexts/FirebaseAuthContext";
import { useRedirectStudentIfPending } from "@/hooks/useStudentNclexAccessGuard";
import { updateMyProfile } from "@/lib/firestore/userSelf";
import { STUDENT_NCLEX_DASHBOARD } from "@/lib/nclex/studentNclexRoutes";
import type { NursingTrack } from "@/lib/userTypes";
import { toast } from "sonner";
import { ArrowRight, BookOpen } from "lucide-react";

const RN_DETAIL = {
  title: "NCLEX-RN",
  short: "Registered Nurse (RN)",
  for: "Students graduating from ADN, BSN, or diploma nursing programs.",
  scope:
    "RNs typically have a wider scope of practice, more responsibility, leadership roles, care planning, medication management, and critical decision-making.",
  roles: [
    "Hospital Registered Nurse",
    "ICU Nurse",
    "Emergency Nurse",
    "Pediatric RN",
    "Operating Room Nurse",
  ],
};

const PN_DETAIL = {
  title: "NCLEX-PN",
  short: "Practical Nurse (PN / LPN / LVN)",
  for: "Students graduating from practical or vocational nursing programs (LPN; LVN in states like California and Texas).",
  scope:
    "PNs provide basic bedside care, assist RNs and doctors, monitor patients, administer some medications, and perform routine procedures.",
  roles: [
    "Clinic Practical Nurse",
    "Long-Term Care Nurse",
    "Nursing Home Nurse",
    "Rehabilitation / assistant roles",
  ],
};

/**
 * Entry from the student area: pick RN or PN, then open the dashboard for that track
 * (exams, assignments, class notes, and other resources filter by this choice).
 */
export default function StudentNclexHub() {
  useRedirectStudentIfPending();
  const [, navigate] = useLocation();
  const { loading, profile } = useFirebaseAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== "student") {
      navigate("/");
    }
  }, [loading, profile, navigate]);

  const choose = async (track: NursingTrack) => {
    if (!profile?.uid) return;
    setBusy(true);
    try {
      await updateMyProfile(profile.uid, { nursingTrack: track });
      toast.success(track === "rn" ? "Opening your NCLEX-RN dashboard." : "Opening your NCLEX-PN dashboard.");
      navigate(STUDENT_NCLEX_DASHBOARD);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your choice");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-16 text-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-16">
        <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">NCLEX student sign-in</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in on your dashboard first, then return here to choose <strong>NCLEX-RN</strong> or <strong>NCLEX-PN</strong>.
          </p>
          <Button className="mt-6 w-full bg-blue-600 hover:bg-blue-700" onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}>
            Go to sign in
          </Button>
          <Button variant="ghost" className="mt-2 w-full" asChild>
            <Link href="/">Back to portfolio</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (profile.role !== "student") {
    return null;
  }

  if (isStudentNclexBlocked(profile)) {
    return null;
  }

  const current = profile.nursingTrack === "rn" || profile.nursingTrack === "pn" ? profile.nursingTrack : null;
  const other: NursingTrack | null = current === "rn" ? "pn" : current === "pn" ? "rn" : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
            <BookOpen className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Choose your NCLEX track</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
            Quizzes, exams, assignments, and class notes are organized by exam type. Pick the track you are preparing for.
            You can switch tracks anytime from here or from your profile.
          </p>
        </div>

        {current ? (
          <Card className="border-blue-200 bg-blue-50/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-blue-950">Continue where you left off</CardTitle>
              <CardDescription className="text-blue-900/80">
                You are set to <strong>{current === "rn" ? RN_DETAIL.title : PN_DETAIL.title}</strong>. Open your dashboard
                for assignments, practice, and materials for this track.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                disabled={busy}
                onClick={() => navigate(STUDENT_NCLEX_DASHBOARD)}
              >
                Go to dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              {other ? (
                <Button type="button" variant="outline" disabled={busy} onClick={() => void choose(other)}>
                  Switch to {other === "rn" ? RN_DETAIL.title : PN_DETAIL.title}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" asChild>
                <Link href="/">Back to portfolio</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-2 border-slate-200 shadow-sm transition hover:border-blue-300">
            <CardHeader>
              <CardTitle className="text-xl text-slate-900">{RN_DETAIL.title}</CardTitle>
              <CardDescription className="text-base font-medium text-slate-700">{RN_DETAIL.short}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">{RN_DETAIL.for}</p>
              <p className="text-sm text-slate-600">{RN_DETAIL.scope}</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Example roles</p>
                <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                  {RN_DETAIL.roles.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={busy}
                onClick={() =>
                  current === "rn" ? navigate(STUDENT_NCLEX_DASHBOARD) : void choose("rn")
                }
              >
                {current === "rn" ? "Open NCLEX-RN dashboard" : "Study NCLEX-RN"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 shadow-sm transition hover:border-emerald-300">
            <CardHeader>
              <CardTitle className="text-xl text-slate-900">{PN_DETAIL.title}</CardTitle>
              <CardDescription className="text-base font-medium text-slate-700">{PN_DETAIL.short}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">{PN_DETAIL.for}</p>
              <p className="text-sm text-slate-600">{PN_DETAIL.scope}</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Example roles</p>
                <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                  {PN_DETAIL.roles.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={busy}
                onClick={() =>
                  current === "pn" ? navigate(STUDENT_NCLEX_DASHBOARD) : void choose("pn")
                }
              >
                {current === "pn" ? "Open NCLEX-PN dashboard" : "Study NCLEX-PN"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-slate-500">
          After you choose a track, use category, topic, and subtopic filters on class notes and future content libraries
          to narrow what you study.
        </p>
      </div>
    </div>
  );
}
