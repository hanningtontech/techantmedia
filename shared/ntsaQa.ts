import { formatAmountKes, parseAmountKes, type NtsaFormRow, type NtsaSessionRow } from "./ntsaExtraction";

export type QaFieldKey = keyof NtsaFormRow;

export const QA_FIELD_LABELS: Record<QaFieldKey, string> = {
  name: "Name",
  idNumber: "ID Number",
  testApplicationNumber: "Application No",
  amount: "Amount",
  date: "Date",
};

export type QaErrorType =
  | "OCR Misinterpretation"
  | "Positional Failure"
  | "Preprocessing Issues"
  | "Parsing Logic Errors"
  | "Handwriting Interference"
  | "Missing Extraction";

const OCR_CONFUSIONS: Array<[string, string]> = [
  ["0", "O"],
  ["0", "D"],
  ["1", "I"],
  ["1", "L"],
  ["5", "S"],
  ["8", "B"],
  ["6", "G"],
  ["2", "Z"],
  ["M", "N"],
];

const HANDWRITING_MARKERS =
  /\b(NATIONAL|TRANSPORT|SAFETY|AUTHORITY|NTSA|REPUBLIC|KENYA|VEHICLE|CLASS|DRIVING|SCHOOL)\b/i;

function normalizeField(field: QaFieldKey, value: string): string {
  const v = value.trim();
  switch (field) {
    case "name":
      return v.toUpperCase().replace(/\s+/g, " ");
    case "idNumber":
      return v.replace(/\D/g, "");
    case "testApplicationNumber":
      return v.toUpperCase().replace(/\s+/g, "").replace(/^TD8/, "TDB");
    case "amount":
      return String(parseAmountKes(v));
    case "date":
      return v.replace(/\s+/g, " ").toLowerCase();
    default:
      return v;
  }
}

function fieldsMatch(field: QaFieldKey, extracted: string, actual: string): boolean {
  const a = normalizeField(field, extracted);
  const b = normalizeField(field, actual);
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a === b;
}

function hasOcrConfusion(a: string, b: string): boolean {
  const left = a.toUpperCase();
  const right = b.toUpperCase();
  if (left.length !== right.length) return false;
  let swaps = 0;
  for (let i = 0; i < left.length; i += 1) {
    const c1 = left[i]!;
    const c2 = right[i]!;
    if (c1 === c2) continue;
    const confused = OCR_CONFUSIONS.some(
      ([x, y]) => (c1 === x && c2 === y) || (c1 === y && c2 === x),
    );
    if (!confused) return false;
    swaps += 1;
  }
  return swaps > 0;
}

function categorizeError(
  field: QaFieldKey,
  extracted: string,
  actual: string,
  ocrSnippet: string,
): { errorType: QaErrorType; explanation: string } {
  const ex = extracted.trim();
  const ac = actual.trim();

  if (!ex && ac) {
    if (field === "name" && /(?:I|1)\s+[A-Z]/i.test(ocrSnippet) && !/ID\s*NO|DNO/i.test(ocrSnippet)) {
      return {
        errorType: "Positional Failure",
        explanation:
          "OCR captured declaration text but the parser did not anchor on the name between “I” and “ID NO”.",
      };
    }
    return {
      errorType: "Missing Extraction",
      explanation: "The field was present on the form but returned empty after OCR and parsing.",
    };
  }

  if (field === "name" && (HANDWRITING_MARKERS.test(ex) || HANDWRITING_MARKERS.test(ac))) {
    return {
      errorType: "Handwriting Interference",
      explanation:
        "Header, stamp, or handwritten annotation text was captured instead of the applicant name after “I”.",
    };
  }

  if (hasOcrConfusion(normalizeField(field, ex), normalizeField(field, ac))) {
    return {
      errorType: "OCR Misinterpretation",
      explanation:
        "Likely OCR character confusion (for example 5/S, O/0, I/1, or B/8) between the spreadsheet and the re-read form.",
    };
  }

  if (field === "name" && ac && ex && ac.includes(ex)) {
    return {
      errorType: "Parsing Logic Errors",
      explanation: "Only part of the applicant name was captured before parsing stopped at “ID NO”.",
    };
  }

  if (field === "idNumber" && ac.replace(/\D/g, "").includes(ex.replace(/\D/g, "")) && ex) {
    return {
      errorType: "Parsing Logic Errors",
      explanation: "ID digits were truncated — spaced OCR digits may not have been merged fully.",
    };
  }

  if (/[|~`^]/.test(ocrSnippet) || ocrSnippet.split("\n").length > 12) {
    return {
      errorType: "Preprocessing Issues",
      explanation:
        "Noisy scan, skew, or low contrast likely degraded OCR before field parsing could run reliably.",
    };
  }

  if (field === "testApplicationNumber" && /[SO]/i.test(ex) !== /[SO]/i.test(ac)) {
    return {
      errorType: "OCR Misinterpretation",
      explanation: "Application number differs by easily confused characters such as S/5 or O/0.",
    };
  }

  return {
    errorType: "Parsing Logic Errors",
    explanation: "Extracted value does not match the form after normalization and field-specific parsing rules.",
  };
}

export type QaErrorLogEntry = {
  rowNumber: number;
  sourcePage: number;
  field: string;
  extractedValue: string;
  actualValue: string;
  errorType: QaErrorType;
  technicalExplanation: string;
};

export type QaSummaryMetric = {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
};

export type QaAuditReport = {
  summary: Record<QaFieldKey, QaSummaryMetric>;
  errors: QaErrorLogEntry[];
  recommendations: string[];
  auditedRows: number;
  sourceCount: number;
};

export function buildQaAuditReport(args: {
  excelRows: NtsaSessionRow[];
  actualByPage: Map<number, { row: NtsaFormRow; ocrText: string; label: string }>;
}): QaAuditReport {
  const fields: QaFieldKey[] = [
    "name",
    "idNumber",
    "testApplicationNumber",
    "amount",
    "date",
  ];

  const summary = Object.fromEntries(
    fields.map((f) => [f, { total: 0, correct: 0, incorrect: 0, accuracy: 0 }]),
  ) as Record<QaFieldKey, QaSummaryMetric>;

  const errors: QaErrorLogEntry[] = [];
  const errorTypeCounts = new Map<QaErrorType, number>();

  const excelByPage = new Map(args.excelRows.map((r) => [r.sourcePage, r]));

  for (const [page, actual] of args.actualByPage) {
    const excelRow = excelByPage.get(page);
    const rowNumber = excelRow?.sourcePage ?? page;

    for (const field of fields) {
      summary[field].total += 1;
      const extractedValue = excelRow ? String(excelRow[field] ?? "") : "";
      const actualValue = String(actual.row[field] ?? "");

      if (fieldsMatch(field, extractedValue, actualValue)) {
        summary[field].correct += 1;
        continue;
      }

      summary[field].incorrect += 1;
      const { errorType, explanation } = categorizeError(
        field,
        extractedValue,
        actualValue,
        actual.ocrText,
      );
      errorTypeCounts.set(errorType, (errorTypeCounts.get(errorType) ?? 0) + 1);

      errors.push({
        rowNumber,
        sourcePage: page,
        field: QA_FIELD_LABELS[field],
        extractedValue: field === "amount" ? formatAmountKes(extractedValue) || "—" : extractedValue || "—",
        actualValue: field === "amount" ? formatAmountKes(actualValue) || "—" : actualValue || "—",
        errorType,
        technicalExplanation: excelRow
          ? explanation
          : `${explanation} No spreadsheet row matched source page ${page}.`,
      });
    }
  }

  for (const field of fields) {
    const m = summary[field];
    m.accuracy = m.total ? Math.round((m.correct / m.total) * 1000) / 10 : 0;
  }

  const recommendations = buildRecommendations(errorTypeCounts, errors);

  return {
    summary,
    errors,
    recommendations,
    auditedRows: args.excelRows.length,
    sourceCount: args.actualByPage.size,
  };
}

function buildRecommendations(
  errorTypeCounts: Map<QaErrorType, number>,
  errors: QaErrorLogEntry[],
): string[] {
  const tips: string[] = [];

  if ((errorTypeCounts.get("OCR Misinterpretation") ?? 0) > 0) {
    tips.push(
      "Increase scan resolution and add post-OCR correction for TDB application numbers (O/0, S/5, I/1).",
    );
  }
  if ((errorTypeCounts.get("Positional Failure") ?? 0) > 0) {
    tips.push(
      "Strengthen declaration anchoring: always read the name strictly between “I” and “ID NO”, immediately after the TDB reference.",
    );
  }
  if ((errorTypeCounts.get("Preprocessing Issues") ?? 0) > 0) {
    tips.push(
      "Crop out header stamps and handwritten marks before OCR, and avoid harsh binarization on phone photos.",
    );
  }
  if ((errorTypeCounts.get("Parsing Logic Errors") ?? 0) > 0) {
    tips.push(
      "Relax name capture to include apostrophes and multi-word names; merge spaced ID digits before validation.",
    );
  }
  if ((errorTypeCounts.get("Handwriting Interference") ?? 0) > 0) {
    tips.push(
      "Ignore organization/header lines (NTSA, TRANSPORT, AUTHORITY) when resolving applicant names.",
    );
  }
  if ((errorTypeCounts.get("Missing Extraction") ?? 0) > 0) {
    tips.push(
      "Re-process failed pages individually with a clearer photo and verify the Excel row maps to the correct source page.",
    );
  }

  const nameErrors = errors.filter((e) => e.field === "Name").length;
  if (nameErrors >= 3) {
    tips.push("Name accuracy is a recurring issue — prioritize the I → NAME → ID NO sentence on every form.");
  }

  if (!tips.length) {
    tips.push("No systematic errors detected in this audit batch. Current extraction settings appear reliable for these sources.");
  }

  return tips;
}
