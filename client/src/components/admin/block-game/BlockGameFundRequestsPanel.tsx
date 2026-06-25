import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { AdminField } from "@/components/admin/shared/AdminField";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/authenticatedFetch";
import { subscribePendingFundRequests, type BlockGameFundRequestDoc } from "@/lib/game/blockGameFirestore";
import { formatKes } from "@/lib/game/formatKes";

async function resolveViaApi(id: string, status: "approved" | "rejected"): Promise<void> {
  await apiFetch("/api/block-game/fund-request/resolve", {
    method: "POST",
    body: JSON.stringify({ id, status }),
  });
}

export function BlockGameFundRequestsPanel() {
  const [requests, setRequests] = useState<BlockGameFundRequestDoc[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => subscribePendingFundRequests(setRequests), []);

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await resolveViaApi(id, "approved");
      toast.success("Funds credited to the player wallet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve request.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    try {
      await resolveViaApi(id, "rejected");
      toast.info("Fund request rejected — player will be notified.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject request.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <AdminField label={`Pending requests (${requests.length})`} fieldSize="full">
        {requests.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No pending top-up requests. Players submit these from{" "}
            <a href="/game" className="text-violet-400 hover:underline" target="_blank" rel="noreferrer">
              /game
            </a>{" "}
            after signing in.
          </p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-100">{formatKes(r.amount)}</p>
                  <p className="text-sm text-zinc-400">{r.userName || "Player"}</p>
                  <p className="text-xs text-zinc-500">{r.userEmail}</p>
                  <p className="text-[11px] text-zinc-600">{new Date(r.requestedAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500"
                    disabled={busyId === r.id}
                    onClick={() => void handleApprove(r.id)}
                  >
                    {busyId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Grant
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/15"
                    disabled={busyId === r.id}
                    onClick={() => void handleReject(r.id)}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminField>
    </div>
  );
}
