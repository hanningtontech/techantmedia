import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Menu, Rocket, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { filterAdminNavGroups } from "@/lib/admin/adminPermissions";
import { ADMIN_NAV_GROUPS, type AdminNavId } from "@/lib/admin/constants";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { cn } from "@/lib/utils";
import "@/styles/admin-portfolio.css";

const SIDEBAR_KEY = "tm-admin-sidebar-collapsed";
const GROUPS_KEY = "tm-admin-nav-groups-open";

type Props = {
  active: AdminNavId;
  onNavigate: (id: AdminNavId) => void;
  busy: boolean;
  onDeploy: () => void;
  children: ReactNode;
};

export function AdminShell({ active, onNavigate, busy, onDeploy, children }: Props) {
  const { profile, user } = useFirebaseAuth();
  const navGroups = filterAdminNavGroups(profile, user?.email);
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      /* ignore */
    }
    return Object.fromEntries(ADMIN_NAV_GROUPS.map((g) => [g.id, true]));
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(openGroups));
    } catch {
      /* ignore */
    }
  }, [openGroups]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="admin-portfolio-root flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 shrink-0 border-b border-white/10 bg-[#08080c]/95 backdrop-blur-xl">
        <div className="admin-shell-header-inner flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-white/10 p-2 text-zinc-300 hover:bg-white/5 lg:hidden"
              onClick={() => setMobileNav((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileNav ? <X size={20} /> : <Menu size={20} />}
            </button>
            <button
              type="button"
              className="hidden rounded-lg border border-white/10 p-2 text-zinc-300 hover:bg-white/5 lg:flex"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">TechantMedia</p>
              <h1 className="truncate text-lg font-bold text-white">Content admin</h1>
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
            {active.startsWith("xai.") ? (
              <a
                href="/portfolio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 sm:text-sm"
              >
                <span className="hidden sm:inline">View xAI portfolio</span>
                <span className="sm:hidden">Portfolio</span>
              </a>
            ) : null}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-teal-500 px-4 py-2 text-xs font-semibold text-black hover:brightness-110 sm:text-sm disabled:opacity-50"
                >
                  <Rocket className="h-4 w-4" />
                  {busy ? "Deploying…" : "Deploy"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-white/10 bg-[#12121a] text-zinc-100">
                <AlertDialogHeader>
                  <AlertDialogTitle>Deploy to live site?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    This publishes all saved admin changes to Firestore. Visitors will see the updated storefront
                    immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={busy}
                    onClick={onDeploy}
                    className="bg-gradient-to-r from-orange-500 to-teal-500 text-black hover:brightness-110"
                  >
                    Deploy now
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "admin-sidebar shrink-0 border-r border-white/10 bg-[#0c0c12] transition-all",
            collapsed ? "admin-sidebar--collapsed w-14" : "w-60 lg:w-64",
            mobileNav ? "fixed inset-y-[57px] left-0 z-40 w-64 shadow-2xl lg:static lg:shadow-none" : "hidden lg:block",
          )}
        >
          <nav className="flex h-[calc(100vh-57px)] flex-col overflow-y-auto p-2">
            {navGroups.map((group) => {
              const isOpen = openGroups[group.id] !== false;
              const accentClass =
                group.accent === "teal"
                  ? "text-teal-400"
                  : group.accent === "violet"
                    ? "text-violet-400"
                    : group.accent === "orange"
                      ? "text-orange-400"
                      : "text-zinc-400";

              return (
                <div key={group.id} className="mb-1">
                  <button
                    type="button"
                    onClick={() => !collapsed && toggleGroup(group.id)}
                    className={cn(
                      "admin-nav-group-label flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-bold uppercase tracking-wider",
                      accentClass,
                    )}
                  >
                    <span className="admin-sidebar-label truncate">{group.label}</span>
                    {!collapsed ? (
                      <ChevronDown className={cn("admin-nav-chevron h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                    ) : null}
                  </button>
                  {(collapsed || isOpen) && (
                    <ul className="mt-0.5 space-y-0.5 pl-1">
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            title={collapsed ? item.label : undefined}
                            onClick={() => {
                              onNavigate(item.id);
                              setMobileNav(false);
                            }}
                            className={cn(
                              "admin-nav-item-label flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-all",
                              active === item.id
                                ? "bg-gradient-to-r from-orange-500/25 to-teal-500/15 text-white ring-1 ring-orange-500/30"
                                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
                            )}
                          >
                            <span className="truncate">{collapsed ? item.label.slice(0, 1) : item.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {mobileNav ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileNav(false)}
          />
        ) : null}

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
