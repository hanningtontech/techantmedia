import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtractionSessionMeta, ExtractionSessionRow } from "@shared/documentExtraction";
import { DOCUMENT_TYPES, defaultSessionMeta, resolveSessionMetaForRows } from "@shared/documentExtraction";
import {
  formatSpreadsheetCell,
  getSpreadsheetCellValue,
  getSpreadsheetColumns,
  sessionTotalKes,
} from "@/lib/ntsa/extractionSpreadsheet";
import { cn } from "@/lib/utils";

const ROWS_PER_PAGE = 50;

type Props = {
  rows: ExtractionSessionRow[];
  meta?: ExtractionSessionMeta | null;
  title?: string;
  emptyMessage?: string;
  compact?: boolean;
};

function PaginationBar({
  page,
  totalPages,
  totalRows,
  onPageChange,
  position = "top",
}: {
  page: number;
  totalPages: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  position?: "top" | "bottom";
}) {
  if (totalPages <= 1) return null;

  const rangeStart = (page - 1) * ROWS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * ROWS_PER_PAGE, totalRows);

  return (
    <div
      className={
        position === "top"
          ? "flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3"
          : "flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3"
      }
    >
      <p className="text-xs text-zinc-500">
        Showing source pages {rangeStart}–{rangeEnd} of {totalRows}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-white/15 text-zinc-300 hover:bg-white/5"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <span className="min-w-[5rem] text-center text-xs text-zinc-400">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-white/15 text-zinc-300 hover:bg-white/5"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SpreadsheetTableView({
  rows,
  meta,
  title = "Spreadsheet",
  emptyMessage = "No rows to display.",
  compact = false,
}: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));

  const resolvedMeta = useMemo(
    () =>
      meta ??
      resolveSessionMetaForRows(rows, null, null) ??
      defaultSessionMeta("ntsa_test_form"),
    [meta, rows],
  );

  const columns = getSpreadsheetColumns(resolvedMeta);
  const totalKes = sessionTotalKes(rows, resolvedMeta);
  const docLabel = DOCUMENT_TYPES[resolvedMeta.documentType].label;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [rows, resolvedMeta.documentType]);

  const pageRows = rows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#12121a]">
      <div
        className={
          compact
            ? "flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3"
            : "flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4"
        }
      >
        <div className="flex items-center gap-2 text-white">
          <FileSpreadsheet className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-xs text-zinc-500">{docLabel}</p>
          </div>
        </div>
        <span className="text-sm text-zinc-400">
          {rows.length} record{rows.length === 1 ? "" : "s"}
          {rows.length > ROWS_PER_PAGE ? ` · ${ROWS_PER_PAGE} per page` : ""}
          {totalKes > 0 ? ` · KES ${totalKes.toLocaleString("en-US")}` : ""}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-16 text-center text-sm text-zinc-500">{emptyMessage}</div>
      ) : (
        <>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalRows={rows.length}
            onPageChange={setPage}
          />
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                {columns.map((col) => (
                  <col key={col.fieldId} style={col.width ? { width: col.width } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-white/10 bg-[#1f6b6b]">
                  {columns.map((col) => (
                    <th
                      key={col.fieldId}
                      className={cn(
                        "py-2.5 font-semibold text-white",
                        col.headerClassName ?? "px-2",
                        col.align === "center" ? "text-center" : "text-left",
                      )}
                      title={col.headerLabel ? col.label : undefined}
                    >
                      {col.headerLabel ?? col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, indexOnPage) => {
                  const globalIndex = (page - 1) * ROWS_PER_PAGE + indexOnPage;
                  return (
                    <tr
                      key={`${row.sourcePage}-${globalIndex}`}
                      className={
                        indexOnPage % 2 === 1
                          ? "border-b border-white/5 bg-[#e8f4f8]/10"
                          : "border-b border-white/5"
                      }
                    >
                      {columns.map((col) => (
                        <td
                          key={col.fieldId}
                          className={cn(
                            "py-2 align-top",
                            col.cellClassName ?? "px-2",
                            col.align === "left" ? "text-white" : "text-center text-zinc-300",
                          )}
                        >
                          {formatSpreadsheetCell(
                            col.fieldId,
                            getSpreadsheetCellValue(row, col.fieldId),
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalRows={rows.length}
            onPageChange={setPage}
            position="bottom"
          />
        </>
      )}
    </div>
  );
}
