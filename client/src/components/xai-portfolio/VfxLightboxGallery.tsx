import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useInView } from "@/hooks/useInView";
import type { BreakdownImage } from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { cn } from "@/lib/utils";

type Props = {
  images: BreakdownImage[];
  title: string;
  /** Visual emphasis for featured case studies (CS1, CS3). */
  featured?: boolean;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.35;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function VfxLightboxGallery({ images, title, featured = false }: Props) {
  const sorted = [...images].sort((a, b) => a.order - b.order);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const { ref, inView } = useInView<HTMLDivElement>();

  if (!sorted.length) return null;

  const current = sorted[index];

  return (
    <>
      <div
        ref={ref}
        className={cn(
          "grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4",
          featured && "rounded-xl border border-violet-500/15 bg-violet-500/[0.03] p-3 sm:p-4",
        )}
      >
        {sorted.map((img, i) => (
          <button
            key={img.id}
            type="button"
            className="group relative overflow-hidden rounded-xl border border-white/10 bg-black text-left transition hover:border-violet-500/40"
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
          >
            {inView ? (
              <img
                src={img.url}
                alt={img.caption || `${title} breakdown ${i + 1}`}
                width={16}
                height={9}
                className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="aspect-video w-full animate-pulse bg-white/5" aria-hidden />
            )}
            <span className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
              <Expand className="h-4 w-4" />
            </span>
            {img.caption ? (
              <span className="font-mono-tech block border-t border-white/10 px-3 py-2 text-xs text-zinc-400">
                {img.caption}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[min(96vw,90rem)] max-w-[min(96vw,90rem)] gap-0 border-white/10 bg-[#0a0a10] p-0 sm:max-w-[min(96vw,90rem)]"
        >
          <div className="relative flex flex-col">
            <button
              type="button"
              className="absolute right-4 top-4 z-10 rounded-full bg-black/80 p-2.5 text-zinc-200 shadow-lg hover:bg-black hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <ZoomableLightboxImage key={current.url} src={current.url} alt={current.caption || title} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-8">
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-white/5 p-3 text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
                disabled={index <= 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <p className="font-mono-tech min-w-0 flex-1 px-2 text-center text-sm text-zinc-400 sm:text-base">
                {current.caption || `Asset ${index + 1} / ${sorted.length}`}
                <span className="mt-1 block text-[10px] uppercase tracking-wider text-zinc-600">
                  Scroll or pinch to zoom · drag to pan
                </span>
              </p>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-white/5 p-3 text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
                disabled={index >= sorted.length - 1}
                onClick={() => setIndex((i) => Math.min(sorted.length - 1, i + 1))}
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ZoomableLightboxImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ active: boolean; startX: number; startY: number; ox: number; oy: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetView();
  }, [src, resetView]);

  const zoomBy = (delta: number) => {
    setScale((s) => {
      const next = clampZoom(Number((s + delta).toFixed(2)));
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!panRef.current?.active) return;
    setOffset({
      x: panRef.current.ox + (e.clientX - panRef.current.startX),
      y: panRef.current.oy + (e.clientY - panRef.current.startY),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    panRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <div className="relative flex min-h-[min(72vh,680px)] flex-col bg-black sm:min-h-[min(84vh,900px)]">
      <div className="absolute left-4 top-4 z-10 flex gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-black/80 p-2 text-zinc-200 hover:bg-black hover:text-white disabled:opacity-40"
          onClick={() => zoomBy(ZOOM_STEP)}
          disabled={scale >= MAX_ZOOM}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-black/80 p-2 text-zinc-200 hover:bg-black hover:text-white disabled:opacity-40"
          onClick={() => zoomBy(-ZOOM_STEP)}
          disabled={scale <= MIN_ZOOM}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-black/80 p-2 text-zinc-200 hover:bg-black hover:text-white"
          onClick={resetView}
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <span className="font-mono-tech self-center rounded-lg bg-black/80 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400">
          {Math.round(scale * 100)}%
        </span>
      </div>
      <div
        ref={viewportRef}
        className="flex flex-1 cursor-grab items-center justify-center overflow-hidden px-4 py-8 active:cursor-grabbing sm:px-10 sm:py-12"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={resetView}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[min(80vh,820px)] w-auto max-w-full select-none object-contain transition-transform duration-75"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

