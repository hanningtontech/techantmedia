import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const accentRing = {
  orange: "border-orange-500/40 data-[state=open]:bg-orange-500/15 data-[state=open]:text-orange-300",
  teal: "border-teal-500/40 data-[state=open]:bg-teal-500/15 data-[state=open]:text-teal-300",
  violet: "border-violet-500/40 data-[state=open]:bg-violet-500/15 data-[state=open]:text-violet-300",
  slate: "border-white/15 data-[state=open]:bg-white/10 data-[state=open]:text-white",
};

type Accent = keyof typeof accentRing;

type Props = {
  title: string;
  description?: string;
  accent?: Accent;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

export function AdminSection({ title, description, accent = "orange", defaultOpen = true, className, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("rounded-xl border border-white/10 bg-[#12121a] overflow-hidden", className)}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full min-w-0 items-start justify-between gap-3 px-4 py-4 text-left transition-colors sm:px-5",
          "hover:bg-white/[0.04] border-b border-transparent data-[state=open]:border-white/10",
          accentRing[accent],
        )}
      >
        <div className="min-w-0 flex-1 admin-prose">
          <p className="font-semibold text-white">{title}</p>
          {description ? <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{description}</p> : null}
        </div>
        <ChevronDown
          className={cn("mt-0.5 h-5 w-5 shrink-0 text-orange-400 transition-transform duration-200", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-5 pt-4 sm:px-5 space-y-4 min-w-0">{children}</CollapsibleContent>
    </Collapsible>
  );
}
