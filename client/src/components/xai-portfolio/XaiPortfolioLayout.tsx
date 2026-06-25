import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BrandMark } from "@/components/tech-media/BrandMark";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { XAI_PAGE_CONTAINER_CLASS } from "@/components/xai-portfolio/XaiPageContainer";
import { cn } from "@/lib/utils";
import "@/styles/tech-media.css";
import "@/styles/xai-portfolio.css";

const SECTION_LINKS = [
  { href: "/portfolio", label: "Overview", anchor: "" },
  { href: "/portfolio#case-studies", label: "Case studies", anchor: "case-studies" },
  { href: "/portfolio#skills", label: "Skills", anchor: "skills" },
] as const;

function scrollToHash(anchor: string) {
  if (!anchor) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function XaiPortfolioLayout({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { content } = useSiteContent();
  const { brand } = content;

  return (
    <div className="xai-portfolio-root tech-media-root flex min-h-screen flex-col bg-[#08080c]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#08080c]/90 backdrop-blur-xl">
        <div className={cn(XAI_PAGE_CONTAINER_CLASS, "flex flex-col gap-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0")}>
          <Link href="/portfolio" className="group flex min-w-0 shrink-0 items-center gap-2">
            <BrandMark
              logoUrl={brand.logoUrl}
              initials={brand.navInitials}
              className="h-9 w-9 shrink-0 text-sm"
              imgClassName="h-9 w-9"
              alt={`${brand.name} logo`}
            />
            <span className="truncate font-semibold text-white group-hover:text-cyan-400">{brand.name}</span>
          </Link>
          <nav className="flex w-full min-w-0 items-center gap-1 overflow-x-auto border-t border-white/10 pt-3 sm:w-auto sm:border-0 sm:pt-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTION_LINKS.map((l) => {
              const active =
                loc === "/portfolio" && !l.anchor ? true : Boolean(l.anchor && loc.includes(l.anchor));
              return (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => {
                    if (l.anchor && loc.startsWith("/portfolio")) {
                      e.preventDefault();
                      window.history.pushState(null, "", l.href);
                      scrollToHash(l.anchor);
                    }
                  }}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:py-2 sm:text-sm",
                    active ? "bg-cyan-500/15 text-cyan-300" : "text-zinc-400 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {l.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/10 py-10">
        <div className={cn(XAI_PAGE_CONTAINER_CLASS, "text-center")}>
        <p className="text-xs text-zinc-600">
          © {new Date().getFullYear()} {brand.name}.{" "}
          <Link href="/" className="text-zinc-500 hover:text-cyan-400">
            Main site
          </Link>
        </p>
        <p className="font-mono-tech mt-4 text-[10px] uppercase tracking-widest text-zinc-600">
          xAI Video Tutor application · purpose-built portfolio reference
        </p>
        <p className="mt-1 text-[10px] text-zinc-700">Not affiliated with xAI — submitted as part of a job application.</p>
        </div>
      </footer>
    </div>
  );
}
