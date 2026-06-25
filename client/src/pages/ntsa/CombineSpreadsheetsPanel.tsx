import { useCallback, useRef, useState } from "react";
import { Download, FileSpreadsheet, Layers, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useExtractionDownload } from "@/contexts/ExtractionDownloadContext";
import { combineNtsaExcelFiles } from "@/lib/ntsa/parseNtsaExcelUpload";
import { parseAmountKes } from "@shared/ntsaExtraction";
import type { ExtractionSessionMeta, ExtractionSessionRow } from "@shared/documentExtraction";
import { SpreadsheetTableView } from "@/pages/ntsa/SpreadsheetTableView";
import { SodaPrankOverlay } from "@/pages/ntsa/SodaPrankOverlay";
import { incrementSodaPrankCombineCount, shouldShowSodaPrank } from "@/lib/ntsa/sodaPrankSchedule";
import { cn } from "@/lib/utils";

const EXCEL_ACCEPT = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type UploadedSheet = {
  id: string;
  file: File;
};

type Props = {
  onLoadToSession?: (rows: ExtractionSessionRow[]) => void;
};

function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel" ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  );
}

export function CombineSpreadsheetsPanel({ onLoadToSession }: Props) {
  const { downloadExcel } = useExtractionDownload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedSheet[]>([]);
  const [combinedRows, setCombinedRows] = useState<ExtractionSessionRow[] | null>(null);
  const [combinedMeta, setCombinedMeta] = useState<ExtractionSessionMeta | null>(null);
  const [sourceSummary, setSourceSummary] = useState<Array<{ fileName: string; count: number }>>([]);
  const [combining, setCombining] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSodaPrank, setShowSodaPrank] = useState(false);
  const dragDepthRef = useRef(0);
  const combineRequestRef = useRef(0);

  const runCombine = useCallback(
    async (options?: { showPrank?: boolean }) => {
      if (files.length < 2) return;

      const requestId = ++combineRequestRef.current;
      setCombining(true);
      setCombinedRows(null);
      setCombinedMeta(null);
      setSourceSummary([]);
      setShowSodaPrank(false);

      try {
        const { combined, sources, meta } = await combineNtsaExcelFiles(files.map((item) => item.file));
        if (requestId !== combineRequestRef.current) return;

        const emptySources = sources.filter((source) => !source.rows.length);

        if (!combined.length) {
          toast.error("No data rows were found in these spreadsheets.");
          return;
        }

        if (emptySources.length) {
          toast.message(
            `${emptySources.length} file${emptySources.length === 1 ? "" : "s"} had no data rows and were skipped.`,
          );
        }

        setCombinedRows(combined);
        setCombinedMeta(meta);
        setSourceSummary(sources.map((source) => ({ fileName: source.fileName, count: source.rows.length })));

        if (options?.showPrank) {
          setShowSodaPrank(true);
        } else {
          toast.success(
            `Combined ${sources.length} spreadsheet${sources.length === 1 ? "" : "s"} into ${combined.length} row${combined.length === 1 ? "" : "s"}.`,
          );
        }
      } catch (e) {
        if (requestId === combineRequestRef.current) {
          const message =
            e instanceof Error ? e.message : "Could not combine these spreadsheets.";
          toast.error(message);
        }
      } finally {
        if (requestId === combineRequestRef.current) {
          setCombining(false);
        }
      }
    },
    [files],
  );

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming).filter(isExcelFile);
    if (!list.length) {
      toast.error("Choose Excel files (.xlsx or .xls) exported from this tool or with the same columns.");
      return;
    }

    setCombinedRows(null);
    setCombinedMeta(null);
    setSourceSummary([]);
    setFiles((prev) => {
      const existing = new Set(prev.map((item) => `${item.file.name}-${item.file.size}`));
      const next = [...prev];
      for (const file of list) {
        const key = `${file.name}-${file.size}`;
        if (existing.has(key)) continue;
        existing.add(key);
        next.push({ id: `${Date.now()}-${Math.random()}`, file });
      }
      return next;
    });
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== id));
    setCombinedRows(null);
    setCombinedMeta(null);
    setSourceSummary([]);
  };

  const handleCombine = () => {
    if (files.length < 2) {
      toast.error("Add at least two spreadsheets to combine.");
      return;
    }
    const combineCount = incrementSodaPrankCombineCount();
    const showPrank = shouldShowSodaPrank(combineCount);
    void runCombine({ showPrank });
  };

  const handleDownload = async () => {
    if (!combinedRows?.length) return;
    const ok = await downloadExcel(
      combinedRows,
      "combined-spreadsheets.xlsx",
      combinedMeta ?? undefined,
    );
    if (ok) toast.success("Combined spreadsheet downloaded");
  };

  const totalKes =
    combinedRows?.reduce(
      (sum, row) => sum + parseAmountKes(row.totalKes || row.amount),
      0,
    ) ?? 0;

  return (
    <div className="space-y-8">
      <SodaPrankOverlay open={showSodaPrank} onClose={() => setShowSodaPrank(false)} />
      <div className="rounded-2xl border border-white/10 bg-[#12121a] p-6">
        <div className="flex items-start gap-3">
          <Layers className="mt-0.5 h-6 w-6 shrink-0 text-indigo-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Combine spreadsheets</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Upload multiple Excel files with the same columns. They are merged into one spreadsheet with
              sequential source pages.
            </p>
          </div>
        </div>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepthRef.current += 1;
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            dragDepthRef.current -= 1;
            if (dragDepthRef.current <= 0) {
              dragDepthRef.current = 0;
              setIsDragging(false);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            dragDepthRef.current = 0;
            setIsDragging(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "mt-6 rounded-xl border border-dashed p-8 text-center transition-colors",
            isDragging
              ? "border-indigo-400 bg-indigo-500/10"
              : "border-white/15 bg-[#0c0c12] hover:border-indigo-500/40",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={EXCEL_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <FileSpreadsheet className="mx-auto h-10 w-10 text-indigo-400" />
          <p className="mt-3 text-sm text-zinc-300">Drag and drop Excel files here, or choose from your device</p>
          <p className="mt-1 text-xs text-zinc-500">Same format as exports from this tool · select multiple files</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 border-white/15 text-white hover:bg-white/5"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose Excel files
          </Button>
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium text-white">
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </p>
            <ul className="space-y-2">
              {files.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#0c0c12] px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-zinc-300">{item.file.name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 shrink-0 text-zinc-500 hover:text-red-400"
                    onClick={() => removeFile(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={files.length < 2 || combining}
                onClick={handleCombine}
              >
                {combining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Combining…
                  </>
                ) : (
                  <>
                    <Layers className="mr-2 h-4 w-4" />
                    Combine spreadsheets
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/15 text-zinc-400"
                onClick={() => {
                  setFiles([]);
                  setCombinedRows(null);
                  setSourceSummary([]);
                }}
              >
                Clear list
              </Button>
            </div>
          </div>
        )}
      </div>

      {combinedRows && combinedRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Combined result</h3>
              <p className="text-sm text-zinc-500">
                {combinedRows.length} record{combinedRows.length === 1 ? "" : "s"}
                {totalKes > 0 ? ` · KES ${totalKes.toLocaleString("en-US")}` : ""}
              </p>
              {sourceSummary.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
                  {sourceSummary.map((source) => (
                    <li key={source.fileName} className="rounded bg-white/5 px-2 py-1">
                      {source.fileName}: {source.count} row{source.count === 1 ? "" : "s"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {onLoadToSession && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/5"
                  onClick={() => {
                    onLoadToSession(combinedRows);
                    toast.success("Combined spreadsheet loaded into your session");
                  }}
                >
                  Open in session
                </Button>
              )}
              <Button
                type="button"
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => void handleDownload()}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Excel
              </Button>
            </div>
          </div>
          <SpreadsheetTableView
            rows={combinedRows}
            meta={combinedMeta}
            title="Combined spreadsheet"
            compact
          />
        </div>
      )}
    </div>
  );
}
