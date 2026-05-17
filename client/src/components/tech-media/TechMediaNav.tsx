import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/tech-media/BrandMark";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/photography", label: "Photography & Video" },
  { href: "/development", label: "Development" },
  { href: "/tutoring", label: "Tutoring" },
  { href: "/contact", label: "Contact" },
] as const;

export function TechMediaNav() {
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const { content } = useSiteContent();
  const { brand } = content;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#08080c]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-2">
          <BrandMark
            logoUrl={brand.logoUrl}
            initials={brand.navInitials}
            className="h-9 w-9 shrink-0 text-sm"
            imgClassName="h-9 w-9"
            alt={`${brand.name} logo`}
          />
          <span className="truncate font-semibold tracking-tight text-white transition-colors group-hover:text-orange-400">
            {brand.name}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => {
            const active = loc === l.href || (l.href !== "/" && loc.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-all",
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/5",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/contact"
          className="hidden md:inline-flex rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2 text-sm font-semibold text-black hover:brightness-110 transition-all hover:scale-[1.02]"
        >
          Get started
        </Link>

        <button
          type="button"
          className="md:hidden rounded-lg p-2 text-zinc-300 hover:bg-white/10"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
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
            className="md:hidden border-t border-white/10 bg-[#0c0c12]"
          >
            <nav className="flex flex-col gap-1 p-4">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-full bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-black"
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
