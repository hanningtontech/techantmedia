import { useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";

const FACTS = [
  "Normal adult respiratory rate is typically 12–20 breaths per minute.",
  "A common early sign of hypoxia is restlessness or confusion.",
  "For many meds, verify the 5 rights: right patient, drug, dose, route, time.",
  "With suspected stroke, time is brain — act fast and document onset time.",
  "Infection control starts with hand hygiene — before and after every patient contact.",
  "SATA questions require selecting all correct options — read carefully for plural cues.",
  "When prioritizing, ABCs (Airway, Breathing, Circulation) often come first.",
  "A sudden drop in urine output can be an early sign of shock or renal hypoperfusion.",
  "Pain is whatever the patient says it is — reassess after interventions.",
  "For IV infusions, double-check concentration and pump settings before starting.",
];

function pickFact(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return FACTS[Math.abs(h) % FACTS.length]!;
}

export function NursingFactLoader({
  title = "Loading…",
  subtitle,
  seed,
}: {
  title?: string;
  subtitle?: string;
  /** Stable seed (e.g. sessionId/ratId) to avoid flicker. */
  seed: string;
}) {
  const fact = useMemo(() => pickFact(seed), [seed]);
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-16">
      <Spinner className="h-10 w-10 text-[var(--nclex-primary)]" />
      <div className="max-w-md text-center">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p> : null}
        <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold">Nursing fact:</span> {fact}
        </div>
      </div>
    </div>
  );
}

