import { ExternalLink, Gamepad2, LineChart, FlaskConical } from "lucide-react";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import { BlockGameBombRangePanel } from "./BlockGameBombRangePanel";
import { BlockGameFundRequestsPanel } from "./BlockGameFundRequestsPanel";
import { BlockGameHouseEdgePanel } from "./BlockGameHouseEdgePanel";
import { BlockGamePlayerRevenuePanel } from "./BlockGamePlayerRevenuePanel";
import { BlockGameSimPinPanel } from "./BlockGameSimPinPanel";

const QUICK_LINKS = [
  { href: "/game", label: "Player game", icon: Gamepad2, note: "Sign-in required to play" },
  { href: "/simulation", label: "Simulation dashboard", icon: FlaskConical, note: "PIN or admin access" },
  { href: "/game/chart", label: "Live chart", icon: LineChart, note: "Universal feed — public" },
] as const;

export function BlockGameAdminSection() {
  return (
    <AdminPage
      title="Block game"
      description="Approve player wallet top-ups, track live house revenue from real players, issue simulation PINs, and open game pages."
      width="standard"
      layout="stack"
      showLayoutGuide={false}
    >
      <AdminSection
        title="Quick links"
        description="All block game routes live on techantmedia.com."
        accent="violet"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map(({ href, label, icon: Icon, note }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 transition hover:border-violet-500/40 hover:bg-violet-500/10"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium text-zinc-100">
                  {label}
                  <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                </p>
                <p className="text-xs text-zinc-500">{note}</p>
                <p className="font-mono text-[11px] text-violet-400/80">{href}</p>
              </div>
            </a>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        title="Live game house edge"
        description="Set the operator edge baked into /game payout multipliers. Changes apply on the next round for all players."
        accent="violet"
        defaultOpen
      >
        <BlockGameHouseEdgePanel />
      </AdminSection>

      <AdminSection
        title="Grid bomb ranges"
        description="Min–max bomb density per grid preset for live /game rounds. Defaults match production (30%–55%)."
        accent="violet"
        defaultOpen
      >
        <BlockGameBombRangePanel />
      </AdminSection>

      <AdminSection
        title="Player house revenue"
        description="Live net from real /game players only — simulation excluded. Positive house net means players lost; negative means players won (house lost)."
        accent="teal"
        defaultOpen
      >
        <BlockGamePlayerRevenuePanel />
      </AdminSection>

      <AdminSection
        title="Player fund requests"
        description="Signed-in players request KES top-ups from /game. Granting credits their Firestore wallet immediately."
        accent="orange"
        defaultOpen
      >
        <BlockGameFundRequestsPanel />
      </AdminSection>

      <AdminSection
        title="Simulation access PINs"
        description="Generate a one-time PIN for a specific visitor. They enter it at /simulation — each PIN works once and expires in 24 hours."
        accent="teal"
        defaultOpen
      >
        <BlockGameSimPinPanel />
      </AdminSection>
    </AdminPage>
  );
}
