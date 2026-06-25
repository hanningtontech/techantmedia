import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ProcessingItem = {
  id: string;
  label: string;
  status: "uploading" | "pending" | "processing" | "done" | "duplicate" | "error";
  error?: string;
};

const VISIBLE_BATCH = 5;

type Props = {
  queue: ProcessingItem[];
  processing: boolean;
  startedAt: number | null;
};

function formatRemaining(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "Almost done";
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `About ${seconds}s remaining`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `About ${minutes} min remaining`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `About ${hours}h ${remMin}m remaining` : `About ${hours}h remaining`;
}

function statusLabel(item: ProcessingItem): string {
  switch (item.status) {
    case "uploading":
      return item.error ?? "Reading file…";
    case "done":
      return "Done";
    case "duplicate":
      return "Already existing";
    case "error":
      return item.error ?? "Failed";
    case "processing":
      return "Extracting";
    default:
      return "Waiting";
  }
}

function statusClass(item: ProcessingItem): string {
  switch (item.status) {
    case "uploading":
      return "text-sky-400";
    case "done":
      return "text-emerald-400";
    case "duplicate":
      return "text-orange-400";
    case "error":
      return "text-red-400";
    case "processing":
      return "text-amber-400";
    default:
      return "text-zinc-500";
  }
}

export function ProcessingQueuePanel({ queue, processing, startedAt }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!processing) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [processing]);

  const stats = useMemo(() => {
    void tick;
    const total = queue.length;
    const uploading = queue.some((item) => item.status === "uploading");
    const finished = queue.filter(
      (item) => item.status === "done" || item.status === "duplicate" || item.status === "error",
    ).length;
    const processingIndex = queue.findIndex((item) => item.status === "processing");
    const firstPending = queue.findIndex((item) => item.status === "pending");
    const firstUploading = queue.findIndex((item) => item.status === "uploading");
    const focusIndex =
      processingIndex >= 0
        ? processingIndex
        : firstUploading >= 0
          ? firstUploading
          : firstPending >= 0
            ? firstPending
            : Math.max(0, total - 1);

    const windowStart = Math.floor(focusIndex / VISIBLE_BATCH) * VISIBLE_BATCH;
    const windowEnd = Math.min(windowStart + VISIBLE_BATCH, total);
    const visible = queue.slice(windowStart, windowEnd);

    const percent = total > 0 ? Math.round((finished / total) * 100) : 0;

    let remainingLabel = "";
    if (uploading) {
      remainingLabel = "Reading your files…";
    } else if (processing && startedAt && finished > 0 && finished < total) {
      const elapsed = Date.now() - startedAt;
      const avgPerItem = elapsed / finished;
      remainingLabel = formatRemaining(avgPerItem * (total - finished));
    } else if (processing && startedAt && finished === 0) {
      remainingLabel = "Estimating time…";
    } else if (!processing && total > 0 && finished === total) {
      remainingLabel = "Complete";
    }

    return {
      uploading,
      total,
      finished,
      percent,
      windowStart,
      windowEnd,
      visible,
      remainingLabel,
    };
  }, [queue, processing, startedAt, tick]);

  if (!queue.length) {
    return (
      <div className="flex h-full min-h-[280px] flex-col rounded-2xl border border-white/10 bg-[#0c0c12] p-5">
        <h3 className="text-sm font-semibold text-white">Processing queue</h3>
        <p className="mt-3 flex flex-1 items-center justify-center text-sm text-zinc-500">
          Upload forms to see extraction progress here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[280px] flex-col rounded-2xl border border-white/10 bg-[#0c0c12] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">
          {stats.uploading ? "Uploading" : "Processing queue"}
        </h3>
        <span className="text-xs text-zinc-400">
          {stats.uploading ? "Preparing…" : `${stats.finished}/${stats.total} · ${stats.percent}%`}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <Progress
          value={stats.uploading ? 18 : stats.percent}
          className={cn(
            "h-2 bg-white/10 [&>[data-slot=progress-indicator]]:bg-amber-500",
            stats.uploading && "[&>[data-slot=progress-indicator]]:animate-pulse [&>[data-slot=progress-indicator]]:bg-sky-500",
          )}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            {stats.uploading
              ? `${stats.total} file${stats.total === 1 ? "" : "s"} selected`
              : `Showing forms ${stats.windowStart + 1}–${stats.windowEnd} of ${stats.total}`}
          </span>
          {stats.remainingLabel && (
            <span
              className={cn(
                stats.uploading
                  ? "text-sky-400/90"
                  : processing
                    ? "text-amber-400/90"
                    : "text-emerald-400/90",
              )}
            >
              {stats.remainingLabel}
            </span>
          )}
        </div>
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {stats.visible.map((item, idx) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-[#12121a] px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate text-zinc-300">
              <span className="mr-2 text-xs text-zinc-600">{stats.windowStart + idx + 1}.</span>
              {item.label}
            </span>
            <span className={cn("shrink-0 text-xs font-medium", statusClass(item))}>
              {(item.status === "processing" || item.status === "uploading") && (
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
              )}
              {statusLabel(item)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
