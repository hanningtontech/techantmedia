import { useEffect, useState } from "react";
import { Download, Loader2, Play, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useExtractionDownload } from "@/contexts/ExtractionDownloadContext";
import { clearAutoDraft, getExtractionUserState } from "@/lib/ntsa/ntsaExtractionFirestore";
import { clearPendingBatch } from "@/lib/ntsa/ntsaPendingJobs";
import { saveNtsaRows } from "@/lib/ntsa/ntsaSession";
import type { NtsaSessionRow } from "@shared/ntsaExtraction";
import { parseAmountKes } from "@shared/ntsaExtraction";
import { SpreadsheetPreviewDialog } from "@/pages/ntsa/SpreadsheetPreviewDialog";

type DraftItem = {
  id: string;
  label: string;
  updatedAt: string;
  rows: NtsaSessionRow[];
};

type Props = {
  userId: string;
  refreshKey: number;
  resumableCount: number;
  onContinueExtraction: () => void;
  onRestoreToSession: (rows: NtsaSessionRow[]) => void;
  onDraftsChange: () => void;
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function ExtractionDraftsTab({
  userId,
  refreshKey,
  resumableCount,
  onContinueExtraction,
  onRestoreToSession,
  onDraftsChange,
}: Props) {
  const { downloadExcel } = useExtractionDownload();
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [previewItem, setPreviewItem] = useState<DraftItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadDrafts = async () => {
    const state = await getExtractionUserState(userId);
    const auto = state.autoDraft;
    if (!auto?.rows.length && !auto?.pendingExtraction?.resumableCount) {
      setDrafts([]);
      return;
    }
    setDrafts([
      {
        id: "auto-draft",
        label: "Auto-draft",
        updatedAt: auto.updatedAt,
        rows: auto.rows ?? [],
      },
    ]);
  };

  useEffect(() => {
    setLoading(true);
    void loadDrafts()
      .catch(() => toast.error("Could not load drafts"))
      .finally(() => setLoading(false));
  }, [userId, refreshKey]);

  const openPreview = (draft: DraftItem) => {
    setPreviewItem(draft);
    setPreviewOpen(true);
  };

  const handleRestore = (draft: DraftItem) => {
    saveNtsaRows(userId, draft.rows);
    onRestoreToSession(draft.rows);
    setPreviewOpen(false);
    toast.success("Draft restored to your active session");
  };

  const handleDownload = async (draft: DraftItem) => {
    await downloadExcel(draft.rows, `${draft.label.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
  };

  const handleDelete = async (draft: DraftItem) => {
    try {
      await clearPendingBatch(userId);
      await clearAutoDraft(userId);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      if (previewItem?.id === draft.id) {
        setPreviewOpen(false);
        setPreviewItem(null);
      }
      onDraftsChange();
      toast.message("Draft removed");
    } catch {
      toast.error("Could not delete draft");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-amber-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!drafts.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0c0c12] px-6 py-20 text-center">
        <h2 className="text-lg font-semibold text-white">Drafts</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Your working session is saved automatically while you extract. If you reload or lose
          connection, a draft will appear here.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-4 border-white/15 text-zinc-300"
          onClick={() => {
            setLoading(true);
            void loadDrafts().finally(() => setLoading(false));
          }}
        >
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Drafts</h2>
            <p className="text-sm text-zinc-500">Click a draft to preview it in a popup.</p>
          </div>
          {resumableCount > 0 && (
            <Button
              type="button"
              size="sm"
              className="bg-sky-600 hover:bg-sky-700"
              onClick={onContinueExtraction}
            >
              <Play className="mr-2 h-4 w-4" />
              Continue ({resumableCount} waiting)
            </Button>
          )}
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map((draft) => {
            const totalKes = draft.rows.reduce((sum, row) => sum + parseAmountKes(row.amount), 0);
            return (
              <li key={draft.id}>
                <div className="flex h-full flex-col rounded-xl border border-white/10 bg-[#12121a] transition-colors hover:border-sky-500/30">
                  <button
                    type="button"
                    className="flex-1 p-4 text-left"
                    onClick={() => openPreview(draft)}
                  >
                    <p className="font-medium text-white">{draft.label}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {draft.rows.length} record{draft.rows.length === 1 ? "" : "s"}
                      {resumableCount > 0 ? ` · ${resumableCount} file(s) waiting to extract` : ""}
                      {totalKes > 0 ? ` · KES ${totalKes.toLocaleString("en-US")}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">Last saved {formatWhen(draft.updatedAt)}</p>
                  </button>
                  <div className="flex border-t border-white/5 px-2 py-1.5">
                    {resumableCount > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 flex-1 text-sky-400 hover:text-sky-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          onContinueExtraction();
                        }}
                      >
                        <Play className="mr-1 h-3.5 w-3.5" />
                        Continue
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 flex-1 text-zinc-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(draft);
                      }}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Restore
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 flex-1 text-zinc-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDownload(draft);
                      }}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 text-zinc-500 hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(draft);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <SpreadsheetPreviewDialog
        item={previewItem ? { label: previewItem.label, rows: previewItem.rows } : null}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        actions={
          previewItem ? (
            <>
              {resumableCount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-sky-600 hover:bg-sky-700"
                  onClick={onContinueExtraction}
                >
                  <Play className="mr-1.5 h-4 w-4" />
                  Continue extraction
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => handleRestore(previewItem)}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Restore to session
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/15 text-white hover:bg-white/5"
                onClick={() => void handleDownload(previewItem)}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Download
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/15 text-red-400 hover:bg-white/5"
                onClick={() => void handleDelete(previewItem)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            </>
          ) : null
        }
      />
    </>
  );
}
