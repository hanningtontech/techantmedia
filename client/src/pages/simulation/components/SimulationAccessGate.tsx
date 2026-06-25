import { useEffect, useState } from "react";
import { ArrowLeft, FlaskConical, KeyRound, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { isSimulationUnlockedLocally, setSimulationUnlockedLocally } from "@/lib/game/blockGameFirestore";
import { publicApiFetch } from "@/lib/api/authenticatedFetch";
import { BlockGameGridLoader } from "@/pages/game/components/BlockGameGridLoader";
import { toast } from "sonner";

/** Private simulation — admins bypass; others need a one-time PIN from admin. */
export function SimulationAccessGate({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const { user, loading, isAdmin } = useFirebaseAuth();
  const [unlocked, setUnlocked] = useState(() => isSimulationUnlockedLocally());
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) setUnlocked(true);
  }, [isAdmin]);

  if (loading) {
    return <BlockGameGridLoader label="Loading simulation…" darkBackdrop className="bg-[#08080c]" />;
  }

  if (unlocked || isAdmin) return <>{children}</>;

  const onUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pin.trim();
    if (trimmed.length < 4) {
      setPinError("Enter the PIN from your admin.");
      return;
    }
    setBusy(true);
    setPinError(null);
    try {
      await publicApiFetch("/api/block-game/sim-pin/redeem", {
        method: "POST",
        body: JSON.stringify({
          pin: trimmed,
          uid: user?.uid ?? null,
          email: user?.email ?? null,
        }),
      });
      setSimulationUnlockedLocally();
      setUnlocked(true);
      toast.success("Simulation unlocked.");
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Invalid or expired PIN.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[#08080c] p-6">
      <div className="w-full max-w-md">
        <Button
          type="button"
          variant="ghost"
          className="mb-6 text-zinc-500 hover:text-zinc-200"
          onClick={() => navigate("/game")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Player game
        </Button>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
            <FlaskConical className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">Simulation (private)</h1>
          <p className="mt-2 text-sm text-zinc-500">
            This area is invite-only. Enter the one-time PIN your admin shared with you.
          </p>
        </div>

        <Card className="border-white/10 bg-zinc-950/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-amber-400" />
              Access PIN
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Each PIN works once. Ask admin to generate a new one if yours was used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onUnlock} className="space-y-4">
              <div>
                <Label htmlFor="sim-pin">One-time PIN</Label>
                <Input
                  id="sim-pin"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="mt-1 border-white/10 bg-black/40 text-center text-lg tracking-[0.35em]"
                  placeholder="••••••"
                  required
                />
              </div>
              {pinError && <p className="text-sm text-red-400">{pinError}</p>}
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-500" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock simulation"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-zinc-600">
          Player mode is at{" "}
          <a href="/game" className="text-zinc-500 underline">
            /game
          </a>{" "}
          (sign-in required to play).
        </p>
      </div>
    </div>
  );
}
