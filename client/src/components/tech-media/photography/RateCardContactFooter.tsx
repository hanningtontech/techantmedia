import { Link } from "wouter";
import { Instagram, Mail, MessageCircle, Phone, Youtube } from "lucide-react";
import type { PhotographySettings, SiteBrand } from "@/lib/portfolio/portfolioTypes";
import { PHOTOGRAPHY_RATE_CARD_EMAIL } from "@/lib/tech-media/footerConfig";
import { formatWhatsappDisplay } from "@/lib/tech-media/rateCardUtils";
import { buildWhatsAppUrl } from "@/lib/tech-media/whatsapp";
import { cn } from "@/lib/utils";

type Props = {
  brand: SiteBrand;
  settings: PhotographySettings;
  whatsappNumbers: string[];
  /** When set, pre-fills the WhatsApp inquiry message */
  groupLabel?: string;
  className?: string;
  compact?: boolean;
};

function socialIcon(label: string) {
  const key = label.toLowerCase();
  if (key.includes("youtube")) return Youtube;
  if (key.includes("instagram")) return Instagram;
  return null;
}

export function RateCardContactFooter({
  brand,
  settings,
  whatsappNumbers,
  groupLabel,
  className,
  compact = false,
}: Props) {
  const tagline =
    settings.rateCardHeaderTagline.trim() ||
    settings.rateCardPageTitle.trim() ||
    "Professional Photography & Videography";

  const waMessage = groupLabel
    ? `Hi ${brand.name}, I'd like to inquire about ${groupLabel} packages.`
    : `Hi ${brand.name}, I'd like to inquire about your photography packages.`;

  const phoneHref = brand.phone.trim() ? `tel:${brand.phone.replace(/\s/g, "")}` : "";
  const email = PHOTOGRAPHY_RATE_CARD_EMAIL;

  const hasContact = whatsappNumbers.length > 0 || email || phoneHref || brand.socials.length > 0;
  if (!hasContact) return null;

  return (
    <footer
      className={cn(
        "border-t border-white/10 bg-[#08080c]",
        compact ? "px-4 py-4 sm:px-5" : "px-5 py-5 sm:px-6 sm:py-6",
        className,
      )}
    >
      <div className={cn("mx-auto w-full", compact ? "max-w-none" : "max-w-4xl")}>
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400/90 sm:text-xs">
          Get in touch
        </p>
        {tagline ? (
          <p className="mt-1.5 text-center text-xs text-zinc-400 sm:text-sm">{tagline}</p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {email ? (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:border-orange-500/35 hover:bg-white/[0.05]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
                <Mail size={16} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Email</span>
                <span className="block truncate text-sm font-medium text-zinc-200">{email}</span>
              </span>
            </a>
          ) : null}

          {phoneHref ? (
            <a
              href={phoneHref}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:border-teal-500/35 hover:bg-white/[0.05]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-teal-400">
                <Phone size={16} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Phone</span>
                <span className="block truncate text-sm font-medium text-zinc-200">{brand.phone}</span>
              </span>
            </a>
          ) : null}
        </div>

        {whatsappNumbers.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              WhatsApp booking
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {whatsappNumbers.map((num) => {
                const url = buildWhatsAppUrl(num, waMessage);
                if (!url) return null;
                return (
                  <a
                    key={num}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/35 bg-[#25D366]/10 px-4 py-2 text-sm font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/20"
                  >
                    <MessageCircle size={16} className="shrink-0" aria-hidden />
                    {formatWhatsappDisplay(num)}
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}

        {brand.socials.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-white/5 pt-4">
            {brand.socials.map((s) => {
              const Icon = socialIcon(s.label);
              return (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-orange-500/40 hover:text-orange-300"
                >
                  {Icon ? <Icon size={14} aria-hidden /> : null}
                  {s.label}
                </a>
              );
            })}
          </div>
        ) : null}

        <p className="mt-4 text-center text-[11px] text-zinc-600">
          <Link href="/contact" className="text-zinc-500 underline-offset-2 hover:text-orange-400 hover:underline">
            Full contact form
          </Link>
        </p>
      </div>
    </footer>
  );
}
