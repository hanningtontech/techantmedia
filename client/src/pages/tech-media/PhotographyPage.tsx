import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Camera, CreditCard, FileText, Film } from "lucide-react";
import { ClientAccountPromo } from "@/components/tech-media/photography/ClientAccountPromo";
import { SeoFaqSection } from "@/components/seo/SeoFaqSection";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { PHOTO_FAQ } from "@/lib/seo/siteSeo";
import { PhotoHeroSlideshow } from "@/components/tech-media/photography/PhotoHeroSlideshow";
import { CategoryGallery } from "@/components/tech-media/photography/CategoryGallery";
import { InspoSelectionBar } from "@/components/tech-media/photography/InspoSelectionBar";
import { VideographyPanel } from "@/components/tech-media/photography/VideographyPanel";
import { BookSessionButton } from "@/components/tech-media/photography/BookSessionButton";
import { RateCardsPricing } from "@/components/tech-media/photography/RateCardsPricing";
import { RateCardPromo } from "@/components/tech-media/photography/RateCardPromo";
import { ProcessStepsSection } from "@/components/tech-media/photography/ProcessStepsSection";
import { ContractsListContent } from "@/components/tech-media/photography/contracts/ContractsListContent";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { scrollPageToTop } from "@/lib/scrollToTop";
import { isRateCardsEnabled } from "@/lib/tech-media/rateCardsEnabled";
import { listedRateCardGroups } from "@/lib/tech-media/rateCardsVisible";
import { cn } from "@/lib/utils";

type Panel = "photography" | "videography" | "rates" | "contracts";

function panelFromSearch(search: string, rateCardsEnabled: boolean): Panel {
  const p = new URLSearchParams(search).get("panel");
  if (p === "videography" || p === "contracts") return p;
  if (p === "rates" && rateCardsEnabled) return "rates";
  return "photography";
}

function openGroupIdFromLocation(search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  const open = params.get("open")?.trim();
  if (open) return open;
  if (hash.startsWith("#rate-group-")) return hash.slice("#rate-group-".length);
  return null;
}

export default function PhotographyPage() {
  const { content } = useSiteContent();
  const {
    brand,
    photoGallery,
    photoHeroSlides,
    photoCategories,
    videoGallery,
    videoCategories,
    rateCardGroups,
    processSteps,
    photographySettings,
  } = content;

  const rateCardsEnabled = isRateCardsEnabled(photographySettings);
  const listedRateGroups = useMemo(
    () => listedRateCardGroups(rateCardGroups),
    [rateCardGroups],
  );

  const [location] = useLocation();
  const search = useSearch();
  const [panel, setPanel] = useState<Panel>(() =>
    panelFromSearch(window.location.search, rateCardsEnabled),
  );

  useEffect(() => {
    const query = search || window.location.search;
    setPanel(panelFromSearch(query, rateCardsEnabled));
  }, [location, search, rateCardsEnabled]);

  useEffect(() => {
    if (!rateCardsEnabled && panel === "rates") {
      const url = new URL(window.location.href);
      url.searchParams.delete("panel");
      url.searchParams.delete("open");
      url.hash = "";
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      setPanel("photography");
    }
  }, [rateCardsEnabled, panel]);

  useEffect(() => {
    scrollPageToTop("instant");
  }, [panel, location]);

  const selectPanel = useCallback(
    (id: Panel) => {
      if (id === "rates" && !rateCardsEnabled) return;
      setPanel(id);
      const url = new URL(window.location.href);
      url.hash = "";
      if (id === "photography") {
        url.searchParams.delete("panel");
        url.searchParams.delete("open");
      } else {
        url.searchParams.set("panel", id);
        if (id !== "rates") url.searchParams.delete("open");
      }
      const next = `${url.pathname}${url.search}`;
      window.history.replaceState({}, "", next);
      scrollPageToTop("instant");
    },
    [rateCardsEnabled],
  );

  const initialOpenGroupId =
    panel === "rates"
      ? openGroupIdFromLocation(window.location.search, window.location.hash)
      : null;

  const bookSession = (
    <BookSessionButton
      settings={photographySettings}
      brandName={brand.name}
      brandPhone={brand.phone}
      photoCategories={photoCategories}
      hintClassName="text-zinc-300/90"
    />
  );

  const tabs: { id: Panel; label: string; icon: typeof Camera }[] = [
    { id: "photography", label: "Photography", icon: Camera },
    { id: "videography", label: "Videography", icon: Film },
    ...(rateCardsEnabled
      ? [{ id: "rates" as const, label: "Rate card", icon: CreditCard }]
      : []),
    { id: "contracts", label: "Contracts", icon: FileText },
  ];

  return (
    <TechMediaLayout fullBleedMain={panel !== "rates"}>
      <div className="tm-sticky-below-nav border-b border-white/10 bg-[#08080c]/90 backdrop-blur-xl">
        <div className="tm-scroll-row mx-auto max-w-7xl justify-start px-4 py-2.5 sm:justify-center sm:px-6 md:flex-wrap md:py-3">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectPanel(id)}
              className={cn(
                "inline-flex min-h-[var(--tm-touch-min)] shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm md:px-5",
                panel === id
                  ? "bg-orange-500/25 text-white ring-1 ring-orange-500/50"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
              )}
            >
              <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {panel === "photography" ? (
        <>
          <PhotoHeroSlideshow
            slides={photoHeroSlides}
            title={photographySettings.heroTitle}
            subtitle={photographySettings.heroSubtitle}
            defaultAnimation={photographySettings.globalHeroAnimation}
            actions={bookSession}
          />
          <ClientAccountPromo />
          <CategoryGallery categories={photoCategories} photos={photoGallery} />
          <InspoSelectionBar />
          {rateCardsEnabled ? <RateCardPromo groups={listedRateGroups} /> : null}
        </>
      ) : panel === "videography" ? (
        <>
          <VideographyPanel brand={brand} videos={videoGallery} categories={videoCategories} />
          <div className="border-b border-white/10 bg-[#0a0a10]">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{bookSession}</div>
          </div>
          {rateCardsEnabled ? <RateCardPromo groups={listedRateGroups} /> : null}
        </>
      ) : panel === "contracts" ? (
        <ContractsListContent embedded />
      ) : rateCardsEnabled ? (
        <RateCardsPricing
          groups={listedRateGroups}
          photoCategories={photoCategories}
          settings={photographySettings}
          brand={brand}
          variant="page"
          initialOpenGroupId={initialOpenGroupId}
        />
      ) : null}

      {panel !== "photography" && panel !== "videography" && panel !== "contracts" ? (
        <div className="border-y border-white/10 bg-[#0a0a10]">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{bookSession}</div>
        </div>
      ) : null}

      <ProcessStepsSection steps={processSteps} />
      <SeoFaqSection items={PHOTO_FAQ} />
    </TechMediaLayout>
  );
}
