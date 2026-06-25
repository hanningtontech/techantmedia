import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadNtsaExcel } from "@/lib/ntsa/ntsaExcel";
import {
  adminRestoreSession,
  deleteExtractionRecord,
  listAllExtractionRecords,
} from "@/lib/ntsa/ntsaExtractionFirestore";
import type { ExtractionRecord } from "@/lib/ntsa/ntsaExtractionTypes";
import { parseAmountKes } from "@shared/ntsaExtraction";

type Filter = "all" | "saved" | "cleared" | "restore-requests";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function ExtractionRecordsAdminSection() {
  const [records, setRecords] = useState<ExtractionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await listAllExtractionRecords());
    } catch {
      toast.error("Could not load extraction records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = records.filter((r) => {
    if (filter === "saved") return r.type === "saved";
    if (filter === "cleared") return r.type === "cleared";
    if (filter === "restore-requests") return r.restoreRequested && !r.restoredAt;
    return true;
  });

  const handleDelete = async (record: ExtractionRecord) => {
    if (!window.confirm(`Delete ${record.label} for ${record.userName ?? record.userEmail ?? record.userId}?`)) {
      return;
    }
    setBusyId(record.id);
    try {
      await deleteExtractionRecord(record.id);
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
      toast.success("Record deleted");
    } catch {
      toast.error("Could not delete record");
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (record: ExtractionRecord) => {
    setBusyId(record.id);
    try {
      await adminRestoreSession(record);
      setRecords((prev) =>
        prev.map((r) =>
          r.id === record.id
            ? { ...r, restoredAt: new Date().toISOString(), restoreRequested: false }
            : r,
        ),
      );
      toast.success(`Restored ${record.label} to ${record.userName ?? "user"}'s session`);
    } catch {
      toast.error("Could not restore session");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (record: ExtractionRecord) => {
    try {
      await downloadNtsaExcel(record.rows, `${record.label.replace(/\//g, "-")}.xlsx`);
    } catch {
      toast.error("Could not download Excel");
    }
  };

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "saved", label: "Saved" },
    { id: "cleared", label: "Cleared" },
    { id: "restore-requests", label: "Restore requests" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={
              filter === f.id
                ? "rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-300"
                : "rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }
          >
            {f.label}
          </button>
        ))}
        <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !filtered.length ? (
        <p className="text-sm text-zinc-500">No records in this view.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((record) => {
            const totalKes = record.rows.reduce((sum, row) => sum + parseAmountKes(row.amount), 0);
            const busy = busyId === record.id;
            return (
              <li
                key={record.id}
                className="rounded-xl border border-white/10 bg-[#0f0f14] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{record.label}</p>
                      <span
                        className={
                          record.type === "saved"
                            ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400"
                            : "rounded-full bg-orange-500/15 px-2 py-0.5 text-xs text-orange-400"
                        }
                      >
                        {record.type}
                      </span>
                      {record.restoreRequested && !record.restoredAt && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
                          Restore requested
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">
                      {record.userName ?? "Unknown"} · {record.userEmail ?? record.userId}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {record.rows.length} rows
                      {totalKes > 0 ? ` · KES ${totalKes.toLocaleString("en-US")}` : ""}
                      {" · "}
                      {formatWhen(record.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleDownload(record)}
                    >
                      <Download className="mr-1 h-4 w-4" />
                      Excel
                    </Button>
                    {record.type === "cleared" && !record.restoredAt && (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700"
                        disabled={busy}
                        onClick={() => void handleRestore(record)}
                      >
                        {busy ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1 h-4 w-4" />
                        )}
                        Restore to user
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-400 hover:text-red-300"
                      disabled={busy}
                      onClick={() => void handleDelete(record)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
