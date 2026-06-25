import type { MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import type { RateCardGroup } from "@/lib/portfolio/portfolioTypes";
import { goToRateCardsPage, RATE_CARDS_PAGE_HREF } from "@/lib/tech-media/routes";
import { scrollPageToTop } from "@/lib/scrollToTop";

type Props = {
  groups: RateCardGroup[];
};

export function RateCardPromo({ groups }: Props) {
  const [, navigate] = useLocation();
  const sorted = [...groups].sort((a, b) => a.order - b.order);
  if (!sorted.length) return null;

  const openRateCards = (e: MouseEvent) => {
    e.preventDefault();
    goToRateCardsPage(navigate);
    scrollPageToTop("instant");
  };

  return (
    <section className="border-y border-white/10 bg-[#0a0a10]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">Pricing</p>
            <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">View packages & rate card</h2>
            <p className="mt-2 max-w-lg text-sm tm-muted">
              Wedding, corporate, portraits, and videography—compare plans and book on WhatsApp.
            </p>
          </div>
          <Link
            href={RATE_CARDS_PAGE_HREF}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-orange-500/20 px-6 py-3 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/40 transition-all hover:bg-orange-500/30"
            onClick={openRateCards}
          >
            Open rate card
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="mt-6 flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
          {sorted.map((g) => {
            const featured = g.packages.find((p) => p.highlight) ?? g.packages[0];
            if (!featured) return null;
            return (
              <Link
                key={g.id}
                href={RATE_CARDS_PAGE_HREF}
                onClick={openRateCards}
                className="tm-card-hover snap-start min-w-[200px] shrink-0 rounded-xl border border-white/10 bg-[#12121a] p-4 transition-colors hover:border-orange-500/40"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{g.label}</p>
                <p className="mt-1 font-semibold text-white">{featured.name}</p>
                <p className="mt-2 text-lg font-bold text-orange-400">{featured.price}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
