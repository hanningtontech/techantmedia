import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LabelTone = "orange" | "teal" | "violet" | "default";
export type AdminFieldSize = "short" | "medium" | "long" | "full";

const sizeClass: Record<AdminFieldSize, string> = {
  short: "admin-input-wrap--short",
  medium: "admin-input-wrap--medium",
  long: "admin-input-wrap--long",
  full: "admin-input-wrap--full",
};

const sizeBadge: Record<AdminFieldSize, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
  full: "Full width",
};

type Props = {
  label: string;
  hint?: string;
  tone?: LabelTone;
  /** Visual width hint — shown as a badge on the label */
  fieldSize?: AdminFieldSize;
  className?: string;
  children: ReactNode;
};

export function AdminField({ label, hint, tone = "orange", fieldSize, className, children }: Props) {
  return (
    <div className={cn("admin-field admin-prose", className)}>
      <div className="admin-field-label-row">
        <label
          className={cn(
            "admin-field-label",
            tone === "teal" && "admin-field-label--teal",
            tone === "violet" && "admin-field-label--violet",
          )}
        >
          {label}
        </label>
        {fieldSize ? (
          <span className={cn("admin-size-badge", `admin-size-badge--${fieldSize}`)} title="Suggested field width">
            {sizeBadge[fieldSize]}
          </span>
        ) : null}
      </div>
      <div className={cn(fieldSize && sizeClass[fieldSize])}>{children}</div>
      {hint ? <p className="admin-hint">{hint}</p> : null}
    </div>
  );
}
