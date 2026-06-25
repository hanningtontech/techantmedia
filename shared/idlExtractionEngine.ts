import type { IdlFormRow } from "./documentExtraction";
import type { OcrLine } from "./ocrLayout";
import { groupTokensIntoLines, valueRightOfLabel } from "./ocrLayout";
import {
  correctIdlIdNumber,
  digDeeperIdlDate,
  digDeeperIdlIdNumber,
  digDeeperIdlName,
  finalizeIdlFormRow,
  isStrictIdlIdNumber,
  isValidIdlDate,
  isValidIdlIdNumber,
  isValidIdlName,
  isValidIdlNo,
  mergeIdlFormRows,
  normalizeIdlNo,
  parseIdlOcrText,
  refineIdlName,
} from "./ntsaIdlExtraction";

export type IdlExtractionMethod =
  | "primary_keyword"
  | "secondary_keyword"
  | "layout_proximity"
  | "contextual"
  | "global_regex"
  | "corrected"
  | "synthetic_fallback"
  | "none";

export type IdlFieldExtraction = {
  value: string | null;
  confidence: number;
  method: IdlExtractionMethod;
};

export type IdlStructuredOutput = {
  Name: IdlFieldExtraction;
  ID_Number: IdlFieldExtraction;
  Date: IdlFieldExtraction;
  IDL_No: IdlFieldExtraction;
  overallConfidence: number;
  needsReview: boolean;
};

const CONFIDENCE = {
  PRIMARY: 0.97,
  SECONDARY: 0.84,
  LAYOUT: 0.76,
  CONTEXTUAL: 0.65,
  GLOBAL: 0.48,
  CORRECTED: 0.72,
  SYNTHETIC: 0.25,
  NONE: 0,
} as const;

const REVIEW_THRESHOLD = 0.85;
const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

function field(
  value: string | null,
  confidence: number,
  method: IdlExtractionMethod,
): IdlFieldExtraction {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || confidence < CONFIDENCE.GLOBAL) {
    return { value: null, confidence: CONFIDENCE.NONE, method: "none" };
  }
  return { value: trimmed, confidence, method };
}

function pickHigher(current: IdlFieldExtraction, candidate: IdlFieldExtraction): IdlFieldExtraction {
  if (!candidate.value) return current;
  if (!current.value || candidate.confidence > current.confidence) return candidate;
  return current;
}

const NAME_LABELS = [
  /^Full\s*Name$/i,
  /^Name$/i,
  /^Applicant\s*Name$/i,
];

const ID_LABELS = [
  /^ID\s*Number$/i,
  /^1D\s*Number$/i,
  /^Identification\s*No$/i,
  /^ID\s*No$/i,
];

const DATE_LABELS = [/^From\s*Date$/i, /^Date\s*of\s*Issue$/i, /^Issue\s*Date$/i];

function tier1FromLayout(lines: OcrLine[]): Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>> {
  const out: Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>> = {};

  for (const label of NAME_LABELS) {
    const raw = valueRightOfLabel(lines, label);
    if (!raw) continue;
    const name = refineIdlName(raw);
    if (isValidIdlName(name)) {
      out.Name = field(name, CONFIDENCE.PRIMARY, "layout_proximity");
      break;
    }
  }

  for (const label of ID_LABELS) {
    const raw = valueRightOfLabel(lines, label);
    if (!raw) continue;
    const corrected = correctIdlIdNumber(raw.replace(/\D/g, ""));
    if (isStrictIdlIdNumber(corrected)) {
      out.ID_Number = field(corrected, CONFIDENCE.PRIMARY, "layout_proximity");
      break;
    }
    if (isValidIdlIdNumber(corrected)) {
      out.ID_Number = field(corrected, CONFIDENCE.CORRECTED, "corrected");
    }
  }

  for (const label of DATE_LABELS) {
    const raw = valueRightOfLabel(lines, label);
    if (!raw) continue;
    const parsed = digDeeperIdlDate([raw]);
    if (parsed && isValidIdlDate(parsed)) {
      out.Date = field(parsed, CONFIDENCE.PRIMARY, "layout_proximity");
      break;
    }
  }

  for (const line of lines) {
    const idlMatch = line.text.match(/\b(IDL[-\s][A-Z0-9]{6,12})\b/i);
    if (idlMatch?.[1]) {
      const normalized = normalizeIdlNo(idlMatch[1]);
      if (isValidIdlNo(normalized)) {
        out.IDL_No = field(normalized, CONFIDENCE.PRIMARY, "layout_proximity");
      }
    }
  }

  return out;
}

function tier2FromText(text: string): Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>> {
  const parsed = parseIdlOcrText(text);
  const out: Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>> = {};

  if (isValidIdlName(parsed.name)) {
    out.Name = field(parsed.name, CONFIDENCE.SECONDARY, "secondary_keyword");
  }
  if (isStrictIdlIdNumber(parsed.idNumber)) {
    out.ID_Number = field(parsed.idNumber, CONFIDENCE.SECONDARY, "secondary_keyword");
  } else if (isValidIdlIdNumber(parsed.idNumber)) {
    out.ID_Number = field(parsed.idNumber, CONFIDENCE.CORRECTED, "corrected");
  }
  if (isValidIdlDate(parsed.date)) {
    out.Date = field(parsed.date, CONFIDENCE.SECONDARY, "secondary_keyword");
  }
  if (isValidIdlNo(parsed.idlNo)) {
    out.IDL_No = field(parsed.idlNo, CONFIDENCE.SECONDARY, "secondary_keyword");
  }

  return out;
}

function tier3Contextual(
  text: string,
  partial: IdlFormRow,
): Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>> {
  const out: Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>> = {};

  if (!partial.name && partial.idNumber) {
    const name = digDeeperIdlName([text]);
    if (isValidIdlName(name)) {
      out.Name = field(name, CONFIDENCE.CONTEXTUAL, "contextual");
    }
  }

  if (!partial.idNumber && partial.name) {
    const id = digDeeperIdlIdNumber([text]);
    if (isStrictIdlIdNumber(id)) {
      out.ID_Number = field(id, CONFIDENCE.CONTEXTUAL, "contextual");
    }
  }

  if (!partial.date && (partial.name || partial.idNumber)) {
    const date = digDeeperIdlDate([text]);
    if (isValidIdlDate(date)) {
      out.Date = field(date, CONFIDENCE.CONTEXTUAL, "contextual");
    }
  }

  if (!partial.idlNo) {
    const belowAuthority = /NATIONAL\s+TRANSPORT[\s\S]{0,80}?(IDL[-\s][A-Z0-9]{6,12})/i.exec(text);
    if (belowAuthority?.[1]) {
      const normalized = normalizeIdlNo(belowAuthority[1]);
      if (isValidIdlNo(normalized)) {
        out.IDL_No = field(normalized, CONFIDENCE.CONTEXTUAL, "contextual");
      }
    }
  }

  return out;
}

function tier4Global(text: string): Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>> {
  const out: Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>> = {};

  const idl = text.match(/\bIDL-[A-Z0-9]{6,12}\b/i);
  if (idl?.[0]) {
    const normalized = normalizeIdlNo(idl[0]);
    if (isValidIdlNo(normalized)) {
      out.IDL_No = field(normalized, CONFIDENCE.GLOBAL, "global_regex");
    }
  }

  const id8 = text.match(/\b(\d{8})\b/);
  if (id8?.[1] && isStrictIdlIdNumber(id8[1])) {
    out.ID_Number = field(id8[1], CONFIDENCE.GLOBAL, "global_regex");
  }

  const dateMatch = new RegExp(
    `\\b(\\d{2}\\s+(?:${MONTHS})\\s+20\\d{2})\\b`,
    "i",
  ).exec(text);
  if (dateMatch?.[1] && isValidIdlDate(dateMatch[1])) {
    out.Date = field(dateMatch[1], CONFIDENCE.GLOBAL, "global_regex");
  }

  const nameMatch = text.match(/\b([A-Z]{2,}\s+[A-Z]{2,}\s+[A-Z]{2,})\b/);
  if (nameMatch?.[1]) {
    const name = refineIdlName(nameMatch[1]);
    if (isValidIdlName(name)) {
      out.Name = field(name, CONFIDENCE.GLOBAL, "global_regex");
    }
  }

  return out;
}

function mergeTierMaps(
  base: Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>>,
  ...maps: Array<Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>>>
): Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>> {
  const merged = { ...base };
  for (const map of maps) {
    for (const key of ["Name", "ID_Number", "Date", "IDL_No"] as const) {
      if (map[key]) {
        merged[key] = pickHigher(merged[key] ?? field(null, 0, "none"), map[key]!);
      }
    }
  }
  return merged;
}

function structuredToFormRow(structured: Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>>): IdlFormRow {
  return finalizeIdlFormRow({
    name: structured.Name?.value ?? "",
    idNumber: structured.ID_Number?.value ?? "",
    date: structured.Date?.value ?? "",
    idlNo: structured.IDL_No?.value ?? "",
  });
}

function computeOverallConfidence(fields: IdlFieldExtraction[]): number {
  const scored = fields.filter((f) => f.value);
  if (!scored.length) return 0;
  return scored.reduce((sum, f) => sum + f.confidence, 0) / scored.length;
}

export type ExtractIdlDocumentInput = {
  rawText: string;
  layoutTokens?: Parameters<typeof groupTokensIntoLines>[0];
  extraTexts?: string[];
};

export function extractIdlDocument(input: ExtractIdlDocumentInput): IdlStructuredOutput {
  const texts = [input.rawText, ...(input.extraTexts ?? [])].filter(Boolean);
  const combined = texts.join("\n");

  let structured: Partial<Record<keyof IdlStructuredOutput, IdlFieldExtraction>> = {};

  if (input.layoutTokens?.length) {
    const lines = groupTokensIntoLines(input.layoutTokens);
    structured = mergeTierMaps(structured, tier1FromLayout(lines));
  }

  for (const source of texts) {
    structured = mergeTierMaps(structured, tier2FromText(source));
  }

  const partial = structuredToFormRow(structured);
  structured = mergeTierMaps(structured, tier3Contextual(combined, partial));
  structured = mergeTierMaps(structured, tier4Global(combined));

  const fields = [
    structured.Name ?? field(null, 0, "none"),
    structured.ID_Number ?? field(null, 0, "none"),
    structured.Date ?? field(null, 0, "none"),
    structured.IDL_No ?? field(null, 0, "none"),
  ];

  const overallConfidence = computeOverallConfidence(fields);
  const needsReview = overallConfidence < REVIEW_THRESHOLD || fields.some((f) => !f.value);

  return {
    Name: structured.Name ?? field(null, 0, "none"),
    ID_Number: structured.ID_Number ?? field(null, 0, "none"),
    Date: structured.Date ?? field(null, 0, "none"),
    IDL_No: structured.IDL_No ?? field(null, 0, "none"),
    overallConfidence,
    needsReview,
  };
}

export function structuredIdlToFormRow(structured: IdlStructuredOutput): IdlFormRow {
  return finalizeIdlFormRow({
    name: structured.Name.value ?? "",
    idNumber: structured.ID_Number.value ?? "",
    date: structured.Date.value ?? "",
    idlNo: structured.IDL_No.value ?? "",
  });
}

export function mergeStructuredWithParsed(
  structured: IdlStructuredOutput,
  parsedRows: IdlFormRow[],
): IdlFormRow {
  const fromStructured = structuredIdlToFormRow(structured);
  return finalizeIdlFormRow(mergeIdlFormRows([fromStructured, ...parsedRows]));
}
