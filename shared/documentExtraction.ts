import type { NtsaFormRow } from "./ntsaExtraction";

export type DocumentTypeId = "ntsa_test_form" | "ntsa_receipt" | "ntsa_interim_license";

export type ExtractionFieldId =
  | "sourcePage"
  | "name"
  | "idNumber"
  | "date"
  | "testApplicationNumber"
  | "amount"
  | "applicationNo"
  | "billReferenceNo"
  | "totalKes"
  | "idlNo";

export type FieldDefinition = {
  id: ExtractionFieldId;
  label: string;
  description: string;
};

export type DocumentTypeDefinition = {
  id: DocumentTypeId;
  label: string;
  description: string;
  fields: FieldDefinition[];
  defaultEnabledFields: ExtractionFieldId[];
};

const SOURCE_PAGE_FIELD: FieldDefinition = {
  id: "sourcePage",
  label: "Source Page",
  description: "Page number from upload order",
};

const TEST_FORM_FIELDS: FieldDefinition[] = [
  { id: "name", label: "Name", description: "Applicant full name (exactly 3 words)" },
  { id: "idNumber", label: "ID Number", description: "Digits after ID NO: on the form" },
  { id: "date", label: "Date", description: "Printed document date" },
];

const IDL_FIELDS: FieldDefinition[] = [
  { id: "name", label: "Name", description: "Full name on the interim license" },
  {
    id: "idNumber",
    label: "ID Number",
    description: "Digits after ID Number: on the license",
  },
  { id: "date", label: "From Date", description: "License start date (From Date)" },
  {
    id: "idlNo",
    label: "IDL No",
    description: "IDL-… code below National Transport and Safety Authority",
  },
];

/** Receipt prints the label exactly as "ID No:" (not "ID Number"). */
const RECEIPT_FIELDS: FieldDefinition[] = [
  { id: "name", label: "Name", description: "Applicant full name (exactly 3 words)" },
  {
    id: "idNumber",
    label: "ID No",
    description: "Digits after ID No: below the RECEIPT PAID banner (left)",
  },
  { id: "date", label: "Date", description: "Printed document date" },
];

export const DOCUMENT_TYPES: Record<DocumentTypeId, DocumentTypeDefinition> = {
  ntsa_test_form: {
    id: "ntsa_test_form",
    label: "NTSA Test Application Form",
    description: "Driving test application form with TDB reference",
    fields: [
      SOURCE_PAGE_FIELD,
      ...TEST_FORM_FIELDS,
      {
        id: "testApplicationNumber",
        label: "Test Application Number",
        description: "TDB-… code from the form heading",
      },
      { id: "amount", label: "Amount (KES)", description: "Fee paid on the form" },
    ],
    defaultEnabledFields: [
      "sourcePage",
      "name",
      "idNumber",
      "testApplicationNumber",
      "amount",
      "date",
    ],
  },
  ntsa_receipt: {
    id: "ntsa_receipt",
    label: "NTSA Payment Receipt",
    description: "eCitizen / NTSA receipt (RECEIPT PAID)",
    fields: [
      SOURCE_PAGE_FIELD,
      ...RECEIPT_FIELDS,
      {
        id: "applicationNo",
        label: "Application No",
        description: "PDL-… or similar application code",
      },
      {
        id: "billReferenceNo",
        label: "Bill Reference No",
        description: "Center header code under BILL REFERENCE NO (e.g. MM4R4Q3)",
      },
      { id: "totalKes", label: "Total KES", description: "Total amount on the receipt" },
    ],
    defaultEnabledFields: [
      "sourcePage",
      "name",
      "idNumber",
      "applicationNo",
      "billReferenceNo",
      "date",
      "totalKes",
    ],
  },
  ntsa_interim_license: {
    id: "ntsa_interim_license",
    label: "Interim Driving License",
    description: "NTSA interim driving license (IDL)",
    fields: [SOURCE_PAGE_FIELD, ...IDL_FIELDS],
    defaultEnabledFields: ["sourcePage", "name", "idNumber", "idlNo", "date"],
  },
};

export type IdlFormRow = {
  name: string;
  idNumber: string;
  idlNo: string;
  date: string;
};

/** Interim license cards have no fee line — drop amount from saved column lists. */
export function normalizeInterimSessionMeta(meta: ExtractionSessionMeta): ExtractionSessionMeta {
  if (meta.documentType !== "ntsa_interim_license") return meta;
  return {
    documentType: meta.documentType,
    enabledFields: meta.enabledFields.filter((field) => field !== "amount"),
  };
}

export type ReceiptFormRow = {
  name: string;
  idNumber: string;
  applicationNo: string;
  billReferenceNo: string;
  totalKes: string;
  date: string;
};

export type ExtractionFormRow = NtsaFormRow &
  Partial<ReceiptFormRow> &
  Partial<IdlFormRow> & {
    documentType?: DocumentTypeId;
  };

export type ExtractionSessionRow = ExtractionFormRow & {
  sourcePage: number;
};

export type ExtractionSessionMeta = {
  documentType: DocumentTypeId;
  enabledFields: ExtractionFieldId[];
};

export type DocumentClassification = {
  type: DocumentTypeId;
  confidence: number;
  scores: Record<DocumentTypeId, number>;
};

const TEST_FORM_MARKERS: Array<[RegExp, number]> = [
  [/TEST\s+APPLICATION\s+FORM/i, 30],
  [/\bTDB[-\s]?[A-Z0-9]{6,}/i, 35],
  [/Driving\s+Test\s+allocated/i, 25],
  [/Fee\s+Paid\s*[-–]?\s*KES/i, 20],
  [/provisional\s+driving\s+licen/i, 12],
  [/vehicle\s+class/i, 8],
];

const RECEIPT_MARKERS: Array<[RegExp, number]> = [
  [/RECEIPT\s+PAID/i, 35],
  [/CUSTOMER\s+COPY/i, 20],
  [/APPLICATION\s+NO\s*:/i, 25],
  [/BILL\s+REFERENCE\s+NO/i, 25],
  [/\bPDL[-\s]?[A-Z0-9]{6,}/i, 30],
  [/Total\s+KES/i, 20],
  [/Powered\s+by\s+Pesaflow/i, 15],
  [/eCitizen/i, 10],
  [/Convenience\s+fee/i, 12],
];

const IDL_MARKERS: Array<[RegExp, number]> = [
  [/INTERIM\s+DRIVING\s+LICEN[CS]E/i, 40],
  [/\bIDL[-\s]?[A-Z0-9]{6,}/i, 35],
  [/To\s+drive\s+class/i, 22],
  [/From\s+Date/i, 18],
  [/Expiry\s+Date/i, 15],
  [/Full\s+Name/i, 12],
  [/ID\s+Number/i, 12],
  [/NATIONAL\s+TRANSPORT/i, 8],
];

function scoreMarkers(text: string, markers: Array<[RegExp, number]>): number {
  const normalized = text.replace(/\s+/g, " ");
  let score = 0;
  for (const [pattern, weight] of markers) {
    if (pattern.test(normalized)) score += weight;
  }
  return score;
}

/** Classify OCR text as test form, payment receipt, or interim driving license. */
export function classifyDocumentFromOcr(text: string): DocumentClassification {
  const scores: Record<DocumentTypeId, number> = {
    ntsa_test_form: scoreMarkers(text, TEST_FORM_MARKERS),
    ntsa_receipt: scoreMarkers(text, RECEIPT_MARKERS),
    ntsa_interim_license: scoreMarkers(text, IDL_MARKERS),
  };

  const ranked = (Object.entries(scores) as Array<[DocumentTypeId, number]>).sort(
    (a, b) => b[1] - a[1],
  );
  const type = ranked[0]?.[0] ?? "ntsa_test_form";
  const winner = scores[type];
  const runnerUp = ranked[1]?.[1] ?? 0;
  const confidence = winner > 0 ? Math.min(100, Math.round(((winner - runnerUp) / winner) * 100)) : 0;

  return { type, confidence, scores };
}

export function getDocumentTypeDefinition(type: DocumentTypeId): DocumentTypeDefinition {
  return DOCUMENT_TYPES[type];
}

export function getFieldLabel(type: DocumentTypeId, fieldId: ExtractionFieldId): string {
  const def = DOCUMENT_TYPES[type].fields.find((f) => f.id === fieldId);
  return def?.label ?? fieldId;
}

export function getEnabledHeaders(meta: ExtractionSessionMeta): string[] {
  const typeDef = DOCUMENT_TYPES[meta.documentType];
  return meta.enabledFields
    .map((fieldId) => typeDef.fields.find((f) => f.id === fieldId)?.label)
    .filter((label): label is string => Boolean(label));
}

export function getRowFieldValue(
  row: ExtractionSessionRow,
  fieldId: ExtractionFieldId,
): string | number {
  switch (fieldId) {
    case "sourcePage":
      return row.sourcePage;
    case "name":
      return row.name;
    case "idNumber":
      return row.idNumber;
    case "date":
      return row.date;
    case "testApplicationNumber":
      return row.testApplicationNumber;
    case "amount":
      return row.amount;
    case "applicationNo":
      return row.applicationNo ?? "";
    case "billReferenceNo":
      return row.billReferenceNo ?? "";
    case "totalKes":
      return row.totalKes ?? row.amount ?? "";
    case "idlNo":
      return row.idlNo ?? "";
    default:
      return "";
  }
}

export function setRowFieldValue(
  row: ExtractionSessionRow,
  fieldId: ExtractionFieldId,
  value: string,
): ExtractionSessionRow {
  switch (fieldId) {
    case "sourcePage": {
      const parsed = Number(value.trim());
      if (!Number.isFinite(parsed) || parsed < 1) return row;
      return { ...row, sourcePage: Math.floor(parsed) };
    }
    case "name":
      return { ...row, name: value };
    case "idNumber":
      return { ...row, idNumber: value };
    case "date":
      return { ...row, date: value };
    case "testApplicationNumber":
      return { ...row, testApplicationNumber: value };
    case "amount":
      return { ...row, amount: value };
    case "applicationNo":
      return { ...row, applicationNo: value };
    case "billReferenceNo":
      return { ...row, billReferenceNo: value };
    case "totalKes":
      return { ...row, totalKes: value };
    case "idlNo":
      return { ...row, idlNo: value };
    default:
      return row;
  }
}

export function normalizeExtractionSessionRow(
  raw: unknown,
  index: number,
): ExtractionSessionRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    sourcePage: typeof row.sourcePage === "number" ? row.sourcePage : index + 1,
    name: String(row.name ?? ""),
    idNumber: String(row.idNumber ?? ""),
    testApplicationNumber: String(row.testApplicationNumber ?? ""),
    amount: String(row.amount ?? ""),
    date: String(row.date ?? ""),
    applicationNo: row.applicationNo != null ? String(row.applicationNo) : undefined,
    billReferenceNo: row.billReferenceNo != null ? String(row.billReferenceNo) : undefined,
    totalKes: row.totalKes != null ? String(row.totalKes) : undefined,
    idlNo: row.idlNo != null ? String(row.idlNo) : undefined,
    documentType:
      row.documentType === "ntsa_receipt" ||
      row.documentType === "ntsa_test_form" ||
      row.documentType === "ntsa_interim_license"
        ? row.documentType
        : undefined,
  };
}

export function normalizeSessionMetaFromStorage(raw: unknown): ExtractionSessionMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const documentType = data.documentType;
  if (
    documentType !== "ntsa_receipt" &&
    documentType !== "ntsa_test_form" &&
    documentType !== "ntsa_interim_license"
  ) {
    return null;
  }
  const fieldsRaw = data.enabledFields;
  if (!Array.isArray(fieldsRaw)) {
    return defaultSessionMeta(documentType);
  }
  const enabledFields = fieldsRaw.filter((field): field is ExtractionFieldId => typeof field === "string");
  return {
    documentType,
    enabledFields: sanitizeEnabledFields(documentType, enabledFields),
  };
}

export function inferDocumentTypeFromRow(row: ExtractionSessionRow): DocumentTypeId {
  if (row.documentType) return row.documentType;
  if (row.idlNo?.trim()) return "ntsa_interim_license";
  if (row.applicationNo?.trim() || row.billReferenceNo?.trim()) return "ntsa_receipt";
  return "ntsa_test_form";
}

/** Pick the dominant document type across all rows in a saved spreadsheet. */
export function inferDocumentTypeFromRows(rows: ExtractionSessionRow[]): DocumentTypeId {
  if (!rows.length) return "ntsa_test_form";
  const counts: Record<DocumentTypeId, number> = {
    ntsa_test_form: 0,
    ntsa_receipt: 0,
    ntsa_interim_license: 0,
  };
  for (const row of rows) {
    counts[inferDocumentTypeFromRow(row)] += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "ntsa_test_form") as DocumentTypeId;
}

export const HISTORY_FOLDER_SLUGS: Record<DocumentTypeId, string> = {
  ntsa_test_form: "test-application-forms",
  ntsa_receipt: "payment-receipts",
  ntsa_interim_license: "interim-driving-licenses",
};

export function historyFolderSlug(documentType: DocumentTypeId): string {
  return HISTORY_FOLDER_SLUGS[documentType];
}

/** Prefix save name with a document-type folder (e.g. payment-receipts/extraction). */
export function historySaveBaseName(documentType: DocumentTypeId, userBaseName: string): string {
  const cleaned = userBaseName.trim().replace(/^\/+|\/+$/g, "") || "extraction";
  const slug = historyFolderSlug(documentType);
  if (cleaned === slug || cleaned.startsWith(`${slug}/`)) return cleaned;
  return `${slug}/${cleaned}`;
}

/** Infer which columns had data when sessionMeta was not stored (legacy saves). */
export function inferEnabledFieldsFromRows(
  rows: ExtractionSessionRow[],
  documentType: DocumentTypeId,
): ExtractionFieldId[] {
  const typeDef = DOCUMENT_TYPES[documentType];
  const withData = new Set<ExtractionFieldId>(["sourcePage"]);
  for (const row of rows) {
    for (const field of typeDef.fields) {
      const val = getRowFieldValue(row, field.id);
      if (String(val).trim()) withData.add(field.id);
    }
  }
  const merged = new Set<ExtractionFieldId>([...typeDef.defaultEnabledFields, ...withData]);
  return typeDef.fields.map((f) => f.id).filter((id) => merged.has(id));
}

/** Add newly introduced default columns to legacy saved field lists. */
export function mergeLegacyDefaultFields(
  documentType: DocumentTypeId,
  enabledFields: ExtractionFieldId[],
): ExtractionFieldId[] {
  const typeDef = DOCUMENT_TYPES[documentType];
  const merged = new Set<ExtractionFieldId>([...typeDef.defaultEnabledFields, ...enabledFields]);
  return typeDef.fields.map((f) => f.id).filter((id) => merged.has(id));
}

/**
 * Resolve spreadsheet columns for rows — uses stored sessionMeta when present,
 * otherwise saved field prefs, otherwise columns inferred from row data.
 */
export function resolveSessionMetaForRows(
  rows: ExtractionSessionRow[],
  storedMeta?: ExtractionSessionMeta | null,
  savedEnabledFields?: ExtractionFieldId[] | null,
): ExtractionSessionMeta | null {
  if (!rows.length) return null;

  const documentType = inferDocumentTypeFromRows(rows);

  if (storedMeta?.documentType === documentType) {
    return normalizeInterimSessionMeta({
      documentType,
      enabledFields: sanitizeEnabledFields(
        documentType,
        mergeLegacyDefaultFields(documentType, storedMeta.enabledFields),
      ),
    });
  }

  if (savedEnabledFields?.length) {
    return normalizeInterimSessionMeta({
      documentType,
      enabledFields: sanitizeEnabledFields(documentType, savedEnabledFields),
    });
  }

  return normalizeInterimSessionMeta({
    documentType,
    enabledFields: inferEnabledFieldsFromRows(rows, documentType),
  });
}

export function inferSessionMetaFromRows(rows: ExtractionSessionRow[]): ExtractionSessionMeta | null {
  return resolveSessionMetaForRows(rows, null, null);
}

export function defaultSessionMeta(type: DocumentTypeId): ExtractionSessionMeta {
  return {
    documentType: type,
    enabledFields: [...DOCUMENT_TYPES[type].defaultEnabledFields],
  };
}

export function sanitizeEnabledFields(
  type: DocumentTypeId,
  fields: ExtractionFieldId[],
): ExtractionFieldId[] {
  const allowed = new Set(DOCUMENT_TYPES[type].fields.map((f) => f.id));
  const picked = fields.filter((id) => allowed.has(id));
  if (picked.length > 0) return picked;
  return [...DOCUMENT_TYPES[type].defaultEnabledFields];
}
