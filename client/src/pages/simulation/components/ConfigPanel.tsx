import { GRID_PRESETS } from "@/lib/simulation/types";
import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { totalCells } from "@/lib/simulation/math";
import { simHint, simPanel } from "../simulationStyles";
import type { SimViewVariant } from "../simulationStyles";
import { SimExpandablePanel } from "./SimExpandablePanel";
import { EditableNumberInput } from "./EditableNumberInput";

function ConfigPanelInner({ variant }: { variant: SimViewVariant }) {
  const { config, setConfig, applyPreset, formulaError } = useBlockGameSimulation();
  const total = totalCells(config.rows, config.cols);
  const maxRounds = Math.max(1, total - config.bombs);
  const expanded = variant === "expanded";

  const labelCls = expanded ? "text-sm text-zinc-400" : "text-sm text-zinc-400";
  const inputCls = expanded
    ? "h-10 border-white/10 bg-black/40 px-3 text-sm"
    : "h-9 border-white/10 bg-black/40 px-3 text-sm";
  const gridCls = expanded
    ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    : "grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8";

  return (
    <div className={gridCls}>
      <div className="space-y-1.5">
        <Label htmlFor={`stake-${variant}`} className={labelCls}>
          Initial stake ($)
        </Label>
        <EditableNumberInput
          id={`stake-${variant}`}
          min={1}
          step={1}
          fallback={1}
          value={config.stake}
          onCommit={(stake) => setConfig({ stake })}
          className={inputCls}
        />
      </div>

      <div className={cn("space-y-1.5", expanded ? "sm:col-span-2" : "col-span-2 sm:col-span-1 lg:col-span-2")}>
        <Label className={labelCls}>Grid preset</Label>
        <div className="flex flex-wrap gap-2">
          {GRID_PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "border-white/15 bg-black/30",
                expanded ? "h-9 px-3 text-sm" : "h-7 px-2 text-xs",
                config.rows === p.rows &&
                  config.cols === p.cols &&
                  "border-violet-400 bg-violet-500/20",
              )}
              onClick={() => applyPreset(p.rows, p.cols)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {[
        { key: "rows" as const, label: "Rows", val: config.rows, min: 1, max: 20, set: (v: number) => setConfig({ rows: v }) },
        { key: "cols" as const, label: "Columns", val: config.cols, min: 2, max: 20, set: (v: number) => setConfig({ cols: v }) },
        { key: "bombs" as const, label: "Bombs", val: config.bombs, min: 1, max: Math.max(1, total - 1), set: (v: number) => setConfig({ bombs: v }) },
        { key: "edge" as const, label: "House edge", val: config.houseEdge, min: 0.01, max: 0.15, step: 0.01, set: (v: number) => setConfig({ houseEdge: v }), fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
        { key: "rounds" as const, label: "Win rounds", val: Math.min(config.simulationRounds, maxRounds), min: 1, max: maxRounds, set: (v: number) => setConfig({ simulationRounds: v }) },
      ].map((s) => (
        <div key={s.key} className="space-y-1.5">
          <Label className={labelCls}>
            {s.label}: {s.fmt ? s.fmt(s.val) : s.val}
            {s.key === "bombs" && expanded && ` / ${total} boxes`}
          </Label>
          <Slider
            className={expanded ? "py-1" : "py-0"}
            min={s.min}
            max={s.max}
            step={"step" in s ? s.step : 1}
            value={[s.val]}
            onValueChange={([v]) => s.set(v ?? s.min)}
          />
        </div>
      ))}

      <div className="space-y-1.5">
        <Label className={labelCls}>Multiplier algorithm</Label>
        <Select
          value={config.multiplierMode}
          onValueChange={(v) => setConfig({ multiplierMode: v as typeof config.multiplierMode })}
        >
          <SelectTrigger className={cn(inputCls, "text-xs")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="linear">Linear — (1 − edge) / P(win)</SelectItem>
            <SelectItem value="progressive">Progressive — exponential bonus</SelectItem>
            <SelectItem value="custom">Custom formula</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.multiplierMode === "progressive" && (
        <div className="space-y-1.5">
          <Label className={labelCls}>Bonus factor: {config.bonusFactor.toFixed(2)}</Label>
          <Slider
            min={0}
            max={0.5}
            step={0.05}
            value={[config.bonusFactor]}
            onValueChange={([v]) => setConfig({ bonusFactor: v ?? 0.1 })}
          />
        </div>
      )}

      {config.multiplierMode === "custom" && (
        <div className={cn("space-y-1.5", expanded ? "sm:col-span-2 lg:col-span-3" : "col-span-2 lg:col-span-3")}>
          <Label htmlFor={`formula-${variant}`} className={labelCls}>
            Custom formula
          </Label>
          <Input
            id={`formula-${variant}`}
            value={config.customFormula}
            onChange={(e) => setConfig({ customFormula: e.target.value })}
            placeholder="(1 - edge) / pWin"
            className={cn(inputCls, "font-mono")}
          />
          {expanded && (
            <p className="text-sm text-zinc-500">
              Variables: <code className="text-violet-300">edge</code>,{" "}
              <code className="text-violet-300">pWin</code>,{" "}
              <code className="text-violet-300">round</code>,{" "}
              <code className="text-violet-300">total</code>,{" "}
              <code className="text-violet-300">bombs</code>,{" "}
              <code className="text-violet-300">stake</code>
            </p>
          )}
          {formulaError && <p className="text-sm text-red-400">{formulaError}</p>}
        </div>
      )}

      {expanded && (
        <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
          <p>
            <strong className="text-zinc-200">{total}</strong> total cells with{" "}
            <strong className="text-red-300">{config.bombs}</strong> bombs. Target:{" "}
            <strong className="text-emerald-300">{config.simulationRounds}</strong> consecutive safe
            picks. House edge <strong>{(config.houseEdge * 100).toFixed(1)}%</strong> is baked into
            the multiplier so long-run RTP stays below 100%.
          </p>
        </div>
      )}
    </div>
  );
}

export function ConfigPanel() {
  const { config } = useBlockGameSimulation();
  const total = totalCells(config.rows, config.cols);

  return (
    <SimExpandablePanel
      title="Game parameters"
      description="Configure stake, grid size, bombs, house edge, and multiplier model."
      panelClassName={simPanel}
      dialogClassName="sm:max-w-4xl"
      expandedContent={<ConfigPanelInner variant="expanded" />}
    >
      <p className={cn(simHint, "mb-2")}>
        {total} boxes · {config.bombs} bombs
      </p>
      <ConfigPanelInner variant="inline" />
    </SimExpandablePanel>
  );
}
