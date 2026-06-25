import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DODGE_MOMENTS,
  MPESA_NUMBER,
  type DodgeMoment,
  type SplashVariant,
  pickDodgeMoment,
  pickGradient,
  pickSplashVariant,
} from "@/lib/ntsa/sodaPrankContent";
import { cn } from "@/lib/utils";

type Phase = "tease" | "goodbye";

type Props = {
  open: boolean;
  onClose: () => void;
};

const RANDOM_SPOTS: Array<{ top?: string; bottom?: string; left?: string; right?: string }> = [
  { top: "8%", left: "6%" },
  { top: "8%", right: "6%" },
  { bottom: "12%", left: "8%" },
  { bottom: "12%", right: "8%" },
  { top: "35%", left: "4%" },
  { top: "35%", right: "4%" },
  { top: "55%", left: "12%" },
  { top: "55%", right: "12%" },
  { bottom: "28%", left: "22%" },
  { bottom: "28%", right: "22%" },
];

const PAINT_FONT = { fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive, sans-serif' } as const;

async function copyMpesaNumber(showSodaToast: boolean) {
  try {
    await navigator.clipboard.writeText(MPESA_NUMBER);
    if (showSodaToast) {
      toast.message("just go to mpesa and by me soda😪");
    } else {
      toast.success(`Copied ${MPESA_NUMBER} — M-Pesa time!`);
    }
  } catch {
    toast.error("Could not copy number — it's " + MPESA_NUMBER);
  }
}

function StarClip({ variant, gradient, children }: { variant: SplashVariant; gradient: string; children: ReactNode }) {
  const isStar = variant.id === "star";

  if (!isStar) {
    return (
      <div
        className={cn(
          "relative overflow-hidden",
          variant.shellClass,
          variant.borderClass,
          variant.shadowClass,
        )}
      >
        <PaintBlobs variant={variant} />
        <div className={cn("relative bg-gradient-to-br p-6 sm:p-7", gradient, variant.innerClass)}>{children}</div>
      </div>
    );
  }

  return (
    <div className="relative p-3" style={{ filter: "drop-shadow(0 0 28px rgba(132,204,22,0.45))" }}>
      <div
        className={cn("relative overflow-hidden border-4 border-dotted border-lime-300", variant.shellClass)}
        style={{
          clipPath:
            "polygon(50% 0%, 62% 32%, 98% 35%, 70% 57%, 79% 92%, 50% 72%, 21% 92%, 30% 57%, 2% 35%, 38% 32%)",
        }}
      >
        <PaintBlobs variant={variant} />
        <div className={cn("relative bg-gradient-to-br p-6 sm:p-7", gradient)}>{children}</div>
      </div>
    </div>
  );
}

function PaintBlobs({ variant }: { variant: SplashVariant }) {
  return (
    <>
      <div className={cn("absolute -left-8 -top-8 h-24 w-24 rotate-12 rounded-full blur-sm", variant.blobA)} />
      <div className={cn("absolute -right-6 top-10 h-20 w-28 -rotate-6 rounded-full blur-sm", variant.blobB)} />
      <div className={cn("absolute bottom-4 left-1/3 h-16 w-24 rotate-45 rounded-full blur-sm", variant.blobC)} />
      <div className="absolute -bottom-6 right-8 h-28 w-20 -rotate-12 rounded-full bg-pink-500/50 blur-md" />
    </>
  );
}

export function SodaPrankOverlay({ open, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("tease");
  const [gotcha, setGotcha] = useState(false);
  const [dodgeIndex, setDodgeIndex] = useState(0);
  const [spot, setSpot] = useState(RANDOM_SPOTS[0]);
  const [variant, setVariant] = useState<SplashVariant>(pickSplashVariant(0));
  const [gradient, setGradient] = useState(pickGradient(0));
  const [dodgeMoment, setDodgeMoment] = useState<DodgeMoment>(DODGE_MOMENTS[0]!);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teaseActivityRef = useRef(false);
  const graceUntilRef = useRef(0);

  const pickRandomSpot = useCallback(() => {
    setSpot(RANDOM_SPOTS[Math.floor(Math.random() * RANDOM_SPOTS.length)]!);
  }, []);

  const triggerDodge = useCallback(
    (showToast: boolean) => {
      setGotcha(true);
      setDodgeIndex((prev) => {
        const next = prev + 1;
        const moment = pickDodgeMoment(next - 1);
        setDodgeMoment(moment);
        setVariant(pickSplashVariant(next));
        setGradient(pickGradient(next));
        if (showToast) toast.message(moment.toast);
        return next;
      });
      pickRandomSpot();
    },
    [pickRandomSpot],
  );

  const dismiss = useCallback(() => {
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
    onClose();
  }, [onClose]);

  const enterGoodbye = useCallback(() => {
    if (phase === "goodbye") return;
    setPhase("goodbye");
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    setPhase("tease");
    setGotcha(false);
    setDodgeIndex(0);
    setSpot(RANDOM_SPOTS[0]!);
    setVariant(pickSplashVariant(0));
    setGradient(pickGradient(0));
    setDodgeMoment(DODGE_MOMENTS[0]!);
    teaseActivityRef.current = false;
    graceUntilRef.current = Date.now() + 500;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "goodbye") return;

    autoCloseRef.current = setTimeout(() => {
      dismiss();
    }, 15_000);

    return () => {
      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
        autoCloseRef.current = null;
      }
    };
  }, [open, phase, dismiss]);

  useEffect(() => {
    if (!open || phase !== "tease") return;

    const onActivity = (event: Event) => {
      if (Date.now() < graceUntilRef.current) return;
      if (teaseActivityRef.current) return;

      const target = event.target;
      if (target instanceof Element && target.closest("[data-soda-prank-safe]")) {
        return;
      }

      teaseActivityRef.current = true;
      enterGoodbye();
    };

    window.addEventListener("pointerdown", onActivity, true);
    window.addEventListener("keydown", onActivity, true);
    window.addEventListener("touchstart", onActivity, true);

    return () => {
      window.removeEventListener("pointerdown", onActivity, true);
      window.removeEventListener("keydown", onActivity, true);
      window.removeEventListener("touchstart", onActivity, true);
    };
  }, [open, phase, enterGoodbye]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Soda prank">
      {phase === "tease" && (
        <>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-md backdrop-saturate-50" aria-hidden />
          <div className="pointer-events-none absolute inset-0 z-[201]">
            <div
              className={cn(
                "pointer-events-auto absolute transition-all duration-300 ease-out",
                variant.id === "oval" ? "w-[min(92vw,480px)]" : "w-[min(92vw,420px)]",
              )}
              style={spot}
            >
              <StarClip variant={variant} gradient={gradient}>
                <button
                  type="button"
                  aria-label="Close"
                  data-soda-prank-safe
                  className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-zinc-800 bg-white text-lg font-black text-zinc-900 shadow-md transition-transform hover:scale-110"
                  onMouseEnter={() => triggerDodge(dodgeIndex === 0)}
                  onFocus={() => triggerDodge(dodgeIndex === 0)}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerDodge(true);
                  }}
                >
                  ✕
                </button>

                {gotcha && (
                  <div className="mb-3 flex justify-center">
                    <img
                      src={dodgeMoment.gif}
                      alt={dodgeMoment.gifAlt}
                      className="h-20 w-20 rounded-full border-2 border-zinc-800 object-cover shadow-md sm:h-24 sm:w-24"
                      loading="lazy"
                    />
                  </div>
                )}

                <p
                  className={cn(
                    "pr-10 text-center font-black leading-snug tracking-tight text-zinc-900",
                    gotcha ? "text-base sm:text-lg" : "text-xl sm:text-2xl",
                  )}
                  style={{
                    ...PAINT_FONT,
                    textShadow: "2px 2px 0 #fff, 4px 4px 0 rgba(236,72,153,0.35)",
                  }}
                >
                  {gotcha ? dodgeMoment.headline : `Nawewe ata buy me soda ${MPESA_NUMBER}`}
                </p>

                <div className="mt-5 flex justify-center">
                  <Button
                    type="button"
                    data-soda-prank-safe
                    className={cn(
                      "h-12 rounded-2xl border-3 border-zinc-900 px-6 text-base font-black shadow-[4px_4px_0_#111]",
                      gotcha
                        ? "bg-zinc-800 text-white hover:bg-zinc-700"
                        : "bg-[#00A651] text-white hover:bg-[#008f47]",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyMpesaNumber(gotcha);
                    }}
                  >
                    {gotcha ? "Cancel" : "M-Pesa"}
                  </Button>
                </div>

                <p
                  className="mt-3 text-center text-xs font-semibold text-zinc-700/80"
                  style={PAINT_FONT}
                >
                  {gotcha
                    ? dodgeMoment.footer
                    : "🎨 splashy paint vibes · your spreadsheets are ready behind this chaos"}
                </p>
              </StarClip>
            </div>
          </div>
        </>
      )}

      {phase === "goodbye" && (
        <div className="absolute inset-0 z-[210] flex flex-col items-center justify-center bg-black/95 px-6 text-center backdrop-blur-sm">
          <p className="text-7xl sm:text-8xl" role="img" aria-label="wave goodbye">
            👋
          </p>
          <p className="mt-6 max-w-md text-xl font-semibold text-zinc-200 sm:text-2xl">
            Goodbye if you dont Buy Me soda
          </p>
          <p className="mt-2 text-sm text-zinc-500">Auto-closing in 15 seconds… or tap Cancel for real.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-8 border-white/25 bg-white/10 px-8 text-white hover:bg-white/20"
            onClick={dismiss}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>,
    document.body,
  );
}
