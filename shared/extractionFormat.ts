import {
  DOCUMENT_TYPES,
  defaultSessionMeta,
  inferSessionMetaFromRows,
  resolveSessionMetaForRows,
  type DocumentTypeId,
  type ExtractionFieldId,
  type ExtractionSessionMeta,
  type ExtractionSessionRow,
} from "./documentExtraction";

export type ExcelFormatSignature = {
  documentType: DocumentTypeId;
  enabledFields: ExtractionFieldId[];
  columnLabels: string[];
};

export function columnLabelsForMeta(meta: ExtractionSessionMeta): string[] {
  const typeDef = DOCUMENT_TYPES[meta.documentType];
  return meta.enabledFields.map((fieldId) => {
    const field = typeDef.fields.find((f) => f.id === fieldId);
    return field?.label ?? fieldId;
  });
}

export function formatSignatureFromMeta(meta: ExtractionSessionMeta): ExcelFormatSignature {
  return {
    documentType: meta.documentType,
    enabledFields: [...meta.enabledFields],
    columnLabels: columnLabelsForMeta(meta),
  };
}

export function inferFormatFromRows(rows: ExtractionSessionRow[]): ExcelFormatSignature | null {
  const meta = inferSessionMetaFromRows(rows);
  if (!meta) return null;
  return formatSignatureFromMeta(meta);
}

function inferFormatForHistoryEntry(entry: HistoryCombineEntry): ExcelFormatSignature | null {
  const meta = resolveSessionMetaForRows(entry.rows, entry.sessionMeta);
  if (!meta) return null;
  return formatSignatureFromMeta(meta);
}

export function formatSignaturesMatch(a: ExcelFormatSignature, b: ExcelFormatSignature): boolean {
  if (a.documentType !== b.documentType) return false;
  if (a.enabledFields.length !== b.enabledFields.length) return false;
  return a.enabledFields.every((field, index) => field === b.enabledFields[index]);
}

function normalizeHeaderLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Match exported Excel header row to a document format. */
export function inferFormatFromExcelHeaders(headers: string[]): ExcelFormatSignature | null {
  const normalized = headers.map(normalizeHeaderLabel).filter(Boolean);
  if (!normalized.length) return null;

  const candidates: DocumentTypeId[] = [
    "ntsa_test_form",
    "ntsa_receipt",
    "ntsa_interim_license",
  ];

  for (const documentType of candidates) {
    const meta = defaultSessionMeta(documentType);
    const signature = formatSignatureFromMeta(meta);
    const expected = signature.columnLabels.map(normalizeHeaderLabel);
    if (normalized.length < expected.length) continue;

    const slice = normalized.slice(0, expected.length);
    const matches = expected.every((label, index) => {
      const cell = slice[index] ?? "";
      return cell === label || cell.includes(label) || label.includes(cell);
    });

    if (matches) return signature;
  }

  return null;
}

export function combineExtractionSessionRows(chunks: ExtractionSessionRow[][]): ExtractionSessionRow[] {
  const combined: ExtractionSessionRow[] = [];
  for (const rows of chunks) {
    for (const row of rows) {
      combined.push({
        ...row,
        sourcePage: combined.length + 1,
      });
    }
  }
  return combined;
}

export type HistoryCombineResult =
  | { ok: true; meta: ExtractionSessionMeta; rows: ExtractionSessionRow[] }
  | { ok: false; oddLabel: string; reason: string };

export type HistoryCombineEntry = {
  label: string;
  rows: ExtractionSessionRow[];
  sessionMeta?: ExtractionSessionMeta | null;
};

export function validateAndCombineHistoryRows(entries: HistoryCombineEntry[]): HistoryCombineResult {
  if (entries.length < 2) {
    return { ok: false, oddLabel: "", reason: "Select at least two saved spreadsheets." };
  }

  const baseFormat = inferFormatForHistoryEntry(entries[0]!);
  if (!baseFormat) {
    return { ok: false, oddLabel: entries[0]!.label, reason: "Could not detect spreadsheet format." };
  }

  for (const entry of entries.slice(1)) {
    const format = inferFormatForHistoryEntry(entry);
    if (!format || !formatSignaturesMatch(baseFormat, format)) {
      const typeLabel = DOCUMENT_TYPES[baseFormat.documentType].label;
      return {
        ok: false,
        oddLabel: entry.label,
        reason: `Uses a different format than the others (${typeLabel} columns expected).`,
      };
    }
  }

  const baseMeta =
    resolveSessionMetaForRows(entries[0]!.rows, entries[0]!.sessionMeta) ??
    defaultSessionMeta(baseFormat.documentType);

  return {
    ok: true,
    meta: baseMeta,
    rows: combineExtractionSessionRows(entries.map((entry) => entry.rows)),
  };
}

export type FileCombineResult =
  | {
      ok: true;
      combined: ExtractionSessionRow[];
      sources: Array<{ fileName: string; rows: ExtractionSessionRow[] }>;
      meta: ExtractionSessionMeta;
    }
  | { ok: false; oddFileName: string; reason: string };

export function validateAndCombineParsedSpreadsheets(
  sources: Array<{ fileName: string; rows: ExtractionSessionRow[]; format: ExcelFormatSignature | null }>,
): FileCombineResult {
  if (sources.length < 2) {
    return { ok: false, oddFileName: "", reason: "Add at least two spreadsheets." };
  }

  const base = sources[0]!;
  if (!base.format) {
    return {
      ok: false,
      oddFileName: base.fileName,
      reason: "Unrecognized column layout — use exports from this tool.",
    };
  }

  for (const source of sources.slice(1)) {
    if (!source.format || !formatSignaturesMatch(base.format, source.format)) {
      const typeLabel = DOCUMENT_TYPES[base.format.documentType].label;
      return {
        ok: false,
        oddFileName: source.fileName,
        reason: `Different columns than the others (${typeLabel} format expected).`,
      };
    }
  }

  const nonEmpty = sources.filter((source) => source.rows.length > 0);
  if (!nonEmpty.length) {
    return { ok: false, oddFileName: base.fileName, reason: "No data rows were found." };
  }

  return {
    ok: true,
    combined: combineExtractionSessionRows(nonEmpty.map((source) => source.rows)),
    sources: nonEmpty.map((source) => ({ fileName: source.fileName, rows: source.rows })),
    meta: {
      documentType: base.format.documentType,
      enabledFields: [...base.format.enabledFields],
    },
  };
}
