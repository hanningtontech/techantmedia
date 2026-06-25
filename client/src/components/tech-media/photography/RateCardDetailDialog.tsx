import { Images, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PhotoCategory,
  PhotographySettings,
  RateCardGroup,
  SiteBrand,
} from "@/lib/portfolio/portfolioTypes";
import {
  getRateCardAccent,
  getRateCardSamplesHref,
  resolveRateCardGalleryCategoryId,
} from "@/lib/tech-media/rateCardAccent";
import { packageFeatures, packageIncludes } from "@/lib/tech-media/rateCardUtils";
import { cn } from "@/lib/utils";

type Props = {
  group: RateCardGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoCategories: PhotoCategory[];
  settings: PhotographySettings;
  brand: SiteBrand;
  whatsappNumbers: string[];
  onInquire: (packageName: string, price: string) => void;
};

export function RateCardDetailDialog({
  group,
  open,
  onOpenChange,
  photoCategories,
  settings,
  brand,
  whatsappNumbers,
  onInquire,
}: Props) {
  if (!group) return null;

  const accent = getRateCardAccent(group);
  const samplesHref = getRateCardSamplesHref(group, photoCategories);
  const linkedCategoryId = resolveRateCardGalleryCategoryId(group);
  const samplesCategory = photoCategories.find((c) => c.id === linkedCategoryId && c.visible);

  const sectionTitle =
    group.sectionTitle.trim() ||
    settings.rateCardPageTitle ||
    "Our Photography & Videography Packages";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="tm-rate-dialog !flex h-[min(75vh,calc(100dvh-2rem))] max-h-[min(75vh,calc(100dvh-2rem))] w-[min(75vw,calc(100vw-2rem))] max-w-[min(75vw,calc(100vw-2rem))] !flex-col gap-0 overflow-hidden border-white/10 bg-[#0e0e14] p-0 text-zinc-100 max-sm:h-[min(85vh,calc(100dvh-1.25rem))] max-sm:max-h-[min(85vh,calc(100dvh-1.25rem))] max-sm:w-[min(92vw,calc(100vw-1.25rem))] max-sm:max-w-[min(92vw,calc(100vw-1.25rem))] sm:max-w-[min(75vw,calc(100vw-2rem))]"
      >
        <DialogHeader
          className={cn(
            "shrink-0 border-b-2 px-5 py-4 text-left sm:px-6 sm:py-5",
            accent.border,
            accent.surface,
          )}
        >
          <p className={cn("text-xs font-semibold uppercase tracking-[0.2em]", accent.muted)}>
            {group.label}
          </p>
          <DialogTitle className={cn("text-xl font-bold sm:text-2xl", accent.title)}>
            {sectionTitle}
          </DialogTitle>
          {group.description ? (
            <DialogDescription className="text-sm text-zinc-400">{group.description}</DialogDescription>
          ) : null}
          {samplesHref ? (
            <Link
              href={samplesHref}
              onClick={() => onOpenChange(false)}
              className={cn(
                "mt-3 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition",
                accent.button,
                accent.buttonRing,
              )}
            >
              <Images size={16} aria-hidden />
              View samples
              {samplesCategory ? (
                <span className="font-normal opacity-80">· {samplesCategory.label}</span>
              ) : null}
            </Link>
          ) : null}
        </DialogHeader>

        <div className="tm-rate-dialog-body min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-5">
          <div className="tm-rate-dialog-packages">
            {group.packages.map((row) => {
              const features = packageFeatures(row);
              const includes = packageIncludes(row);
              const delivery = row.deliveryNote.trim() || group.deliveryNote.trim();
              const popularLabel = row.popularLabel.trim() || "Most Popular";

              return (
                <article
                  key={row.id}
                  className={cn(
                    "relative flex h-full min-h-0 min-w-0 flex-col rounded-lg border bg-[#12121a] p-3 sm:p-3.5",
                    row.highlight
                      ? "border-amber-500/50 ring-1 ring-amber-500/30"
                      : "border-white/10",
                  )}
                >
                  {row.highlight ? (
                    <span className="absolute -top-2 left-2 right-2 mx-auto w-fit max-w-full truncate rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-900 sm:left-3 sm:right-auto">
                      {popularLabel}
                    </span>
                  ) : null}

                  <h4 className="text-sm font-semibold leading-snug text-white sm:text-[0.9rem]">{row.name}</h4>
                  <p className="mt-1.5 text-lg font-bold leading-tight text-orange-400 sm:text-xl">
                    {row.price}
                    {row.priceSuffix ? (
                      <span className="mt-0.5 block text-[10px] font-medium leading-tight text-zinc-500 sm:inline sm:ml-1 sm:mt-0 sm:text-xs">
                        / {row.priceSuffix}
                      </span>
                    ) : null}
                  </p>

                  {features.length > 0 ? (
                    <div className="mt-2.5 space-y-1 border-b border-white/10 pb-2.5">
                      {features.map((line, i) => (
                        <p
                          key={`${row.id}-f-${i}`}
                          className="break-words text-[11px] leading-snug text-zinc-300 sm:text-xs"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {includes.length > 0 ? (
                    <div className="mt-2.5 flex min-h-0 flex-1 flex-col">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[11px]">
                        Includes
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {includes.map((line, i) => (
                          <p
                            key={`${row.id}-i-${i}`}
                            className="break-words text-[11px] leading-snug text-zinc-400 sm:text-xs"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}

                  {delivery ? (
                    <p className="mt-2 break-words text-[10px] leading-snug text-zinc-500 sm:text-[11px]">{delivery}</p>
                  ) : null}

                  {whatsappNumbers[0] ? (
                    <button
                      type="button"
                      onClick={() => onInquire(row.name, row.price)}
                      className={cn(
                        "mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 pt-2.5 text-[11px] font-semibold sm:text-xs",
                        row.highlight
                          ? "bg-orange-500 text-black hover:bg-orange-400"
                          : "border border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20",
                      )}
                    >
                      <MessageCircle size={14} className="shrink-0" />
                      <span className="truncate">{row.ctaLabel?.trim() || "Book on WhatsApp"}</span>
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>

          {group.footnote ? (
            <p className="mt-6 text-center text-xs text-zinc-500 sm:text-sm">{group.footnote}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
