import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NclexHeader } from "@/components/nclex/NclexHeader";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { updateMyIntakeQuestionnaire, updateMyProfile } from "@/lib/firestore/userSelf";
import type { IntakeQuestionnaire, NursingTrack } from "@/lib/userTypes";
import { toast } from "sonner";

const EDUCATION_LEVEL_OPTIONS = [
  "Nursing Student (PN)",
  "Nursing Student (LPN/LVN)",
  "Nursing Student (ADN)",
  "Nursing Student (BSN)",
  "LPN / LVN",
  "RN (Diploma)",
  "RN (ADN)",
  "RN (BSN)",
  "BSN Graduate (Not Licensed Yet)",
  "MSN Student",
  "MSN / APRN",
  "Nurse Practitioner (NP)",
  "DNP Student",
  "DNP / Doctorate Prepared Nurse",
  "Other",
] as const;

const EXAM_OPTIONS = [
  "NCLEX-PN",
  "NCLEX-RN",
  "NCLEX-RN (NGN)",
  "NCLEX-PN (NGN)",
  "HESI Exit Exam",
  "ATI Comprehensive Predictor",
  "Kaplan NCLEX Prep Exam",
  "UWorld Self-Assessment",
  "Nursing School Exams",
  "Other Licensing Exam",
  "Not Yet Decided",
] as const;

const NCLEX_CATEGORY_OPTIONS = [
  "Safe and Effective Care Environment",
  "Health Promotion and Maintenance",
  "Psychosocial Integrity",
  "Physiological Integrity",
] as const;

const TOPIC_OPTIONS = [
  "Management of Care",
  "Safety and Infection Control",
  "Growth and Development Across the Lifespan",
  "Disease Prevention and Early Detection",
  "Antepartum / Intrapartum / Postpartum Care",
  "Newborn Care",
  "Mental Health Concepts",
  "Coping Mechanisms",
  "Behavioral Interventions",
  "Substance Use Disorders",
  "Crisis Intervention",
  "Abuse / Neglect / Violence",
  "Mobility / Immobility",
  "Hygiene",
  "Nutrition",
  "Elimination",
  "Rest and Sleep",
  "Non-pharmacological Comfort Measures",
  "Medication Administration",
  "Adverse Effects / Side Effects",
  "IV Therapy",
  "Blood Products",
  "Dosage Calculations (safety-based)",
  "High-Alert Medications",
  "Diagnostic Testing",
  "Lab Values Interpretation",
  "Vital Signs Abnormalities",
  "Post-Procedure Care",
  "Complications Prevention",
  "Early Warning Signs of Deterioration",
  "Fluid and Electrolyte Imbalances",
  "Acid-Base Balance",
  "Shock and Hemodynamics",
  "Respiratory Disorders",
  "Cardiac Disorders",
  "Renal Disorders",
  "Endocrine Disorders",
  "Neurological Disorders",
  "Infectious Diseases",
  "Oncology Nursing",
  "Perioperative Care",
] as const;

function emptyIntake(): IntakeQuestionnaire {
  return {
    educationLevel: "",
    examPreparing: "",
    interestedCategories: [],
    comfortableTopics: [],
    challengingTopics: [],
    coachingGoals: "",
    schoolName: "",
    phoneNumber: "",
  };
}

export default function StudentProfile() {
  const [, navigate] = useLocation();
  const { loading, profile } = useFirebaseAuth();
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [track, setTrack] = useState<NursingTrack | "">("");
  const [intake, setIntake] = useState<IntakeQuestionnaire>(() => emptyIntake());

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.name ?? "");
    setTrack(profile.nursingTrack ?? "");
    const q = profile.intakeQuestionnaire;
    if (q) {
      setIntake({
        educationLevel: q.educationLevel ?? "",
        examPreparing: q.examPreparing ?? "",
        interestedCategories: q.interestedCategories ?? [],
        comfortableTopics: q.comfortableTopics ?? [],
        challengingTopics: q.challengingTopics ?? [],
        coachingGoals: q.coachingGoals ?? "",
        schoolName: q.schoolName ?? "",
        phoneNumber: q.phoneNumber ?? "",
      });
    }
  }, [profile]);

  const canSave = useMemo(() => {
    if (!profile) return false;
    if (track !== "rn" && track !== "pn") return false;
    if (!intake.educationLevel.trim()) return false;
    if (!intake.examPreparing.trim()) return false;
    if (!intake.interestedCategories.length) return false;
    if (!intake.comfortableTopics.length) return false;
    if (!intake.challengingTopics.length) return false;
    if (!intake.coachingGoals.trim()) return false;
    return true;
  }, [profile, track, intake]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!canSave) {
      toast.error("Please complete required fields before saving.");
      return;
    }
    setBusy(true);
    try {
      await updateMyProfile(profile.uid, { name: displayName, nursingTrack: track as NursingTrack });
      await updateMyIntakeQuestionnaire(profile.uid, intake);
      toast.success("Profile updated.");
      navigate("/student/nclex");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="nclex-app nclex-shell flex min-h-[45vh] flex-col items-center justify-center gap-3 px-4 py-16">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-200 border-t-[var(--nclex-primary)]" />
        <p className="text-sm font-medium text-slate-700">Loading profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="nclex-app nclex-shell px-4 py-16">
        <p className="text-sm text-slate-600">Sign in to edit your profile.</p>
      </div>
    );
  }

  return (
    <div className="nclex-app nclex-shell min-h-screen">
      <NclexHeader title="Your profile" subtitle="Update your preferences" homeHref="/student/nclex" homeLabel="Dashboard" />
      <main className="nclex-main mx-auto max-w-3xl space-y-6 py-6 sm:py-8 xl:max-w-4xl">
        <Card className="nclex-card shadow-md">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your admin can view these details for coaching and quiz assignment.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSave} className="space-y-5">
              <div className="grid gap-2">
                <Label>Display name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                <p className="text-xs text-muted-foreground">If you signed in with Google, your Google name may still display in some places.</p>
              </div>

              <div className="grid gap-2">
                <Label>Track</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant={track === "rn" ? "default" : "outline"} onClick={() => setTrack("rn")}>
                    RN
                  </Button>
                  <Button type="button" variant={track === "pn" ? "default" : "outline"} onClick={() => setTrack("pn")}>
                    PN
                  </Button>
                </div>
              </div>

              <SelectOne
                label="Nursing Education Level"
                value={intake.educationLevel}
                options={[...EDUCATION_LEVEL_OPTIONS]}
                onChange={(v) => setIntake((s) => ({ ...s, educationLevel: v }))}
              />
              <SelectOne
                label="Exam You Are Preparing For"
                value={intake.examPreparing}
                options={[...EXAM_OPTIONS]}
                onChange={(v) => setIntake((s) => ({ ...s, examPreparing: v }))}
              />
              <SelectMany
                label="NCLEX Categories of Interest"
                value={intake.interestedCategories}
                options={[...NCLEX_CATEGORY_OPTIONS]}
                onChange={(v) => setIntake((s) => ({ ...s, interestedCategories: v }))}
              />
              <SelectMany
                label="Comfortable topics"
                value={intake.comfortableTopics}
                options={[...TOPIC_OPTIONS]}
                onChange={(v) => setIntake((s) => ({ ...s, comfortableTopics: v }))}
              />
              <SelectMany
                label="Challenging topics"
                value={intake.challengingTopics}
                options={[...TOPIC_OPTIONS]}
                onChange={(v) => setIntake((s) => ({ ...s, challengingTopics: v }))}
              />

              <div className="grid gap-2">
                <Label>Coaching goals</Label>
                <Textarea
                  rows={4}
                  value={intake.coachingGoals}
                  onChange={(e) => setIntake((s) => ({ ...s, coachingGoals: e.target.value }))}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                <div className="grid gap-2">
                  <Label>Current school / university (optional)</Label>
                  <Input
                    value={intake.schoolName ?? ""}
                    onChange={(e) => setIntake((s) => ({ ...s, schoolName: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Phone number (optional)</Label>
                  <Input
                    value={intake.phoneNumber ?? ""}
                    onChange={(e) => setIntake((s) => ({ ...s, phoneNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="nclex-btn-primary" disabled={busy || !canSave}>
                  {busy ? "Saving…" : "Save changes"}
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => navigate("/student/nclex")}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SelectOne({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm leading-snug">{label}</Label>
      <select className="h-10 w-full rounded-md border px-3 text-sm bg-white" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select one…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectMany({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  const set = new Set(value);
  const toggle = (opt: string) => {
    const next = new Set(set);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(Array.from(next));
  };
  return (
    <div className="grid gap-2">
      <Label className="text-sm leading-snug">{label}</Label>
      <div className="max-h-56 overflow-y-auto rounded-md border bg-white p-2 space-y-1">
        {options.map((o) => (
          <label key={o} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={set.has(o)} onChange={() => toggle(o)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Selected: <span className="font-medium">{value.length}</span>
      </p>
    </div>
  );
}

