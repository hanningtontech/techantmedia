import { useState } from "react";
import {
  Download,
  FolderOpen,
  PlayCircle,
  Save,
  Trash2,
  Eraser,
  FileSpreadsheet,
  LineChart,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { simHint, simPanel } from "../simulationStyles";
import { SimExpandablePanel } from "./SimExpandablePanel";

function SessionManagerInner({ expanded }: { expanded: boolean }) {
  const {
    sessionName,
    setSessionName,
    sessionStartedAt,
    savedSessions,
    sessionEconomics,
    startSession,
    clearActiveSession,
    saveSessionToStorage,
    exportCurrentSessionExcel,
    exportSavedSessionExcel,
    removeSavedSession,
    autoProgress,
    openChartDialog,
    expandChartDialog,
    openChartInNewTab,
    simResultsOpen,
    chartMinimized,
  } = useBlockGameSimulation();

  const [exporting, setExporting] = useState(false);
  const hasRunData =
    sessionEconomics.gamesPlayed > 0 || sessionStartedAt != null;

  const handleSave = () => {
    if (!sessionName.trim()) {
      toast.error("Name your session before saving.");
      return;
    }
    if (saveSessionToStorage()) {
      toast.success("Session saved on this device.");
    } else {
      toast.error("Play or run a simulation first — nothing to save yet.");
    }
  };

  const handleExportCurrent = async () => {
    if (!sessionName.trim()) {
      toast.error("Name your session before exporting.");
      return;
    }
    setExporting(true);
    try {
      const ok = await exportCurrentSessionExcel();
      if (ok) toast.success("Excel downloaded to your device.");
      else toast.error("No results to export yet.");
    } catch {
      toast.error("Excel export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportSaved = async (id: string, name: string) => {
    setExporting(true);
    try {
      await exportSavedSessionExcel(id);
      toast.success(`Downloaded "${name}"`);
    } catch {
      toast.error("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={cn("flex flex-col", expanded ? "gap-4" : "gap-3")}>
      <div className="space-y-2">
        <Label htmlFor="session-name" className="text-xs text-zinc-400">
          Session name
        </Label>
        <Input
          id="session-name"
          placeholder="e.g. 5×5 · 3% edge · 10 players"
          value={sessionName}
          disabled={autoProgress.running}
          onChange={(e) => setSessionName(e.target.value)}
          className="h-9 border-white/10 bg-black/40 text-sm"
        />
        {sessionStartedAt && (
          <p className={simHint}>
            Active since {new Date(sessionStartedAt).toLocaleString()} ·{" "}
            {sessionEconomics.gamesPlayed.toLocaleString()} games logged
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="h-9 bg-[#2962ff] text-sm hover:bg-[#1e53e5]"
          onClick={() => {
            if (simResultsOpen && chartMinimized) expandChartDialog();
            else openChartDialog();
          }}
        >
          <LineChart className="mr-1.5 h-4 w-4" />
          {simResultsOpen && chartMinimized ? "Expand chart" : "Session chart"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 border-[#2962ff]/40 text-sm text-[#d1d4dc] hover:bg-[#2962ff]/10"
          onClick={openChartInNewTab}
          title="Open chart in new tab"
        >
          <ExternalLink className="mr-1.5 h-4 w-4" />
          New tab
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={autoProgress.running}
          className="h-9 bg-violet-600 text-sm hover:bg-violet-500"
          onClick={startSession}
        >
          <PlayCircle className="mr-1.5 h-4 w-4" />
          Start session
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={autoProgress.running || !hasRunData}
          className="h-9 border-white/15 text-sm"
          onClick={clearActiveSession}
        >
          <Eraser className="mr-1.5 h-4 w-4" />
          Clear run
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={autoProgress.running}
          className="h-9 border-emerald-500/30 text-sm text-emerald-300 hover:bg-emerald-500/10"
          onClick={handleSave}
        >
          <Save className="mr-1.5 h-4 w-4" />
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={exporting || autoProgress.running}
          className="h-9 border-white/15 text-sm"
          onClick={handleExportCurrent}
        >
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          Excel
        </Button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <FolderOpen className="h-3.5 w-3.5" />
          Saved on this device ({savedSessions.length})
        </p>
        {savedSessions.length === 0 ? (
          <p className={simHint}>Saved sessions appear here. Works on phone or computer browser storage.</p>
        ) : (
          <ul className={cn("space-y-1.5", expanded ? "max-h-64" : "max-h-36", "overflow-y-auto")}>
            {savedSessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/30 px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">{s.name}</p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(s.savedAt).toLocaleDateString()} · {s.sessionEconomics.gamesPlayed} games · User{" "}
                    {s.sessionEconomics.userNetProfit >= 0 ? "+" : ""}$
                    {s.sessionEconomics.userNetProfit.toFixed(2)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-zinc-400 hover:text-emerald-300"
                    title="Download Excel"
                    disabled={exporting}
                    onClick={() => handleExportSaved(s.id, s.name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-zinc-400 hover:text-red-400"
                    title="Delete"
                    onClick={() => {
                      removeSavedSession(s.id);
                      toast.success("Session removed from device.");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SessionManager() {
  return (
    <SimExpandablePanel
      title="Sessions"
      description="Name, start, save, and export simulation runs as Excel on your device."
      panelClassName={simPanel}
      dialogClassName="sm:max-w-lg"
      expandedContent={<SessionManagerInner expanded />}
    >
      <SessionManagerInner expanded={false} />
    </SimExpandablePanel>
  );
}
