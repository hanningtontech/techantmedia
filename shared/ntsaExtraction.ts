export type NtsaFormRow = {
  name: string;
  idNumber: string;
  testApplicationNumber: string;
  amount: string;
  date: string;
};

export type NtsaSessionRow = NtsaFormRow & {
  sourcePage: number;
};

export const NTSA_EXCEL_HEADERS = [
  "Source Page",
  "Name",
  "ID Number",
  "Test Application Number",
  "Amount (KES)",
  "Date",
] as const;

/** Shown when a field cannot be read reliably — never guess. */
export const REVIEW_REQUIRED = "REVIEW_REQUIRED";

export const TEST_APPLICATION_NUMBER_PATTERN = /^TDB-[A-Z0-9]+$/;

/** Canonical extraction rules (OCR + validation). */
export const NTSA_EXTRACTION_RULES = `You are extracting structured data from scanned Kenyan NTSA Test Application Forms. Each page normally contains one form. Extract exactly one row per page/image. Do not duplicate rows. Do not leave blank rows.

Output only these columns in this exact order:
Source Page | Name | ID Number | Test Application Number | Amount (KES) | Date

1. Source Page — page/image number from input order.
2. Name — applicant full name from the declaration sentence near the top. Remove leading markers. Exclude test-application fragments (AEV, EL, QE, RE, JA, EE, AQ, CM, ZP, VFLLLKA, BZEL, W). No placeholder values like 11. If unclear: ${REVIEW_REQUIRED}.
3. ID Number — digits immediately after "ID NO:". Reject driving-school codes, licence numbers, QR values. If unreadable: ${REVIEW_REQUIRED}.
4. Test Application Number — full code from "TEST APPLICATION FORM -" (normally TDB-…). Distinguish O/0, B/8, Z/2, R/P, I/1. If unclear: ${REVIEW_REQUIRED}.
5. Amount (KES) — value after "Fee Paid - KES:" as plain number (e.g. 1050).
6. Date — printed date after "Driving Test allocated as follows Date:". Format DD Month YYYY. Ignore handwritten dates. Watch 2025 vs 2028 misreads.
7. Ignore handwritten notes, signatures, photos, QR codes, logos, school codes, licence numbers, vehicle class, and location text unless part of requested fields.
8. Validate: all six columns present; TDB-[A-Z0-9]+; numeric amount; ID not 11/blank/placeholder; date from printed driving-test line. Use ${REVIEW_REQUIRED} instead of guessing.`;

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

const MONTH_INDEX: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const ORG_WORDS =
  /\b(NATIONAL|TRANSPORT|SAFETY|AUTHORITY|NTSA|REPUBLIC|KENYA|DRIVING|SCHOOL|VEHICLE|CLASS|APPLICATION|FORM|PROVISIONAL|LICENCE|LICENSE|HOLDING|REQUIRE|UNDERGO|RESPECT|ALLOCATED|FOLLOWS|COMPUTER|GENERATED|SIGNATURE|AUTHORIZED|FEE|PAID)\b/i;

const NAME_FRAGMENT_WORDS = new Set([
  "AEV",
  "EL",
  "QE",
  "RE",
  "JA",
  "EE",
  "AQ",
  "CM",
  "ZP",
  "VFLLLKA",
  "BZEL",
  "W",
  "TDB",
  "TD8",
  "11",
]);

export function parseAmountKes(amount: string): number {
  const digits = amount.replace(/\D/g, "");
  const value = Number(digits);
  return Number.isFinite(value) ? value : 0;
}

/** Display formatting for UI tables (with thousands separators). */
export function formatAmountKes(amount: string): string {
  const value = parseAmountKes(amount);
  return value ? value.toLocaleString("en-US") : "";
}

/** Plain numeric amount for Excel export (no commas). */
export function formatAmountPlain(amount: string): string {
  const value = parseAmountKes(amount);
  return value > 0 ? String(value) : "";
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const EXPECTED_NAME_WORDS = 3;

function isAlphanumericCodeWord(word: string): boolean {
  if (word.length < 3) return false;
  if (/^\d/.test(word)) return true;
  if (/\d/.test(word) && /^[A-Z0-9]+$/.test(word)) return true;
  if (/^[A-Z0-9]{5,}$/.test(word) && /\d/.test(word)) return true;
  return false;
}

function isNameNoiseWord(word: string): boolean {
  if (!word) return true;
  if (NAME_FRAGMENT_WORDS.has(word)) return true;
  if (word.length === 1) return true;
  if (isAlphanumericCodeWord(word)) return true;
  return false;
}

function cleanName(value: string): string {
  let name = value
    .replace(/[|_]/g, " ")
    .replace(/^[\s•\-*.\d]+/, "")
    .replace(/^(?:I|l|1)\s+/, "")
    .replace(/\bTDB[-\s]?[A-Z0-9]+\b/gi, " ")
    .replace(/[^A-Za-z\s'./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  name = name
    .split(/\s+/)
    .filter((word) => word && !NAME_FRAGMENT_WORDS.has(word))
    .join(" ");

  return name;
}

function scrubNameAgainstTestApp(name: string, testApplicationNumber: string): string {
  let words = name.split(/\s+/).filter(Boolean);
  if (!words.length) return name;

  const suffix = testApplicationNumber.replace(/^TDB-?/i, "").toUpperCase();
  if (suffix) {
    const first = words[0]!;
    const overlapsSuffix =
      first === suffix ||
      suffix === first ||
      (first.length >= 4 && (suffix.includes(first) || first.includes(suffix))) ||
      (first.length >= 4 && suffix.endsWith(first)) ||
      (first.length >= 4 && first.endsWith(suffix.slice(-Math.min(6, suffix.length))));

    if (overlapsSuffix || isAlphanumericCodeWord(first)) {
      words = words.slice(1);
    } else {
      const suffixNoDigits = suffix.replace(/^\d+/, "");
      if (suffixNoDigits.length >= 4 && (first === suffixNoDigits || first.includes(suffixNoDigits))) {
        words = words.slice(1);
      }
    }
  }

  while (words.length && isNameNoiseWord(words[0]!)) {
    words = words.slice(1);
  }

  return words.join(" ");
}

function trimToThreeNameWords(name: string): string {
  const words = name.split(/\s+/).filter((word) => word && !isNameNoiseWord(word));
  if (words.length <= EXPECTED_NAME_WORDS) return words.join(" ");
  return words.slice(0, EXPECTED_NAME_WORDS).join(" ");
}

/** Strip test-application codes and normalize to exactly three name words. */
export function refineNtsaName(name: string, testApplicationNumber = ""): string {
  const cleaned = cleanName(name);
  const scrubbed = scrubNameAgainstTestApp(cleaned, normalizeTestAppNumber(testApplicationNumber));
  return trimToThreeNameWords(scrubbed);
}

function collapseDigits(value: string): string {
  return value.replace(/\s+/g, "").replace(/\D/g, "");
}

function normalizeTestAppNumber(raw: string): string {
  let value = raw.toUpperCase().replace(/\s+/g, "");
  value = value.replace(/^TD8/, "TDB");
  value = value.replace(/^TDBM/, "TDB-M");
  value = value.replace(/^TDB-?MOB/, "TDB-M08");
  if (value.startsWith("TDB") && !value.includes("-")) {
    value = `TDB-${value.slice(3)}`;
  }
  return value;
}

function applyTestAppSuffixCorrections(code: string): string {
  if (TEST_APPLICATION_NUMBER_PATTERN.test(code)) return code;

  const [prefix, suffix = ""] = code.includes("-") ? code.split("-", 2) : ["TDB", code.replace(/^TDB/, "")];
  const variants = new Set<string>([code]);

  const chars = suffix.split("");
  const swaps: Array<[string, string]> = [
    ["O", "0"],
    ["0", "O"],
    ["B", "8"],
    ["8", "B"],
    ["Z", "2"],
    ["2", "Z"],
    ["R", "P"],
    ["P", "R"],
    ["I", "1"],
    ["1", "I"],
  ];

  for (let i = 0; i < chars.length; i += 1) {
    for (const [from, to] of swaps) {
      if (chars[i] !== from) continue;
      const next = [...chars];
      next[i] = to;
      variants.add(`${prefix}-${next.join("")}`);
    }
  }

  for (const candidate of variants) {
    const normalized = normalizeTestAppNumber(candidate);
    if (TEST_APPLICATION_NUMBER_PATTERN.test(normalized)) return normalized;
  }

  return normalizeTestAppNumber(code);
}

function findTestApplicationNumber(text: string, headerText?: string): string {
  const sources = [headerText, text].filter(Boolean) as string[];

  for (const source of sources) {
    const normalized = normalizeWhitespace(source);

    const heading = normalized.match(
      /TEST\s+APPLICATION\s+FORM\s*[-–]\s*(TDB[-\s]?[A-Z0-9]{6,16})/i,
    );
    if (heading?.[1]) {
      return applyTestAppSuffixCorrections(normalizeTestAppNumber(heading[1]));
    }

    const compact = normalized.match(/\b(TDB[-\s]?[A-Z0-9]{6,16})\b/i);
    if (compact?.[1]) {
      return applyTestAppSuffixCorrections(normalizeTestAppNumber(compact[1]));
    }

    const td8 = normalized.match(/\b(TD8[-\s]?[A-Z0-9]{6,16})\b/i);
    if (td8?.[1]) {
      return applyTestAppSuffixCorrections(normalizeTestAppNumber(td8[1]));
    }

    const spaced = normalized.match(
      /\bT\s*D\s*B\s*[-\s]?\s*([A-Z0-9](?:\s+[A-Z0-9]){5,15})(?:\s+(?:I|1|l)\b|\s+[A-Z])/i,
    );
    if (spaced?.[1]) {
      const code = spaced[1].replace(/\s+/g, "");
      if (code.length >= 6) {
        return applyTestAppSuffixCorrections(normalizeTestAppNumber(`TDB-${code}`));
      }
    }
  }

  return "";
}

function isLikelyPersonName(name: string): boolean {
  if (!name || name === "11" || name === REVIEW_REQUIRED) return false;
  if (name.length < 5) return false;
  if (ORG_WORDS.test(name)) return false;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length !== EXPECTED_NAME_WORDS) return false;
  return words.every(
    (word) => /^[A-Z][A-Z'./-]*$/.test(word) && !isNameNoiseWord(word) && !isAlphanumericCodeWord(word),
  );
}

function parseIdLabelDigits(raw: string): string {
  const digits = collapseDigits(raw);
  if (digits === "11") return "";
  return digits.length >= 7 && digits.length <= 8 ? digits : "";
}

type DeclarationFields = { name: string; idNumber: string };

function findDeclarationFields(text: string): DeclarationFields {
  const idLabel = "(?:I\\s*D\\s*N\\s*O|ID\\s*NO|IDNO|DNO|I\\s*DNO)";

  const patterns = [
    new RegExp(
      `(?:^|[\\s,.;])` +
        `(?:I|l|1)\\s+` +
        `([A-Za-z][A-Za-z\\s'./-]{2,}?)` +
        `\\s+${idLabel}\\s*[:\\-]?\\s*((?:\\d\\s*){7,12})`,
      "i",
    ),
    new RegExp(`([A-Z][A-Z\\s'./-]{4,}?)\\s+${idLabel}(\\d{7,8})`, "i"),
    new RegExp(
      `([A-Z][A-Z\\s'./-]{4,}?)\\s+${idLabel}\\s*[:\\-]?\\s*((?:\\d\\s*){7,12})`,
      "i",
    ),
    new RegExp(`(?:I|l|1)\\s+([A-Za-z][A-Za-z\\s'./-]{2,}?)\\s+${idLabel}\\b`, "i"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const name = cleanName(match[1]);
    const idNumber = match[2] ? parseIdLabelDigits(match[2]) : "";

    if (!isLikelyPersonName(name)) continue;

    return { name, idNumber };
  }

  const idAnchors = [
    ...text.matchAll(/\b(?:I\s*D\s*N\s*O|ID\s*NO|IDNO|DNO)\s*:?\s*([\d\s]{7,14})/gi),
    ...text.matchAll(/\bDNO(\d{7,8})\b/gi),
  ];

  for (const anchor of idAnchors) {
    const idNumber = parseIdLabelDigits(anchor[1] ?? "");
    if (!idNumber || anchor.index == null) continue;

    const before = text.slice(Math.max(0, anchor.index - 100), anchor.index);
    const nameFromI = before.match(
      /(?:^|[\s,.;])(?:I|l|1)\s+([A-Za-z][A-Za-z\s'./-]{2,})\s*$/i,
    );
    if (nameFromI?.[1]) {
      const name = cleanName(nameFromI[1]);
      if (isLikelyPersonName(name)) return { name, idNumber };
    }

    const nameBeforeLabel = before.match(/(?:^|[\s,.;])([A-Z][A-Z\s'./-]{4,})\s*$/i);
    if (nameBeforeLabel?.[1]) {
      const name = cleanName(nameBeforeLabel[1]);
      if (isLikelyPersonName(name)) return { name, idNumber };
    }
  }

  return { name: "", idNumber: "" };
}

function findIdNumber(text: string, declarationId: string): string {
  if (declarationId) return declarationId;

  const patterns = [
    /\b(?:I\s*D\s*N\s*O|ID\s*NO|IDNO|DNO)\s*:?\s*((?:\d\s*){7,12})\b/i,
    /\bDNO(\d{7,8})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const digits = parseIdLabelDigits(match[1]);
    if (digits) return digits;
  }

  return "";
}

function findAmount(text: string): string {
  const patterns = [
    /Fee\s+Paid\s*[-–]?\s*KES\s*:?\s*([\d,]+(?:\.\d{2})?)/i,
    /\bKES\s*:?\s*([\d,]+(?:\.\d{2})?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = parseAmountKes(match[1]);
    if (value > 0) return String(value);
  }

  return "";
}

/** Extract fee amount from NTSA document OCR (test form, interim license, etc.). */
export function findFeeAmountKes(text: string): string {
  return findAmount(text);
}

function padDay(day: string): string {
  const n = Number(day);
  if (!Number.isFinite(n) || n < 1 || n > 31) return day;
  return String(n).padStart(2, "0");
}

function fixYearOcrMisread(year: string): string {
  if (year === "2028") return "2025";
  return year;
}

function formatLongDate(day: string, monthName: string, year: string): string {
  const monthKey = monthName.toLowerCase();
  if (!MONTH_INDEX[monthKey]) return "";
  const correctedYear = fixYearOcrMisread(year);
  return `${padDay(day)} ${monthName} ${correctedYear}`;
}

function findDate(text: string): string {
  const allocation = new RegExp(
    `Driving\\s+Test\\s+allocated\\s+as\\s+follows[\\s\\S]{0,120}?Date\\s*:?\\s*(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})`,
    "i",
  ).exec(text);
  if (allocation?.[1]) {
    const parts = new RegExp(`^(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})$`, "i").exec(allocation[1]);
    if (parts?.[1] && parts[2] && parts[3]) {
      return formatLongDate(parts[1], parts[2], parts[3]);
    }
  }

  const long = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})\\b`, "i").exec(text);
  if (long?.[1] && long[2] && long[3]) {
    return formatLongDate(long[1], long[2], long[3]);
  }

  const short = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (short?.[1] && short[2] && short[3]) {
    const monthNum = Number(short[2]);
    const monthName = Object.keys(MONTH_INDEX).find((key) => MONTH_INDEX[key] === monthNum);
    if (monthName) {
      return formatLongDate(short[1], monthName.charAt(0).toUpperCase() + monthName.slice(1), short[3]);
    }
  }

  return "";
}

function isValidDate(value: string): boolean {
  return new RegExp(`^\\d{2}\\s+(?:${MONTHS})\\s+\\d{4}$`, "i").test(value.trim());
}

function isValidIdNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (!digits || digits === "11" || digits.length < 7) return false;
  return digits.length <= 8;
}

function isValidAmount(value: string): boolean {
  return parseAmountKes(value) > 0;
}

export function isValidNtsaName(value: string): boolean {
  return isLikelyPersonName(value.trim());
}

export function isValidNtsaIdNumber(value: string): boolean {
  return isValidIdNumber(value);
}

export function isValidNtsaTestApp(value: string): boolean {
  const normalized = applyTestAppSuffixCorrections(normalizeTestAppNumber(value.trim()));
  return TEST_APPLICATION_NUMBER_PATTERN.test(normalized);
}

export function isValidNtsaAmount(value: string): boolean {
  return isValidAmount(value);
}

export function isValidNtsaDate(value: string): boolean {
  return isValidDate(value);
}

function normalizeValidatedTestApp(value: string): string {
  return applyTestAppSuffixCorrections(normalizeTestAppNumber(value.trim()));
}

/** Count how many of the five data fields passed validation. */
export function countValidNtsaFields(row: NtsaFormRow): number {
  let count = 0;
  if (isValidNtsaName(row.name)) count += 1;
  if (isValidNtsaIdNumber(row.idNumber)) count += 1;
  if (isValidNtsaTestApp(row.testApplicationNumber)) count += 1;
  if (isValidNtsaAmount(row.amount)) count += 1;
  if (isValidNtsaDate(row.date)) count += 1;
  return count;
}

/** Extract fields from OCR text without marking failures — empty string when not found. */
export function extractRawNtsaFields(text: string, headerText?: string): NtsaFormRow {
  const normalized = normalizeWhitespace(text);
  const declaration = findDeclarationFields(normalized);
  const idNumber = findIdNumber(normalized, declaration.idNumber);
  const testApplicationNumber = findTestApplicationNumber(normalized, headerText);
  const amount = findAmount(normalized);
  const date = findDate(normalized);

  return {
    name: declaration.name,
    idNumber,
    testApplicationNumber,
    amount,
    date,
  };
}

function pickField(
  rows: NtsaFormRow[],
  field: keyof NtsaFormRow,
  isValid: (value: string) => boolean,
  normalize?: (value: string) => string,
): string {
  for (const row of rows) {
    const raw = String(row[field] ?? "").trim();
    if (!raw) continue;
    const value = normalize ? normalize(raw) : raw;
    if (isValid(value)) return value;
  }
  return "";
}

function pickRefinedName(rows: NtsaFormRow[], testApplicationNumber: string): string {
  const testApp = testApplicationNumber || pickField(rows, "testApplicationNumber", isValidNtsaTestApp, normalizeValidatedTestApp);

  for (const row of rows) {
    const refined = refineNtsaName(row.name, testApp || row.testApplicationNumber);
    if (isLikelyPersonName(refined)) return refined;
  }

  for (const row of rows) {
    if (!row.name.trim()) continue;
    const refined = refineNtsaName(row.name, testApp);
    if (refined) return refined;
  }

  return "";
}

/** Merge multiple extraction passes — first valid value wins per field. */
export function mergeNtsaFormRows(rows: NtsaFormRow[]): NtsaFormRow {
  const testApplicationNumber = pickField(
    rows,
    "testApplicationNumber",
    isValidNtsaTestApp,
    normalizeValidatedTestApp,
  );

  return {
    name: pickRefinedName(rows, testApplicationNumber),
    idNumber: pickField(rows, "idNumber", isValidNtsaIdNumber),
    testApplicationNumber,
    amount: pickField(rows, "amount", isValidNtsaAmount, (v) => String(parseAmountKes(v))),
    date: pickField(rows, "date", isValidNtsaDate),
  };
}

/**
 * Re-check missing fields on combined OCR text — NTSA forms always contain these labels.
 * Only runs finders for fields that are still empty or invalid.
 */
export function verifyMissingNtsaFields(combinedText: string, row: NtsaFormRow): NtsaFormRow {
  const text = normalizeWhitespace(combinedText);
  const next = { ...row };

  if (!isValidNtsaName(next.name)) {
    const declaration = findDeclarationFields(text);
    const refined = refineNtsaName(declaration.name, next.testApplicationNumber);
    if (isLikelyPersonName(refined)) next.name = refined;
  }

  if (!isValidNtsaIdNumber(next.idNumber)) {
    const declaration = findDeclarationFields(text);
    const idNumber = findIdNumber(text, declaration.idNumber);
    if (isValidIdNumber(idNumber)) next.idNumber = idNumber;
  }

  if (!isValidNtsaTestApp(next.testApplicationNumber)) {
    const tdb = findTestApplicationNumber(text);
    if (isValidNtsaTestApp(tdb)) next.testApplicationNumber = normalizeValidatedTestApp(tdb);
  }

  if (!isValidNtsaAmount(next.amount)) {
    const amount = findAmount(text);
    if (isValidAmount(amount)) next.amount = amount;
  }

  if (!isValidNtsaDate(next.date)) {
    const date = findDate(text);
    if (isValidDate(date)) next.date = date;
  }

  return next;
}

/** Final cleanup: valid values kept, invalid or unclear fields left blank. */
export function finalizeNtsaFormRow(row: NtsaFormRow): NtsaFormRow {
  const testApplicationNumber = normalizeValidatedTestApp(row.testApplicationNumber);
  const name = refineNtsaName(row.name, testApplicationNumber);
  const idNumber = row.idNumber.replace(/\D/g, "");
  const amount = isValidAmount(row.amount) ? String(parseAmountKes(row.amount)) : "";
  const date = row.date.trim();

  return {
    name: isLikelyPersonName(name) ? name : "",
    idNumber: isValidIdNumber(idNumber) ? idNumber : "",
    testApplicationNumber: isValidNtsaTestApp(testApplicationNumber) ? testApplicationNumber : "",
    amount: isValidAmount(amount) ? amount : "",
    date: isValidDate(date) ? date : "",
  };
}

export type ParseNtsaOcrOptions = {
  /** Extra OCR text from a cropped heading region (test application number). */
  headerText?: string;
  /** Additional OCR passes (other crops / rotations). */
  extraTexts?: string[];
};

/** Parse one or more OCR text sources with merge + verification. */
export function parseNtsaOcrText(rawText: string, options?: ParseNtsaOcrOptions): NtsaFormRow {
  const sources = [rawText, ...(options?.extraTexts ?? [])].filter((t) => t.trim().length > 0);
  const partials = sources.map((source, index) =>
    extractRawNtsaFields(source, index === 0 ? options?.headerText : undefined),
  );

  const merged = mergeNtsaFormRows(partials);
  const verified = verifyMissingNtsaFields(sources.join("\n"), merged);
  return finalizeNtsaFormRow(verified);
}

/** Merge multiple row lists into one spreadsheet with sequential source pages. */
export function combineNtsaSessionRows(chunks: NtsaSessionRow[][]): NtsaSessionRow[] {
  const combined: NtsaSessionRow[] = [];
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

export function ntsaRowToExcelArray(row: NtsaSessionRow): (string | number)[] {
  return [
    row.sourcePage,
    row.name,
    row.idNumber,
    row.testApplicationNumber,
    formatAmountPlain(row.amount) || row.amount,
    row.date,
  ];
}
