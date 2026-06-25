import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, Film, Plus, Star, Trash2 } from "lucide-react";
import { AdminField } from "@/components/admin/shared/AdminField";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import {
  FilterChip,
  ListedCheckbox,
  sortByOrder,
  SortButtons,
  swapOrder,
} from "@/lib/admin/adminListControls";
import { listItemAccent } from "@/lib/admin/listItemAccent";
import { LIST_ITEM_ACCENT_CLASS } from "@/lib/admin/listItemAccent";
import { newPortfolioId } from "@/lib/portfolio/portfolioFirestore";
import type { SiteContent, SiteVideoItem, VideoCategory } from "@/lib/portfolio/portfolioTypes";
import { extractYoutubeId, youtubeThumbnailUrl } from "@/lib/tech-media/youtubeUtils";
import { cn } from "@/lib/utils";

type Props = {
  draft: SiteContent;
  setDraft: Dispatch<SetStateAction<SiteContent>>;
  persistDraft: (
    updater: (current: SiteContent) => SiteContent,
    successMessage?: string,
  ) => Promise<void>;
};

function categoryTileSpan(videoCount: number): string {
  if (videoCount >= 5) return "sm:col-span-2 lg:row-span-2";
  if (videoCount >= 2) return "sm:col-span-2";
  return "";
}

function CategoryTile({
  cat,
  index,
  videoCount,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  cat: VideoCategory;
  index: number;
  videoCount: number;
  onUpdate: (patch: Partial<VideoCategory>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const accent = listItemAccent(index);
  const styles = LIST_ITEM_ACCENT_CLASS[accent];

  return (
    <div
      className={cn(
        "admin-panel flex min-h-[88px] flex-col justify-between p-3 ring-1",
        styles.wrap,
        categoryTileSpan(videoCount),
      )}
    >
      <div className="flex items-start gap-2">
        <SortButtons onUp={onMoveUp} onDown={onMoveDown} />
        <div className="min-w-0 flex-1">
          <input
            className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-white outline-none placeholder:text-zinc-600 focus:ring-0"
            value={cat.label}
            placeholder="Category name"
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            {videoCount} video{videoCount === 1 ? "" : "s"}
            {!cat.visible ? " · hidden" : ""}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-zinc-600 transition-colors hover:text-red-400"
          onClick={onDelete}
          aria-label="Delete category"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
        <ListedCheckbox checked={cat.visible} onChange={(visible) => onUpdate({ visible })} compact />
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
            cat.visible ? styles.badge : "bg-zinc-800 text-zinc-500 ring-zinc-700",
          )}
        >
          #{index + 1}
        </span>
      </div>
    </div>
  );
}

function VideoEditorCard({
  video,
  categories,
  expanded,
  onToggle,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  video: SiteVideoItem;
  categories: VideoCategory[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<SiteVideoItem>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const embedId = extractYoutubeId(video.embedId);
  const thumb = youtubeThumbnailUrl(video.embedId);
  const catLabel = categories.find((c) => c.id === video.categoryId)?.label ?? "Uncategorized";

  return (
    <article
      className={cn(
        "admin-panel overflow-hidden transition-shadow",
        video.featured && "sm:col-span-2",
        !video.visible && "opacity-60",
      )}
    >
      <div className="flex gap-2 p-2">
        <SortButtons onUp={onMoveUp} onDown={onMoveDown} />
        <button
          type="button"
          className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-900"
          onClick={onToggle}
        >
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-zinc-600">
              <Film className="h-6 w-6" />
            </span>
          )}
          {video.featured ? (
            <span className="absolute left-1 top-1 rounded bg-orange-500/90 px-1 py-0.5 text-[9px] font-bold uppercase text-white">
              Wide
            </span>
          ) : null}
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggle}>
          <p className="truncate text-sm font-medium text-white">{video.title || "Untitled video"}</p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">{catLabel}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <ListedCheckbox
              checked={video.visible !== false}
              onChange={(visible) => onUpdate({ visible })}
              compact
            />
            {embedId ? (
              <span className="font-mono text-[10px] text-zinc-600">{embedId}</span>
            ) : (
              <span className="text-[10px] text-amber-500/90">Needs YouTube ID</span>
            )}
          </div>
        </button>
        <button
          type="button"
          className="shrink-0 self-start rounded-md p-1 text-zinc-500 hover:text-zinc-200"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-white/10 p-3 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="Title" tone="orange" fieldSize="medium">
              <input
                className="admin-input"
                value={video.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
              />
            </AdminField>
            <AdminField label="Category" tone="orange" fieldSize="medium">
              <select
                className="admin-input"
                value={video.categoryId}
                onChange={(e) => onUpdate({ categoryId: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </AdminField>
          </div>
          <AdminField label="YouTube ID or URL" tone="orange">
            <input
              className="admin-input font-mono text-sm"
              value={video.embedId}
              placeholder="dQw4w9WgXcQ or full YouTube URL"
              onChange={(e) => onUpdate({ embedId: e.target.value })}
            />
          </AdminField>
          <AdminField label="Description" tone="orange">
            <textarea
              className="admin-input min-h-[64px] resize-y text-sm"
              value={video.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
            />
          </AdminField>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={video.featured}
                onChange={(e) => onUpdate({ featured: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-white/20 accent-orange-500"
              />
              <Star className="h-3.5 w-3.5 text-orange-400" aria-hidden />
              Featured wide card on site
            </label>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-red-400 hover:underline"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
          {embedId ? (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <div className="aspect-video max-h-24">
                <iframe
                  title={video.title}
                  src={`https://www.youtube.com/embed/${embedId}`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function VideographyAdminSection({ draft, setDraft, persistDraft }: Props) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);

  const categories = useMemo(() => sortByOrder(draft.videoCategories), [draft.videoCategories]);
  const videos = useMemo(() => sortByOrder(draft.videoGallery), [draft.videoGallery]);
  const firstCategoryId = categories[0]?.id ?? "vid-events";

  const videoCountByCategory = (id: string) => draft.videoGallery.filter((v) => v.categoryId === id).length;

  const filteredVideos =
    filterCategory === "all" ? videos : videos.filter((v) => v.categoryId === filterCategory);

  const updateCategories = (next: VideoCategory[]) => {
    setDraft((d) => ({ ...d, videoCategories: sortByOrder(next).map((c, i) => ({ ...c, order: i })) }));
  };

  const moveCategory = (id: string, delta: number) => {
    updateCategories(swapOrder(draft.videoCategories, id, delta));
  };

  const moveVideo = (id: string, delta: number) => {
    setDraft((d) => ({ ...d, videoGallery: swapOrder(d.videoGallery, id, delta) }));
  };

  const addCategory = () => {
    const order = draft.videoCategories.length;
    updateCategories([
      ...draft.videoCategories,
      {
        id: newPortfolioId(),
        slug: `video-cat-${order}`,
        label: "New category",
        order,
        visible: true,
      },
    ]);
  };

  const addVideo = () => {
    const order = draft.videoGallery.length;
    const id = newPortfolioId();
    setDraft((d) => ({
      ...d,
      videoGallery: [
        ...d.videoGallery,
        {
          id,
          title: "New video",
          description: "",
          embedId: "",
          categoryId: filterCategory !== "all" ? filterCategory : firstCategoryId,
          featured: false,
          visible: true,
          order,
        },
      ],
    }));
    setExpandedVideoId(id);
  };

  const deleteCategory = (catId: string) => {
    void persistDraft(
      (d) => ({
        ...d,
        videoCategories: d.videoCategories.filter((c) => c.id !== catId),
        videoGallery: d.videoGallery.map((v) =>
          v.categoryId === catId ? { ...v, categoryId: firstCategoryId } : v,
        ),
      }),
      "Video category removed.",
    );
  };

  const deleteVideo = (videoId: string) => {
    void persistDraft(
      (d) => ({ ...d, videoGallery: d.videoGallery.filter((v) => v.id !== videoId) }),
      "Video removed.",
    );
    if (expandedVideoId === videoId) setExpandedVideoId(null);
  };

  return (
    <AdminPage
      title="Videography"
      description="Manage categories and YouTube videos. Uncheck Listed to hide items from the public page without deleting them."
      width="wide"
      layout="stack"
      showLayoutGuide={false}
      actions={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/40"
          onClick={addVideo}
        >
          <Plus className="h-4 w-4" />
          Add video
        </button>
      }
    >
      <section className="admin-span-full">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Categories</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Larger tiles hold more videos. Reorder with arrows; uncheck Listed to hide a tab on the site.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-300 hover:bg-teal-500/20"
            onClick={addCategory}
          >
            <Plus className="h-3.5 w-3.5" />
            Add category
          </button>
        </div>

        <div className="grid auto-rows-[minmax(88px,auto)] grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat, idx) => (
            <CategoryTile
              key={cat.id}
              cat={cat}
              index={idx}
              videoCount={videoCountByCategory(cat.id)}
              onUpdate={(patch) =>
                setDraft((d) => ({
                  ...d,
                  videoCategories: d.videoCategories.map((c) => (c.id === cat.id ? { ...c, ...patch } : c)),
                }))
              }
              onMoveUp={() => moveCategory(cat.id, -1)}
              onMoveDown={() => moveCategory(cat.id, 1)}
              onDelete={() => deleteCategory(cat.id)}
            />
          ))}
          {categories.length === 0 ? (
            <button
              type="button"
              className="admin-panel flex min-h-[88px] flex-col items-center justify-center gap-1 border-dashed p-4 text-zinc-500 transition-colors hover:border-teal-500/40 hover:text-teal-300"
              onClick={addCategory}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs font-medium">Add your first category</span>
            </button>
          ) : null}
        </div>
      </section>

      <section className="admin-span-full mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">
            Videos
            <span className="ml-2 font-normal text-zinc-500">({filteredVideos.length})</span>
          </h3>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          <FilterChip
            active={filterCategory === "all"}
            label={`All (${videos.length})`}
            onClick={() => setFilterCategory("all")}
          />
          {categories.map((cat) => (
            <FilterChip
              key={cat.id}
              active={filterCategory === cat.id}
              label={`${cat.label} (${videoCountByCategory(cat.id)})`}
              muted={!cat.visible}
              onClick={() => setFilterCategory(cat.id)}
            />
          ))}
        </div>

        {filteredVideos.length === 0 ? (
          <div className="admin-panel flex flex-col items-center justify-center gap-2 py-12 text-zinc-500">
            <Film className="h-8 w-8 opacity-40" />
            <p className="text-sm">No videos in this view yet.</p>
            <button
              type="button"
              className="text-xs text-orange-400 hover:underline"
              onClick={addVideo}
            >
              Add a video
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVideos.map((video) => (
              <VideoEditorCard
                key={video.id}
                video={video}
                categories={categories}
                expanded={expandedVideoId === video.id}
                onToggle={() => setExpandedVideoId((id) => (id === video.id ? null : video.id))}
                onUpdate={(patch) =>
                  setDraft((d) => ({
                    ...d,
                    videoGallery: d.videoGallery.map((v) => (v.id === video.id ? { ...v, ...patch } : v)),
                  }))
                }
                onMoveUp={() => moveVideo(video.id, -1)}
                onMoveDown={() => moveVideo(video.id, 1)}
                onDelete={() => deleteVideo(video.id)}
              />
            ))}
          </div>
        )}
      </section>
    </AdminPage>
  );
}
