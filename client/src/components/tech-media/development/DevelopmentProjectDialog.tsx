import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PortfolioProject } from "@/lib/portfolio/portfolioTypes";
import { cn } from "@/lib/utils";

const badgeClass: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  slate: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  amber: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  blue: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  purple: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  orange: "bg-orange-500/15 text-orange-400 ring-orange-500/30",
};

type Props = {
  project: PortfolioProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DevelopmentProjectDialog({ project, open, onOpenChange }: Props) {
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [project?.id]);

  if (!project) return null;

  const images = project.images.filter(Boolean);
  const hasMultiple = images.length > 1;
  const currentSrc = images[imageIndex] ?? images[0];

  const goPrev = () => setImageIndex((i) => (i - 1 + images.length) % images.length);
  const goNext = () => setImageIndex((i) => (i + 1) % images.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(90vh,calc(100dvh-1.5rem))] w-[min(92vw,calc(100vw-1.25rem))] max-w-3xl flex-col gap-0 overflow-hidden border-white/10 bg-[#0e0e14] p-0 text-zinc-100 sm:max-w-3xl"
      >
        <div className="relative shrink-0 border-b border-white/10 bg-[#12121a]">
          {currentSrc ? (
            <img
              src={currentSrc}
              alt={`${project.title} screenshot ${imageIndex + 1}`}
              className="max-h-[min(50vh,28rem)] w-full object-contain"
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-zinc-600">No screenshots yet</div>
          )}

          {hasMultiple && (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white hover:bg-black/80"
                onClick={goPrev}
                aria-label="Previous screenshot"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                className="absolute right-12 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white hover:bg-black/80 sm:right-14"
                onClick={goNext}
                aria-label="Next screenshot"
              >
                <ChevronRight size={22} />
              </button>
              <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-zinc-300">
                {imageIndex + 1} / {images.length}
              </p>
            </>
          )}
        </div>

        {hasMultiple && (
          <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 bg-[#0c0c12] px-4 py-3">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setImageIndex(i)}
                className={cn(
                  "h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition",
                  i === imageIndex ? "border-teal-400 ring-1 ring-teal-400/40" : "border-white/10 opacity-70 hover:opacity-100",
                )}
                aria-label={`View screenshot ${i + 1}`}
                aria-current={i === imageIndex}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-xl font-bold text-white sm:text-2xl">{project.title}</DialogTitle>
            <DialogDescription className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
              {project.description}
            </DialogDescription>
          </DialogHeader>

          {project.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {project.badges.map((b) => (
                <span
                  key={b.label}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${badgeClass[b.tone] ?? badgeClass.slate}`}
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {project.links.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {project.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/20 px-4 py-2 text-sm font-semibold text-teal-300 hover:bg-teal-500/30"
                >
                  {l.label}
                  <ExternalLink size={14} />
                </a>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
