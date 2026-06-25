import * as XLSX from "xlsx";
import type { ExtractionSessionRow } from "@shared/documentExtraction";
import type { ExtractionSessionMeta } from "@shared/documentExtraction";
import { setRowFieldValue, type ExtractionFieldId } from "@shared/documentExtraction";
import {
  inferFormatFromExcelHeaders,
  validateAndCombineParsedSpreadsheets,
  type ExcelFormatSignature,
} from "@shared/extractionFormat";

function cellString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseAmountCell(raw: string): string {
  const cleaned = raw.replace(/,/g, "");
  return cleaned.replace(/\D/g, "") || cleaned;
}

function parseDataRow(
  cells: unknown[],
  fields: ExtractionFieldId[],
  documentType: ExcelFormatSignature["documentType"],
  fallbackPage: number,
): ExtractionSessionRow | null {
  let row: ExtractionSessionRow = {
    sourcePage: fallbackPage,
    name: "",
    idNumber: "",
    testApplicationNumber: "",
    amount: "",
    date: "",
    documentType,
  };

  let hasValue = false;
  fields.forEach((fieldId, index) => {
    const raw = cellString(cells[index]);
    if (!raw) return;
    hasValue = true;
    if (fieldId === "sourcePage") {
      const page =
        typeof cells[index] === "number"
          ? (cells[index] as number)
          : Number.parseInt(raw, 10) || fallbackPage;
      row = setRowFieldValue(row, fieldId, String(page));
      return;
    }
    if (fieldId === "amount" || fieldId === "totalKes") {
      row = setRowFieldValue(row, fieldId, parseAmountCell(raw));
      return;
    }
    row = setRowFieldValue(row, fieldId, raw);
  });

  if (!hasValue) return null;
  return row;
}

export type ParsedSpreadsheetSource = {
  fileName: string;
  rows: ExtractionSessionRow[];
  format: ExcelFormatSignature | null;
};

/** Parse an uploaded extraction spreadsheet (test form, receipt, or IDL export layout). */
export async function parseNtsaExcelUpload(file: File): Promise<ParsedSpreadsheetSource> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { fileName: file.name, rows: [], format: null };
  }

  const sheet = workbook.Sheets[sheetName]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

  let headerRowIndex = matrix.findIndex((row) =>
    row.some((cell) => normalizeNameHeader(cellString(cell))),
  );
  if (headerRowIndex < 0) headerRowIndex = 0;

  const headerCells = (matrix[headerRowIndex] ?? []).map(cellString);
  const format = inferFormatFromExcelHeaders(headerCells);

  const rows: ExtractionSessionRow[] = [];
  if (!format) {
    return { fileName: file.name, rows, format: null };
  }

  for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
    const cells = matrix[i] ?? [];
    const first = cellString(cells[0]);
    if (/^total records/i.test(first) || /^note:/i.test(first)) break;

    const parsed = parseDataRow(cells, format.enabledFields, format.documentType, rows.length + 1);
    if (parsed) rows.push(parsed);
  }

  return { fileName: file.name, rows, format };
}

function normalizeNameHeader(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return lower === "name" || lower.endsWith(" name");
}

/** Parse multiple extraction spreadsheets (same column layout). */
export async function parseMultipleNtsaExcelUploads(files: File[]): Promise<ParsedSpreadsheetSource[]> {
  const sources: ParsedSpreadsheetSource[] = [];
  for (const file of files) {
    sources.push(await parseNtsaExcelUpload(file));
  }
  return sources;
}

/** Parse and merge multiple spreadsheets into one row list (formats must match). */
export async function combineNtsaExcelFiles(files: File[]): Promise<{
  combined: ExtractionSessionRow[];
  sources: ParsedSpreadsheetSource[];
  format: ExcelFormatSignature | null;
  meta: ExtractionSessionMeta | null;
}> {
  const sources = await parseMultipleNtsaExcelUploads(files);
  const result = validateAndCombineParsedSpreadsheets(sources);
  if (!result.ok) {
    throw new Error(result.oddFileName ? `${result.oddFileName}: ${result.reason}` : result.reason);
  }
  return {
    combined: result.combined,
    sources: sources.map((source) => ({
      fileName: source.fileName,
      rows: source.rows,
      format: source.format,
    })),
    format: sources[0]?.format ?? null,
    meta: result.meta,
  };
}
