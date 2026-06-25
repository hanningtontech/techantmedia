import { useEffect, useRef, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { VideoPlayOverlay } from "@/components/xai-portfolio/VideoPlayOverlay";
import { parseVideoEmbed } from "@/lib/xai-portfolio/parseVideoUrl";
import type { VideoSourceKind } from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { cn } from "@/lib/utils";

type Props = {
  videoKind: VideoSourceKind;
  videoUrl: string;
  title: string;
  thumbnailUrl?: string;
  placeholder?: string;
  /** When true (default), player is ~half page width and centered. */
  compact?: boolean;
  /** Inside a multi-video grid tile — width comes from the parent cell. */
  inGrid?: boolean;
};

/** ~50% of a wide content column; full width on phones. */
const COMPACT_PLAYER_CLASS = "mx-auto w-full max-w-[min(100%,28rem)] sm:max-w-md md:max-w-lg";

function isSelfHosted(kind: VideoSourceKind, parsedKind: VideoSourceKind): boolean {
  return kind === "self-hosted" || parsedKind === "self-hosted";
}

export function PortfolioVideoPlayer({
  videoKind,
  videoUrl,
  title,
  thumbnailUrl = "",
  placeholder,
  compact = true,
  inGrid = false,
}: Props) {
  const parsed = parseVideoEmbed(videoUrl, videoKind);
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: "200px" });
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const wrap = inGrid ? "w-full" : compact ? COMPACT_PLAYER_CLASS : "mx-auto w-full max-w-4xl";

  const shell = cn(
    wrap,
    "overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg shadow-black/40",
  );

  useEffect(() => {
    setPlaying(false);
  }, [videoUrl, thumbnailUrl]);

  useEffect(() => {
    if (!playing || !inView) return;
    const el = videoRef.current;
    if (!el) return;
    void el.play().catch(() => {
      /* autoplay blocked — user can use native controls */
    });
  }, [playing, inView]);

  if (parsed.kind === "none" || !parsed.embedUrl) {
    return (
      <div
        className={cn(
          wrap,
          "flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/15 bg-[#12121a] px-6 text-center text-sm text-zinc-500",
        )}
      >
        {placeholder ?? "Add a video in the admin dashboard."}
      </div>
    );
  }

  if (parsed.kind === "youtube" || parsed.kind === "vimeo") {
    return (
      <div ref={ref} className={shell}>
        <div className="relative aspect-video w-full">
          {inView ? (
            <iframe
              src={parsed.embedUrl}
              title={title}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a10] text-sm text-zinc-500">
              Loading player…
            </div>
          )}
        </div>
      </div>
    );
  }

  const selfHosted = isSelfHosted(videoKind, parsed.kind);
  const poster = thumbnailUrl.trim();
  const showPoster = selfHosted && !playing;

  if (showPoster) {
    return (
      <div ref={ref} className={shell}>
        <button
          type="button"
          className="group relative block aspect-video w-full cursor-pointer text-left"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${title}`}
        >
          {poster ? (
            <img
              src={poster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="absolute inset-0 bg-gradient-to-br from-[#12121a] via-[#0a0a10] to-[#1a1a28]" />
          )}
          <VideoPlayOverlay />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className={shell}>
      {inView ? (
        <video
          ref={videoRef}
          src={parsed.embedUrl}
          controls
          playsInline
          poster={poster || undefined}
          preload={playing ? "metadata" : "none"}
          className="aspect-video w-full bg-black"
          title={title}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-[#0a0a10] text-sm text-zinc-500">
          Loading video…
        </div>
      )}
    </div>
  );
}
