import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  allChartTimeframesForPicker,
  CHART_TIMEFRAME_GROUPS,
  intervalBucketDescription,
  type ChartTimeframe,
} from "@/lib/simulation/timeChartHistory";
import { cn } from "@/lib/utils";

/** TradingView-style interval dropdown (grouped seconds / minutes / hours / days). */
export function ChartTimeframeSelect({
  timeframeId,
  onChange,
  compact,
  fontSize = 11,
  className,
}: {
  timeframeId: string;
  onChange?: (id: string) => void;
  compact?: boolean;
  fontSize?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const all = allChartTimeframesForPicker();
  const current = all.find((t) => t.id === timeframeId) ?? all[0]!;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-semibold text-[#2962ff] transition-colors hover:bg-[#2a2e39]",
          compact ? "min-w-[2.5rem]" : "min-w-[3rem]",
        )}
        style={{ fontSize, borderColor: "#2a2e39", background: "#1c2030" }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Chart interval"
        title={intervalBucketDescription(timeframeId)}
      >
        {current.label}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-[min(320px,50vh)] min-w-[148px] overflow-y-auto rounded-md border py-1 shadow-xl"
          style={{ borderColor: "#2a2e39", background: "#1c2030" }}
          role="listbox"
        >
          {CHART_TIMEFRAME_GROUPS.map((group) => (
            <div key={group.label}>
              <p
                className="px-2.5 pb-0.5 pt-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#434651]"
              >
                {group.label}
              </p>
              {group.ids.map((id) => {
                const tf = all.find((t) => t.id === id);
                if (!tf) return null;
                const active = tf.id === timeframeId;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex w-full px-3 py-1.5 text-left font-medium hover:bg-[#2a2e39]",
                      active ? "text-[#2962ff]" : "text-[#d1d4dc]",
                    )}
                    style={{ fontSize }}
                    onClick={() => {
                      onChange?.(tf.id);
                      setOpen(false);
                    }}
                  >
                    {tf.label}
                    {tf.id === "1s" && (
                      <span className="ml-auto text-[9px] font-normal text-[#434651]">live</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          <p
            className="mx-2 mt-1 border-t px-0.5 pt-1.5 text-[9px] leading-snug text-[#434651]"
            style={{ borderColor: "#2a2e39" }}
          >
            {intervalBucketDescription(timeframeId)}
          </p>
        </div>
      )}
    </div>
  );
}

export type { ChartTimeframe };
