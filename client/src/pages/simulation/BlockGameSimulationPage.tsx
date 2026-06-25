import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { PageSeo } from "@/components/seo/PageSeo";
import { BlockGameSimulationProvider } from "@/contexts/BlockGameSimulationContext";
import { ConfigPanel } from "./components/ConfigPanel";
import { SessionManager } from "./components/SessionManager";
import { GameGrid } from "./components/GameGrid";
import { GridPlayControls } from "./components/GridPlayControls";
import { ControlBar } from "./components/ControlBar";
import { OutcomeBlocks } from "./components/OutcomeBlocks";
import { SimulationCharts } from "./components/SimulationCharts";
import { SimulationTables } from "./components/SimulationTables";
import { SimResultsDialog } from "./components/SimResultsDialog";
import { SimulationAccessGate } from "./components/SimulationAccessGate";
import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";

function SimulationDashboard() {
  const { autoProgress } = useBlockGameSimulation();

  return (
    <div className="min-h-screen w-full bg-[#08080c] text-zinc-100">
      <div className="w-full px-3 py-3 sm:px-4 lg:px-5">
        <div className="flex flex-col gap-4">
          <ConfigPanel />
          <SessionManager />

          <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
            <div className="flex w-fit max-w-full shrink-0 flex-col gap-3">
              <GameGrid />
              <GridPlayControls />
            </div>
            <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-2">
              <ControlBar />
              <OutcomeBlocks />
            </div>
          </div>

          <SimulationTables />
          {!autoProgress.running && <SimulationCharts />}
        </div>
      </div>
      <SimResultsDialog />
    </div>
  );
}

export default function BlockGameSimulationPage() {
  return (
    <TechMediaLayout fullBleedMain hideChrome>
      <PageSeo
        config={{
          title: "Block Game Simulation Dashboard | TechantMedia",
          description:
            "Interactive block game simulation with configurable grids, bomb counts, house edge, multiplier algorithms, live analytics, and Monte Carlo auto-play.",
          path: "/simulation",
        }}
      />
      <SimulationAccessGate>
        <BlockGameSimulationProvider>
          <SimulationDashboard />
        </BlockGameSimulationProvider>
      </SimulationAccessGate>
    </TechMediaLayout>
  );
}
