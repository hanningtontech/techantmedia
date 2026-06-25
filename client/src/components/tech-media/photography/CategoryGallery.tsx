import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { ClientAccountPromo } from "@/components/tech-media/photography/ClientAccountPromo";
import type { PhotoCategory, SitePhotoItem } from "@/lib/portfolio/portfolioTypes";
import { JustifiedGalleryGrid } from "@/components/tech-media/photography/JustifiedGalleryGrid";
import { PhotoLightbox } from "./PhotoLightbox";
import { getCategoryAccent } from "@/lib/portfolio/categoryAccent";
import { buildPhotosByCategory } from "@/lib/portfolio/galleryUtils";
import { cn } from "@/lib/utils";
import { useGalleryPreviewLimit } from "@/hooks/useGalleryPreviewLimit";
import { useShuffledOnce } from "@/hooks/useShuffledOnce";
import { useShuffledPhotosByCategory } from "@/hooks/useShuffledPhotosByCategory";

type Props = {
  categories: PhotoCategory[];
  photos: SitePhotoItem[];
};

/** Header / filters: padded on all breakpoints. */
const GALLERY_SHELL =
  "mx-auto w-full max-w-[min(100%,90rem)] px-3 sm:px-6 lg:px-8 min-[1500px]:max-w-none min-[1500px]:px-[10px]";

/** Category cards: inset from screen edges on phone so corners and coloured borders breathe. */
const GALLERY_CARDS_SHELL =
  "tm-gallery-category-shell mx-auto mt-10 flex w-full max-w-[min(100%,90rem)] flex-col gap-6 px-3 sm:gap-10 sm:px-6 lg:px-8 min-[1500px]:mt-12 min-[1500px]:max-w-none min-[1500px]:gap-12 min-[1500px]:px-[10px]";

export function CategoryGallery({ categories, photos }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { previewCount, previewRowHeight, isUltraWide } = useGalleryPreviewLimit();

  const visibleCategoriesBase = useMemo(
    () => categories.filter((c) => c.visible),
    [categories],
  );

  const visibleCategories = useShuffledOnce(visibleCategoriesBase, "photo-gallery-categories");

  const photosByCategoryOrdered = useMemo(
    () => buildPhotosByCategory(photos, visibleCategories),
    [photos, visibleCategories],
  );

  const photosByCategory = useShuffledPhotosByCategory(photosByCategoryOrdered, "photo-gallery");

  const filteredSections = useMemo(() => {
    if (activeCategory === "all") {
      return visibleCategories
        .map((cat) => ({ cat, items: photosByCategory.get(cat.id) ?? [] }))
        .filter((s) => s.items.length > 0);
    }
    const cat = visibleCategories.find((c) => c.id === activeCategory);
    if (!cat) return [];
    const items = photosByCategory.get(cat.id) ?? [];
    return items.length ? [{ cat, items }] : [];
  }, [activeCategory, photosByCategory, visibleCategories]);

  const flatImages = useMemo(
    () =>
      filteredSections.flatMap((s) =>
        s.items.slice(0, previewCount).map((p) => ({ src: p.src, alt: p.alt, id: p.id })),
      ),
    [filteredSections, previewCount],
  );

  const openLightbox = (photoId: string) => {
    const idx = flatImages.findIndex((i) => i.id === photoId);
    if (idx >= 0) setLightboxIndex(idx);
  };

  const totalPhotos = useMemo(
    () => [...photosByCategory.values()].reduce((n, list) => n + list.length, 0),
    [photosByCategory],
  );

  if (!totalPhotos) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="tm-muted text-center">Gallery coming soon.</p>
      </section>
    );
  }

  return (
    <section className="w-full py-12 sm:py-16 lg:py-20">
      <div className={cn(GALLERY_SHELL, "flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6")}>
        <div>
          <h2 className="tm-heading-section font-bold text-white">Gallery</h2>
          <p className="mt-2 tm-muted max-w-xl">
            Browse by category—open a category to see every photo, tap an image to enlarge, or build Inspos from the full gallery.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeCategory === "all"
                ? "bg-orange-500/25 text-orange-200 ring-1 ring-orange-500/50"
                : "border border-white/15 text-zinc-300 hover:border-white/30 hover:text-white"
            }`}
          >
            All
          </button>
          {visibleCategories.map((cat) => {
            const count = photosByCategory.get(cat.id)?.length ?? 0;
            if (count === 0) return null;
            return (
              <Link
                key={cat.id}
                href={`/photography/gallery/${cat.slug}`}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-200"
              >
                {cat.label}
              </Link>
            );
          })}
          <Link
            href="/inspos"
            className="rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-200 hover:bg-orange-500/20"
          >
            Inspos
          </Link>
        </div>
      </div>

      <div className={cn(GALLERY_SHELL, "mt-6")}>
        <ClientAccountPromo variant="compact" />
      </div>

      <div className={GALLERY_CARDS_SHELL}>
        {filteredSections.map(({ cat, items }) => {
          const preview = items.slice(0, previewCount);
          const hasMore = items.length > previewCount;
          const categoryHref = `/photography/gallery/${cat.slug}`;
          const accent = getCategoryAccent(cat.slug, cat.id);
          return (
            <div
              key={cat.id}
              id={`gallery-${cat.slug}`}
              className={cn(
                "tm-gallery-category-card overflow-hidden border-2 p-4 ring-1",
                "rounded-2xl sm:rounded-3xl sm:p-6 lg:p-8",
                "min-[1500px]:rounded-[1.75rem] min-[1500px]:p-10 min-[1500px]:py-11",
                accent.border,
                accent.ring,
                accent.surface,
                "shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)]",
              )}
            >
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.06] pb-5 sm:mb-6 min-[1500px]:mb-8 min-[1500px]:pb-7">
                <div className="min-w-0">
                  <Link href={categoryHref} className="group inline-block">
                    <h3
                      className={cn(
                        "text-2xl font-bold tracking-tight transition-opacity group-hover:opacity-90 sm:text-[1.65rem]",
                        "min-[1500px]:text-3xl",
                        accent.title,
                      )}
                    >
                      {cat.label}
                    </h3>
                  </Link>
                  {cat.description ? (
                    <p className={cn("mt-1.5 max-w-2xl text-sm leading-relaxed", accent.muted)}>
                      {cat.description}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={categoryHref}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-2.5 text-sm font-semibold ring-1 transition",
                    accent.button,
                    accent.buttonRing,
                  )}
                >
                  {hasMore ? `View all (${items.length})` : `View gallery (${items.length})`}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <JustifiedGalleryGrid
                items={preview}
                onOpen={openLightbox}
                className="tm-gallery-category-grid w-full min-h-[12rem] overflow-hidden rounded-xl sm:min-h-[16rem] lg:min-h-[18rem] min-[1500px]:min-h-[20rem]"
                targetRowHeight={previewRowHeight}
                boxSpacing={isUltraWide ? 8 : 6}
                fitContent
              />
            </div>
          );
        })}
      </div>

      {lightboxIndex !== null ? (
        <PhotoLightbox
          images={flatImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      ) : null}
    </section>
  );
}
