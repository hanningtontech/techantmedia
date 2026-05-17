import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, Menu, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import "@/styles/admin-portfolio.css";

export type AdminNavId =
  | "brand"
  | "home"
  | "projects"
  | "skills"
  | "photoHero"
  | "photoGallery"
  | "videography"
  | "photoRates"
  | "photoBooking";

const NAV: { id: AdminNavId; label: string; short: string }[] = [
  { id: "brand", label: "Brand & contact", short: "Brand" },
  { id: "home", label: "Home page cards", short: "Home" },
  { id: "projects", label: "Development projects", short: "Projects" },
  { id: "skills", label: "Dev skills", short: "Skills" },
  { id: "photoHero", label: "Photo hero slideshow", short: "Hero" },
  { id: "photoGallery", label: "Gallery & categories", short: "Gallery" },
  { id: "videography", label: "Videography", short: "Video" },
  { id: "photoRates", label: "Rate cards", short: "Rates" },
  { id: "photoBooking", label: "Booking & process", short: "Book" },
];

type Props = {
  active: AdminNavId;
  onNavigate: (id: AdminNavId) => void;
  busy: boolean;
  onSave: () => void;
  onReset: () => void;
  children: ReactNode;
};

export function AdminShell({ active, onNavigate, busy, onSave, onReset, children }: Props) {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="admin-portfolio-root">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#08080c]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-white/10 p-2 text-zinc-300 hover:bg-white/5 lg:hidden"
              onClick={() => setMobileNav((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileNav ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">TechantMedia</p>
              <h1 className="truncate text-lg font-bold text-white">Site content</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-white/25 hover:text-white sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">View site</span>
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={onReset}
              className="rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5 sm:text-sm disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-teal-500 px-4 py-2 text-xs font-semibold text-black hover:brightness-110 sm:text-sm disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {busy ? "Saving…" : "Save all"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-w-0 max-w-[1600px]">
        <aside
          className={cn(
            "w-full shrink-0 border-b border-white/10 bg-[#0c0c12] lg:w-56 lg:border-b-0 lg:border-r lg:min-h-[calc(100vh-57px)]",
            mobileNav ? "block" : "hidden lg:block",
          )}
        >
          <nav className="flex flex-wrap gap-1 p-3 lg:flex-col lg:gap-0.5 lg:p-4 lg:max-h-[calc(100vh-57px)] lg:overflow-y-auto">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setMobileNav(false);
                }}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all lg:w-full",
                  active === item.id
                    ? "bg-gradient-to-r from-orange-500/25 to-teal-500/15 text-white ring-1 ring-orange-500/30"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                )}
              >
                <span className="lg:hidden">{item.short}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl space-y-5">{children}</div>
        </main>
      </div>
    </div>
  );
}