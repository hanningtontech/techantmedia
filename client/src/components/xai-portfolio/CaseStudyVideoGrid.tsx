import { PortfolioVideoPlayer } from "@/components/xai-portfolio/PortfolioVideoPlayer";
import { getCaseStudyVideos } from "@/lib/xai-portfolio/xaiCaseStudyVideos";
import type { XaiCaseStudy } from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { cn } from "@/lib/utils";

/** Same max width as a single compact player — reused per tile. */
const TILE_CLASS = "w-full max-w-[min(100%,28rem)] sm:max-w-md md:max-w-lg";

type Props = {
  study: XaiCaseStudy;
  placeholder?: string;
};

export function CaseStudyVideoGrid({ study, placeholder }: Props) {
  const videos = getCaseStudyVideos(study);
  const count = videos.length;

  if (!count) {
    return (
      <PortfolioVideoPlayer
        videoKind="none"
        videoUrl=""
        title={study.title}
        placeholder={placeholder}
        compact
      />
    );
  }

  if (count === 1) {
    const v = videos[0];
    return (
      <div className="flex flex-col items-center gap-2">
        <PortfolioVideoPlayer
          videoKind={v.videoKind}
          videoUrl={v.videoUrl}
          thumbnailUrl={v.thumbnailUrl}
          title={v.label || study.title}
          compact
          inGrid
        />
        {v.label ? <p className="font-mono-tech text-center text-xs text-zinc-500">{v.label}</p> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-[min(100%,56rem)] gap-4 sm:gap-5",
        count === 2 && "grid-cols-1 sm:grid-cols-2",
        count >= 3 && "grid-cols-1 sm:grid-cols-2",
      )}
    >
      {videos.map((v, index) => (
        <div
          key={v.id}
          className={cn(
            TILE_CLASS,
            "flex flex-col gap-2",
            count === 3 && index === 2 && "sm:col-span-2 sm:mx-auto",
          )}
        >
          <PortfolioVideoPlayer
            videoKind={v.videoKind}
            videoUrl={v.videoUrl}
            thumbnailUrl={v.thumbnailUrl}
            title={v.label || `${study.title} — video ${index + 1}`}
            compact
            inGrid
          />
          {v.label ? <p className="font-mono-tech text-center text-xs text-zinc-500">{v.label}</p> : null}
        </div>
      ))}
    </div>
  );
}
