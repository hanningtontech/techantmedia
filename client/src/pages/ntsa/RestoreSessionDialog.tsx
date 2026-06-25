import { useEffect, useState } from "react";
import { HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { listUserClearedRecords, requestSessionRestore } from "@/lib/ntsa/ntsaExtractionFirestore";
import type { ExtractionRecord } from "@/lib/ntsa/ntsaExtractionTypes";
import { parseAmountKes } from "@shared/ntsaExtraction";

type Props = {
  userId: string;
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function RestoreSessionHelp({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cleared, setCleared] = useState<ExtractionRecord[]>([]);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void listUserClearedRecords(userId)
      .then(setCleared)
      .catch(() => toast.error("Could not load cleared sessions"))
      .finally(() => setLoading(false));
  }, [open, userId]);

  const handleRequest = async (record: ExtractionRecord) => {
    setRequestingId(record.id);
    try {
      await requestSessionRestore(record.id);
      setCleared((prev) =>
        prev.map((r) =>
          r.id === record.id
            ? { ...r, restoreRequested: true, restoreRequestedAt: new Date().toISOString() }
            : r,
        ),
      );
      toast.success(`Restore requested for ${record.label}. An admin will review it.`);
    } catch {
      toast.error("Could not send restore request");
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/15 text-zinc-300 hover:bg-white/5 hover:text-white"
        >
          <HelpCircle className="mr-2 h-4 w-4" />
          Help · Restore session
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[85vh] overflow-hidden border-white/10 bg-[#12121a] text-white sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Restore a cleared session</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            If you cleared a session without saving, pick it below and request a restore. An admin can
            send it back to your active spreadsheet.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-64 overflow-y-auto py-2">
          {loading ? (
            <div className="flex justify-center py-8 text-amber-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !cleared.length ? (
            <p className="text-sm text-zinc-500">No cleared sessions found for your account.</p>
          ) : (
            <ul className="space-y-2">
              {cleared.map((record) => {
                const totalKes = record.rows.reduce((sum, row) => sum + parseAmountKes(row.amount), 0);
                return (
                  <li
                    key={record.id}
                    className="rounded-xl border border-white/10 bg-[#0c0c12] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white">{record.label}</p>
                        <p className="text-xs text-zinc-500">
                          {record.rows.length} record{record.rows.length === 1 ? "" : "s"}
                          {totalKes > 0 ? ` · KES ${totalKes.toLocaleString("en-US")}` : ""}
                          {" · Cleared "}
                          {formatWhen(record.clearedAt ?? record.createdAt)}
                        </p>
                        {record.restoreRequested && (
                          <p className="mt-1 text-xs text-amber-400">Restore requested — awaiting admin</p>
                        )}
                        {record.restoredAt && (
                          <p className="mt-1 text-xs text-emerald-400">
                            Restored {formatWhen(record.restoredAt)}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0 bg-amber-600 hover:bg-amber-700"
                        disabled={record.restoreRequested || !!record.restoredAt || requestingId === record.id}
                        onClick={() => void handleRequest(record)}
                      >
                        {requestingId === record.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : record.restoreRequested ? (
                          "Requested"
                        ) : (
                          "Request restore"
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">
            Close
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
