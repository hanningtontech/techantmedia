import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/tech-media/BrandMark";
import { useFirebaseAuth, isClient } from "@/contexts/FirebaseAuthContext";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { useXaiPortfolioPublicEnabled } from "@/hooks/useXaiPortfolioPublicEnabled";
import { OFF_PAGE_NAV_LINKS } from "@/lib/site/offPagesNav";
import { cn } from "@/lib/utils";

const MAIN_LINKS = [
  { href: "/", label: "Home", short: "Home" },
  { href: "/photography", label: "Photography & Video", short: "Photo" },
  { href: "/portfolio", label: "Video Portfolio", short: "Portfolio", xaiOnly: true },
  { href: "/development", label: "Development", short: "Dev" },
  { href: "/tutoring", label: "Tutoring", short: "Tutor" },
  { href: "/contact", label: "Contact", short: "Contact" },
] as const;

const navLinkClass = (active: boolean, compact?: boolean) =>
  cn(
    "shrink-0 rounded-full font-medium transition-all whitespace-nowrap",
    compact ? "px-2 py-1.5 text-[0.6875rem] lg:px-3 lg:py-2 lg:text-sm" : "px-3 py-2 text-sm xl:px-4",
    active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white",
  );

export function TechMediaNav() {
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const { content } = useSiteContent();
  const { brand } = content;
  const { user, profile } = useFirebaseAuth();
  const clientSignedIn = !!user && isClient(profile);
  const xaiPortfolioEnabled = useXaiPortfolioPublicEnabled();
  const onPhotography = loc === "/photography" || loc.startsWith("/photography/");

  const mainLinks = MAIN_LINKS.filter((l) => !("xaiOnly" in l && l.xaiOnly) || xaiPortfolioEnabled);

  return (
    <header className="tech-media-nav sticky top-0 z-50 border-b border-white/10 bg-[#08080c]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 tm-page-x sm:gap-3">
        <Link href="/" className="group flex min-w-0 shrink-0 items-center gap-2 max-w-[42%] sm:max-w-none">
          <BrandMark
            logoUrl={brand.logoUrl}
            initials={brand.navInitials}
            className="h-8 w-8 shrink-0 text-xs sm:h-9 sm:w-9 sm:text-sm"
            imgClassName="h-8 w-8 sm:h-9 sm:w-9"
            alt={`${brand.name} logo`}
          />
          <span className="truncate text-sm font-semibold tracking-tight text-white transition-colors group-hover:text-orange-400 sm:text-base">
            {brand.name}
          </span>
        </Link>

        <nav
          className="tm-scroll-row hidden min-w-0 flex-1 items-center px-1 md:flex lg:gap-0.5"
          aria-label="Main"
        >
          {mainLinks.map((l) => {
            const active = loc === l.href || (l.href !== "/" && loc.startsWith(l.href));
            return (
              <Link key={l.href} href={l.href} className={navLinkClass(active, true)}>
                <span className="lg:hidden xl:inline">{l.short}</span>
                <span className="hidden lg:inline xl:hidden">{l.label.split(" ")[0]}</span>
                <span className="hidden xl:inline">{l.label}</span>
              </Link>
            );
          })}
          <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-white/15 xl:block" aria-hidden />
          {OFF_PAGE_NAV_LINKS.map((l) => {
            const active = loc === l.href || loc.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "hidden shrink-0 rounded-full px-2 py-1.5 text-[0.6875rem] font-medium transition-all xl:inline-flex xl:px-3 xl:py-2 xl:text-sm",
                  active
                    ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30"
                    : "text-zinc-500 hover:bg-violet-500/10 hover:text-violet-200",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {onPhotography ? (
            <Link
              href={clientSignedIn ? "/photography/my-gallery" : "/photography/account"}
              className="inline-flex rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300 transition hover:bg-orange-500/20 lg:px-5 lg:py-2 lg:text-sm"
            >
              <span className="hidden lg:inline">{clientSignedIn ? "My Gallery" : "Client account"}</span>
              <span className="lg:hidden">{clientSignedIn ? "Gallery" : "Account"}</span>
            </Link>
          ) : null}
          <Link
            href="/contact"
            className="inline-flex rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-2 text-xs font-semibold text-black transition hover:brightness-110 lg:px-5 lg:py-2 lg:text-sm"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          className="ml-auto inline-flex min-h-[var(--tm-touch-min)] min-w-[var(--tm-touch-min)] items-center justify-center rounded-lg p-2 text-zinc-300 hover:bg-white/10 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-white/10 bg-[#0c0c12] md:hidden"
          >
            <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
              {mainLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="min-h-[var(--tm-touch-min)] rounded-lg px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
              <p className="mt-3 px-4 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-zinc-500">Off pages</p>
              {OFF_PAGE_NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="min-h-[var(--tm-touch-min)] rounded-lg px-4 py-3 text-sm font-medium text-violet-300/90 hover:bg-violet-500/10 hover:text-violet-200"
                >
                  {l.label}
                </Link>
              ))}
              {onPhotography ? (
                <Link
                  href={clientSignedIn ? "/photography/my-gallery" : "/photography/account"}
                  onClick={() => setOpen(false)}
                  className="min-h-[var(--tm-touch-min)] rounded-lg px-4 py-3 text-sm font-medium text-orange-300 hover:bg-white/5"
                >
                  {clientSignedIn ? "My Gallery" : "Client account"}
                </Link>
              ) : null}
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="mt-2 min-h-[var(--tm-touch-min)] rounded-full bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-black"
              >
                Get started
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
