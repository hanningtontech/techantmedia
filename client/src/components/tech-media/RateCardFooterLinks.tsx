import type { MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { listedRateCardGroups } from "@/lib/tech-media/rateCardsVisible";
import { goToRateCardsPage, RATE_CARDS_PAGE_HREF } from "@/lib/tech-media/routes";
import { isRateCardsEnabled } from "@/lib/tech-media/rateCardsEnabled";
import { scrollPageToTop } from "@/lib/scrollToTop";

export function RateCardFooterLinks() {
  const [, navigate] = useLocation();
  const { content } = useSiteContent();
  if (!isRateCardsEnabled(content.photographySettings)) return null;
  const groups = listedRateCardGroups(content.rateCardGroups);
  if (!groups.length) return null;

  const openRateCards = (e: MouseEvent) => {
    e.preventDefault();
    goToRateCardsPage(navigate);
    scrollPageToTop("instant");
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-orange-400/90">Rate card</p>
      <p className="mt-1 text-sm text-zinc-400">Packages for weddings, events, and studio work.</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {groups.map((g) => (
          <li key={g.id}>
            <Link
              href={RATE_CARDS_PAGE_HREF}
              onClick={openRateCards}
              className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-orange-500/40 hover:text-orange-300"
            >
              {g.label}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={RATE_CARDS_PAGE_HREF}
        onClick={openRateCards}
        className="mt-4 inline-block text-sm font-medium text-orange-400 hover:underline"
      >
        View full pricing →
      </Link>
    </div>
  );
}
