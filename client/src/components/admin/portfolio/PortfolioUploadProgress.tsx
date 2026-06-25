import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  estimateUploadEtaMs,
  formatUploadBytes,
  formatUploadDuration,
} from "@/lib/portfolio/uploadFormat";
import { cn } from "@/lib/utils";

export type BatchUploadProgress = {
  fileIndex: number;
  fileCount: number;
  currentFileName: string;
  bytesLoaded: number;
  bytesTotal: number;
  percent: number;
  completedNames: string[];
  startedAt: number;
};

type Props = {
  progress: BatchUploadProgress;
  accent?: "orange" | "purple" | "teal";
  className?: string;
};

export function PortfolioUploadProgress({ progress, accent = "teal", className }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const tick = () => setElapsedMs(Date.now() - progress.startedAt);
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [progress.startedAt]);

  const etaMs = estimateUploadEtaMs(progress.bytesLoaded, progress.bytesTotal, elapsedMs);
  const fileNum = progress.fileIndex + 1;
  const barClass =
    accent === "purple"
      ? "[&_[data-slot=progress-indicator]]:bg-violet-400"
      : accent === "orange"
        ? "[&_[data-slot=progress-indicator]]:bg-orange-400"
        : "[&_[data-slot=progress-indicator]]:bg-teal-400";

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-white/10 bg-black/30 p-4",
        accent === "purple" && "border-violet-500/25",
        accent === "orange" && "border-orange-500/25",
        accent === "teal" && "border-teal-500/30",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-zinc-100">
          {progress.fileCount > 1
            ? `Uploading ${fileNum} of ${progress.fileCount}`
            : "Uploading"}
          {progress.currentFileName ? (
            <span className="ml-1 font-normal text-zinc-400">· {progress.currentFileName}</span>
          ) : null}
        </p>
        <span className="text-lg font-bold tabular-nums text-white">{progress.percent}%</span>
      </div>

      <Progress value={progress.percent} className={cn("h-2.5 bg-white/10", barClass)} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        <span className="tabular-nums">
          {formatUploadBytes(progress.bytesLoaded)} / {formatUploadBytes(progress.bytesTotal)}
        </span>
        <span className="tabular-nums">Elapsed {formatUploadDuration(elapsedMs)}</span>
        {etaMs != null ? (
          <span className="tabular-nums text-zinc-300">~{formatUploadDuration(etaMs)} left</span>
        ) : null}
      </div>

      {progress.completedNames.length > 0 ? (
        <ul className="max-h-28 space-y-1 overflow-y-auto border-t border-white/10 pt-2">
          {progress.completedNames.map((name, i) => (
            <li key={`${name}-${i}`} className="flex items-center gap-2 text-xs text-emerald-400/90">
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{name}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
