import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import BnbQuestionnaireForm from "./BnbQuestionnaireForm";

const SESSION_KEY = "portfolio_written_qns_ok";
const PASSWORD = "2026";

function readUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export default function WrittenQnsPage() {
  const [, navigate] = useLocation();
  const params = useParams() as unknown as { step?: string };
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const wizardStep = params.step ?? "contact";

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PASSWORD) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      setError(null);
      setUnlocked(true);
      return;
    }
    setError("Incorrect password.");
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-700 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-white/20">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Written questionnaire</h1>
          <p className="text-sm text-gray-600 text-center mb-6">Enter the password to continue.</p>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <Label htmlFor="written-qns-password">Password</Label>
              <Input
                id="written-qns-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="mt-1.5"
                placeholder="••••"
              />
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            </div>
            <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">
              Unlock
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            className="w-full mt-4 gap-2 text-gray-700"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to portfolio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Below the questionnaire fixed progress bar (h-[4.5rem]) */}
      <div className="fixed top-[4.5rem] left-0 right-0 z-40 border-b bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex items-center justify-between max-w-4xl mx-auto px-4">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
            Back to portfolio
          </Button>
        </div>
      </div>
      <BnbQuestionnaireForm wizardStep={wizardStep} />
    </div>
  );
}
