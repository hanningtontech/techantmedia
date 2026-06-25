import type { ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { simPanelExpanded, simTitle, simTitleLg, simHint } from "../simulationStyles";

type SimExpandablePanelProps = {
  title: string;
  description?: string;
  panelClassName?: string;
  dialogClassName?: string;
  /** Stretch panel to fill grid column height */
  fill?: boolean;
  children: ReactNode;
  expandedContent: ReactNode;
};

export function SimExpandablePanel({
  title,
  description,
  panelClassName,
  dialogClassName,
  fill = false,
  children,
  expandedContent,
}: SimExpandablePanelProps) {
  return (
    <Dialog>
      <section
        className={cn(
          panelClassName,
          "group relative flex flex-col",
          fill && "h-full",
        )}
      >
        <div className="mb-3 flex shrink-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className={simTitle}>{title}</h2>
            {description && <p className={cn(simHint, "mt-1")}>{description}</p>}
          </div>
          <DialogTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-zinc-400 hover:bg-white/10 hover:text-violet-300"
              title={`Expand ${title}`}
              aria-label={`Expand ${title}`}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </div>
        <div className={cn(fill && "flex min-h-0 flex-1 flex-col")}>{children}</div>
      </section>

      <DialogContent
        className={cn(
          "max-h-[92vh] overflow-y-auto border-white/15 bg-[#0a0a0f] text-zinc-100 sm:max-w-2xl",
          dialogClassName,
        )}
      >
        <DialogHeader>
          <DialogTitle className={simTitleLg}>{title}</DialogTitle>
          {description && <DialogDescription className={simHint}>{description}</DialogDescription>}
        </DialogHeader>
        <div className={simPanelExpanded}>{expandedContent}</div>
      </DialogContent>
    </Dialog>
  );
}
