import { BlockGameUniversalChart } from "@/pages/simulation/components/BlockGameUniversalChart";
import { cn } from "@/lib/utils";

/** Inline universal chart — same component as /simulation and /game/chart. */
export function PlayerInlineChart({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#2a2e39]", className)}>
      <BlockGameUniversalChart className="h-full min-h-0" />
    </div>
  );
}
