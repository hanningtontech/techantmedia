import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./BlockGameGridLoader.css";

const GRID = 10;
const TOTAL = GRID * GRID;

type CellState = "hidden" | "safe" | "bomb";

function useBrowserChromeColor(): string {
  const [color, setColor] = useState("#dee1e6");

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')?.getAttribute("content")?.trim();
    if (meta) {
      setColor(meta);
      return;
    }
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setColor(dark ? "#2b2b2b" : "#dee1e6");
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setColor(mq.matches ? "#2b2b2b" : "#dee1e6");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return color;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickHiddenIndex(cells: CellState[]): number | null {
  const hidden: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === "hidden") hidden.push(i);
  }
  if (hidden.length === 0) return null;
  return hidden[Math.floor(Math.random() * hidden.length)]!;
}

export function BlockGameGridLoader({
  label = "Loading…",
  className,
  darkBackdrop = true,
}: {
  label?: string;
  className?: string;
  darkBackdrop?: boolean;
}) {
  const chromeColor = useBrowserChromeColor();
  const [cells, setCells] = useState<CellState[]>(() => Array(TOTAL).fill("hidden"));
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      setCells((prev) => {
        const hiddenCount = prev.filter((c) => c === "hidden").length;
        if (hiddenCount === 0) {
          return Array(TOTAL).fill("hidden") as CellState[];
        }

        const idx = pickHiddenIndex(prev);
        if (idx == null) return prev;

        const next = [...prev];
        const streak = (() => {
          let s = 0;
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i] === "safe") s++;
            else if (prev[i] !== "hidden") break;
          }
          return s;
        })();

        const blastChance = streak >= 2 ? 0.22 : 0.08;
        const forceBlast = streak >= randomInt(4, 7);
        const isBomb = forceBlast || Math.random() < blastChance;

        if (isBomb) {
          next[idx] = "bomb";
          setPulse(true);
          window.setTimeout(() => setPulse(false), 420);
          return next;
        }

        next[idx] = "safe";

        if (hiddenCount <= randomInt(2, 5) && Math.random() < 0.35) {
          for (let i = 0; i < next.length; i++) {
            if (next[i] === "hidden") next[i] = "safe";
          }
        }

        return next;
      });

      timeout = setTimeout(tick, randomInt(380, 1100));
    };

    timeout = setTimeout(tick, 500);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return (
    <div
      className={cn(
        "flex min-h-svh flex-col items-center justify-center gap-6 p-6",
        darkBackdrop ? "bg-[#06060a]" : "bg-transparent",
        className,
      )}
    >
      <div
        className={cn("block-game-grid-loader", pulse && "block-game-grid-loader--blast")}
        style={{ "--chrome-cell": chromeColor } as CSSProperties}
        aria-hidden
      >
        {cells.map((state, i) => (
          <div
            key={i}
            className={cn(
              "block-game-grid-loader__cell",
              state === "safe" && "block-game-grid-loader__cell--safe",
              state === "bomb" && "block-game-grid-loader__cell--bomb",
            )}
          />
        ))}
      </div>
      <p className="text-center text-sm font-medium tracking-wide text-zinc-400">{label}</p>
    </div>
  );
}
