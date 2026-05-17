import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Camera, Film } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { PhotoHeroSlideshow } from "@/components/tech-media/photography/PhotoHeroSlideshow";
import { CategoryGallery } from "@/components/tech-media/photography/CategoryGallery";
import { VideographyPanel } from "@/components/tech-media/photography/VideographyPanel";
import { WhatsAppBooking } from "@/components/tech-media/photography/WhatsAppBooking";
import { RateCardsSection } from "@/components/tech-media/photography/RateCardsSection";
import { ProcessStepsSection } from "@/components/tech-media/photography/ProcessStepsSection";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { cn } from "@/lib/utils";

type Panel = "photography" | "videography";

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

  const [location] = useLocation();
  const [panel, setPanel] = useState<Panel>("photography");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("panel") === "videography") setPanel("videography");
  }, [location]);

  const tabs: { id: Panel; label: string; icon: typeof Camera }[] = [
    { id: "photography", label: "Photography", icon: Camera },
    { id: "videography", label: "Videography", icon: Film },
  ];

  return (
    <TechMediaLayout fullBleedMain>
      <div className="sticky top-[57px] z-40 border-b border-white/10 bg-[#08080c]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl justify-center gap-2 px-4 py-3 sm:px-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPanel(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all",
                panel === id
                  ? "bg-orange-500/25 text-white ring-1 ring-orange-500/50"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
              )}
            >
              <Icon size={18} />
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
          />
          <CategoryGallery categories={photoCategories} photos={photoGallery} />
        </>
      ) : (
        <VideographyPanel brand={brand} videos={videoGallery} categories={videoCategories} />
      )}

      <WhatsAppBooking
        settings={photographySettings}
        brandName={brand.name}
        brandPhone={brand.phone}
        photoCategories={photoCategories}
      />
      <RateCardsSection
        groups={rateCardGroups}
        settings={photographySettings}
        brandName={brand.name}
        brandPhone={brand.phone}
      />
      <ProcessStepsSection steps={processSteps} />
    </TechMediaLayout>
  );
}
