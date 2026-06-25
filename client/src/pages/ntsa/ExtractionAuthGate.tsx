import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, FileSpreadsheet, Loader2 } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";

export function ExtractionAuthGate() {
  const [, navigate] = useLocation();
  const { firebaseReady, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useFirebaseAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  if (!firebaseReady) {
    return (
      <div className="min-h-screen bg-[#08080c] flex flex-col items-center justify-center p-6 text-zinc-400">
        Sign-in is unavailable — Firebase is not configured.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center text-amber-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const onGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in successfully");
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
        toast.success("Account created. Welcome!");
      } else {
        await signInWithEmail(email.trim(), password);
        toast.success("Signed in successfully");
      }
    } catch (err) {
      toast.error(formatAuthOrFirestoreError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080c] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">Data extraction</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to upload forms and manage your extraction sessions. Your history is saved to your account only.
          </p>
        </div>

        <Card className="border-white/10 bg-[#12121a] text-white shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {mode === "signup" ? "Create an account" : "Sign in"}
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Use the same email sign-in as the rest of this site, or continue with Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GoogleSignInButton loading={busy} onClick={() => void onGoogle()} />

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#12121a] px-2 text-zinc-500">or email</span>
              </div>
            </div>

            <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="extraction-name" className="text-zinc-300">
                    Your name
                  </Label>
                  <Input
                    id="extraction-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 border-white/10 bg-[#0c0c12] text-white"
                    placeholder="First and last name"
                    autoComplete="name"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="extraction-email" className="text-zinc-300">
                  Email
                </Label>
                <Input
                  id="extraction-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 border-white/10 bg-[#0c0c12] text-white"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="extraction-password" className="text-zinc-300">
                  Password
                </Label>
                <Input
                  id="extraction-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 border-white/10 bg-[#0c0c12] text-white"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700"
                disabled={busy}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>

            <button
              type="button"
              className="w-full text-center text-sm text-zinc-400 hover:text-amber-300"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </CardContent>
        </Card>

        <Button
          type="button"
          variant="ghost"
          className="w-full mt-4 gap-2 text-zinc-400 hover:text-white"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Button>
      </div>
    </div>
  );
}
