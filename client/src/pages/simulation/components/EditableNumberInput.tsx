import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type EditableNumberInputProps = {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  /** Native spinner / arrow-key step. Dollar fields use 1. */
  step?: number;
  /** Applied when field is cleared or invalid on blur. */
  fallback?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  /** Round to integer on commit (games, players, counts). */
  integer?: boolean;
};

function clamp(n: number, min?: number, max?: number): number {
  let v = n;
  if (min != null) v = Math.max(min, v);
  if (max != null) v = Math.min(max, v);
  return v;
}

function parseCommit(raw: string, integer: boolean): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return integer ? Math.floor(n) : n;
}

/**
 * Number input that stays fully editable while typing (empty, partial decimals)
 * and commits a clamped value on blur / Enter. Spinner arrows use `step` (default 1).
 */
export function EditableNumberInput({
  value,
  onCommit,
  min,
  max,
  step = 1,
  fallback,
  disabled,
  className,
  id: idProp,
  placeholder,
  integer = false,
}: EditableNumberInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const resolvedFallback = fallback ?? min ?? 0;
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => String(value));

  useEffect(() => {
    if (!focused) {
      setText(String(value));
    }
  }, [value, focused]);

  const commit = (raw: string) => {
    const parsed = parseCommit(raw, integer);
    const next = clamp(parsed ?? resolvedFallback, min, max);
    onCommit(next);
    setText(String(next));
  };

  return (
    <Input
      id={id}
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(className)}
      value={focused ? text : String(value)}
      onFocus={(e) => {
        setFocused(true);
        setText(String(value));
        e.target.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit(text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}
