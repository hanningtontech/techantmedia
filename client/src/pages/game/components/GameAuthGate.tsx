import { useEffect, useState } from "react";
import { ArrowLeft, Gamepad2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { ensureBlockGamePlayerRegistered } from "@/lib/game/blockGamePlayersFirestore";
import { toast } from "sonner";

function RegisterGamePlayerOnMount() {
  const { user, profile } = useFirebaseAuth();
  useEffect(() => {
    if (!user) return;
    void ensureBlockGamePlayerRegistered({
      uid: user.uid,
      userEmail: user.email ?? profile?.email ?? "",
      userName: profile?.name ?? user.displayName ?? "",
    }).catch(() => {});
  }, [user, profile?.email, profile?.name]);
  return null;
}

/** Requires a signed-in account before playing the block game. */
export function GameAuthGate({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const { user, firebaseReady, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } =
    useFirebaseAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  if (user && !loading) {
    return (
      <>
        <RegisterGamePlayerOnMount />
        {children}
      </>
    );
  }

  if (!firebaseReady) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-[#06060a] p-6 text-zinc-400">
        Sign-in is unavailable — Firebase is not configured.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#06060a] text-violet-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const onGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in — good luck!");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) {
          toast.error("Please enter your name.");
          return;
        }
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters.");
          return;
        }
        await signUpWithEmail(email.trim(), password, name.trim());
        toast.success("Account created. Welcome to Block Game!");
      } else {
        await signInWithEmail(email.trim(), password);
        toast.success("Signed in — good luck!");
      }
    } catch (err) {
      toast.error(formatAuthOrFirestoreError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[#06060a] p-6">
      <div className="w-full max-w-md">
        <Button
          type="button"
          variant="ghost"
          className="mb-6 text-zinc-500 hover:text-zinc-200"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
            <Gamepad2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">Block Game</h1>
          <p className="mt-2 text-sm text-zinc-500">Sign in to play with your KES wallet and live charts.</p>
        </div>

        <Card className="border-white/10 bg-zinc-950/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{mode === "signin" ? "Sign in" : "Create account"}</CardTitle>
            <CardDescription className="text-zinc-500">
              Your wallet and stats sync to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GoogleSignInButton onClick={onGoogle} disabled={busy} />

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-950 px-2 text-zinc-600">or email</span>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="game-name">Name</Label>
                  <Input
                    id="game-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 border-white/10 bg-black/40"
                    autoComplete="name"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="game-email">Email</Label>
                <Input
                  id="game-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 border-white/10 bg-black/40"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="game-password">Password</Label>
                <Input
                  id="game-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 border-white/10 bg-black/40"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
            </form>

            <p className="text-center text-sm text-zinc-500">
              {mode === "signin" ? (
                <>
                  No account?{" "}
                  <button type="button" className="text-violet-400 hover:underline" onClick={() => setMode("signup")}>
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have one?{" "}
                  <button type="button" className="text-violet-400 hover:underline" onClick={() => setMode("signin")}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-zinc-600">
          Session charts at{" "}
          <a href="/game/chart" className="text-zinc-500 underline">
            /game/chart
          </a>{" "}
          are public — no sign-in needed to view.
        </p>
      </div>
    </div>
  );
}
