import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { StudentQuestion } from "@/lib/firestore/nclexTypes";

type Props = {
  question: StudentQuestion;
  /** Selected option ids (lowercase a–d). */
  value: string[];
  onChange: (ids: string[]) => void;
  /** When true, multiple checkboxes may stay selected. */
  allowMultiple?: boolean;
  showCorrect?: boolean;
  /** Correct option ids for read-only review (from tutor key). */
  correctIds?: string[];
  readOnly?: boolean;
  className?: string;
  compact?: boolean;
};

export function QuestionCard({
  question,
  value,
  onChange,
  allowMultiple = false,
  showCorrect,
  correctIds = [],
  readOnly,
  className,
  compact,
}: Props) {
  const showHeader = !compact && Boolean(question.title?.trim());
  const correctSet = new Set(correctIds);
  const selectedSet = new Set(value);

  const toggle = (optId: string, checked: boolean) => {
    if (readOnly) return;
    const id = optId.toLowerCase();
    if (allowMultiple) {
      const has = value.includes(id);
      if (checked && !has) onChange([...value, id].sort());
      else if (!checked && has) onChange(value.filter((x) => x !== id));
      return;
    }
    if (checked) onChange([id]);
    else onChange([]);
  };

  return (
    <Card className={cn(className)}>
      {showHeader ? (
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-balance text-base font-bold leading-snug sm:text-lg">{question.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={cn("space-y-3 sm:space-y-4", !showHeader && "pt-4 sm:pt-6")}>
        <p className="text-pretty text-sm leading-relaxed text-slate-900 whitespace-pre-wrap sm:text-base sm:leading-relaxed">
          {question.questionText}
        </p>
        {question.allowMultipleAnswers && !readOnly ? (
          <p className="text-xs font-semibold text-[var(--nclex-primary)] sm:text-sm">
            <strong className="font-bold">Select all that apply</strong> — choose every correct option for this item.
          </p>
        ) : null}
        <div className="space-y-2 sm:space-y-3" role="group" aria-label="Answer choices">
          {question.options.map((opt) => {
            const id = opt.id.toLowerCase();
            const selected = selectedSet.has(id);
            const isCorrectOption = correctSet.has(id);
            const wrong = showCorrect && selected && !isCorrectOption;
            const right = showCorrect && isCorrectOption;
            return (
              <div
                key={opt.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-2.5 transition-colors sm:gap-3 sm:p-3.5",
                  right ? "border-emerald-500 bg-emerald-50" : "",
                  wrong ? "border-red-400 bg-red-50" : "",
                  !right && !wrong ? "border-[var(--nclex-border)] bg-white/90" : "",
                )}
              >
                {readOnly ? (
                  <span className="mt-0.5 w-4 text-center text-sm font-bold">{selected ? "☑" : "☐"}</span>
                ) : (
                  <Checkbox
                    id={`${question.id}-${opt.id}`}
                    checked={selected}
                    onCheckedChange={(c) => toggle(id, c === true)}
                    className="mt-0.5"
                    aria-label={`Option ${opt.id.toUpperCase()}`}
                  />
                )}
                {readOnly ? (
                  <div className="flex-1 text-sm leading-relaxed sm:text-base">
                    <span className="font-bold tabular-nums text-slate-900">{opt.id.toUpperCase()}.</span>{" "}
                    <span className="text-slate-800">{opt.text}</span>
                  </div>
                ) : (
                  <Label
                    htmlFor={`${question.id}-${opt.id}`}
                    className="flex-1 cursor-pointer text-sm font-normal leading-relaxed sm:text-base"
                  >
                    <span className="font-bold tabular-nums text-slate-900">{opt.id.toUpperCase()}.</span>{" "}
                    <span className="text-slate-800">{opt.text}</span>
                  </Label>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
