import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type CaseStudyPanelTheme =
  | "cyan"
  | "violet"
  | "teal"
  | "amber"
  | "emerald"
  | "rose";

const themes: Record<
  CaseStudyPanelTheme,
  { border: string; bg: string; header: string; badge: string; ring: string; chevron: string }
> = {
  cyan: {
    border: "border-cyan-500/35",
    bg: "bg-cyan-500/[0.06]",
    header: "bg-cyan-500/12 text-cyan-100",
    badge: "bg-cyan-500/25 text-cyan-200 ring-cyan-400/40",
    ring: "ring-cyan-500/15",
    chevron: "text-cyan-400",
  },
  violet: {
    border: "border-violet-500/35",
    bg: "bg-violet-500/[0.07]",
    header: "bg-violet-500/12 text-violet-100",
    badge: "bg-violet-500/25 text-violet-200 ring-violet-400/40",
    ring: "ring-violet-500/15",
    chevron: "text-violet-400",
  },
  teal: {
    border: "border-teal-500/35",
    bg: "bg-teal-500/[0.06]",
    header: "bg-teal-500/12 text-teal-100",
    badge: "bg-teal-500/25 text-teal-200 ring-teal-400/40",
    ring: "ring-teal-500/15",
    chevron: "text-teal-400",
  },
  amber: {
    border: "border-amber-500/35",
    bg: "bg-amber-500/[0.06]",
    header: "bg-amber-500/12 text-amber-100",
    badge: "bg-amber-500/25 text-amber-200 ring-amber-400/40",
    ring: "ring-amber-500/15",
    chevron: "text-amber-400",
  },
  emerald: {
    border: "border-emerald-500/35",
    bg: "bg-emerald-500/[0.06]",
    header: "bg-emerald-500/12 text-emerald-100",
    badge: "bg-emerald-500/25 text-emerald-200 ring-emerald-400/40",
    ring: "ring-emerald-500/15",
    chevron: "text-emerald-400",
  },
  rose: {
    border: "border-rose-500/35",
    bg: "bg-rose-500/[0.06]",
    header: "bg-rose-500/12 text-rose-100",
    badge: "bg-rose-500/25 text-rose-200 ring-rose-400/40",
    ring: "ring-rose-500/15",
    chevron: "text-rose-400",
  },
};

type Props = {
  step: number;
  title: string;
  description?: string;
  theme: CaseStudyPanelTheme;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** Color-coded, numbered sub-panel inside a case study — easy to see which section you are editing. */
export function XaiCaseStudyPanel({ step, title, description, theme, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const t = themes[theme];

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "mt-6 overflow-hidden rounded-xl border-l-4 ring-1",
        t.border,
        t.bg,
        t.ring,
      )}
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full min-w-0 items-start gap-4 px-4 py-4 text-left transition-colors sm:px-5",
          t.header,
          "hover:brightness-110",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ring-1 ring-inset",
            t.badge,
          )}
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm opacity-80 leading-relaxed">{description}</p> : null}
        </div>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 transition-transform duration-200", t.chevron, open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-5 border-t border-white/10 px-4 py-5 sm:px-5">{children}</CollapsibleContent>
    </Collapsible>
  );
}
