import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { PhotoCategory, SitePhotoItem } from "@/lib/portfolio/portfolioTypes";
import { PhotoLightbox } from "./PhotoLightbox";

type Props = {
  categories: PhotoCategory[];
  photos: SitePhotoItem[];
};

export function CategoryGallery({ categories, photos }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.visible).sort((a, b) => a.order - b.order),
    [categories],
  );

  const photosByCategory = useMemo(() => {
    const map = new Map<string, SitePhotoItem[]>();
    for (const cat of visibleCategories) map.set(cat.id, []);
    for (const photo of [...photos].sort((a, b) => a.order - b.order)) {
      const list = map.get(photo.categoryId);
      if (list) list.push(photo);
      else if (map.has(photo.categoryId)) map.get(photo.categoryId)!.push(photo);
    }
    return map;
  }, [photos, visibleCategories]);

  const filteredSections = useMemo(() => {
    if (activeCategory === "all") {
      return visibleCategories
        .map((cat) => ({ cat, items: photosByCategory.get(cat.id) ?? [] }))
        .filter((s) => s.items.length > 0);
    }
    const cat = visibleCategories.find((c) => c.id === activeCategory);
    if (!cat) return [];
    return [{ cat, items: photosByCategory.get(cat.id) ?? [] }].filter((s) => s.items.length > 0);
  }, [activeCategory, photosByCategory, visibleCategories]);

  const flatImages = useMemo(
    () =>
      filteredSections.flatMap((s) =>
        s.items.map((p) => ({ src: p.src, alt: p.alt, id: p.id })),
      ),
    [filteredSections],
  );

  const openLightbox = (photoId: string) => {
    const idx = flatImages.findIndex((i) => i.id === photoId);
    if (idx >= 0) setLightboxIndex(idx);
  };

  if (!photos.length) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="tm-muted text-center">Gallery coming soon.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1920px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Gallery</h2>
          <p className="mt-2 tm-muted max-w-xl">Browse work by category—tap any image to view full size.</p>
        </motion.div>
        <div className="flex flex-wrap gap-2">
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
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? "bg-orange-500/25 text-orange-200 ring-1 ring-orange-500/50"
                    : "border border-white/15 text-zinc-300 hover:border-white/30 hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <motion.div
        className="mt-10 space-y-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        {filteredSections.map(({ cat, items }) => (
          <motion.div
            key={cat.id}
            id={`gallery-${cat.slug}`}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
          >
            <h3 className="text-xl font-semibold text-white">{cat.label}</h3>
            {cat.description && <p className="mt-1 text-sm tm-muted">{cat.description}</p>}
            <motion.div className="tm-masonry mt-6">
              {items.map((img, i) => (
                <motion.button
                  key={img.id}
                  type="button"
                  initial={{ opacity: 0, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  className="tm-masonry-item block w-full overflow-hidden rounded-xl border border-white/10 focus-visible:ring-2 focus-visible:ring-orange-500"
                  onClick={() => openLightbox(img.id)}
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    className={`w-full object-cover transition-transform duration-500 hover:scale-105 ${
                      img.tall ? "min-h-[280px] lg:min-h-[360px]" : "min-h-[200px] lg:min-h-[240px]"
                    }`}
                    loading="lazy"
                  />
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        ))}
      </motion.div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          images={flatImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </section>
  );
}
