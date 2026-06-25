import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Camera, Loader2 } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebaseAuth, isClient } from "@/contexts/FirebaseAuthContext";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export default function ClientSignUpPage() {
  const [, setLocation] = useLocation();
  const { firebaseReady, loading, user, profile, signInWithEmail, signUpClientWithEmail, signInClientWithGoogle } =
    useFirebaseAuth();

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    if (!loading && user && profile && isClient(profile)) {
      setLocation("/photography/my-gallery");
    }
  }, [loading, user, profile, setLocation]);

  if (!firebaseReady) {
    return (
      <TechMediaLayout>
        <div className="mx-auto max-w-lg px-4 py-20 text-center text-zinc-400">
          Account sign-up is unavailable — Firebase is not configured.
        </div>
      </TechMediaLayout>
    );
  }

  if (loading) {
    return (
      <TechMediaLayout>
        <div className="flex min-h-[50vh] items-center justify-center text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      </TechMediaLayout>
    );
  }

  const validateClientFields = () => {
    const u = username.trim();
    const phone = normalizePhone(phoneNumber);
    if (!u) {
      toast.error("Please enter a username.");
      return null;
    }
    if (u.length < 3) {
      toast.error("Username must be at least 3 characters.");
      return null;
    }
    if (!phone || phone.length < 8) {
      toast.error("Please enter a valid WhatsApp phone number.");
      return null;
    }
    return { username: u, phoneNumber: phone };
  };

  const onGoogle = async () => {
    const fields = validateClientFields();
    if (!fields) return;
    setBusy(true);
    try {
      await signInClientWithGoogle({
        ...fields,
        displayName: displayName.trim() || undefined,
      });
      toast.success("Welcome! Your gallery is ready.");
      setLocation("/photography/my-gallery");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
    }
  };

  const onEmailSubmit = async () => {
    if (mode === "signup") {
      const fields = validateClientFields();
      if (!fields) return;
      const name = displayName.trim();
      if (!name) {
        toast.error("Please enter your display name.");
        return;
      }
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
      setBusy(true);
      try {
        await signUpClientWithEmail(email.trim(), password, name, fields.phoneNumber, fields.username);
        toast.success("Account created. Welcome to your gallery!");
        setLocation("/photography/my-gallery");
      } catch (e) {
        toast.error(formatAuthOrFirestoreError(e));
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(true);
      try {
        await signInWithEmail(email.trim(), password);
        setLocation("/photography/my-gallery");
      } catch (e) {
        toast.error(formatAuthOrFirestoreError(e));
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <TechMediaLayout>
      <div className="mx-auto max-w-lg px-4 py-12 sm:py-16">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
            <Camera className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {mode === "signup" ? "Create your gallery account" : "Sign in to My Gallery"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            View your session photos, previews, and downloads after your photographer releases them.
          </p>
        </div>

        <Card className="border-white/10 bg-[#0f0f14] text-white shadow-xl">
          <CardHeader>
            <CardTitle>{mode === "signup" ? "Sign up" : "Sign in"}</CardTitle>
            <CardDescription className="text-zinc-400">
              {mode === "signup"
                ? "Use Google or email. Your WhatsApp number helps us reach you about your photos."
                : "Sign in to access My Gallery."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                className="border-white/10 bg-black/40"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="yourname"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">WhatsApp phone number</Label>
              <Input
                id="phone"
                type="tel"
                className="border-white/10 bg-black/40"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                autoComplete="tel"
                placeholder="+254 7XX XXX XXX"
              />
            </div>

            {mode === "signup" ? (
              <div className="grid gap-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  className="border-white/10 bg-black/40"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            ) : null}

            <GoogleSignInButton loading={busy} onClick={() => void onGoogle()} />

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <span className="relative mx-auto block w-fit bg-[#0f0f14] px-3 text-xs text-zinc-500">or email</span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="border-white/10 bg-black/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="border-white/10 bg-black/40"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            {mode === "signup" ? (
              <div className="grid gap-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  className="border-white/10 bg-black/40"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            ) : null}

            <Button
              type="button"
              className={cn("w-full bg-gradient-to-r from-orange-500 to-orange-600 text-black hover:brightness-110")}
              disabled={busy}
              onClick={() => void onEmailSubmit()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create account" : "Sign in"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-zinc-400"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </Button>

            <p className="text-center text-xs text-zinc-500">
              <Link href="/photography" className="text-orange-400 hover:underline">
                Back to Photography & Video
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </TechMediaLayout>
  );
}
