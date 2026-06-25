import { useState } from "react";
import { ChevronDown, ChevronUp, ImageIcon, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { PortfolioVideoPlayer } from "@/components/xai-portfolio/PortfolioVideoPlayer";
import { AdminField } from "@/components/admin/shared/AdminField";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { detectVideoKind, parseVideoEmbed } from "@/lib/xai-portfolio/parseVideoUrl";
import {
  getAdminCaseStudyVideos,
  newCaseStudyVideo,
  syncLegacyVideoFields,
} from "@/lib/xai-portfolio/xaiCaseStudyVideos";
import { uploadXaiPortfolioFile, type XaiUploadProgress } from "@/lib/xai-portfolio/xaiPortfolioUpload";
import type { VideoSourceKind, XaiCaseStudy, XaiCaseStudyVideo } from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { toast } from "sonner";

type Props = {
  study: XaiCaseStudy;
  onChange: (patch: Partial<XaiCaseStudy>) => void;
  onPersist: (patch: Partial<XaiCaseStudy>, message?: string) => void;
};

function applyVideos(study: XaiCaseStudy, videos: XaiCaseStudyVideo[]): Partial<XaiCaseStudy> {
  const ordered = videos.map((v, i) => ({ ...v, order: i }));
  return syncLegacyVideoFields({ ...study, videos: ordered });
}

function isServerHostedVideo(video: XaiCaseStudyVideo): boolean {
  if (!video.videoUrl.trim()) return false;
  if (video.videoKind === "self-hosted") return true;
  return detectVideoKind(video.videoUrl) === "self-hosted";
}

export function XaiVideoAdminField({ study, onChange, onPersist }: Props) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadingThumbId, setUploadingThumbId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const videos = getAdminCaseStudyVideos(study);

  const commitVideos = (next: XaiCaseStudyVideo[], persist?: boolean, message?: string) => {
    const patch = applyVideos(study, next);
    onChange(patch);
    if (persist) onPersist(patch, message);
  };

  const updateVideo = (id: string, partial: Partial<XaiCaseStudyVideo>) => {
    commitVideos(videos.map((v) => (v.id === id ? { ...v, ...partial } : v)));
  };

  const setVideoUrl = (id: string, videoUrl: string) => {
    const videoKind: VideoSourceKind = videoUrl.trim() ? detectVideoKind(videoUrl) : "none";
    updateVideo(id, { videoUrl, videoKind });
  };

  const handleFileUpload = (id: string, file: File) => {
    setUploadingId(id);
    setUploadPct(0);
    void uploadXaiPortfolioFile(file, (p: XaiUploadProgress) => setUploadPct(p.percent))
      .then((url) => {
        const next = videos.map((v) =>
          v.id === id ? { ...v, videoUrl: url, videoKind: "self-hosted" as VideoSourceKind } : v,
        );
        commitVideos(next, true, "Video uploaded to your server ? live on the portfolio.");
      })
      .catch((e) => toast.error(formatAuthOrFirestoreError(e)))
      .finally(() => {
        setUploadingId(null);
        setUploadPct(null);
      });
  };

  const handleThumbnailUpload = (id: string, file: File) => {
    setUploadingThumbId(id);
    setUploadPct(0);
    void uploadXaiPortfolioFile(file, (p: XaiUploadProgress) => setUploadPct(p.percent))
      .then((url) => {
        const next = videos.map((v) => (v.id === id ? { ...v, thumbnailUrl: url } : v));
        commitVideos(next, true, "Thumbnail uploaded ? visible on the portfolio.");
      })
      .catch((e) => toast.error(formatAuthOrFirestoreError(e)))
      .finally(() => {
        setUploadingThumbId(null);
        setUploadPct(null);
      });
  };

  const addVideo = () => {
    commitVideos([...videos, newCaseStudyVideo(videos.length)]);
  };

  const removeVideo = (id: string) => {
    commitVideos(videos.filter((v) => v.id !== id));
  };

  const moveVideo = (id: string, dir: -1 | 1) => {
    const idx = videos.findIndex((v) => v.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= videos.length) return;
    const next = [...videos];
    [next[idx], next[target]] = [next[target], next[idx]];
    commitVideos(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-violet-200/90">Showcase videos</p>
      <p className="text-xs leading-relaxed text-zinc-500">
        Add <strong className="text-zinc-400">multiple videos</strong> per project ? YouTube links, uploads, or direct
        MP4 URLs. For <strong className="text-zinc-400">server-hosted videos</strong>, upload a{" "}
        <strong className="text-zinc-400">thumbnail</strong> so visitors see a poster with a play button. On the
        portfolio: <strong className="text-zinc-400">two</strong> play side by side;{" "}
        <strong className="text-zinc-400">three or more</strong> use two on the top row and the rest below (same player
        size as a single video). Click <strong className="text-zinc-400">Publish this case study</strong> when you are
        done editing.
      </p>

      {videos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
          No videos yet ? add one below.
        </p>
      ) : (
        <ul className="space-y-6">
          {videos.map((video, index) => {
            const parsed = parseVideoEmbed(video.videoUrl, video.videoKind);
            const uploading = uploadingId === video.id;
            const uploadingThumb = uploadingThumbId === video.id;
            const serverHosted = isServerHostedVideo(video);
            return (
              <li
                key={video.id}
                className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-violet-200">
                    Video {index + 1}
                    {video.label ? ` ? ${video.label}` : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => moveVideo(video.id, -1)}
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      disabled={index === videos.length - 1}
                      onClick={() => moveVideo(video.id, 1)}
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1.5 text-red-400/80 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => removeVideo(video.id)}
                      aria-label="Remove video"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <AdminField label="Caption (optional)">
                  <input
                    className="admin-input"
                    value={video.label}
                    placeholder="e.g. Full breakdown, Client cut"
                    onChange={(e) => updateVideo(video.id, { label: e.target.value })}
                  />
                </AdminField>

                <AdminField label="YouTube / Vimeo / direct video URL">
                  <input
                    className="admin-input"
                    value={video.videoUrl}
                    placeholder="https://www.youtube.com/watch?v=?"
                    onChange={(e) => setVideoUrl(video.id, e.target.value)}
                    onBlur={() => {
                      if (!video.videoUrl.trim()) return;
                      const kind = detectVideoKind(video.videoUrl);
                      updateVideo(video.id, { videoUrl: video.videoUrl.trim(), videoKind: kind });
                    }}
                  />
                </AdminField>

                <AdminField label="Or upload to your server (MP4, MOV, WebM)">
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                    disabled={uploading}
                    className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-4 file:py-2 file:text-sm file:font-medium file:text-violet-200"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(video.id, file);
                      e.target.value = "";
                    }}
                  />
                  {uploading ? (
                    <p className="mt-2 flex items-center gap-2 text-sm text-cyan-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading? {uploadPct ?? 0}%
                    </p>
                  ) : (
                    <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                      <Upload className="h-3 w-3" /> Stored on your Backblaze server.
                    </p>
                  )}
                </AdminField>

                {serverHosted ? (
                  <AdminField label="Thumbnail / poster (for server videos)">
                    <p className="mb-3 text-xs text-zinc-500">
                      Shown on the portfolio before play ? JPG or PNG recommended (16:9).
                    </p>
                    {video.thumbnailUrl ? (
                      <div className="mb-3 overflow-hidden rounded-lg border border-white/10">
                        <img
                          src={video.thumbnailUrl}
                          alt="Video thumbnail preview"
                          className="aspect-video h-20 w-36 rounded-lg object-cover"
                        />
                      </div>
                    ) : null}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
                      disabled={uploadingThumb}
                      className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-4 file:py-2 file:text-sm file:font-medium file:text-violet-200"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleThumbnailUpload(video.id, file);
                        e.target.value = "";
                      }}
                    />
                    {uploadingThumb ? (
                      <p className="mt-2 flex items-center gap-2 text-sm text-cyan-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading thumbnail? {uploadPct ?? 0}%
                      </p>
                    ) : (
                      <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                        <ImageIcon className="h-3 w-3" /> Or paste a direct image URL below.
                      </p>
                    )}
                    <input
                      className="admin-input mt-3"
                      value={video.thumbnailUrl}
                      placeholder="https://your-server.com/thumb.jpg"
                      onChange={(e) => updateVideo(video.id, { thumbnailUrl: e.target.value })}
                      onBlur={() => {
                        if (!video.thumbnailUrl.trim()) return;
                        updateVideo(video.id, { thumbnailUrl: video.thumbnailUrl.trim() });
                      }}
                    />
                    {video.thumbnailUrl ? (
                      <button
                        type="button"
                        className="mt-2 text-xs text-red-400/90 hover:text-red-300"
                        onClick={() => updateVideo(video.id, { thumbnailUrl: "" })}
                      >
                        Remove thumbnail
                      </button>
                    ) : null}
                  </AdminField>
                ) : null}

                <AdminField label="Video type">
                  <select
                    className="admin-input"
                    value={video.videoKind}
                    onChange={(e) => updateVideo(video.id, { videoKind: e.target.value as VideoSourceKind })}
                  >
                    <option value="none">Auto / none</option>
                    <option value="youtube">YouTube embed</option>
                    <option value="vimeo">Vimeo embed</option>
                    <option value="self-hosted">Hosted file (upload or direct URL)</option>
                  </select>
                </AdminField>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Preview</p>
                  {parsed.embedUrl ? (
                    <PortfolioVideoPlayer
                      videoKind={parsed.kind}
                      videoUrl={video.videoUrl}
                      thumbnailUrl={video.thumbnailUrl}
                      title={video.label || study.title || "Preview"}
                      inGrid
                    />
                  ) : video.videoUrl.trim() ? (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                      URL not recognized ? try YouTube, youtu.be, or a direct .mp4 URL.
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-500">No URL yet.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={addVideo}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-violet-500/40 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
      >
        <Plus className="h-4 w-4" />
        {videos.length === 0 ? "Add video" : "Add another video"}
      </button>
    </div>
  );
}
