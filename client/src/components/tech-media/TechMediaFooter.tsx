import { Link, useLocation } from "wouter";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { RateCardFooterLinks } from "@/components/tech-media/RateCardFooterLinks";
import { isPhotographyMediaPath, RATE_CARDS_PAGE_HREF } from "@/lib/tech-media/routes";
import { isRateCardsEnabled } from "@/lib/tech-media/rateCardsEnabled";
import {
  GENERAL_FOOTER,
  PHOTOGRAPHY_FOOTER,
  telHref,
} from "@/lib/tech-media/footerConfig";
import type { SiteSocialLink } from "@/lib/portfolio/portfolioTypes";
import { useXaiPortfolioPublicEnabled } from "@/hooks/useXaiPortfolioPublicEnabled";
import { Github, Instagram, Linkedin, Mail, Phone, Youtube } from "lucide-react";

const ICONS: Record<string, typeof Instagram> = {
  Instagram,
  YouTube: Youtube,
  LinkedIn: Linkedin,
  GitHub: Github,
};

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
    </svg>
  );
}

function resolvePhotoSocials(cmsSocials: SiteSocialLink[]): SiteSocialLink[] {
  const byLabel = new Map(cmsSocials.map((s) => [s.label.toLowerCase(), s]));
  return PHOTOGRAPHY_FOOTER.socialOrder.map((label) => {
    const fromCms = byLabel.get(label.toLowerCase());
    if (fromCms?.href) return fromCms;
    return PHOTOGRAPHY_FOOTER.defaultSocials.find((d) => d.label === label) ?? { label, href: "#" };
  });
}

function PhotographyMediaFooter({
  brandName,
  brandTagline,
  cmsSocials,
  rateCardsEnabled,
}: {
  brandName: string;
  brandTagline: string;
  cmsSocials: SiteSocialLink[];
  rateCardsEnabled: boolean;
}) {
  const socials = resolvePhotoSocials(cmsSocials);

  return (
    <footer className="tech-media-footer border-t border-white/10 bg-[#06060a]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className={`grid gap-8 md:grid-cols-2 ${rateCardsEnabled ? "lg:grid-cols-3 xl:grid-cols-4" : "lg:grid-cols-3"}`}>
          <div>
            <p className="text-lg font-semibold text-white">{brandName}</p>
            <p className="mt-2 max-w-xs text-sm text-zinc-400">{brandTagline}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Services</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-400">
              <li>
                <Link href="/photography" className="transition-colors hover:text-orange-400">
                  Photography & Video
                </Link>
              </li>
              {rateCardsEnabled ? (
                <li>
                  <Link href={RATE_CARDS_PAGE_HREF} className="transition-colors hover:text-orange-400">
                    Rate card & packages
                  </Link>
                </li>
              ) : null}
              <li>
                <Link href="/photography/contracts" className="transition-colors hover:text-orange-400">
                  Contracts & releases
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Contact</p>
            <ul className="mt-4 space-y-3 text-sm">
              {PHOTOGRAPHY_FOOTER.phones.map((phone) => (
                <li key={phone}>
                  <a
                    href={telHref(phone)}
                    className="inline-flex items-center gap-2.5 text-zinc-400 transition-colors hover:text-teal-400"
                  >
                    <Phone size={16} className="shrink-0 text-teal-400/80" aria-hidden />
                    <span>{phone}</span>
                  </a>
                </li>
              ))}
              {PHOTOGRAPHY_FOOTER.emails.map((email) => (
                <li key={email}>
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex items-center gap-2.5 text-zinc-400 transition-colors hover:text-orange-400"
                  >
                    <Mail size={16} className="shrink-0 text-orange-400/80" aria-hidden />
                    <span>{email}</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              {socials.map((s) => {
                const Icon = ICONS[s.label];
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-all hover:scale-110 hover:border-orange-500/50 hover:text-orange-400"
                    aria-label={s.label}
                  >
                    {s.label === "TikTok" ? (
                      <TikTokIcon className="h-4 w-4" />
                    ) : Icon ? (
                      <Icon size={16} />
                    ) : (
                      <span className="text-[10px] font-bold">{s.label.slice(0, 2)}</span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>

          {rateCardsEnabled ? (
            <div className="lg:col-span-1">
              <RateCardFooterLinks />
            </div>
          ) : null}
        </div>

        <p className="mt-10 border-t border-white/10 pt-8 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} {brandName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export function TechMediaFooter() {
  const [location] = useLocation();
  const { content } = useSiteContent();
  const { brand } = content;

  if (isPhotographyMediaPath(location)) {
    return (
      <PhotographyMediaFooter
        brandName={brand.name}
        brandTagline={brand.tagline}
        cmsSocials={brand.socials}
        rateCardsEnabled={isRateCardsEnabled(content.photographySettings)}
      />
    );
  }

  const githubHref =
    brand.socials.find((s) => s.label.toLowerCase() === "github")?.href || GENERAL_FOOTER.githubHref;
  const xaiPortfolioEnabled = useXaiPortfolioPublicEnabled();

  return (
    <footer className="tech-media-footer border-t border-white/10 bg-[#06060a]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-white">{brand.name}</p>
          </div>

          <ul className="flex flex-col gap-3 text-sm">
            {xaiPortfolioEnabled ? (
              <li>
                <Link
                  href="/portfolio"
                  className="inline-flex items-center gap-2.5 text-zinc-400 transition-colors hover:text-cyan-400"
                >
                  Video portfolio (xAI application)
                </Link>
              </li>
            ) : null}
            <li>
              <a
                href={telHref(GENERAL_FOOTER.phone)}
                className="inline-flex items-center gap-2.5 text-zinc-400 transition-colors hover:text-teal-400"
              >
                <Phone size={16} className="shrink-0 text-teal-400/80" aria-hidden />
                <span>{GENERAL_FOOTER.phone}</span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${GENERAL_FOOTER.email}`}
                className="inline-flex items-center gap-2.5 text-zinc-400 transition-colors hover:text-orange-400"
              >
                <Mail size={16} className="shrink-0 text-orange-400/80" aria-hidden />
                <span>{GENERAL_FOOTER.email}</span>
              </a>
            </li>
            <li>
              <a
                href={githubHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 text-zinc-400 transition-colors hover:text-white"
              >
                <Github size={16} className="shrink-0" aria-hidden />
                <span>GitHub</span>
              </a>
            </li>
          </ul>
        </div>

        <p className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
