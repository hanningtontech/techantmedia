import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatKes } from "@/lib/game/formatKes";
import { formatKesAbbrev } from "@/lib/game/formatKesAbbrev";
import { cn } from "@/lib/utils";

type AdaptiveKesAmountProps = {
  amount: number;
  className?: string;
  signed?: boolean;
  omitCurrency?: boolean;
};

/**
 * Shows full KES formatting when it fits; otherwise shortens (10k, 100k, …).
 * Hover / tap reveals the exact amount only when shortened.
 */
export function AdaptiveKesAmount({
  amount,
  className,
  signed = false,
  omitCurrency = false,
}: AdaptiveKesAmountProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

  const useCompactFull = Math.abs(amount) >= 1000;
  const full = omitCurrency
    ? `${signed && amount > 0 ? "+" : amount < 0 ? "−" : ""}${Math.abs(amount).toLocaleString("en-KE", {
        maximumFractionDigits: Math.abs(amount) >= 100 ? 0 : 2,
      })}`
    : formatKes(amount, { compact: useCompactFull });
  const abbreviated = formatKesAbbrev(amount, { signed, omitCurrency });
  const canAbbreviate = abbreviated !== full;
  const tooltipFull = omitCurrency ? formatKes(amount, { compact: useCompactFull }) : full;
  const display = overflows ? abbreviated : full;

  const measure = useCallback(() => {
    const container = containerRef.current;
    const probe = measureRef.current;
    if (!container || !probe) return;
    setOverflows(canAbbreviate && probe.offsetWidth > container.clientWidth + 1);
  }, [canAbbreviate, full]);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [measure, amount, full]);

  useLayoutEffect(() => {
    if (!overflows) setTipOpen(false);
  }, [overflows, amount, full]);

  const body = (
    <span
      ref={containerRef}
      className={cn(
        "relative inline-block max-w-full min-w-0 truncate tabular-nums",
        overflows && "cursor-help",
        className,
      )}
      title={overflows ? tooltipFull : undefined}
    >
      <span
        ref={measureRef}
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap"
        aria-hidden
      >
        {full}
      </span>
      {display}
    </span>
  );

  if (!overflows) return body;

  return (
    <Tooltip open={tipOpen} onOpenChange={setTipOpen} delayDuration={150}>
      <TooltipTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="inline-block max-w-full min-w-0 outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
          onClick={(e) => {
            e.preventDefault();
            setTipOpen((open) => !open);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setTipOpen((open) => !open);
            }
          }}
        >
          {body}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="tabular-nums">
        {tooltipFull}
      </TooltipContent>
    </Tooltip>
  );
}
