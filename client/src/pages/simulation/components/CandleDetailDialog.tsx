import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SimCandle } from "@/lib/simulation/candleSeries";
import {
  formatCandleTimeRange,
  summarizeCandlePeriod,
  type CandlePeriodStats,
  type SimChartTick,
} from "@/lib/simulation/timeChartHistory";
import { cn } from "@/lib/utils";

const TV = {
  bull: "#26a69a",
  bear: "#ef5350",
  text: "#d1d4dc",
  muted: "#787b86",
  border: "#2a2e39",
  panel: "#1c2030",
};

function fmtPrice(n: number) {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}$${abs.toFixed(digits)}`;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function OhlcRow({ label, candle }: { label: string; candle: SimCandle }) {
  const change = candle.close - candle.open;
  return (
    <div className="rounded border px-2 py-1.5" style={{ borderColor: TV.border, background: TV.panel }}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#2962ff]">{label}</p>
      <div className="grid grid-cols-4 gap-2 text-[11px] tabular-nums">
        <div>
          <p className="text-[9px] text-[#787b86]">Open</p>
          <p style={{ color: candle.open >= 0 ? TV.bull : TV.bear }}>{fmtPrice(candle.open)}</p>
        </div>
        <div>
          <p className="text-[9px] text-[#787b86]">High</p>
          <p style={{ color: TV.bull }}>{fmtPrice(candle.high)}</p>
        </div>
        <div>
          <p className="text-[9px] text-[#787b86]">Low</p>
          <p style={{ color: TV.bear }}>{fmtPrice(candle.low)}</p>
        </div>
        <div>
          <p className="text-[9px] text-[#787b86]">Close</p>
          <p style={{ color: candle.close >= 0 ? TV.bull : TV.bear }}>{fmtPrice(candle.close)}</p>
        </div>
      </div>
      <p className="mt-1 text-[10px] tabular-nums" style={{ color: change >= 0 ? TV.bull : TV.bear }}>
        Period change {fmtPrice(change)} · {candle.bullish ? "Up" : "Down"}
      </p>
    </div>
  );
}

function Stat({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="min-w-0 rounded border px-2 py-1" style={{ borderColor: TV.border, background: TV.panel }}>
      <p className="truncate text-[8px] font-medium uppercase tracking-wide text-[#787b86]">{label}</p>
      <p className={cn("truncate text-[12px] font-semibold tabular-nums text-[#d1d4dc]", valueClass)}>{value}</p>
      {sub && <p className="truncate text-[9px] text-[#434651]">{sub}</p>}
    </div>
  );
}

function PeriodSummary({ stats }: { stats: CandlePeriodStats }) {
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
      <Stat
        label="Games in period"
        value={stats.gamesPlayed.toLocaleString()}
        sub={`#${stats.gameStart} – #${stats.gameEnd}`}
      />
      <Stat
        label="Manual / Auto"
        value={`${stats.manualGames} / ${stats.autoGames}`}
        sub="games by source"
      />
      <Stat
        label="W / L / Even"
        value={`${stats.userWins} / ${stats.userLosses} / ${stats.userBreakEven}`}
        sub="user outcome per game"
      />
      <Stat label="Avg stake" value={fmtPrice(stats.avgStake)} sub={`Vol ${fmtPrice(stats.totalVolume)}`} />
      <Stat
        label="User net (period)"
        value={fmtPrice(stats.periodUserNet)}
        valueClass={stats.periodUserNet >= 0 ? "text-[#26a69a]" : "text-[#ef5350]"}
      />
      <Stat
        label="House net (period)"
        value={fmtPrice(stats.periodAdminNet)}
        valueClass={stats.periodAdminNet >= 0 ? "text-[#26a69a]" : "text-[#ef5350]"}
      />
      <Stat label="Period RTP" value={pct(stats.periodRtp)} sub="return / staked" />
      <Stat
        label="Status"
        value={stats.partial ? "In progress" : "Closed"}
        sub={stats.partial ? "Bucket still filling" : "Bucket complete"}
      />
    </div>
  );
}

export function CandleDetailDialog({
  open,
  onOpenChange,
  userCandle,
  houseCandle,
  chartHistory,
  timeframeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userCandle: SimCandle | null;
  houseCandle: SimCandle | null;
  chartHistory: SimChartTick[];
  timeframeLabel?: string;
}) {
  if (!userCandle) return null;

  const stats = summarizeCandlePeriod(chartHistory, userCandle);
  const timeRange = formatCandleTimeRange(userCandle);
  const title = userCandle.label.replace("*", "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto border-[#2a2e39] bg-[#131722] text-[#d1d4dc] sm:max-w-lg"
        overlayClassName="bg-black/50 backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle className="text-left text-sm font-semibold text-[#d1d4dc]">
            Candle details · {title}
            {stats.partial && (
              <span className="ml-2 rounded bg-[#2a2e39] px-1.5 py-0.5 text-[10px] font-normal text-[#787b86]">
                live
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {(timeRange || timeframeLabel) && (
            <div className="rounded border px-2 py-1.5 text-[10px]" style={{ borderColor: TV.border, background: TV.panel }}>
              {timeframeLabel && (
                <p>
                  <span className="text-[#787b86]">Timeframe </span>
                  <span className="font-medium text-[#d1d4dc]">{timeframeLabel}</span>
                </p>
              )}
              {timeRange && (
                <p className={timeframeLabel ? "mt-0.5" : ""}>
                  <span className="text-[#787b86]">Window </span>
                  <span className="tabular-nums text-[#d1d4dc]">{timeRange}</span>
                </p>
              )}
            </div>
          )}

          <PeriodSummary stats={stats} />

          <OhlcRow label="User cumulative P/L" candle={userCandle} />
          {houseCandle && <OhlcRow label="House cumulative revenue" candle={houseCandle} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
