import { Copy, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminField } from "@/components/admin/shared/AdminField";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/authenticatedFetch";

type SimPinRecord = {
  pinId: string;
  pin: string;
  label: string;
  recipientName: string | null;
  recipientEmail: string | null;
  expiresAt: number;
  usedAt: string | null;
  usedEmail: string | null;
  createdAt: string | null;
};

export function BlockGameSimPinPanel() {
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [lastPin, setLastPin] = useState<SimPinRecord | null>(null);
  const [recent, setRecent] = useState<SimPinRecord[]>([]);

  const loadRecent = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await apiFetch("/api/block-game/sim-pin/recent");
      const data = (await res.json()) as { pins: SimPinRecord[] };
      setRecent(data.pins ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load PIN history.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/block-game/sim-pin/generate", {
        method: "POST",
        body: JSON.stringify({
          label: recipientName.trim() || recipientEmail.trim() || "Simulation access",
          recipientName: recipientName.trim() || null,
          recipientEmail: recipientEmail.trim() || null,
        }),
      });
      const data = (await res.json()) as SimPinRecord;
      setLastPin(data);
      toast.success("One-time PIN generated — share it with your visitor.");
      await loadRecent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate PIN.");
    } finally {
      setBusy(false);
    }
  };

  const copyPin = async (pin: string) => {
    try {
      await navigator.clipboard.writeText(pin);
      toast.success("PIN copied.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const copyInvite = async (record: SimPinRecord) => {
    const name = record.recipientName || record.recipientEmail || "there";
    const text = `Hi ${name}, use this one-time PIN to open the block game simulation at ${window.location.origin}/simulation\n\nPIN: ${record.pin}\n\nExpires: ${new Date(record.expiresAt).toLocaleString()}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Invite message copied.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Recipient name (optional)" fieldSize="medium">
          <input
            className="admin-input"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Jane Doe"
          />
        </AdminField>
        <AdminField label="Recipient email (optional)" fieldSize="medium">
          <input
            className="admin-input"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </AdminField>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="bg-amber-600 hover:bg-amber-500" disabled={busy} onClick={generate}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Generate one-time PIN
        </Button>
        <Button type="button" variant="outline" className="border-white/15" disabled={loadingList} onClick={loadRecent}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
          Refresh list
        </Button>
      </div>

      {lastPin && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Latest PIN</p>
          <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-amber-200">{lastPin.pin}</p>
          {(lastPin.recipientName || lastPin.recipientEmail) && (
            <p className="mt-1 text-sm text-zinc-400">
              For {lastPin.recipientName || lastPin.recipientEmail}
              {lastPin.recipientEmail && lastPin.recipientName ? ` (${lastPin.recipientEmail})` : null}
            </p>
          )}
          <p className="text-xs text-zinc-500">Expires {new Date(lastPin.expiresAt).toLocaleString()}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="border-white/15" onClick={() => copyPin(lastPin.pin)}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy PIN
            </Button>
            <Button type="button" size="sm" variant="outline" className="border-white/15" onClick={() => copyInvite(lastPin)}>
              Copy invite message
            </Button>
          </div>
        </div>
      )}

      <AdminField label="Recent PINs" fieldSize="full">
        {loadingList ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-zinc-500">No PINs generated yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => {
              const used = Boolean(r.usedAt);
              const expired = !used && r.expiresAt > 0 && Date.now() > r.expiresAt;
              return (
                <li
                  key={r.pinId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-lg tracking-widest text-zinc-200">{r.pin}</p>
                    <p className="text-sm text-zinc-400">
                      {r.recipientName || r.recipientEmail || r.label || "Simulation access"}
                    </p>
                    {r.recipientEmail && r.recipientName ? (
                      <p className="text-xs text-zinc-500">{r.recipientEmail}</p>
                    ) : null}
                    <p className="text-[11px] text-zinc-600">
                      {used
                        ? `Used${r.usedEmail ? ` by ${r.usedEmail}` : ""}`
                        : expired
                          ? "Expired"
                          : `Active until ${new Date(r.expiresAt).toLocaleString()}`}
                    </p>
                  </div>
                  {!used && !expired ? (
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" className="border-white/15" onClick={() => copyPin(r.pin)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="border-white/15" onClick={() => copyInvite(r)}>
                        Invite
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs uppercase tracking-wide text-zinc-600">{used ? "Used" : "Expired"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </AdminField>
    </div>
  );
}
