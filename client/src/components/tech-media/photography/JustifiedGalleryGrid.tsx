import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import justifiedLayout from "justified-layout";
import type { SitePhotoItem } from "@/lib/portfolio/portfolioTypes";
import { getPhotoAspectRatio } from "@/lib/portfolio/photoDimensions";
import { cn } from "@/lib/utils";
import { Bookmark, Check } from "lucide-react";

type Props = {
  items: SitePhotoItem[];
  onOpen: (photoId: string) => void;
  className?: string;
  /** Target row height in px (scales with viewport). */
  targetRowHeight?: number;
  boxSpacing?: number;
  selectable?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (photo: SitePhotoItem) => void;
  /** Floating bookmark on each tile (e.g. gallery “see all” pages). */
  showInspoBookmarks?: boolean;
  isInspoBookmarked?: (id: string) => boolean;
  onInspoBookmark?: (photo: SitePhotoItem) => void;
  /** Shrink grid height to fit rows (category previews). */
  fitContent?: boolean;
};

type LayoutBox = {
  photo: SitePhotoItem;
  top: number;
  left: number;
  width: number;
  height: number;
};

function useContainerWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}

/** Row height for justified rows — fitContent must not divide by total item count (crushes previews). */
function resolveTargetRowHeight(
  containerWidth: number,
  itemCount: number,
  targetRowHeight: number,
  fitContent: boolean,
): number {
  if (!fitContent) {
    return Math.max(140, Math.min(targetRowHeight, Math.round(containerWidth / (itemCount > 6 ? 5 : 4))));
  }

  const minRow = Math.max(120, Math.round(targetRowHeight * 0.72));
  const idealTileWidth = Math.max(targetRowHeight * 1.1, 150);
  const photosPerRow = Math.min(
    itemCount,
    Math.max(3, Math.floor(containerWidth / idealTileWidth)),
  );
  const fromWidth = Math.round(containerWidth / photosPerRow);
  return Math.max(minRow, Math.min(targetRowHeight, fromWidth));
}

function GalleryJustifiedTile({
  box,
  onOpen,
  selectable,
  selected,
  onToggleSelect,
  showInspoBookmark,
  inspoBookmarked,
  onInspoBookmark,
}: {
  box: LayoutBox;
  onOpen: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (photo: SitePhotoItem) => void;
  showInspoBookmark?: boolean;
  inspoBookmarked?: boolean;
  onInspoBookmark?: (photo: SitePhotoItem) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const { photo } = box;

  const onClick = () => {
    if (selectable && onToggleSelect) {
      onToggleSelect(photo);
      return;
    }
    onOpen(photo.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "absolute cursor-pointer overflow-hidden rounded-none border-0 bg-[#08080c] p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 focus-visible:outline-offset-0",
        selectable && selected && "ring-2 ring-inset ring-orange-400",
      )}
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={cn(
          "block h-full w-full transition-opacity duration-400",
          loaded ? "opacity-100" : "opacity-0",
        )}
        style={{ objectFit: "cover" }}
      />
      {!loaded ? (
        <span
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-800"
          aria-hidden
        />
      ) : null}
      {selectable ? (
        <span
          className={cn(
            "absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/40 shadow-md transition-colors",
            selected ? "bg-orange-500 text-black" : "bg-black/50 text-white",
          )}
          aria-hidden
        >
          {selected ? <Check className="h-4 w-4" /> : null}
        </span>
      ) : null}
      {showInspoBookmark && onInspoBookmark ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInspoBookmark(photo);
          }}
          className={cn(
            "absolute bottom-1.5 right-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-all",
            inspoBookmarked
              ? "bg-orange-500 text-black ring-1 ring-orange-300/80"
              : "bg-black/55 text-white backdrop-blur-sm hover:bg-black/75",
          )}
          aria-label={inspoBookmarked ? "Remove from Inspos" : "Add to Inspos"}
        >
          <Bookmark className={cn("h-4 w-4", inspoBookmarked && "fill-current")} />
        </button>
      ) : null}
    </div>
  );
}

export function JustifiedGalleryGrid({
  items,
  onOpen,
  className,
  targetRowHeight = 220,
  boxSpacing = 2,
  selectable,
  isSelected,
  onToggleSelect,
  showInspoBookmarks,
  isInspoBookmarked,
  onInspoBookmark,
  fitContent = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const [refinedRatios, setRefinedRatios] = useState<Record<string, number>>({});

  const aspectRatios = useMemo(
    () =>
      items.map((photo) => {
        const refined = refinedRatios[photo.id];
        if (refined && refined > 0) return refined;
        return getPhotoAspectRatio(photo);
      }),
    [items, refinedRatios],
  );

  const layout = useMemo(() => {
    if (!containerWidth || !items.length) {
      return { boxes: [] as LayoutBox[], height: 0 };
    }

    const rowHeight = resolveTargetRowHeight(
      containerWidth,
      items.length,
      targetRowHeight,
      fitContent,
    );

    const geometry = justifiedLayout(aspectRatios, {
      containerWidth,
      targetRowHeight: rowHeight,
      boxSpacing,
      containerPadding: 0,
      maxNumRows: Number.POSITIVE_INFINITY,
      showWidows: true,
      widowLayoutStyle: "justify",
    });

    const boxes: LayoutBox[] = geometry.boxes.map((b, i) => ({
      photo: items[i]!,
      top: b.top,
      left: b.left,
      width: b.width,
      height: b.height,
    }));

    return { boxes, height: geometry.containerHeight };
  }, [aspectRatios, boxSpacing, containerWidth, fitContent, items, targetRowHeight]);

  const onImageMeasured = useCallback((id: string, ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    setRefinedRatios((prev) => {
      const existing = prev[id];
      if (existing != null && Math.abs(existing - ratio) < 0.02) return prev;
      return { ...prev, [id]: ratio };
    });
  }, []);

  if (!items.length) return null;

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
      style={{
        height: layout.height || 1,
        minHeight:
          fitContent && items.length
            ? Math.max(180, Math.round(targetRowHeight * 0.85))
            : fitContent
              ? 0
              : 120,
      }}
    >
      {layout.boxes.map((box) => (
        <GalleryJustifiedTile
          key={box.photo.id}
          box={box}
          onOpen={onOpen}
          selectable={selectable}
          selected={isSelected?.(box.photo.id)}
          onToggleSelect={onToggleSelect}
          showInspoBookmark={showInspoBookmarks}
          inspoBookmarked={isInspoBookmarked?.(box.photo.id)}
          onInspoBookmark={onInspoBookmark}
        />
      ))}
      {/* Hidden probes refine aspect ratios for legacy photos missing metadata */}
      <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
        {items.map((photo) =>
          photo.aspectRatio ? null : (
            <img
              key={`probe-${photo.id}`}
              src={photo.src}
              alt=""
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  onImageMeasured(photo.id, img.naturalWidth / img.naturalHeight);
                }
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}
