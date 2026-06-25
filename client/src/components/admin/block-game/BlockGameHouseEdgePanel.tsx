import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminField } from "@/components/admin/shared/AdminField";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/authenticatedFetch";
import { subscribeBlockGameSettings } from "@/lib/game/blockGameFirestore";
import { DEFAULT_HOUSE_EDGE } from "@/lib/game/constants";

export function BlockGameHouseEdgePanel() {
  const [houseEdge, setHouseEdge] = useState(DEFAULT_HOUSE_EDGE);
  const [updatedAt, setUpdatedAt] = useState("");
  const [draftPct, setDraftPct] = useState(String(DEFAULT_HOUSE_EDGE * 100));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return subscribeBlockGameSettings((settings) => {
      setHouseEdge(settings.houseEdge);
      setUpdatedAt(settings.updatedAt);
      setDraftPct((settings.houseEdge * 100).toFixed(1));
    });
  }, []);

  const save = async () => {
    const pct = Number(draftPct);
    if (!Number.isFinite(pct) || pct < 1 || pct > 50) {
      toast.error("House edge must be between 1% and 50%.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/block-game/settings/house-edge", {
        method: "POST",
        body: JSON.stringify({ houseEdge: pct / 100 }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save house edge.");
      }
      const data = (await res.json()) as { houseEdge: number; updatedAt: string };
      setHouseEdge(data.houseEdge);
      setUpdatedAt(data.updatedAt);
      setDraftPct((data.houseEdge * 100).toFixed(1));
      toast.success(`House edge set to ${(data.houseEdge * 100).toFixed(1)}% — live games update immediately.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save house edge.");
    } finally {
      setSaving(false);
    }
  };

  const rtp = (1 - houseEdge) * 100;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Controls the built-in edge on <span className="font-mono text-zinc-300">/game</span> multipliers. Players
        see payouts recalculated from{" "}
        <span className="font-mono text-violet-300">M = (1 − edge) / P(win)</span>. Simulation dashboard keeps its
        own local edge slider.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Current house edge">
          <p className="text-2xl font-bold tabular-nums text-zinc-100">{(houseEdge * 100).toFixed(1)}%</p>
          <p className="text-xs text-zinc-500">Target RTP ≈ {rtp.toFixed(1)}%</p>
        </AdminField>
        <AdminField label="Last updated">
          <p className="text-sm text-zinc-300">
            {updatedAt ? new Date(updatedAt).toLocaleString() : "Default (3%) — not saved yet"}
          </p>
        </AdminField>
      </div>

      <AdminField label="New house edge (%)" hint="1% – 50%. Applies to all live player rounds.">
        <div className="flex flex-wrap items-end gap-3">
          <input
            type="number"
            min={1}
            max={50}
            step={0.1}
            value={draftPct}
            onChange={(e) => setDraftPct(e.target.value)}
            className="h-10 w-32 rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm tabular-nums text-zinc-100"
          />
          <Button type="button" onClick={save} disabled={saving} className="bg-violet-600 hover:bg-violet-500">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save house edge
          </Button>
        </div>
      </AdminField>
    </div>
  );
}
