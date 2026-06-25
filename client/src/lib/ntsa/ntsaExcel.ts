import ExcelJS from "exceljs";
import type { ExtractionFieldId, ExtractionSessionMeta, ExtractionSessionRow } from "@shared/documentExtraction";
import { getRowFieldValue } from "@shared/documentExtraction";
import {
  NTSA_EXCEL_HEADERS,
  formatAmountPlain,
  parseAmountKes,
  type NtsaSessionRow,
} from "@shared/ntsaExtraction";
import { getSpreadsheetColumns, sessionTotalKes } from "@/lib/ntsa/extractionSpreadsheet";

const HEADER_ROW = 4;
const HEADER_FILL = "FF1F6B6B";
const ALT_ROW_FILL = "FFE8F4F8";
const BORDER_COLOR = "FFB8D4D9";

function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: BORDER_COLOR } },
    left: { style: "thin", color: { argb: BORDER_COLOR } },
    bottom: { style: "thin", color: { argb: BORDER_COLOR } },
    right: { style: "thin", color: { argb: BORDER_COLOR } },
  };
}

function formatExcelValue(fieldId: ExtractionFieldId, value: string | number): string | number {
  if (fieldId === "amount" || fieldId === "totalKes") {
    const plain = formatAmountPlain(String(value));
    return plain || value;
  }
  return value;
}

export async function buildExtractionExcelBuffer(
  rows: ExtractionSessionRow[],
  meta: ExtractionSessionMeta,
): Promise<ArrayBuffer> {
  const columns = getSpreadsheetColumns(meta);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TechantMedia Data Extraction";
  const sheetName =
    meta.documentType === "ntsa_receipt"
      ? "Payment Receipts"
      : meta.documentType === "ntsa_interim_license"
        ? "Interim Licenses"
        : "Application Forms";
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
  });

  sheet.columns = columns.map((col) => ({
    width: col.fieldId === "name" ? 34 : col.fieldId === "sourcePage" ? 12 : 18,
  }));

  const header = sheet.getRow(HEADER_ROW);
  columns.forEach((col, index) => {
    const cell = header.getCell(index + 1);
    cell.value = col.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    applyThinBorder(cell);
  });
  header.height = 24;

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(HEADER_ROW + 1 + index);
    columns.forEach((col, colIndex) => {
      const raw = getRowFieldValue(row, col.fieldId);
      const value = formatExcelValue(col.fieldId, raw);
      const cell = excelRow.getCell(colIndex + 1);
      cell.value = value;
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align,
        wrapText: col.fieldId === "name",
      };
      if (index % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT_ROW_FILL } };
      }
      applyThinBorder(cell);
    });
    excelRow.height = 20;
  });

  const summaryStart = HEADER_ROW + rows.length + 2;
  const totalAmount = sessionTotalKes(rows, meta);
  const firstPage = rows[0]?.sourcePage ?? 0;
  const lastPage = rows[rows.length - 1]?.sourcePage ?? 0;
  const amountLabel =
    meta.documentType === "ntsa_receipt" ? "Total KES" : "Total Amount (KES)";

  const summaryRows: Array<{ label: string; value: string | number }> = [
    { label: "Total Records", value: rows.length },
    { label: amountLabel, value: totalAmount.toLocaleString("en-US") },
    {
      label: "Source Pages",
      value: rows.length ? `${firstPage}–${lastPage}` : "—",
    },
  ];

  summaryRows.forEach((item, index) => {
    const row = sheet.getRow(summaryStart + index);
    row.getCell(1).value = item.label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = item.value;
    row.getCell(2).font = { bold: index === 1 };
  });

  const noteRow = sheet.getRow(summaryStart + summaryRows.length + 1);
  sheet.mergeCells(noteRow.number, 1, noteRow.number, Math.max(columns.length, 1));
  const noteCell = noteRow.getCell(1);
  noteCell.value =
    "Note: duplicate-looking documents were retained as separate rows because they appear as separate pages/images in the uploaded PDF.";
  noteCell.font = { italic: true, size: 10, color: { argb: "FF5A6A6E" } };
  noteCell.alignment = { wrapText: true, vertical: "top" };
  noteRow.height = 36;

  return workbook.xlsx.writeBuffer();
}

/** Legacy export for test application forms with all default columns. */
export async function buildNtsaExcelBuffer(rows: NtsaSessionRow[]): Promise<ArrayBuffer> {
  const meta: ExtractionSessionMeta = {
    documentType: "ntsa_test_form",
    enabledFields: [
      "sourcePage",
      "name",
      "idNumber",
      "testApplicationNumber",
      "amount",
      "date",
    ],
  };
  return buildExtractionExcelBuffer(rows, meta);
}

export async function downloadExtractionExcelBlob(
  rows: ExtractionSessionRow[],
  meta: ExtractionSessionMeta,
  fileName?: string,
): Promise<void> {
  const defaultName =
    meta.documentType === "ntsa_receipt"
      ? "data-extraction-payment-receipts.xlsx"
      : meta.documentType === "ntsa_interim_license"
        ? "data-extraction-interim-licenses.xlsx"
        : "data-extraction-application-forms.xlsx";
  const buffer = await buildExtractionExcelBuffer(rows, meta);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName ?? defaultName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadNtsaExcelBlob(
  rows: NtsaSessionRow[],
  fileName = "data-extraction-application-forms.xlsx",
): Promise<void> {
  const buffer = await buildNtsaExcelBuffer(rows);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** @deprecated Use downloadNtsaExcelBlob or useExtractionDownload */
export const downloadNtsaExcel = downloadNtsaExcelBlob;
