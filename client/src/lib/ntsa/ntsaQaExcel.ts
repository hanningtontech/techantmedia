import ExcelJS from "exceljs";
import {
  QA_FIELD_LABELS,
  type QaAuditReport,
  type QaFieldKey,
} from "@shared/ntsaQa";

const HEADER_FILL = "FF1F6B6B";

export async function downloadQaAuditExcel(
  report: QaAuditReport,
  fileName = "extraction-qa-audit-report.xlsx",
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const summarySheet = workbook.addWorksheet("Summary");
  const errorsSheet = workbook.addWorksheet("Error Log");
  const tipsSheet = workbook.addWorksheet("Recommendations");

  summarySheet.columns = [
    { width: 18 },
    { width: 14 },
    { width: 12 },
    { width: 18 },
    { width: 12 },
  ];

  summarySheet.addRow(["Metric", "Total Records", "Correct", "Incorrect/Missing", "Accuracy %"]);
  const header = summarySheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });

  const fieldOrder: QaFieldKey[] = [
    "name",
    "idNumber",
    "testApplicationNumber",
    "amount",
    "date",
  ];
  for (const field of fieldOrder) {
    const m = report.summary[field];
    summarySheet.addRow([
      QA_FIELD_LABELS[field],
      m.total,
      m.correct,
      m.incorrect,
      m.accuracy,
    ]);
  }

  errorsSheet.columns = [
    { width: 8 },
    { width: 10 },
    { width: 16 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 48 },
  ];
  errorsSheet.addRow([
    "Row #",
    "Source Page",
    "Field",
    "Extracted Value",
    "Actual Value",
    "Error Type",
    "Technical Explanation",
  ]);
  const errHeader = errorsSheet.getRow(1);
  errHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  errHeader.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });

  for (const err of report.errors) {
    errorsSheet.addRow([
      err.rowNumber,
      err.sourcePage,
      err.field,
      err.extractedValue,
      err.actualValue,
      err.errorType,
      err.technicalExplanation,
    ]);
  }

  tipsSheet.getColumn(1).width = 90;
  tipsSheet.addRow(["Recommendations for Improvement"]);
  tipsSheet.getRow(1).font = { bold: true, size: 12 };
  for (const tip of report.recommendations) {
    const row = tipsSheet.addRow([tip]);
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
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
