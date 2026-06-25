import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { useBlockGameSimulation } from "@/contexts/BlockGameSimulationContext";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { simHint, simPanel, type SimViewVariant } from "../simulationStyles";
import { SimExpandablePanel } from "./SimExpandablePanel";

const evChartConfig = {
  expectedValue: { label: "Expected value", color: "hsl(262, 83%, 58%)" },
  stake: { label: "Initial stake", color: "hsl(45, 93%, 47%)" },
};

const economicsChartConfig = {
  userCumulativeProfit: { label: "User net profit", color: "hsl(152, 70%, 45%)" },
  adminCumulativeRevenue: { label: "Admin net revenue", color: "hsl(0, 72%, 55%)" },
};

const histChartConfig = {
  count: { label: "Games", color: "hsl(199, 89%, 48%)" },
};

function chartHeight(expanded: boolean) {
  return expanded ? "h-[280px]" : "h-[200px] xl:h-[220px]";
}

function ChartBlock({
  title,
  hint,
  expanded,
  children,
}: {
  title: string;
  hint?: string;
  expanded: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        expanded ? "rounded-lg border border-white/10 bg-black/20 p-4" : simPanel,
      )}
    >
      <h4 className={expanded ? "text-base font-semibold text-zinc-200" : "text-sm font-semibold uppercase tracking-wider text-zinc-300"}>
        {title}
      </h4>
      {hint && <p className={expanded ? "mb-3 text-sm text-zinc-500" : simHint}>{hint}</p>}
      {children}
    </div>
  );
}

function ChartsInner({ variant }: { variant: SimViewVariant }) {
  const { evSeries, winLossDistribution, payoutHistogram, economicsSeries, config } =
    useBlockGameSimulation();
  const expanded = variant === "expanded";
  const h = chartHeight(expanded);
  const grid = expanded ? "grid gap-4 sm:grid-cols-2" : "contents";

  return (
    <div className={grid}>
      <ChartBlock title="Expected value over rounds" hint="EV vs initial stake per consecutive win" expanded={expanded}>
        <ChartContainer config={evChartConfig} className={`${h} w-full !aspect-auto`}>
          <LineChart data={evSeries} margin={{ left: expanded ? 8 : -12, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="round" tickLine={false} axisLine={false} tick={{ fontSize: expanded ? 12 : 9 }} />
            <YAxis tickLine={false} axisLine={false} width={expanded ? 48 : 32} tick={{ fontSize: expanded ? 12 : 9 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {expanded && <ChartLegend content={<ChartLegendContent />} />}
            <Line type="monotone" dataKey="expectedValue" stroke="var(--color-expectedValue)" strokeWidth={2} dot={expanded ? { r: 4 } : false} />
            <Line type="monotone" dataKey="stake" stroke="var(--color-stake)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
          </LineChart>
        </ChartContainer>
      </ChartBlock>

      <ChartBlock title="Win / loss probability" hint={`${config.simulationRounds} consecutive safe picks`} expanded={expanded}>
        <ChartContainer config={{ win: { label: "Win", color: "hsl(152, 70%, 45%)" } }} className={`${h} w-full !aspect-auto`}>
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={winLossDistribution}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={expanded ? 55 : 40}
              outerRadius={expanded ? 90 : 64}
              paddingAngle={2}
            >
              {winLossDistribution.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent />} wrapperStyle={{ fontSize: expanded ? 12 : 9 }} />
          </PieChart>
        </ChartContainer>
      </ChartBlock>

      <ChartBlock title="Payout distribution" hint="Histogram from auto-play" expanded={expanded}>
        <ChartContainer config={histChartConfig} className={`${h} w-full !aspect-auto`}>
          <BarChart data={payoutHistogram} margin={{ left: expanded ? 4 : -16, right: 4, top: 8, bottom: expanded ? 0 : -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="bin" tickLine={false} axisLine={false} tick={{ fontSize: expanded ? 10 : 0 }} />
            <YAxis tickLine={false} axisLine={false} width={expanded ? 40 : 28} tick={{ fontSize: expanded ? 11 : 9 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        {payoutHistogram.length === 0 && (
          <p className="text-center text-xs text-zinc-500">Run auto-play to populate</p>
        )}
      </ChartBlock>

      <ChartBlock title="User profit vs admin revenue" hint="Green = user, red = house — zero-sum" expanded={expanded}>
        <ChartContainer config={economicsChartConfig} className={`${h} w-full !aspect-auto`}>
          <LineChart data={economicsSeries} margin={{ left: expanded ? 8 : -8, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="game" tickLine={false} axisLine={false} tick={{ fontSize: expanded ? 11 : 9 }} />
            <YAxis tickLine={false} axisLine={false} width={expanded ? 56 : 36} tick={{ fontSize: expanded ? 11 : 9 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {expanded && <ChartLegend content={<ChartLegendContent />} />}
            <Line type="monotone" dataKey="userCumulativeProfit" stroke="var(--color-userCumulativeProfit)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="adminCumulativeRevenue" stroke="var(--color-adminCumulativeRevenue)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
        {economicsSeries.length === 0 && (
          <p className="text-center text-xs text-zinc-500">Play manually or run auto-sim to see curves</p>
        )}
      </ChartBlock>
    </div>
  );
}

export function SimulationCharts() {
  return (
    <SimExpandablePanel
      title="Analytics charts"
      description="Live EV, win/loss odds, payout histogram, and cumulative house performance."
      panelClassName={simPanel}
      dialogClassName="sm:max-w-6xl"
      expandedContent={<ChartsInner variant="expanded" />}
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ChartsInner variant="inline" />
      </div>
    </SimExpandablePanel>
  );
}
