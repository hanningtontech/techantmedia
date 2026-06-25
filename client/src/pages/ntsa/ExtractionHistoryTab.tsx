import { useEffect, useMemo, useState } from "react";
import { Download, Folder, FolderOpen, Layers, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useExtractionDownload } from "@/contexts/ExtractionDownloadContext";
import {
  combineHistoryRows,
  loadExtractionHistory,
  removeHistoryEntry,
  resolveHistoryEntryMeta,
  type ExtractionHistoryEntry,
} from "@/lib/ntsa/ntsaHistory";
import { DOCUMENT_TYPES, historyFolderSlug, type DocumentTypeId } from "@shared/documentExtraction";
import { parseAmountKes } from "@shared/ntsaExtraction";
import { SpreadsheetPreviewDialog } from "@/pages/ntsa/SpreadsheetPreviewDialog";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  refreshKey: number;
  onHistoryChange: () => void;
  pendingEntry?: ExtractionHistoryEntry | null;
};

const FOLDER_ORDER: DocumentTypeId[] = [
  "ntsa_test_form",
  "ntsa_receipt",
  "ntsa_interim_license",
];

function formatSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function mergeHistory(
  loaded: ExtractionHistoryEntry[],
  pending?: ExtractionHistoryEntry | null,
): ExtractionHistoryEntry[] {
  if (!pending) return loaded;
  if (loaded.some((e) => e.id === pending.id)) return loaded;
  return [pending, ...loaded];
}

function groupHistoryByFolder(entries: ExtractionHistoryEntry[]) {
  const groups = new Map<DocumentTypeId, ExtractionHistoryEntry[]>();
  for (const entry of entries) {
    const meta = resolveHistoryEntryMeta(entry);
    const list = groups.get(meta.documentType) ?? [];
    list.push(entry);
    groups.set(meta.documentType, list);
  }
  return FOLDER_ORDER.filter((type) => groups.has(type)).map((documentType) => ({
    documentType,
    label: DOCUMENT_TYPES[documentType].label,
    entries: groups.get(documentType)!.sort((a, b) => a.sequence - b.sequence),
  }));
}

export function ExtractionHistoryTab({ userId, refreshKey, onHistoryChange, pendingEntry }: Props) {
  const { downloadExcel } = useExtractionDownload();
  const [history, setHistory] = useState<ExtractionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewEntry, setPreviewEntry] = useState<ExtractionHistoryEntry | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [openFolder, setOpenFolder] = useState<DocumentTypeId | null>(null);

  useEffect(() => {
    setLoading(true);
    void loadExtractionHistory(userId)
      .then((entries) => {
        setHistory(mergeHistory(entries, pendingEntry));
      })
      .catch((err: unknown) => {
        console.error("loadExtractionHistory failed:", err);
        if (pendingEntry) {
          setHistory([pendingEntry]);
        } else {
          toast.error("Could not load your saved history. Try refreshing in a moment.");
        }
      })
      .finally(() => setLoading(false));
  }, [userId, refreshKey, pendingEntry]);

  const folders = useMemo(() => groupHistoryByFolder(history), [history]);
  const selectedEntries = history.filter((e) => selected.has(e.id));
  const activeFolder = folders.find((folder) => folder.documentType === openFolder) ?? null;

  useEffect(() => {
    if (openFolder && !folders.some((folder) => folder.documentType === openFolder)) {
      setOpenFolder(null);
    }
  }, [folders, openFolder]);

  useEffect(() => {
    if (!pendingEntry) return;
    const meta = resolveHistoryEntryMeta(pendingEntry);
    setOpenFolder(meta.documentType);
  }, [pendingEntry?.id]);

  const toggleFolder = (documentType: DocumentTypeId) => {
    setOpenFolder((prev) => (prev === documentType ? null : documentType));
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openPreview = (entry: ExtractionHistoryEntry) => {
    setPreviewEntry(entry);
    setPreviewOpen(true);
  };

  const handleDownloadOne = async (entry: ExtractionHistoryEntry) => {
    const meta = resolveHistoryEntryMeta(entry);
    await downloadExcel(
      entry.rows,
      `${entry.label.replace(/\//g, "-")}.xlsx`,
      meta,
    );
  };

  const handleCombine = async () => {
    if (selectedEntries.length < 2) {
      toast.error("Select at least two saved spreadsheets to combine.");
      return;
    }
    const result = combineHistoryRows(
      selectedEntries.sort((a, b) => a.sequence - b.sequence),
    );
    if (!result.ok) {
      toast.error(
        result.oddLabel
          ? `Cannot combine — "${result.oddLabel}" does not match the others. ${result.reason}`
          : result.reason,
      );
      return;
    }
    const label = selectedEntries.map((e) => e.label).join("+").replace(/\//g, "-");
    await downloadExcel(result.rows, `combined-${label}.xlsx`, result.meta);
  };

  const handleDelete = async (entry: ExtractionHistoryEntry, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await removeHistoryEntry(entry.id);
      setHistory((prev) => prev.filter((item) => item.id !== entry.id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
      if (previewEntry?.id === entry.id) {
        setPreviewOpen(false);
        setPreviewEntry(null);
      }
      onHistoryChange();
      toast.message(`Removed ${entry.label} from history`);
    } catch {
      toast.error("Could not remove this entry");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-amber-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0c0c12] px-6 py-20 text-center">
        <h2 className="text-lg font-semibold text-white">Saved history</h2>
        <p className="mt-2 text-sm text-zinc-500">
          No saved spreadsheets yet. Go to <span className="text-zinc-400">Extract data</span> and use{" "}
          <span className="text-zinc-400">Save to history</span> before clearing your session.
        </p>
      </div>
    );
  }

  const previewMeta = previewEntry ? resolveHistoryEntryMeta(previewEntry) : null;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Saved history</h2>
            <p className="text-sm text-zinc-500">
              Click a folder to open the spreadsheets inside. Combine only works within the same folder.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 text-white hover:bg-white/5"
            disabled={selectedEntries.length < 2}
            onClick={() => void handleCombine()}
          >
            <Layers className="mr-2 h-4 w-4" />
            Combine selected ({selected.size})
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          {folders.map((folder) => {
            const isOpen = openFolder === folder.documentType;
            return (
              <button
                key={folder.documentType}
                type="button"
                onClick={() => toggleFolder(folder.documentType)}
                aria-expanded={isOpen}
                aria-label={`${folder.label}, ${folder.entries.length} spreadsheet${folder.entries.length === 1 ? "" : "s"}`}
                className={cn(
                  "flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all sm:h-32 sm:w-32",
                  isOpen
                    ? "border-amber-500/50 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]"
                    : "border-white/10 bg-[#12121a] hover:border-amber-500/30 hover:bg-[#16161f]",
                )}
              >
                {isOpen ? (
                  <FolderOpen className="h-8 w-8 text-amber-400" />
                ) : (
                  <Folder className="h-8 w-8 text-amber-400/80" />
                )}
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-white sm:text-xs">
                  {folder.label}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {folder.entries.length} file{folder.entries.length === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>

        {activeFolder ? (
          <section
            className="animate-in fade-in slide-in-from-top-2 duration-200 rounded-2xl border border-white/10 bg-[#0c0c12] p-4 sm:p-5"
            aria-label={activeFolder.label}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
              <div>
                <h3 className="font-medium text-white">{activeFolder.label}</h3>
                <p className="text-xs text-zinc-500">{historyFolderSlug(activeFolder.documentType)}/</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-zinc-400 hover:text-white"
                onClick={() => setOpenFolder(null)}
              >
                Close folder
              </Button>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeFolder.entries.map((entry) => {
                const meta = resolveHistoryEntryMeta(entry);
                const totalKes = entry.rows.reduce((sum, row) => {
                  const field = meta.documentType === "ntsa_receipt" ? row.totalKes : row.amount;
                  return sum + parseAmountKes(field || "");
                }, 0);
                return (
                  <li key={entry.id}>
                    <div
                      className={cn(
                        "flex h-full flex-col rounded-xl border border-white/10 bg-[#12121a] transition-colors hover:border-amber-500/30",
                      )}
                    >
                      <button
                        type="button"
                        className="flex flex-1 items-start gap-3 p-4 text-left"
                        onClick={() => openPreview(entry)}
                      >
                        <Checkbox
                          checked={selected.has(entry.id)}
                          onCheckedChange={() => toggle(entry.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${entry.label}`}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-white">{entry.label}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {entry.rows.length} record{entry.rows.length === 1 ? "" : "s"}
                            {totalKes > 0 ? ` · KES ${totalKes.toLocaleString("en-US")}` : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-600">{formatSavedAt(entry.savedAt)}</p>
                        </div>
                      </button>
                      <div className="flex border-t border-white/5 px-2 py-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 flex-1 text-zinc-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadOne(entry);
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
                          onClick={(e) => void handleDelete(entry, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <p className="text-center text-sm text-zinc-600">Select a folder above to view saved spreadsheets.</p>
        )}
      </div>

      <SpreadsheetPreviewDialog
        item={
          previewEntry
            ? {
                label: previewEntry.label,
                rows: previewEntry.rows,
                meta: previewMeta,
              }
            : null
        }
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        actions={
          previewEntry ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/15 text-white hover:bg-white/5"
                onClick={() => void handleDownloadOne(previewEntry)}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Download
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/15 text-red-400 hover:bg-white/5"
                onClick={() => void handleDelete(previewEntry)}
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
