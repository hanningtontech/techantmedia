import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function swapOrder<T extends { id: string; order: number }>(
  items: T[],
  id: string,
  delta: number,
): T[] {
  const sorted = sortByOrder(items);
  const idx = sorted.findIndex((x) => x.id === id);
  const swap = idx + delta;
  if (idx < 0 || swap < 0 || swap >= sorted.length) return items;
  const a = sorted[idx]!;
  const b = sorted[swap]!;
  return items.map((x) => {
    if (x.id === a.id) return { ...x, order: b.order };
    if (x.id === b.id) return { ...x, order: a.order };
    return x;
  });
}

export function reorderArray<T>(items: T[], index: number, delta: number): T[] {
  const swap = index + delta;
  if (index < 0 || swap < 0 || swap >= items.length) return items;
  const next = [...items];
  [next[index], next[swap]] = [next[swap]!, next[index]!];
  return next;
}

export function SortButtons({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return (
    <div className="flex shrink-0 gap-0.5">
      <button
        type="button"
        className="rounded-md border border-white/10 p-1 text-zinc-500 transition-colors hover:border-white/20 hover:text-zinc-200"
        onClick={onUp}
        aria-label="Move up"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="rounded-md border border-white/10 p-1 text-zinc-500 transition-colors hover:border-white/20 hover:text-zinc-200"
        onClick={onDown}
        aria-label="Move down"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ListedCheckbox({
  checked,
  onChange,
  compact,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-1.5 text-zinc-400",
        compact ? "text-[11px]" : "text-xs",
      )}
      title="When unchecked, hidden from the public site"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-white/20 accent-teal-500"
      />
      Listed
    </label>
  );
}

export function FilterChip({
  label,
  active,
  muted,
  onClick,
}: {
  label: string;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-all",
        active
          ? "bg-orange-500/25 text-orange-200 ring-1 ring-orange-500/50"
          : "border border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200",
        muted && !active && "opacity-50",
      )}
    >
      {label}
    </button>
  );
}
