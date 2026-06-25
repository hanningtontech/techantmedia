import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { JustifiedGalleryGrid } from "@/components/tech-media/photography/JustifiedGalleryGrid";
import { PhotoLightbox } from "@/components/tech-media/photography/PhotoLightbox";
import { ClientAccountPromo } from "@/components/tech-media/photography/ClientAccountPromo";
import { InspoSelectionBar } from "@/components/tech-media/photography/InspoSelectionBar";
import { InspoGalleryHelp } from "@/components/tech-media/photography/InspoGalleryHelp";
import { useInspo } from "@/contexts/InspoContext";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { buildPhotosByCategory, findCategoryBySlug } from "@/lib/portfolio/galleryUtils";
import type { SitePhotoItem } from "@/lib/portfolio/portfolioTypes";
import { scrollPageToTop } from "@/lib/scrollToTop";
import { useShuffledGalleryPhotos } from "@/hooks/useShuffledGalleryPhotos";

export default function GalleryCategoryPage() {
  const [, params] = useRoute("/photography/gallery/:slug");
  const slug = params?.slug ?? "";
  const { content } = useSiteContent();
  const { photoGallery, photoCategories, brand } = content;
  const inspo = useInspo();
  const [selectMode, setSelectMode] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    scrollPageToTop("instant");
  }, [slug]);

  const visibleCategories = useMemo(
    () => photoCategories.filter((c) => c.visible).sort((a, b) => a.order - b.order),
    [photoCategories],
  );

  const category = useMemo(
    () => findCategoryBySlug(photoCategories, slug),
    [photoCategories, slug],
  );

  const itemsOrdered = useMemo(() => {
    if (!category) return [];
    const map = buildPhotosByCategory(photoGallery, visibleCategories);
    return map.get(category.id) ?? [];
  }, [category, photoGallery, visibleCategories]);

  const items = useShuffledGalleryPhotos(itemsOrdered, `gallery-${slug}`);

  const flatImages = useMemo(
    () => items.map((p) => ({ src: p.src, alt: p.alt, id: p.id })),
    [items],
  );

  const onToggleInspo = (photo: SitePhotoItem) => {
    inspo.toggle({
      id: photo.id,
      src: photo.src,
      alt: photo.alt,
      categoryId: photo.categoryId,
      categoryLabel: category?.label,
    });
  };

  if (!category) {
    return (
      <TechMediaLayout fullBleedMain>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <p className="text-white">Category not found.</p>
          <Link href="/photography" className="mt-4 inline-block text-orange-400 hover:underline">
            Back to photography
          </Link>
        </div>
      </TechMediaLayout>
    );
  }

  return (
    <TechMediaLayout fullBleedMain>
      <div className="border-b border-white/10 bg-[#08080c]/90">
        <div className="mx-auto flex max-w-[min(100%,90rem)] flex-wrap items-center justify-between gap-4 px-3 py-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/photography"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Gallery
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-white sm:text-2xl">{category.label}</h1>
              {category.description ? (
                <p className="mt-0.5 text-sm tm-muted">{category.description}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectMode((v) => !v)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                selectMode
                  ? "bg-orange-500/30 text-orange-100 ring-1 ring-orange-500/50"
                  : "border border-white/15 text-zinc-300 hover:text-white"
              }`}
            >
              {selectMode ? "Done selecting" : "Select for Inspos"}
            </button>
            <Link
              href="/inspos"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white"
            >
              My Inspos ({inspo.count})
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[min(100%,90rem)] px-3 py-4 sm:px-6 lg:px-8">
        <ClientAccountPromo variant="compact" />
      </div>

      <div className={selectMode || inspo.count ? "pb-24" : undefined}>
      {items.length ? (
        <JustifiedGalleryGrid
          items={items}
          onOpen={(id) => {
            if (selectMode) return;
            const idx = flatImages.findIndex((i) => i.id === id);
            if (idx >= 0) setLightboxIndex(idx);
          }}
          className="tm-gallery-justified"
          targetRowHeight={240}
          boxSpacing={2}
          selectable={selectMode}
          isSelected={inspo.isSelected}
          onToggleSelect={onToggleInspo}
          showInspoBookmarks
          isInspoBookmarked={inspo.isSelected}
          onInspoBookmark={onToggleInspo}
        />
      ) : (
        <p className="tm-muted py-16 text-center">No photos in this category yet.</p>
      )}
      </div>

      {lightboxIndex !== null && !selectMode ? (
        <PhotoLightbox
          images={flatImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      ) : null}

      <InspoGalleryHelp
        brandName={brand.name}
        className={inspo.count > 0 ? "bottom-24 sm:bottom-20" : undefined}
      />
      <InspoSelectionBar brandName={brand.name} />
    </TechMediaLayout>
  );
}
