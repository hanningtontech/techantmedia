import { useMemo, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import type { SiteBrand, SiteVideoItem, VideoCategory } from "@/lib/portfolio/portfolioTypes";
import { useShuffledOnce } from "@/hooks/useShuffledOnce";
import { useShuffledGalleryVideos } from "@/hooks/useShuffledGalleryVideos";

type Props = {
  brand: SiteBrand;
  videos: SiteVideoItem[];
  categories: VideoCategory[];
};

export function VideographyPanel({ brand, videos, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");

  const visibleCategoriesBase = useMemo(
    () => categories.filter((c) => c.visible),
    [categories],
  );

  const listedVideos = useMemo(() => videos.filter((v) => v.visible !== false), [videos]);

  const visibleCategories = useShuffledOnce(visibleCategoriesBase, "videography-categories");

  const shuffledVideos = useShuffledGalleryVideos(listedVideos, "videography-videos");

  const filtered = useMemo(() => {
    if (activeCategory === "all") return shuffledVideos;
    return shuffledVideos.filter((v) => v.categoryId === activeCategory);
  }, [activeCategory, shuffledVideos]);

  return (
    <div>
      <section className="border-b border-white/10 bg-[#0c0c12]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Videography</h2>
              <p className="mt-2 tm-muted">Films, reels, and event highlights.</p>
            </div>
            <a
              href={brand.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:border-orange-500/50 hover:text-orange-400"
            >
              <Play size={16} />
              YouTube channel
              <ExternalLink size={14} />
            </a>
          </div>

          {visibleCategories.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  activeCategory === "all"
                    ? "bg-orange-500/25 text-orange-200 ring-1 ring-orange-500/50"
                    : "border border-white/15 text-zinc-300 hover:text-white"
                }`}
              >
                All
              </button>
              {visibleCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? "bg-orange-500/25 text-orange-200 ring-1 ring-orange-500/50"
                      : "border border-white/15 text-zinc-300 hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1920px] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
        {filtered.length === 0 ? (
          <p className="tm-muted text-center">Videos coming soon.</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3 2xl:gap-10">
            {filtered.map((v) => (
              <article
                key={v.id}
                className={`overflow-hidden rounded-2xl border bg-[#12121a] ${
                  v.featured ? "border-orange-500/40 sm:col-span-2 xl:col-span-2" : "border-white/10"
                }`}
              >
                <div className="aspect-video">
                  <iframe
                    title={v.title}
                    src={`https://www.youtube.com/embed/${v.embedId}`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-white">{v.title}</h3>
                  <p className="mt-2 text-sm tm-muted">{v.description}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
