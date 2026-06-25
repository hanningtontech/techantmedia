import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ExtractionFieldId } from "@shared/documentExtraction";
import { formatSpreadsheetCell } from "@/lib/ntsa/extractionSpreadsheet";

type Props = {
  fieldId: ExtractionFieldId;
  value: string | number;
  align: "left" | "center";
  editable: boolean;
  onCommit: (value: string) => void;
};

function toDraftValue(value: string | number): string {
  if (value === "" || value === 0) return "";
  return String(value);
}

export function EditableSpreadsheetCell({ fieldId, value, align, editable, onCommit }: Props) {
  const [draft, setDraft] = useState(() => toDraftValue(value));

  useEffect(() => {
    setDraft(toDraftValue(value));
  }, [value]);

  const nameDisplayClass = fieldId === "name" ? "whitespace-normal break-words leading-snug" : "";
  const compactInputClass =
    fieldId === "sourcePage" || fieldId === "totalKes" || fieldId === "amount"
      ? "min-w-0 px-1 text-xs"
      : fieldId === "name"
        ? "min-w-0 whitespace-normal"
        : "min-w-0 px-1.5";

  if (!editable) {
    return (
      <span className={cn("block min-h-[2rem] py-0.5", nameDisplayClass)}>
        {formatSpreadsheetCell(fieldId, value)}
      </span>
    );
  }

  const commit = () => {
    const next = fieldId === "sourcePage" ? draft.trim() : draft;
    if (next !== toDraftValue(value)) {
      onCommit(next);
    }
  };

  return (
    <Input
      type={fieldId === "sourcePage" ? "number" : "text"}
      min={fieldId === "sourcePage" ? 1 : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "h-8 w-full border-transparent bg-white/5 text-sm text-white shadow-none",
        "hover:border-white/15 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20",
        align === "center" ? "text-center" : "text-left",
        compactInputClass,
        nameDisplayClass,
      )}
      aria-label={`Edit ${fieldId}`}
    />
  );
}
