import {
  ChevronDown,
  Save,
  FileSpreadsheet,
  Play,
  X,
  Minimize2,
  ExternalLink,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import { PLAYER_LIST_THRESHOLD, type SessionEconomics } from "@/lib/simulation/types";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BlockGameUniversalChart } from "./BlockGameUniversalChart";
import { SimChartDock } from "./SimChartDock";

type BottomTab = "summary" | "money" | "players";

function fmt(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function outcomeLabel(outcome: string) {
  switch (outcome) {
    case "won":
      return "Won (all safe)";
    case "lost":
      return "Lost (bomb)";
    case "cashed_out":
      return "Withdrawn";
    case "stopped":
      return "Stopped early";
    default:
      return outcome;
  }
}

function MiniStat({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded border border-[#2a2e39] bg-[#1c2030] px-2 py-1", className)}>
      <p className="truncate text-[8px] font-medium uppercase tracking-wide text-[#787b86]">{label}</p>
      <p className="truncate text-[11px] font-semibold tabular-nums text-[#d1d4dc]">{value}</p>
      {sub && <p className="truncate text-[9px] text-[#434651]">{sub}</p>}
    </div>
  );
}

function CompactEconomics({ economics, houseEdgeTarget }: { economics: SessionEconomics; houseEdgeTarget: number }) {
  const rtp = economics.userTotalStaked > 0 ? economics.userTotalPayout / economics.userTotalStaked : 0;
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-6">
      <MiniStat label="Staked = collected" value={`$${economics.userTotalStaked.toFixed(0)}`} />
      <MiniStat label="Returned = paid" value={`$${economics.userTotalPayout.toFixed(0)}`} />
      <MiniStat label="User net" value={fmt(economics.userNetProfit)} />
      <MiniStat label="House net" value={fmt(economics.adminNetRevenue)} />
      <MiniStat label="RTP" value={pct(rtp)} sub={`Edge ${pct(economics.realizedHouseEdge)}`} />
      <MiniStat label="Target edge" value={pct(houseEdgeTarget)} sub={`${economics.gamesPlayed.toLocaleString()} g`} />
    </div>
  );
}

function PlayerList({
  title,
  players,
  colorClass,
}: {
  title: string;
  players: { playerId: number; endingBalance: number; netProfit: number; stakePerGame: number }[];
  colorClass: string;
}) {
  if (players.length === 0) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded border border-[#2a2e39] bg-[#1c2030] px-2 py-1 text-left text-[10px] hover:bg-[#2a2e39]">
        <span className={cn("font-medium", colorClass)}>{title} ({players.length})</span>
        <ChevronDown className="h-3 w-3 text-[#787b86]" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">
        {players.length > PLAYER_LIST_THRESHOLD ? (
          <p className="text-[10px] text-[#787b86]">{players.length} players — export Excel for full list.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[#2a2e39] hover:bg-transparent">
                <TableHead className="h-6 px-1 text-[9px] text-[#787b86]">#</TableHead>
                <TableHead className="h-6 px-1 text-right text-[9px] text-[#787b86]">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.slice(0, 4).map((p) => (
                <TableRow key={p.playerId} className="border-[#2a2e39]">
                  <TableCell className="px-1 py-0.5 text-[10px] text-[#d1d4dc]">{p.playerId + 1}</TableCell>
                  <TableCell className={cn("px-1 py-0.5 text-right text-[10px]", colorClass)}>{fmt(p.netProfit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function TabBar({ tab, onTab, labels }: { tab: BottomTab; onTab: (t: BottomTab) => void; labels: { id: BottomTab; label: string }[] }) {
  return (
    <div className="flex shrink-0 gap-0 border-b border-[#2a2e39]">
      {labels.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTab(t.id)}
          className={cn(
            "border-b-2 px-3 py-1 text-[10px] font-medium transition-colors",
            tab === t.id
              ? "border-[#2962ff] text-[#d1d4dc]"
              : "border-transparent text-[#787b86] hover:text-[#d1d4dc]",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SimResultsDialog() {
  const {
    simResultsOpen,
    chartMinimized,
    closeSimResults,
    minimizeChartDialog,
    expandChartDialog,
    openChartInNewTab,
    summary,
    manualResult,
    sessionName,
    sessionEconomics,
    config,
    saveSessionToStorage,
    exportCurrentSessionExcel,
    playAgainAfterRound,
    accountBalance,
    userWallet,
    autoProgress,
    liveMetrics,
  } = useBlockGameSimulation();
  const [busy, setBusy] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>("summary");

  const isManual = manualResult != null;
  const isLive = autoProgress.running;
  const canContinueManual = isManual && accountBalance >= userWallet.stake;
  const chartExpanded = simResultsOpen && !chartMinimized;

  const progressPct = autoProgress.target > 0 ? Math.round((autoProgress.completed / autoProgress.target) * 100) : 0;

  const bottomTabs = useMemo(() => {
    const tabs: { id: BottomTab; label: string }[] = [{ id: "summary", label: "Summary" }];
    if (!isLive && sessionEconomics.gamesPlayed > 0) tabs.push({ id: "money", label: "Money" });
    if (summary && !isLive) tabs.push({ id: "players", label: "Players" });
    return tabs;
  }, [isLive, sessionEconomics.gamesPlayed, summary]);

  const winners = summary?.playerStats.filter((p) => p.sessionWon) ?? [];
  const losers = summary?.playerStats.filter((p) => p.sessionLost) ?? [];
  const breakEven = summary?.playerStats.filter((p) => !p.sessionWon && !p.sessionLost) ?? [];

  const handleDialogOpenChange = (open: boolean) => {
    if (open) return;
    if (isLive) minimizeChartDialog();
    else closeSimResults();
  };

  const sessionUserNet = isLive ? liveMetrics.userProfit : sessionEconomics.userNetProfit;
  const sessionGameCount = isLive ? liveMetrics.games : sessionEconomics.gamesPlayed;

  return (
    <>
      <SimChartDock
        visible={simResultsOpen && chartMinimized}
        isLive={isLive}
        games={isLive ? liveMetrics.games : autoProgress.completed}
        target={autoProgress.target}
        progressPct={progressPct}
        userNet={sessionUserNet}
        sessionGames={sessionGameCount}
        onExpand={expandChartDialog}
        onDismiss={closeSimResults}
        onOpenNewTab={openChartInNewTab}
      />

      <Dialog open={chartExpanded} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        overlayClassName="bg-black/40 backdrop-blur-[18px]"
        style={{ width: "85vw", maxWidth: "85vw", height: "85vh", maxHeight: "85vh" }}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          "border-[#2a2e39] bg-[#131722] text-[#d1d4dc] sm:rounded-lg",
          "!w-[85vw] !max-w-[85vw] !h-[85vh] !max-h-[85vh] sm:!max-w-[85vw]",
        )}
        showCloseButton={false}
      >
        {/* Close + actions — top-right */}
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]"
            aria-label="Open chart in new tab"
            title="Open in new tab"
            onClick={openChartInNewTab}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          {isLive ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]"
              aria-label="Dock chart"
              title="Dock chart"
              onClick={minimizeChartDialog}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <>
              {canContinueManual && (
                <Button type="button" size="sm" className="h-6 bg-[#2962ff] px-2 text-[10px] hover:bg-[#1e53e5]" onClick={() => { closeSimResults(); playAgainAfterRound(); }}>
                  <Play className="mr-0.5 h-3 w-3" /> Play
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#787b86] hover:text-[#d1d4dc]" onClick={() => {
                if (!sessionName.trim()) { toast.error("Add session name first."); return; }
                if (saveSessionToStorage()) toast.success("Saved.");
              }}>
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#787b86] hover:text-[#d1d4dc]" disabled={busy} onClick={async () => {
                if (!sessionName.trim()) { toast.error("Add session name first."); return; }
                setBusy(true);
                try {
                  const ok = await exportCurrentSessionExcel();
                  if (ok) toast.success("Exported.");
                } finally { setBusy(false); }
              }}>
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#787b86] hover:text-[#d1d4dc]" onClick={closeSimResults}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <BlockGameUniversalChart className="min-h-0 flex-1" />

          {/* Post-run bottom panel — only when not live */}
          {!isLive && (summary || manualResult) && (
            <div className="flex max-h-[28%] min-h-[120px] shrink-0 flex-col border-t border-[#2a2e39] bg-[#1c2030]">
              {bottomTabs.length > 1 && <TabBar tab={bottomTab} onTab={setBottomTab} labels={bottomTabs} />}
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {bottomTab === "summary" && summary && (
                  <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
                    <MiniStat label="Games" value={summary.gamesPlayed.toLocaleString()} />
                    <MiniStat label="RTP" value={pct(summary.rtp)} sub={`tgt ${pct(1 - config.houseEdge)}`} />
                    <MiniStat label="W/L games" value={`${summary.totalWins}/${summary.totalLosses}`} />
                    <MiniStat label="Avg/game" value={fmt(summary.averageUserProfitPerGame)} />
                    <MiniStat label="Winners" value={String(summary.playersWinners)} />
                    <MiniStat label="Losers" value={String(summary.playersLosers)} />
                    <MiniStat label="Even" value={String(summary.playersBreakEven)} />
                    <MiniStat label="Net" value={fmt(sessionEconomics.userNetProfit)} />
                  </div>
                )}
                {bottomTab === "money" && sessionEconomics.gamesPlayed > 0 && (
                  <CompactEconomics economics={sessionEconomics} houseEdgeTarget={config.houseEdge} />
                )}
                {bottomTab === "players" && summary && (
                  <div className="grid gap-1 sm:grid-cols-3">
                    <PlayerList title="Winners" players={winners.map((p) => ({ playerId: p.playerId, endingBalance: p.endingBalance, netProfit: p.netProfit, stakePerGame: p.stakePerGame }))} colorClass="text-[#26a69a]" />
                    <PlayerList title="Losers" players={losers.map((p) => ({ playerId: p.playerId, endingBalance: p.endingBalance, netProfit: p.netProfit, stakePerGame: p.stakePerGame }))} colorClass="text-[#ef5350]" />
                    {breakEven.length > 0 && (
                      <PlayerList title="Even" players={breakEven.map((p) => ({ playerId: p.playerId, endingBalance: p.endingBalance, netProfit: p.netProfit, stakePerGame: p.stakePerGame }))} colorClass="text-[#787b86]" />
                    )}
                  </div>
                )}
                {manualResult && bottomTab === "summary" && (
                  <div className="mt-1 grid grid-cols-4 gap-1">
                    <MiniStat label="Outcome" value={outcomeLabel(manualResult.outcome)} />
                    <MiniStat label="Balance" value={`$${manualResult.endingAccountBalance.toFixed(2)}`} />
                    <MiniStat label="Stake" value={`$${manualResult.gameStake.toFixed(2)}`} />
                    <MiniStat label="Net" value={fmt(manualResult.netProfit)} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
