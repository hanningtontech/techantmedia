import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  beforeUrl: string;
  afterUrl: string;
  label?: string;
  featured?: boolean;
  className?: string;
};

export function BeforeAfterSlider({ beforeUrl, afterUrl, label, featured = false, className }: Props) {
  const [position, setPosition] = useState(50);
  const [loadedCount, setLoadedCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const onInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPosition(Number(e.target.value));
  }, []);

  const onImgLoad = useCallback(() => {
    setLoadedCount((n) => n + 1);
  }, []);

  if (!beforeUrl && !afterUrl) return null;

  const expectedLoads = (beforeUrl ? 1 : 0) + (afterUrl ? 1 : 0);
  const ready = loadedCount >= expectedLoads;

  return (
    <figure className={cn("@container relative mx-auto flex w-full flex-col", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-[#0a0a10]",
          featured ? "border-cyan-500/25 shadow-lg shadow-cyan-500/5" : "border-white/10",
        )}
      >
        <div
          className="relative h-[max(7.2rem,45cqw)] w-full touch-none select-none"
          style={{ contain: "layout paint" }}
        >
          {!ready ? (
            <div
              className="absolute inset-0 z-10 animate-pulse bg-gradient-to-br from-white/[0.04] to-white/[0.08]"
              aria-hidden
            />
          ) : null}
          <img
            src={afterUrl || beforeUrl}
            alt={label ? `${label} — after` : "After"}
            width={16}
            height={9}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
              ready ? "opacity-100" : "opacity-0",
            )}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={onImgLoad}
          />
          <div
            className={cn("absolute inset-0 overflow-hidden", dragging && "will-change-[clip-path]")}
            style={{
              clipPath: `inset(0 ${100 - position}% 0 0)`,
              transform: "translateZ(0)",
            }}
          >
            <img
              src={beforeUrl || afterUrl}
              alt={label ? `${label} — before` : "Before"}
              width={16}
              height={9}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
                ready ? "opacity-100" : "opacity-0",
              )}
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={onImgLoad}
            />
          </div>
          <CompareDivider position={position} />
          <input
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={onInput}
            onPointerDown={() => setDragging(true)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            aria-label={label ? `Compare before and after for ${label}` : "Compare before and after"}
            className="absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0"
          />
          <span className="font-mono-tech pointer-events-none absolute bottom-3 left-3 z-20 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
            Raw
          </span>
          <span className="font-mono-tech pointer-events-none absolute bottom-3 right-3 z-20 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
            Final
          </span>
        </div>
      </div>
      {label ? (
        <figcaption className="font-mono-tech mt-2 px-1 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}

function CompareDivider({ position }: { position: number }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-20 h-full w-0.5 bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.5)]"
      style={{ left: `${position}%`, transform: "translateX(-50%) translateZ(0)" }}
      aria-hidden
    >
      <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400/50 bg-black/80 text-xs text-cyan-200 shadow-lg">
        <span aria-hidden>&#8596;</span>
      </div>
    </div>
  );
}
