import { ExternalLink } from "lucide-react";
import type { XaiLink } from "@/lib/xai-portfolio/xaiPortfolioTypes";

type Props = {
  links: XaiLink[];
  variant?: "hero" | "inline";
};

export function XaiLinkButtons({ links, variant = "inline" }: Props) {
  const visible = links.filter((l) => l.href.trim());
  if (!visible.length) return null;

  const hero = variant === "hero";

  return (
    <div className={hero ? "flex flex-wrap gap-3" : "mt-4 flex flex-wrap gap-2"}>
      {visible.map((link, i) => (
        <a
          key={`${link.href}-${i}`}
          href={link.href.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className={
            hero
              ? "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-200"
              : "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-cyan-300 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/10"
          }
        >
          {link.label.trim() || "Link"}
          <ExternalLink size={hero ? 14 : 12} className="opacity-70" />
        </a>
      ))}
    </div>
  );
}
