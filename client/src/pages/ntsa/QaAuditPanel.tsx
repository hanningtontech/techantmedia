import { useRef, useState } from "react";
import { ClipboardCheck, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  buildQaAuditReport,
  QA_FIELD_LABELS,
  type QaAuditReport,
  type QaFieldKey,
} from "@shared/ntsaQa";
import { recognizeNtsaFormWithText } from "@/lib/ntsa/ntsaOcr";
import { parseNtsaExcelUpload } from "@/lib/ntsa/parseNtsaExcelUpload";
import { pdfFileToImages } from "@/lib/ntsa/pdfToImages";
import { MAX_EXTRACTION_FORMS, MAX_UPLOAD_MB, validateUploadBatch } from "@/lib/ntsa/ntsaLimits";
import { downloadQaAuditExcel } from "@/lib/ntsa/ntsaQaExcel";
import { cn } from "@/lib/utils";

const SOURCE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
const EXCEL_ACCEPT = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

const FIELD_ORDER: QaFieldKey[] = [
  "name",
  "idNumber",
  "testApplicationNumber",
  "amount",
  "date",
];

export function QaAuditPanel() {
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<QaAuditReport | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const runAudit = async (sourceFiles: FileList | File[]) => {
    if (!excelFile) {
      toast.error("Upload the extracted Excel spreadsheet first, then add the source images or PDF.");
      return;
    }

    const list = Array.from(sourceFiles).filter((f) => isPdf(f) || isImage(f));
    if (!list.length) {
      toast.error("Add at least one source image or PDF to audit against the spreadsheet.");
      return;
    }

    setRunning(true);
    setReport(null);

    try {
      const parsed = await parseNtsaExcelUpload(excelFile);
      const excelRows = parsed.rows;
      if (!excelRows.length) {
        toast.error(
          "Could not read any data rows from the Excel file. Use the spreadsheet downloaded from this tool.",
        );
        return;
      }

      const jobs: Array<{ page: number; label: string; blob: Blob }> = [];
      let page = 1;

      for (const file of list) {
        if (isPdf(file)) {
          const pages = await pdfFileToImages(file);
          for (const p of pages) {
            jobs.push({ page, label: `${file.name} (page ${p.pageNumber})`, blob: p.blob });
            page += 1;
            if (page > MAX_EXTRACTION_FORMS) break;
          }
        } else {
          jobs.push({ page, label: file.name, blob: file });
          page += 1;
        }
        if (page > MAX_EXTRACTION_FORMS) break;
      }

      const validation = validateUploadBatch({
        files: list,
        currentFormCount: 0,
        pendingFormCount: jobs.length,
      });
      if (!validation.ok) {
        toast.error(validation.message, { duration: 8000 });
        return;
      }

      if (!jobs.length) {
        toast.error("No form pages were found in your source upload.");
        return;
      }

      const actualByPage = new Map<
        number,
        { row: import("@shared/ntsaExtraction").NtsaFormRow; ocrText: string; label: string }
      >();

      for (const job of jobs) {
        const { row, ocrText } = await recognizeNtsaFormWithText(job.blob);
        actualByPage.set(job.page, { row, ocrText, label: job.label });
      }

      const audit = buildQaAuditReport({ excelRows, actualByPage });
      setReport(audit);

      const totalErrors = audit.errors.length;
      if (totalErrors === 0) {
        toast.success("QA audit complete — all checked fields match the source documents.");
      } else {
        toast.message(`QA audit complete — ${totalErrors} field mismatch${totalErrors === 1 ? "" : "es"} found.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "QA audit failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-[#12121a] p-6">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-6 w-6 shrink-0 text-teal-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Quality assurance audit</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Upload your extracted Excel file plus the original form images or PDF. The system re-reads each
              source page with OCR and compares every field row by row.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#0c0c12] p-4">
            <p className="text-sm font-medium text-white">1. Extracted Excel</p>
            <p className="mt-1 text-xs text-zinc-500">The spreadsheet produced by this tool</p>
            <input
              ref={excelInputRef}
              type="file"
              accept={EXCEL_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setExcelFile(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full border-white/15"
              onClick={() => excelInputRef.current?.click()}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {excelFile ? excelFile.name : "Choose Excel file"}
            </Button>
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
              if (!running && e.dataTransfer.files.length) void runAudit(e.dataTransfer.files);
            }}
            className={cn(
              "rounded-xl border border-dashed p-4 transition-all",
              isDragging
                ? "border-orange-400 bg-orange-500/10"
                : "border-white/10 bg-[#0c0c12]",
            )}
          >
            <p className="text-sm font-medium text-white">2. Source documents</p>
            <p className="mt-1 text-xs text-zinc-500">Original images or PDF (max {MAX_UPLOAD_MB} MB, 100 pages)</p>
            <input
              ref={sourceInputRef}
              type="file"
              accept={SOURCE_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void runAudit(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              className="mt-3 w-full bg-teal-600 hover:bg-teal-700"
              disabled={running || !excelFile}
              onClick={() => sourceInputRef.current?.click()}
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Auditing…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload sources &amp; run audit
                </>
              )}
            </Button>
            {isDragging && (
              <p className="mt-3 text-center text-sm font-bold uppercase tracking-wide text-orange-300">
                Drop it like it&apos;s hot
              </p>
            )}
          </div>
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-400">
              Audited {report.sourceCount} source page{report.sourceCount === 1 ? "" : "s"} against{" "}
              {report.auditedRows} spreadsheet row{report.auditedRows === 1 ? "" : "s"}
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-white/15"
              onClick={() => void downloadQaAuditExcel(report)}
            >
              <Download className="mr-2 h-4 w-4" />
              Download audit report
            </Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#12121a]">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="bg-[#1f6b6b] text-white">
                  <th className="px-4 py-3 text-left font-semibold">Metric</th>
                  <th className="px-4 py-3 text-center font-semibold">Total Records</th>
                  <th className="px-4 py-3 text-center font-semibold">Correct</th>
                  <th className="px-4 py-3 text-center font-semibold">Incorrect/Missing</th>
                  <th className="px-4 py-3 text-center font-semibold">Accuracy %</th>
                </tr>
              </thead>
              <tbody>
                {FIELD_ORDER.map((field, index) => {
                  const m = report.summary[field];
                  return (
                    <tr
                      key={field}
                      className={index % 2 === 1 ? "bg-[#e8f4f8]/10" : ""}
                    >
                      <td className="px-4 py-3 text-white">{QA_FIELD_LABELS[field]}</td>
                      <td className="px-4 py-3 text-center text-zinc-300">{m.total}</td>
                      <td className="px-4 py-3 text-center text-emerald-400">{m.correct}</td>
                      <td className="px-4 py-3 text-center text-orange-400">{m.incorrect}</td>
                      <td className="px-4 py-3 text-center text-zinc-300">{m.accuracy}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {report.errors.length > 0 ? (
            <div
              className="overflow-auto rounded-2xl border border-white/10 bg-[#12121a]"
              style={{ maxHeight: 528 }}
            >
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#1f6b6b] text-white">
                    <th className="px-3 py-3 text-left font-semibold">Row #</th>
                    <th className="px-3 py-3 text-left font-semibold">Field</th>
                    <th className="px-3 py-3 text-left font-semibold">Extracted Value</th>
                    <th className="px-3 py-3 text-left font-semibold">Actual Value</th>
                    <th className="px-3 py-3 text-left font-semibold">Error Type</th>
                    <th className="px-3 py-3 text-left font-semibold">Technical Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {report.errors.map((err, index) => (
                    <tr key={`${err.rowNumber}-${err.field}-${index}`} className="border-t border-white/5">
                      <td className="px-3 py-3 text-zinc-300">{err.rowNumber}</td>
                      <td className="px-3 py-3 text-white">{err.field}</td>
                      <td className="px-3 py-3 text-orange-300">{err.extractedValue}</td>
                      <td className="px-3 py-3 text-emerald-300">{err.actualValue}</td>
                      <td className="px-3 py-3 text-amber-300">{err.errorType}</td>
                      <td className="px-3 py-3 text-zinc-400">{err.technicalExplanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-8 text-center text-emerald-300">
              No discrepancies found for the uploaded batch.
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-[#0c0c12] p-5">
            <h3 className="font-semibold text-white">Recommendations for improvement</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-400">
              {report.recommendations.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
