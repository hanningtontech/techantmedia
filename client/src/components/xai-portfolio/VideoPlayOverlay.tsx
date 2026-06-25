import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  label?: string;
};

export function VideoPlayOverlay({ className, label = "Play video" }: Props) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35",
        className,
      )}
      aria-hidden
    >
      <span className="xai-video-play-btn flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/50 bg-black/70 text-cyan-300 shadow-lg shadow-cyan-500/20 sm:h-16 sm:w-16">
        <Play className="ml-0.5 h-7 w-7 fill-current sm:h-8 sm:w-8" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    </span>
  );
}
