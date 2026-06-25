import { useCallback, useState } from "react";
import { Link } from "wouter";
import { Bookmark, MessageCircle, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "hannington-inspo-gallery-help-dismissed";

type Props = {
  brandName: string;
  className?: string;
};

export function InspoGalleryHelp({ brandName, className }: Props) {
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return true;
    }
  });

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#12121a]/95 text-sm font-semibold text-zinc-300 shadow-lg backdrop-blur-md transition-colors hover:border-orange-500/40 hover:text-orange-300 sm:bottom-6",
          className,
        )}
        aria-label="How to use Inspos"
      >
        ?
      </button>
    );
  }

  return (
    <aside
      role="dialog"
      aria-labelledby="inspo-help-title"
      className={cn(
        "fixed bottom-20 right-4 z-40 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-orange-500/30 bg-[#12121a]/98 p-4 shadow-2xl backdrop-blur-md sm:bottom-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p id="inspo-help-title" className="text-sm font-semibold text-white">
          Build your Inspos
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close help"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-zinc-400">
        <li className="flex gap-2">
          <Bookmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" aria-hidden />
          <span>
            Tap the <strong className="font-medium text-zinc-200">bookmark</strong> on any photo to save it to
            your board.
          </span>
        </li>
        <li className="flex gap-2">
          <Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" aria-hidden />
          <span>
            Open <Link href="/inspos" className="font-medium text-orange-300 hover:underline">My Inspos</Link> to
            review picks and create a share link.
          </span>
        </li>
        <li className="flex gap-2">
          <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#25D366]" aria-hidden />
          <span>
            Send the link to <strong className="font-medium text-zinc-200">{brandName}</strong> on WhatsApp so they
            know the shots you love.
          </span>
        </li>
      </ol>

      <button
        type="button"
        onClick={dismiss}
        className="mt-4 w-full rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
      >
        Cancel
      </button>
    </aside>
  );
}
