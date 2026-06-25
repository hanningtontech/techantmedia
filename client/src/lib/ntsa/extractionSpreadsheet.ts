import type { ExtractionFieldId, ExtractionSessionMeta, ExtractionSessionRow } from "@shared/documentExtraction";
import { DOCUMENT_TYPES, getRowFieldValue } from "@shared/documentExtraction";
import { formatAmountKes, parseAmountKes } from "@shared/ntsaExtraction";

export type SpreadsheetColumn = {
  fieldId: ExtractionFieldId;
  label: string;
  /** Shorter header when the column is intentionally narrow */
  headerLabel?: string;
  align: "left" | "center";
  /** Applied to <col>, <th>, and <td> for consistent sizing */
  width?: string;
  headerClassName?: string;
  cellClassName?: string;
};

function spreadsheetColumnLayout(fieldId: ExtractionFieldId): Pick<
  SpreadsheetColumn,
  "headerLabel" | "width" | "headerClassName" | "cellClassName"
> {
  switch (fieldId) {
    case "sourcePage":
      return {
        headerLabel: "Page",
        width: "2.75rem",
        headerClassName: "px-1 text-xs",
        cellClassName: "px-1",
      };
    case "name":
      return {
        width: "38%",
        cellClassName: "min-w-[10rem] px-2",
      };
    case "totalKes":
    case "amount":
      return {
        headerLabel: "Total",
        width: "4.25rem",
        headerClassName: "px-1 text-xs",
        cellClassName: "px-1",
      };
    case "idNumber":
      return {
        width: "5.5rem",
        headerClassName: "px-1 text-xs",
        cellClassName: "px-1",
      };
    case "date":
      return {
        width: "7.5rem",
        headerClassName: "px-1 text-xs",
        cellClassName: "px-1",
      };
    case "applicationNo":
    case "testApplicationNumber":
      return {
        width: "8.5rem",
        headerClassName: "px-1 text-xs",
        cellClassName: "px-1",
      };
    case "billReferenceNo":
      return {
        width: "6.5rem",
        headerClassName: "px-1 text-xs",
        cellClassName: "px-1",
      };
    case "idlNo":
      return {
        width: "8.5rem",
        headerClassName: "px-1 text-xs",
        cellClassName: "px-1",
      };
    default:
      return {};
  }
}

export function getSpreadsheetColumns(meta: ExtractionSessionMeta): SpreadsheetColumn[] {
  const typeDef = DOCUMENT_TYPES[meta.documentType];

  return meta.enabledFields
    .map((fieldId) => {
      const field = typeDef.fields.find((f) => f.id === fieldId);
      if (!field) return null;
      const layout = spreadsheetColumnLayout(fieldId);
      return {
        fieldId,
        label: field.label,
        align: fieldId === "name" ? ("left" as const) : ("center" as const),
        ...layout,
      };
    })
    .filter((col): col is SpreadsheetColumn => col !== null);
}

export function formatSpreadsheetCell(fieldId: ExtractionFieldId, value: string | number): string {
  if (fieldId === "amount" || fieldId === "totalKes") {
    return formatAmountKes(String(value)) || "—";
  }
  if (value === "" || value === 0) return "—";
  return String(value);
}

export function getSpreadsheetCellValue(row: ExtractionSessionRow, fieldId: ExtractionFieldId): string | number {
  return getRowFieldValue(row, fieldId);
}

export function sessionTotalKes(rows: ExtractionSessionRow[], meta: ExtractionSessionMeta): number {
  const amountField: ExtractionFieldId =
    meta.documentType === "ntsa_receipt" ? "totalKes" : "amount";
  if (!meta.enabledFields.includes(amountField)) return 0;

  return rows.reduce((sum, row) => {
    const raw = getRowFieldValue(row, amountField);
    return sum + parseAmountKes(String(raw));
  }, 0);
}
