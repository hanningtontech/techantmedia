import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { RateCardDetailDialog } from "@/components/tech-media/photography/RateCardDetailDialog";
import type {
  PhotoCategory,
  PhotographySettings,
  RateCardGroup,
  SiteBrand,
} from "@/lib/portfolio/portfolioTypes";
import { getRateCardAccent } from "@/lib/tech-media/rateCardAccent";
import { ContractInfoLink } from "@/components/tech-media/photography/contracts/ContractInfoLink";
import { buildInquiryMessage, buildWhatsAppUrl, normalizeWhatsAppNumber } from "@/lib/tech-media/whatsapp";
import { cn } from "@/lib/utils";

export type RateCardsVariant = "page" | "section" | "compact";

type Props = {
  groups: RateCardGroup[];
  photoCategories: PhotoCategory[];
  settings: PhotographySettings;
  brand: SiteBrand;
  variant?: RateCardsVariant;
  className?: string;
  initialOpenGroupId?: string | null;
};

function RateCardCategoryTile({
  group,
  onClick,
  index,
}: {
  group: RateCardGroup;
  onClick: () => void;
  index: number;
}) {
  const accent = getRateCardAccent(group);
  const tierCount = group.packages.length;
  const displayName = group.label.trim() || "Packages";

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[8.5rem] w-full flex-col justify-between overflow-hidden rounded-2xl border-2 p-4 text-left shadow-lg transition-all duration-200 sm:min-h-[10.5rem] sm:rounded-3xl sm:p-6",
        "hover:scale-[1.02] hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500",
        accent.border,
        accent.ring,
        accent.surface,
      )}
    >
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.22em] sm:text-[11px]",
          accent.muted,
        )}
      >
        {tierCount} package{tierCount === 1 ? "" : "s"}
      </span>

      <h3
        className={cn(
          "mt-2 max-w-full text-[1.65rem] font-black leading-[1.02] tracking-tight sm:text-3xl lg:text-[2rem]",
          accent.title,
        )}
      >
        {displayName}
      </h3>

      <span
        className={cn(
          "mt-4 inline-flex items-center gap-1.5 text-sm font-semibold transition-transform group-hover:translate-x-0.5",
          accent.title,
        )}
      >
        View packages
        <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      </span>
    </motion.button>
  );
}

export function RateCardsPricing({
  groups,
  photoCategories,
  settings,
  brand,
  variant = "section",
  className,
  initialOpenGroupId = null,
}: Props) {
  const sorted = [...groups].sort((a, b) => a.order - b.order);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const primaryWhatsapp =
    normalizeWhatsAppNumber(settings.whatsappNumber) || normalizeWhatsAppNumber(brand.phone);
  const whatsappNumbers = [
    ...settings.rateCardWhatsappNumbers.map((n) => normalizeWhatsAppNumber(n)).filter(Boolean),
    ...(primaryWhatsapp && !settings.rateCardWhatsappNumbers.length ? [primaryWhatsapp] : []),
  ].filter((n, i, arr) => arr.indexOf(n) === i);

  const openGroup = sorted.find((g) => g.id === openGroupId) ?? null;

  const inquire = (packageName: string, groupLabel: string, price: string) => {
    const num = whatsappNumbers[0];
    if (!num) return;
    const message = buildInquiryMessage({ brandName: brand.name, packageName, groupLabel, price });
    const url = buildWhatsAppUrl(num, message);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (!initialOpenGroupId) return;
    const match = sorted.find((g) => g.id === initialOpenGroupId);
    if (match) setOpenGroupId(match.id);
  }, [initialOpenGroupId, groups]);

  if (!sorted.length) return null;

  const pageTitle = settings.rateCardPageTitle || "Packages & pricing";
  const pageSubtitle =
    settings.rateCardPageSubtitle ||
    settings.rateCardHeaderTagline ||
    "Choose a category to explore packages and pricing.";

  return (
    <section
      className={cn(
        "mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8",
        variant === "page" && "py-8 sm:py-10",
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400/90">Rate card</p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{pageTitle}</h1>
        {pageSubtitle ? <p className="mt-2 text-sm tm-muted sm:text-base">{pageSubtitle}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <ContractInfoLink slug="photography-videography" />
          <ContractInfoLink slug="vixen-release" label="Vixen release" />
        </div>
      </motion.div>

      <motion.div
        className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {sorted.map((group, i) => (
          <motion.div
            key={group.id}
            id={`rate-group-${group.id}`}
            className={cn(
              group.label.length > 14 && "sm:col-span-2",
              group.id === "rates-packages" && "col-span-2 md:col-span-2",
            )}
          >
            <RateCardCategoryTile group={group} index={i} onClick={() => setOpenGroupId(group.id)} />
          </motion.div>
        ))}
      </motion.div>

      <RateCardDetailDialog
        group={openGroup}
        open={Boolean(openGroup)}
        onOpenChange={(next) => {
          if (!next) setOpenGroupId(null);
        }}
        photoCategories={photoCategories}
        settings={settings}
        brand={brand}
        whatsappNumbers={whatsappNumbers}
        onInquire={(name, price) => {
          if (openGroup) inquire(name, openGroup.label, price);
        }}
      />
    </section>
  );
}
