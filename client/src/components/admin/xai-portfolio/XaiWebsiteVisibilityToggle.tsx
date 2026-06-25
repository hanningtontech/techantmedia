import { Eye, EyeOff } from "lucide-react";
import { isXaiPortfolioPublicEnabled } from "@/lib/xai-portfolio/xaiPortfolioVisibility";
import type { XaiPortfolioContent } from "@/lib/xai-portfolio/xaiPortfolioTypes";

type Props = {
  draft: XaiPortfolioContent;
  busy: boolean;
  persistXai: (
    updater: (current: XaiPortfolioContent) => XaiPortfolioContent,
    successMessage?: string,
  ) => Promise<void>;
};

export function XaiWebsiteVisibilityToggle({ draft, busy, persistXai }: Props) {
  const enabled = isXaiPortfolioPublicEnabled(draft);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-100">Public xAI video portfolio</p>
        <p className="mt-1 text-sm text-zinc-400">
          {enabled
            ? "/portfolio is live — nav links, home CTA, footer, and page content are visible."
            : "Portfolio is hidden — /portfolio redirects home and all public links are removed."}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void persistXai(
            (d) => ({ ...d, publicEnabled: !isXaiPortfolioPublicEnabled(d) }),
            enabled ? "xAI portfolio hidden from the website." : "xAI portfolio enabled on /portfolio.",
          )
        }
        className={
          enabled
            ? "inline-flex shrink-0 items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
            : "inline-flex shrink-0 items-center gap-2 rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
        }
      >
        {enabled ? (
          <>
            <EyeOff className="h-4 w-4" />
            Disable on website
          </>
        ) : (
          <>
            <Eye className="h-4 w-4" />
            Enable on website
          </>
        )}
      </button>
    </div>
  );
}
