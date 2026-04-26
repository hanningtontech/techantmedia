import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  useFirebaseAuth,
  isStudentNclexBlocked,
  isStudentDisabled,
  isStudentDisqualified,
  isStudentRejected,
} from "@/contexts/FirebaseAuthContext";
import { saveStudentIntakeQuestionnaire, setStudentNursingTrack } from "@/lib/firestore/usersAdmin";
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
  // Safe and Effective Care Environment
  "Management of Care",
  "Safety and Infection Control",
  // Health Promotion and Maintenance
  "Growth and Development Across the Lifespan",
  "Disease Prevention and Early Detection",
  "Antepartum / Intrapartum / Postpartum Care",
  "Newborn Care",
  // Psychosocial Integrity
  "Mental Health Concepts",
  "Coping Mechanisms",
  "Behavioral Interventions",
  "Substance Use Disorders",
  "Crisis Intervention",
  "Abuse / Neglect / Violence",
  // Physiological Integrity — Basic Care and Comfort
  "Mobility / Immobility",
  "Hygiene",
  "Nutrition",
  "Elimination",
  "Rest and Sleep",
  "Non-pharmacological Comfort Measures",
  // Physiological Integrity — Pharmacological and Parenteral Therapies
  "Medication Administration",
  "Adverse Effects / Side Effects",
  "IV Therapy",
  "Blood Products",
  "Dosage Calculations (safety-based)",
  "High-Alert Medications",
  // Physiological Integrity — Reduction of Risk Potential
  "Diagnostic Testing",
  "Lab Values Interpretation",
  "Vital Signs Abnormalities",
  "Post-Procedure Care",
  "Complications Prevention",
  "Early Warning Signs of Deterioration",
  // Physiological Integrity — Physiological Adaptation
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

const emptyIntake: IntakeQuestionnaire = {
  educationLevel: "",
  examPreparing: "",
  interestedCategories: [],
  comfortableTopics: [],
  challengingTopics: [],
  coachingGoals: "",
  schoolName: "",
  phoneNumber: "",
};

export default function StudentPendingApprovalPage() {
  const [, navigate] = useLocation();
  const { profile, loading, signOut } = useFirebaseAuth();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intake, setIntake] = useState<IntakeQuestionnaire>(emptyIntake);
  const [track, setTrack] = useState<NursingTrack | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== "student") {
      navigate("/tutor/nclex");
      return;
    }
    if (isStudentDisqualified(profile)) {
      navigate("/student/disqualified");
      return;
    }
    if (isStudentDisabled(profile)) {
      navigate("/student/disabled");
      return;
    }
    if (!isStudentNclexBlocked(profile)) {
      navigate("/student/nclex");
    }
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (loading || !profile || !isStudentNclexBlocked(profile) || isStudentRejected(profile)) return;
    const hasIntake =
      profile.intakeQuestionnaire &&
      Boolean(
        profile.intakeQuestionnaire.educationLevel?.trim() ||
          profile.intakeQuestionnaire.examPreparing?.trim() ||
          (profile.intakeQuestionnaire.interestedCategories?.length ?? 0) > 0 ||
          (profile.intakeQuestionnaire.comfortableTopics?.length ?? 0) > 0 ||
          (profile.intakeQuestionnaire.challengingTopics?.length ?? 0) > 0 ||
          profile.intakeQuestionnaire.coachingGoals?.trim() ||
          profile.intakeQuestionnaire.schoolName?.trim() ||
          profile.intakeQuestionnaire.phoneNumber?.trim(),
      );
    if (!hasIntake) {
      const t = window.setTimeout(() => {
        setIntakeOpen(true);
        toast.info("Please complete a short questionnaire — it helps your coach review your account.", {
          duration: 8000,
        });
      }, 600);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [loading, profile]);

  useEffect(() => {
    if (!intakeOpen || !profile?.intakeQuestionnaire) return;
    const q = profile.intakeQuestionnaire;
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
  }, [intakeOpen, profile?.intakeQuestionnaire]);

  const onSubmitIntake = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (track !== "rn" && track !== "pn") {
      toast.error("Please select RN or PN.");
      return;
    }
    const missing = Object.entries(intake)
      .filter(([k]) => !["schoolName", "phoneNumber"].includes(k))
      .filter(([, v]) => (Array.isArray(v) ? v.length === 0 : !String(v).trim()));
    if (missing.length) {
      toast.error("Please answer every question.");
      return;
    }
    setSaving(true);
    try {
      await setStudentNursingTrack(profile.uid, track);
      await saveStudentIntakeQuestionnaire(profile.uid, intake);
      toast.success("Thanks — your coach can review your answers with your request.");
      setIntakeOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="nclex-app flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm nclex-text-muted">Loading…</p>
      </div>
    );
  }

  if (profile.role !== "student") {
    return null;
  }

  if (isStudentRejected(profile)) {
    return (
      <div className="nclex-app mx-auto max-w-lg px-4 py-16">
        <Card className="nclex-card border-red-200">
          <CardHeader>
            <CardTitle>Access not approved</CardTitle>
            <CardDescription>
              This account is not enabled for the NCLEX student area. If you believe this is a mistake, contact your
              program administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="nclex-app min-h-screen px-4 py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <Card className="nclex-card overflow-hidden border-amber-200">
          <CardHeader className="space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <Spinner className="h-7 w-7 text-amber-800" />
            </div>
            <CardTitle className="text-center text-xl">Waiting for account approval</CardTitle>
            <CardDescription className="text-center text-base text-gray-700">
              An administrator must approve your account before you can open the NCLEX dashboard or quizzes. This page
              updates automatically when you are approved — you can leave it open or return later.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setIntakeOpen(true);
              }}
            >
              {profile.intakeQuestionnaire ? "Edit questionnaire" : "Open questionnaire"}
            </Button>
            <Button variant="ghost" className="text-muted-foreground" onClick={() => void signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Tip: completing the questionnaire helps your admin understand your background and goals.
        </p>
      </div>

      <Dialog open={intakeOpen} onOpenChange={setIntakeOpen}>
        <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Getting to know you</DialogTitle>
            <DialogDescription>
              Your answers are visible to administrators when they review your access request.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmitIntake} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label className="text-sm leading-snug">Track</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={track === "rn" ? "default" : "outline"}
                  onClick={() => setTrack("rn")}
                >
                  RN
                </Button>
                <Button
                  type="button"
                  variant={track === "pn" ? "default" : "outline"}
                  onClick={() => setTrack("pn")}
                >
                  PN
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">This will be shown to your admin next to your name.</p>
            </div>
            <SelectOne
              label="Nursing Education Level"
              value={intake.educationLevel}
              options={[...EDUCATION_LEVEL_OPTIONS]}
              placeholder="Select one…"
              onChange={(v) => setIntake((s) => ({ ...s, educationLevel: v }))}
            />
            <SelectOne
              label="Exam You Are Preparing For"
              value={intake.examPreparing}
              options={[...EXAM_OPTIONS]}
              placeholder="Select one…"
              onChange={(v) => setIntake((s) => ({ ...s, examPreparing: v }))}
            />
            <SelectMany
              label="NCLEX Categories of Interest (select all that apply)"
              value={intake.interestedCategories}
              options={[...NCLEX_CATEGORY_OPTIONS]}
              onChange={(v) => setIntake((s) => ({ ...s, interestedCategories: v }))}
            />
            <SelectMany
              label="NCLEX Topics you find easiest / most comfortable with (select all that apply)"
              value={intake.comfortableTopics}
              options={[...TOPIC_OPTIONS]}
              onChange={(v) => setIntake((s) => ({ ...s, comfortableTopics: v }))}
            />
            <SelectMany
              label="NCLEX Topics you find most challenging (select all that apply)"
              value={intake.challengingTopics}
              options={[...TOPIC_OPTIONS]}
              onChange={(v) => setIntake((s) => ({ ...s, challengingTopics: v }))}
            />
            <Field
              label="What are your personal goals for these coaching sessions? (For example: passing on the first attempt, boosting confidence, mastering priority questions, etc.)"
              value={intake.coachingGoals}
              onChange={(v) => setIntake((s) => ({ ...s, coachingGoals: v }))}
            />
            <Field
              label="Current school / university (optional)"
              value={intake.schoolName ?? ""}
              onChange={(v) => setIntake((s) => ({ ...s, schoolName: v }))}
            />
            <Field
              label="Phone number (optional)"
              value={intake.phoneNumber ?? ""}
              onChange={(v) => setIntake((s) => ({ ...s, phoneNumber: v }))}
            />
            <div className="sticky bottom-0 -mx-6 mt-2 border-t bg-white px-6 py-3">
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="submit" disabled={saving} className="nclex-btn-primary">
                  {saving ? "Saving…" : "Submit answers"}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm leading-snug">{label}</Label>
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="text-sm" />
    </div>
  );
}

function SelectOne({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm leading-snug">{label}</Label>
      <select
        className="h-10 w-full rounded-md border px-3 text-sm bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
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
      <div className="max-h-48 overflow-y-auto rounded-md border bg-white p-2 space-y-1">
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
