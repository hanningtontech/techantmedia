export type PlayerRevenuePeriodId = "hour" | "day" | "week" | "month";

export interface PeriodBounds {
  start: number;
  end: number;
  prevStart: number;
  prevEnd: number;
  label: string;
  prevLabel: string;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfLocalWeek(d: Date): number {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - diff);
  return copy.getTime();
}

function startOfLocalMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Calendar / rolling bounds for admin house-revenue filters. */
export function getPlayerRevenuePeriodBounds(
  period: PlayerRevenuePeriodId,
  at = Date.now(),
): PeriodBounds {
  const d = new Date(at);

  switch (period) {
    case "hour": {
      const end = at;
      const start = at - 60 * 60 * 1000;
      return {
        start,
        end,
        prevStart: start - 60 * 60 * 1000,
        prevEnd: start,
        label: "Last hour",
        prevLabel: "Previous hour",
      };
    }
    case "day": {
      const start = startOfLocalDay(d);
      const prevStart = start - 24 * 60 * 60 * 1000;
      return {
        start,
        end: at,
        prevStart,
        prevEnd: start,
        label: "Today",
        prevLabel: "Yesterday",
      };
    }
    case "week": {
      const start = startOfLocalWeek(d);
      const prevStart = start - 7 * 24 * 60 * 60 * 1000;
      return {
        start,
        end: at,
        prevStart,
        prevEnd: start,
        label: "This week",
        prevLabel: "Last week",
      };
    }
    case "month": {
      const start = startOfLocalMonth(d);
      const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
      return {
        start,
        end: at,
        prevStart,
        prevEnd: start,
        label: "This month",
        prevLabel: "Last month",
      };
    }
  }
}

export const PLAYER_REVENUE_PERIODS: { id: PlayerRevenuePeriodId; label: string }[] = [
  { id: "hour", label: "Hour" },
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];
