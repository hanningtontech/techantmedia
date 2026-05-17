import { Link } from "wouter";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { Github, Instagram, Linkedin, Youtube } from "lucide-react";

const ICONS: Record<string, typeof Instagram> = {
  Instagram,
  YouTube: Youtube,
  LinkedIn: Linkedin,
  GitHub: Github,
};

export function TechMediaFooter() {
  const { content } = useSiteContent();
  const { brand } = content;

  return (
    <footer className="border-t border-white/10 bg-[#06060a]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="text-lg font-semibold text-white">{brand.name}</p>
            <p className="mt-2 max-w-xs text-sm text-zinc-400">{brand.tagline}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Services</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-400">
              <li>
                <Link href="/photography" className="transition-colors hover:text-orange-400">
                  Photography & Video
                </Link>
              </li>
              <li>
                <Link href="/development" className="transition-colors hover:text-teal-400">
                  Development
                </Link>
              </li>
              <li>
                <Link href="/tutoring" className="transition-colors hover:text-violet-400">
                  NCLEX Tutoring
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Connect</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {brand.socials.map((s) => {
                const Icon = ICONS[s.label] ?? Instagram;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-all hover:scale-110 hover:border-orange-500/50 hover:text-orange-400"
                    aria-label={s.label}
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        <p className="mt-10 border-t border-white/10 pt-8 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
