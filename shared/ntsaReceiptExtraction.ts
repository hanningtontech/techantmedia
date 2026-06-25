import { parseAmountKes } from "./ntsaExtraction";
import type { ReceiptFormRow } from "./documentExtraction";

const MONTHS =
  "January|February|March|April|May|July|August|September|October|November|December|June";

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

const RECEIPT_NOISE_WORDS = new Set([
  "NATIONAL",
  "TRANSPORT",
  "SAFETY",
  "AUTHORITY",
  "NTSA",
  "REPUBLIC",
  "KENYA",
  "RECEIPT",
  "PAID",
  "CUSTOMER",
  "COPY",
  "APPLICATION",
  "BILL",
  "REFERENCE",
  "TOTAL",
  "KES",
  "SERVICE",
  "CODE",
  "DESCRIPTION",
  "CONVENIENCE",
  "FEE",
  "ECITIZEN",
  "PESAFLOW",
  "EMAIL",
  "TEL",
  "TELEPHONE",
  "GMAIL",
  "COM",
  "NAME",
  "ID",
  "NO",
]);

const EXPECTED_NAME_WORDS = 3;
const REVIEW_REQUIRED = "REVIEW_REQUIRED";
const ORG_WORDS =
  /\b(NATIONAL|TRANSPORT|SAFETY|AUTHORITY|NTSA|REPUBLIC|KENYA|RECEIPT|PAID|CUSTOMER|COPY)\b/i;

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function collapseDigits(value: string): string {
  return value.replace(/\s+/g, "").replace(/\D/g, "");
}

function padDay(day: string): string {
  const n = Number(day);
  if (!Number.isFinite(n) || n < 1 || n > 31) return day;
  return String(n).padStart(2, "0");
}

function formatLongDate(day: string, monthName: string, year: string): string {
  const monthKey = monthName.toLowerCase();
  if (!MONTH_INDEX[monthKey]) return "";
  return `${padDay(day)} ${monthName} ${correctedYear(year)}`;
}

/** Fix common OCR glitches in receipt years (e.g. 202! → 2025). */
export function sanitizeOcrYear(raw: string): string {
  const cleaned = raw.trim().replace(/\s/g, "");
  if (/^202[!l|IL1]$/.test(cleaned)) return "2025";
  if (/^202[56]$/.test(cleaned)) return cleaned;
  if (cleaned === "2028") return "2025";
  const digits = cleaned.replace(/[^0-9]/g, "");
  if (digits.length === 4) {
    const numeric = Number(digits);
    if (Number.isFinite(numeric) && numeric > MAX_RECEIPT_YEAR) return String(MAX_RECEIPT_YEAR);
    if (numeric >= 2020 && numeric <= MAX_RECEIPT_YEAR) return digits;
  }
  if (digits.length === 3 && digits.startsWith("202")) return `${digits}5`;
  if (/^20\d$/.test(digits)) return `${digits}5`;
  return digits.length === 4 ? digits : cleaned;
}

function correctedYear(year: string): string {
  return sanitizeOcrYear(year);
}

function isReceiptNameNoiseWord(word: string): boolean {
  if (!word) return true;
  if (RECEIPT_NOISE_WORDS.has(word)) return true;
  if (word.length === 1) return true;
  if (/@|\.com$/i.test(word)) return true;
  if (/^\d+$/.test(word)) return true;
  if (/^[A-Z0-9]*\d[A-Z0-9]*$/.test(word) && word.length >= 5) return true;
  return false;
}

function cleanReceiptName(value: string): string {
  let raw = value.split(/\b(?:Email|E-mail|Tel|Telephone)\b/i)[0] ?? value;
  raw = raw.replace(/@.*$/, "");

  let name = raw
    .replace(/[|_]/g, " ")
    .replace(/^[\s•\-*.\d:]+/, "")
    .replace(/\b(?:Name|NAME)\s*:?\s*/i, "")
    .replace(/\bPDL[-\s]?[A-Z0-9]+\b/gi, " ")
    .replace(/[^A-Za-z\s'./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  name = name
    .split(/\s+/)
    .filter((word) => word && !isReceiptNameNoiseWord(word))
    .join(" ");

  return name;
}

function trimToThreeReceiptNameWords(name: string): string {
  const words = name.split(/\s+/).filter((word) => word && !isReceiptNameNoiseWord(word));
  if (words.length <= EXPECTED_NAME_WORDS) return words.join(" ");
  return words.slice(0, EXPECTED_NAME_WORDS).join(" ");
}

/** Normalize receipt applicant name to exactly three words — no extras. */
export function refineReceiptName(name: string): string {
  return trimToThreeReceiptNameWords(cleanReceiptName(name));
}

function isLikelyReceiptName(name: string): boolean {
  if (!name || name === REVIEW_REQUIRED) return false;
  if (name.length < 5) return false;
  if (ORG_WORDS.test(name)) return false;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length !== EXPECTED_NAME_WORDS) return false;
  return words.every(
    (word) =>
      /^[A-Z][A-Z'./-]*$/.test(word) &&
      !isReceiptNameNoiseWord(word) &&
      word.length > 1,
  );
}

export function normalizeApplicationNo(raw: string): string {
  let value = raw.toUpperCase().replace(/\s+/g, "");
  value = value.replace(/^PD1[-]?/, "PDL-");
  value = value.replace(/^PDL(?!-)/, "PDL-");
  if (value.startsWith("PDL-")) {
    const suffix = stripApplicationSuffixOrgNoise(value.slice(4));
    return suffix ? `PDL-${suffix}` : "";
  }
  if (/^PDL[A-Z0-9]{6,}/.test(value)) {
    const suffix = stripApplicationSuffixOrgNoise(value.slice(3));
    return suffix ? `PDL-${suffix}` : "";
  }
  return value;
}

const APPLICATION_NO_PATTERN = /^PDL-[A-Z0-9]{6,16}$/;
/** NTSA/eCitizen bill refs are short uppercase alphanumeric codes (typically 6–8 chars, e.g. MM4R4Q3). */
const BILL_REF_PATTERN = /^[A-Z0-9]{6,8}$/;
const SYNTHETIC_BILL_REF_PATTERN = /^[A-Z0-9]{9}$/;

export const MAX_RECEIPT_YEAR = 2026;

export type BillRefContext = {
  applicationNo?: string;
  idNumber?: string;
  date?: string;
};

export type ApplicationNoContext = {
  idNumber?: string;
};

const BILL_REF_REJECT_WORDS = new Set([
  "APPLICATION",
  "REFERENCE",
  "BILL",
  "DATE",
  "CUSTOMER",
  "RECEIPT",
  "PAID",
  "COPY",
  "NO",
  "NTSA",
  "KENYA",
  "JULY",
  "JUNE",
  "MARCH",
  "APRIL",
  "MAY",
  "AUGUST",
  "JANUARY",
  "FEBRUARY",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
]);

/** OCR fragments from header labels (e.g. "1CATION" from "APPLICATION") — never valid bill refs. */
const BILL_REF_LABEL_FRAGMENTS = [
  "ICATION",
  "1CATION",
  "CATION",
  "ATION",
  "LICATI",
  "APPLIC",
  "PLICAT",
  "ERENCE",
  "FERENC",
  "RENC",
  "EFEREN",
  "BILLRE",
  "STOMER",
  "RECEIP",
  "PAIDCU",
  "CUSTOM",
];

const HEADER_LABEL_WORDS = ["APPLICATION", "REFERENCE", "CUSTOMER", "RECEIPT"];

const APPLICATION_SUFFIX_REJECT = new Set([
  "APPLICATION",
  "REFERENCE",
  "CUSTOMER",
  "RECEIPT",
  "NATIONAL",
  "TRANSPORT",
  "SAFETY",
  "AUTHORITY",
  "NTSA",
  "REPUBLIC",
  "KENYA",
]);

/** Header/org words OCR often glues onto PDL suffixes (e.g. YLLH289MLNATIONAL). */
const APPLICATION_ORG_TAIL_WORDS = [
  "NATIONAL",
  "TRANSPORT",
  "SAFETY",
  "AUTHORITY",
  "NTSA",
  "REPUBLIC",
  "KENYA",
  "RECEIPT",
  "CUSTOMER",
  "APPLICATION",
  "REFERENCE",
  "BILL",
] as const;

function applicationSuffixHasOrgNoise(suffix: string): boolean {
  const upper = suffix.toUpperCase();
  return APPLICATION_ORG_TAIL_WORDS.some((word) => upper.includes(word));
}

/** Application suffix fragments must mix letters and digits — not header words like NATIONAL. */
function isPlausibleApplicationSuffixFragment(token: string): boolean {
  const t = token.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (t.length < 5) return false;
  if (!/\d/.test(t) || !/[A-Z]/.test(t)) return false;
  if (APPLICATION_ORG_TAIL_WORDS.some((word) => t === word || t.includes(word))) return false;
  if (BILL_REF_REJECT_WORDS.has(t)) return false;
  return true;
}

function stripApplicationSuffixOrgNoise(suffix: string): string {
  let s = suffix.toUpperCase();
  let changed = true;
  while (changed) {
    changed = false;
    for (const word of APPLICATION_ORG_TAIL_WORDS) {
      if (s.endsWith(word) && s.length > word.length) {
        s = s.slice(0, -word.length);
        changed = true;
        continue;
      }
      for (let len = word.length - 1; len >= 4; len -= 1) {
        const frag = word.slice(0, len);
        if (s.endsWith(frag) && s.length > frag.length + 5) {
          s = s.slice(0, -frag.length);
          changed = true;
          break;
        }
      }
    }
  }
  return s;
}

function scoreApplicationNo(value: string, context?: ApplicationNoContext): number {
  const suffix = value.replace(/^PDL-/, "");
  let score = 0;
  if (/[A-Z]/.test(suffix) && /\d/.test(suffix)) score += 20;
  if (/^[A-Z]{3,}\d/.test(suffix) || /^\d*[A-Z]{3,}/.test(suffix)) score += 10;
  if (suffix.length >= 9) score += 3;
  const idDigits = context?.idNumber?.replace(/\D/g, "") ?? "";
  if (idDigits && suffix === idDigits) score -= 100;
  if (idDigits && suffix.includes(idDigits)) score -= 50;
  if (/^\d+$/.test(suffix)) score -= 80;
  return score;
}

export function isValidReceiptApplicationNo(
  value: string,
  context?: ApplicationNoContext,
): boolean {
  const normalized = normalizeApplicationNo(value.trim());
  if (!APPLICATION_NO_PATTERN.test(normalized)) return false;
  const suffix = normalized.replace(/^PDL-/, "");
  if (APPLICATION_SUFFIX_REJECT.has(suffix)) return false;
  if (applicationSuffixHasOrgNoise(suffix)) return false;
  if (!/\d/.test(suffix)) return false;
  if (!/[A-Z]/.test(suffix)) return false;
  const idDigits = context?.idNumber?.replace(/\D/g, "") ?? "";
  if (idDigits && suffix === idDigits) return false;
  if (idDigits && idDigits.length >= 7 && suffix.includes(idDigits)) return false;
  return scoreApplicationNo(normalized, context) > 0;
}

function collapseBillRefToken(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-_.]/g, "");
}

/** Fix common OCR misreads in bill reference codes (e.g. MM4R4Q3). */
export function normalizeBillReferenceNo(raw: string): string {
  let value = collapseBillRefToken(raw);
  value = value.replace(/^PD[L1]-?/, "");
  return value;
}

function letterCount(value: string): number {
  return (value.match(/[A-Z]/g) ?? []).length;
}

function digitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

function containsMonthFragment(value: string): boolean {
  return [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ].some((month) => value.includes(month));
}

function scoreBillRefPattern(code: string): number {
  let score = 0;
  if (/^[A-Z]{2}\d[A-Z]\d[A-Z]\d$/.test(code)) score += 25;
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(code)) score += 20;
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d[A-Z]$/.test(code)) score += 15;
  if (letterCount(code) >= 3 && digitCount(code) >= 2) score += 5;
  if (code.includes("O") && !code.includes("Q")) score -= 3;
  return score;
}

function isBillRefLabelFragment(normalized: string): boolean {
  if (BILL_REF_LABEL_FRAGMENTS.some((frag) => normalized.includes(frag))) return true;
  for (const word of HEADER_LABEL_WORDS) {
    if (word.includes(normalized) || normalized.includes(word)) return true;
  }
  return false;
}

function hasStrongBillRefShape(normalized: string): boolean {
  if (/^[A-Z]{2}\d[A-Z]\d[A-Z]\d$/.test(normalized)) return true;
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d[A-Z]?$/.test(normalized)) return true;
  if (digitCount(normalized) >= 2 && letterCount(normalized) >= 2) return true;
  return false;
}

export function isValidReceiptBillRef(value: string, context?: BillRefContext): boolean {
  const normalized = normalizeBillReferenceNo(value);
  if (!normalized || normalized.length < 6 || normalized.length > 8) return false;
  if (!BILL_REF_PATTERN.test(normalized)) return false;
  if (BILL_REF_REJECT_WORDS.has(normalized)) return false;
  if (isBillRefLabelFragment(normalized)) return false;
  if (containsMonthFragment(normalized)) return false;
  if (/^PDL/.test(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  if (letterCount(normalized) < 2 || digitCount(normalized) < 1) return false;
  if (!hasStrongBillRefShape(normalized)) return false;

  const idDigits = context?.idNumber?.replace(/\D/g, "") ?? "";
  if (idDigits && (normalized === idDigits || idDigits.includes(normalized))) return false;

  const appCollapsed = context?.applicationNo?.replace(/^PDL-?/i, "").toUpperCase() ?? "";
  if (appCollapsed && (normalized === appCollapsed || appCollapsed.includes(normalized))) {
    return false;
  }

  return true;
}

/** Validate 9-character synthetic bill reference fallback codes. */
export function isValidSyntheticBillReferenceNo(value: string): boolean {
  const normalized = normalizeBillReferenceNo(value);
  if (!SYNTHETIC_BILL_REF_PATTERN.test(normalized)) return false;
  if (BILL_REF_REJECT_WORDS.has(normalized)) return false;
  if (isBillRefLabelFragment(normalized)) return false;
  if (letterCount(normalized) < 2 || digitCount(normalized) < 2) return false;
  return true;
}

function isAcceptedReceiptBillRef(value: string, context?: BillRefContext): boolean {
  return (
    isValidReceiptBillRef(value, context) || isValidSyntheticBillReferenceNo(value)
  );
}

export function applyBillRefOcrCorrections(code: string, context?: BillRefContext): string {
  const normalized = normalizeBillReferenceNo(code);
  const chars = normalized.split("");
  if (chars.length < 6 || chars.length > 8) return normalized;

  const swaps: Array<[string, string]> = [
    ["O", "0"],
    ["0", "O"],
    ["Q", "O"],
    ["O", "Q"],
    ["I", "1"],
    ["1", "I"],
    ["L", "1"],
    ["B", "8"],
    ["8", "B"],
    ["S", "5"],
    ["5", "S"],
    ["Z", "2"],
    ["2", "Z"],
    ["G", "6"],
    ["6", "G"],
    ["M", "W"],
    ["W", "M"],
    ["A", "4"],
    ["4", "A"],
  ];

  const variants = new Set<string>([normalized]);

  for (let i = 0; i < chars.length; i += 1) {
    for (const [from, to] of swaps) {
      if (chars[i] !== from) continue;
      const next = [...chars];
      next[i] = to;
      variants.add(next.join(""));
    }
  }

  const validVariants: string[] = [];
  for (const candidate of variants) {
    if (isValidReceiptBillRef(candidate, context)) validVariants.push(candidate);
  }

  if (validVariants.length >= 1) {
    return validVariants.sort((a, b) => scoreBillRefPattern(b) - scoreBillRefPattern(a))[0]!;
  }

  return normalized;
}

export function isValidReceiptIdNumber(value: string): boolean {
  const digits = collapseDigits(value);
  if (!digits || digits === "11") return false;
  if (isLikelyPhoneNumber(digits)) return false;
  return digits.length >= 7 && digits.length <= 9;
}

function parseReceiptIdDigits(raw: string): string {
  const digits = collapseDigits(raw);
  if (!digits || digits === "11") return "";
  if (digits.length >= 7 && digits.length <= 9) return digits;
  return "";
}

export function isValidReceiptName(value: string): boolean {
  return isLikelyReceiptName(value.trim());
}

export function isValidReceiptDate(value: string): boolean {
  const trimmed = value.trim();
  if (!new RegExp(`^\\d{2}\\s+(?:${MONTHS})\\s+\\d{4}$`, "i").test(trimmed)) return false;
  const year = Number(trimmed.match(/\d{4}$/)?.[0] ?? "");
  return Number.isFinite(year) && year <= MAX_RECEIPT_YEAR;
}

/** NTSA receipt totals are either KES 550 or KES 650. */
export const RECEIPT_TOTAL_KES_AMOUNTS = [550, 650] as const;

export function isValidReceiptTotalKes(value: string): boolean {
  const amount = parseAmountKes(value);
  return (RECEIPT_TOTAL_KES_AMOUNTS as readonly number[]).includes(amount);
}

function findPdlToken(raw: string): string {
  const normalized = normalizeApplicationNo(raw.replace(/\s+/g, ""));
  return isValidReceiptApplicationNo(normalized) ? normalized : "";
}

type HeaderValueRowFields = {
  applicationNo: string;
  billReferenceNo: string;
  date: string;
};

const LOOSE_RECEIPT_YEAR = "20\\d[!l|IL1]?";
const HEADER_DATE_TAIL = `(\\d{1,2}\\s+(?:${MONTHS})\\s+${LOOSE_RECEIPT_YEAR}|\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})`;

/** Reassemble PDL- codes split across OCR lines (e.g. PDL-YL| + LH289ML). */
export function findSplitApplicationNo(
  text: string,
  context?: ApplicationNoContext,
): string {
  const raw = text.replace(/\r/g, "\n");
  const candidates: string[] = [];

  const splitWithBill = raw.match(
    new RegExp(
      `PD[L1][-\\s]?([A-Z0-9|§~.]{1,8})[\\s\\S]{0,72}?([A-Z0-9]{7,12})\\s+([A-Z0-9]{6,8})`,
      "i",
    ),
  );
  if (splitWithBill?.[1] && splitWithBill[2]) {
    const prefix = splitWithBill[1].replace(/[^A-Z0-9]/gi, "");
    const suffix = splitWithBill[2].replace(/[^A-Z0-9]/gi, "");
    if (isPlausibleApplicationSuffixFragment(suffix)) {
      const found = findPdlToken(`PDL-${prefix}${suffix}`);
      if (found && isValidReceiptApplicationNo(found, context)) candidates.push(found);
    }
  }

  const suffixLine = raw.match(
    new RegExp(`\\b([A-Z]{2}[A-Z0-9]{5,11})\\s+([A-Z0-9]{6,8})\\s+${HEADER_DATE_TAIL}`, "i"),
  );
  const pdlFrag = raw.match(/PD[L1][-\s]?([A-Z0-9|§~.]{1,8})/i);
  if (suffixLine?.[1] && pdlFrag?.[1]) {
    const prefix = pdlFrag[1].replace(/[^A-Z0-9]/gi, "");
    const suffix = suffixLine[1].replace(/[^A-Z0-9]/gi, "");
    if (isPlausibleApplicationSuffixFragment(suffix)) {
      const found = findPdlToken(`PDL-${prefix}${suffix}`);
      if (found && isValidReceiptApplicationNo(found, context)) candidates.push(found);
    }
  }

  if (!candidates.length) return "";
  return candidates.sort(
    (a, b) => scoreApplicationNo(b, context) - scoreApplicationNo(a, context),
  )[0]!;
}

/** Parse the header value row: PDL-… | bill ref | date (including split/garbled OCR). */
export function parseHeaderValueRowFields(
  text: string,
  context?: ApplicationNoContext & BillRefContext,
): HeaderValueRowFields {
  const raw = text.replace(/\r/g, "\n");
  const normalized = normalizeWhitespace(text);
  const result: HeaderValueRowFields = {
    applicationNo: "",
    billReferenceNo: "",
    date: "",
  };

  const splitApp = findSplitApplicationNo(text, context);
  if (splitApp) result.applicationNo = splitApp;

  const tripleLine = raw.match(
    new RegExp(
      `(?:PD[L1][-\\s]?[A-Z0-9|§~.]{1,16}[\\s\\S]{0,40}?)?([A-Z0-9]{7,12})\\s+([A-Z0-9]{6,8})\\s+${HEADER_DATE_TAIL}`,
      "i",
    ),
  );
  if (tripleLine) {
    if (!result.applicationNo && tripleLine[1]) {
      const nearPdl = raw.match(/PD[L1][-\s]?([A-Z0-9|§~.]{1,8})/i);
      if (nearPdl?.[1]) {
        const prefix = nearPdl[1].replace(/[^A-Z0-9]/gi, "");
        const suffix = tripleLine[1].replace(/[^A-Z0-9]/gi, "");
        if (isPlausibleApplicationSuffixFragment(suffix)) {
          const app = findPdlToken(`PDL-${prefix}${suffix}`);
          if (app && isValidReceiptApplicationNo(app, context)) result.applicationNo = app;
        }
      }
    }
    if (tripleLine[2]) {
      const bill = tryBillRefCandidate(tripleLine[2], {
        ...context,
        applicationNo: result.applicationNo || context?.applicationNo,
        date: context?.date,
      });
      if (bill) result.billReferenceNo = bill;
    }
    if (tripleLine[3]) {
      const date = parseLongDateMatch(tripleLine[3]);
      if (date && isValidReceiptDate(date)) result.date = date;
    }
  }

  const valueRow = normalized.match(
    new RegExp(`\\b(PD[L1][-\\s]?[A-Z0-9]{6,16})\\s+([A-Z0-9]{6,8})(?:\\s+${HEADER_DATE_TAIL})?`, "i"),
  );
  if (valueRow?.[1]) {
    const app = findPdlToken(valueRow[1]);
    if (app && isValidReceiptApplicationNo(app, context)) result.applicationNo = result.applicationNo || app;
    if (valueRow[2]) {
      const bill = tryBillRefCandidate(valueRow[2], {
        ...context,
        applicationNo: result.applicationNo || context?.applicationNo,
      });
      if (bill) result.billReferenceNo = result.billReferenceNo || bill;
    }
    if (valueRow[3]) {
      const date = parseLongDateMatch(valueRow[3]);
      if (date && isValidReceiptDate(date)) result.date = result.date || date;
    }
  }

  return result;
}

/** Header value row often reads as "PDL-YLLH289ML MM4R4Q3" on one line. */
function findApplicationNoFromHeaderValueRow(text: string): string {
  const parsed = parseHeaderValueRowFields(text);
  return parsed.applicationNo;
}

function findApplicationNo(text: string, context?: ApplicationNoContext): string {
  const normalized = normalizeWhitespace(text);
  const split = findSplitApplicationNo(text, context);
  if (split && isValidReceiptApplicationNo(split, context)) return split;

  const fromValueRow = findApplicationNoFromHeaderValueRow(normalized);
  if (fromValueRow && isValidReceiptApplicationNo(fromValueRow, context)) return fromValueRow;

  const patterns = [
    /APPLICATION\s+NO\s*:?\s*(PD[L1][-\s]?[A-Z0-9]{6,16})/i,
    /APPLIC(?:ATION)?\s+NO\s*:?[\s\n]+(PD[L1][-\s]?[A-Z0-9]{6,16})/i,
    /APPLICATION\s+NO\s*:?\s*([A-Z]{2,4}[-\s]?[A-Z0-9]{5,14})/i,
    /(?:APPLICATION|APPLIC)[\s\S]{0,50}?(PD[L1][-\s]?[A-Z0-9]{6,16})/i,
    /\b(PD[L1][-\s]?[A-Z0-9]{6,16})\b/i,
    /\bPD[L1]\s+([A-Z0-9]{6,16})\b/i,
  ];

  const candidates: string[] = [];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const found = findPdlToken(match[1]);
    if (found && isValidReceiptApplicationNo(found, context)) candidates.push(found);
  }

  const splitPdl = normalized.match(/\bPD[L1]\s+([A-Z0-9]{6,16})\b/i);
  if (splitPdl?.[1]) {
    const found = findPdlToken(`PDL-${splitPdl[1]}`);
    if (found && isValidReceiptApplicationNo(found, context)) candidates.push(found);
  }

  const loosePdl = [...normalized.matchAll(/\bPD[L1][\s\-]?[A-Z0-9]{7,16}\b/gi)];
  for (const match of loosePdl) {
    const found = findPdlToken(match[0] ?? "");
    if (found && isValidReceiptApplicationNo(found, context)) candidates.push(found);
  }

  if (!candidates.length) return "";
  return candidates.sort(
    (a, b) => scoreApplicationNo(b, context) - scoreApplicationNo(a, context),
  )[0]!;
}

/** Parse application number from a left-header column crop (label + value only). */
export function findApplicationNoInColumn(text: string, context?: ApplicationNoContext): string {
  const normalized = normalizeWhitespace(text);
  const fromValueRow = findApplicationNoFromHeaderValueRow(normalized);
  if (fromValueRow) return fromValueRow;

  const fromLabel = findApplicationNo(normalized, context);
  if (fromLabel) return fromLabel;

  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const found = findPdlToken(line);
    if (found && isValidReceiptApplicationNo(found, context)) return found;

    if (/^PD[L1][-:]?$/i.test(line) && lines[i + 1]) {
      const combined = findPdlToken(`${line}${lines[i + 1]}`);
      if (combined) return combined;
    }

    if (/^(?:APPLICATION|APPLIC)(?:\s+NO)?$/i.test(line) && lines[i + 1]) {
      const nextFound = findPdlToken(lines[i + 1]!) || findApplicationNo(lines[i + 1]!);
      if (nextFound) return nextFound;
    }
  }

  if (/APPLICATION|APPLIC/i.test(normalized)) {
    const labelNoise = new Set([
      "APPLICATION",
      "APPLIC",
      "REFERENCE",
      "BILL",
      "CUSTOMER",
      "RECEIPT",
    ]);
    for (const match of normalized.matchAll(/\b([A-Z0-9]{8,14})\b/g)) {
      const token = match[1] ?? "";
      if (labelNoise.has(token)) continue;
      if (/^(NO|DATE)$/i.test(token)) continue;
      if (!/\d/.test(token) || !/[A-Z]/i.test(token)) continue;
      const withPdl = findPdlToken(`PDL-${token}`);
      if (withPdl && isValidReceiptApplicationNo(withPdl, context)) return withPdl;
    }
  }

  return "";
}

/** Deep retry for application number using header column OCR text. */
export function digDeeperApplicationNo(texts: string[], context?: ApplicationNoContext): string {
  const candidates: string[] = [];
  for (const source of texts) {
    const headerRow = parseHeaderValueRowFields(source, context);
    if (headerRow.applicationNo) candidates.push(headerRow.applicationNo);
    const found =
      findSplitApplicationNo(source, context) ||
      findApplicationNoInColumn(source, context) ||
      findApplicationNo(source, context);
    if (found) candidates.push(found);
  }
  if (!candidates.length) return "";
  return candidates.sort(
    (a, b) => scoreApplicationNo(b, context) - scoreApplicationNo(a, context),
  )[0]!;
}

function tryBillRefCandidate(raw: string, context?: BillRefContext): string {
  const corrected = applyBillRefOcrCorrections(raw, context);
  if (isValidReceiptBillRef(corrected, context)) return corrected;
  const collapsed = collapseBillRefToken(raw);
  const correctedCollapsed = applyBillRefOcrCorrections(collapsed, context);
  if (isValidReceiptBillRef(correctedCollapsed, context)) return correctedCollapsed;
  return "";
}

/** Parse bill reference from center-header column crop (often just the code, e.g. MM4R4Q3). */
export function findBillReferenceInColumn(text: string, context?: BillRefContext): string {
  const normalized = normalizeWhitespace(text);
  const fromLabel = findBillReferenceNo(normalized, context);
  if (fromLabel) return fromLabel;

  const collapsed = collapseBillRefToken(normalized);
  if (collapsed.length >= 6 && collapsed.length <= 8) {
    const found = tryBillRefCandidate(collapsed, context);
    if (found) return found;
  }

  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const lineCollapsed = collapseBillRefToken(line);
    if (lineCollapsed.length < 6 || lineCollapsed.length > 8) continue;
    const found = tryBillRefCandidate(lineCollapsed, context);
    if (found) return found;
  }

  return "";
}

/**
 * Bill reference sits in the top header row between APPLICATION NO (left) and DATE (right).
 * Value is printed directly under the "BILL REFERENCE NO:" label (e.g. MM4R4Q3).
 */
function findBillReferenceNo(
  text: string,
  context?: BillRefContext,
): string {
  const normalized = normalizeWhitespace(text);

  const labeledSameLine = [
    /BILL\s+REFERENCE\s+NO\s*:?\s*([A-Z0-9]{6,8})\b/i,
    /BILL\s+REF(?:ERENCE)?\s+NO\s*:?\s*([A-Z0-9]{6,8})\b/i,
    /BILL\s+REFERENCE\s*:?\s*([A-Z0-9]{6,8})\b/i,
  ];
  for (const pattern of labeledSameLine) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const found = tryBillRefCandidate(match[1], context);
    if (found) return found;
  }

  const labeledMultiline = normalized.match(
    /BILL\s+REFERENCE\s+NO\s*:?[\s\n]+([A-Z0-9]{6,8})\b/i,
  );
  if (labeledMultiline?.[1]) {
    const found = tryBillRefCandidate(labeledMultiline[1], context);
    if (found) return found;
  }

  const headerTriple = normalized.match(
    /APPLICATION\s+NO\s*:?[\s\S]{0,80}?PD[L1][-\s]?[A-Z0-9]{6,16}[\s\S]{0,60}?BILL\s+REFERENCE\s+NO\s*:?[\s\S]{0,30}?([A-Z0-9]{6,8})[\s\S]{0,60}?DATE\s*:?[\s\S]{0,30}?\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i,
  );
  if (headerTriple?.[1]) {
    const found = tryBillRefCandidate(headerTriple[1], context);
    if (found) return found;
  }

  if (context?.applicationNo && context.date) {
    const appEsc = context.applicationNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const betweenAppAndDate = new RegExp(
      `${appEsc}[\\s\\S]{0,80}?([A-Z0-9]{6,8})[\\s\\S]{0,80}?${context.date.replace(/\s+/g, "\\s+")}`,
      "i",
    ).exec(normalized);
    if (betweenAppAndDate?.[1]) {
      const found = tryBillRefCandidate(betweenAppAndDate[1], context);
      if (found) return found;
    }
  }

  const afterBillLabel = normalized.match(
    /BILL\s+REFERENCE\s+NO\s*:?[\s\S]{0,40}?([A-Z0-9]{6,8})\b/i,
  );
  if (afterBillLabel?.[1]) {
    const found = tryBillRefCandidate(afterBillLabel[1], context);
    if (found) return found;
  }

  const strongPatternCodes = [...normalized.matchAll(/\b([A-Z]{2}\d[A-Z]\d[A-Z]\d)\b/g)];
  for (const match of strongPatternCodes) {
    const candidate = match[1];
    if (!candidate) continue;
    if (context?.applicationNo && candidate.includes(context.applicationNo.replace(/^PDL-?/, ""))) {
      continue;
    }
    const found = tryBillRefCandidate(candidate, context);
    if (found) return found;
  }

  return "";
}

/** Extra pass when bill reference is still missing — searches header-only OCR text. */
export function digDeeperBillReferenceNo(
  texts: string[],
  context?: BillRefContext,
): string {
  for (const source of texts) {
    const headerRow = parseHeaderValueRowFields(source, context);
    if (headerRow.billReferenceNo) return headerRow.billReferenceNo;
    const found = findBillReferenceNo(source, context);
    if (found) return found;
  }

  const combined = texts.join("\n");
  const nearLabel = combined.match(
    /BILL[\s\S]{0,12}?REFERENCE[\s\S]{0,12}?NO[\s\S]{0,24}?([A-Z0-9][A-Z0-9\s]{4,10})/i,
  );
  if (nearLabel?.[1]) {
    const collapsed = collapseBillRefToken(nearLabel[1]);
    for (const len of [7, 6, 8]) {
      if (collapsed.length >= len) {
        const slice = collapsed.slice(0, len);
        const found = tryBillRefCandidate(slice, context);
        if (found) return found;
      }
    }
  }

  return "";
}

export function parseLongDateMatch(raw: string): string {
  const cleaned = raw
    .replace(/\bJu[l1I](?!y)/gi, "July")
    .replace(/Janu[a4@]ry/gi, "January")
    .replace(/Feb[rru][a4@]ry/gi, "February")
    .replace(/\bMa[rY](?!y)/gi, "May")
    .replace(/\s+/g, " ")
    .trim();
  const looseYear = new RegExp(`^(\\d{1,2})\\s+(${MONTHS})\\s+(${LOOSE_RECEIPT_YEAR})$`, "i").exec(
    cleaned,
  );
  if (looseYear?.[1] && looseYear[2] && looseYear[3]) {
    return formatLongDate(looseYear[1], looseYear[2], sanitizeOcrYear(looseYear[3]));
  }
  const parts = new RegExp(`^(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})$`, "i").exec(cleaned);
  if (!parts?.[1] || !parts[2] || !parts[3]) return "";
  return formatLongDate(parts[1], parts[2], parts[3]);
}

function findReceiptDateLoose(text: string): string {
  const normalized = normalizeWhitespace(text);

  for (const match of normalized.matchAll(
    new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})\\b`, "gi"),
  )) {
    if (!match[1] || !match[2] || !match[3]) continue;
    const formatted = formatLongDate(match[1], match[2], match[3]);
    if (isValidReceiptDate(formatted)) return formatted;
  }

  for (const match of normalized.matchAll(
    new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})\\s+(${LOOSE_RECEIPT_YEAR})\\b`, "gi"),
  )) {
    if (!match[1] || !match[2] || !match[3]) continue;
    const formatted = formatLongDate(match[1], match[2], sanitizeOcrYear(match[3]));
    if (isValidReceiptDate(formatted)) return formatted;
  }

  const compact = new RegExp(`\\b(\\d{1,2})\\s*(${MONTHS})\\s*(\\d{4})\\b`, "i").exec(
    normalized.replace(/[,|]/g, " "),
  );
  if (compact?.[1] && compact[2] && compact[3]) {
    const formatted = formatLongDate(compact[1], compact[2], compact[3]);
    if (isValidReceiptDate(formatted)) return formatted;
  }

  const glued = normalized
    .replace(/\s+/g, "")
    .match(new RegExp(`(\\d{1,2})(${MONTHS})(\\d{4})`, "i"));
  if (glued?.[1] && glued[2] && glued[3]) {
    const formatted = formatLongDate(glued[1], glued[2], glued[3]);
    if (isValidReceiptDate(formatted)) return formatted;
  }

  const monthYear = new RegExp(`\\b(${MONTHS})\\s+(\\d{4})\\b`, "i").exec(normalized);
  if (monthYear?.[1] && monthYear[2]) {
    const dayMatch = normalized.match(/(?:DATE\s*:?\s*)?(\d{1,2})\b/i);
    if (dayMatch?.[1]) {
      const formatted = formatLongDate(dayMatch[1], monthYear[1], monthYear[2]);
      if (isValidReceiptDate(formatted)) return formatted;
    }
  }

  return "";
}

/** Deep retry for receipt date using header column OCR text. */
export function digDeeperReceiptDate(texts: string[]): string {
  for (const source of texts) {
    const found =
      findReceiptDateInColumn(source) || findReceiptDate(source) || findReceiptDateLoose(source);
    if (found) return found;
  }
  return "";
}

function findReceiptDate(text: string): string {
  const normalized = normalizeWhitespace(text);

  const labeled = new RegExp(
    `DATE\\s*:?\\s*(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})`,
    "i",
  ).exec(normalized);
  if (labeled?.[1]) {
    const formatted = parseLongDateMatch(labeled[1]);
    if (formatted) return formatted;
  }

  const labeledMultiline = new RegExp(
    `DATE\\s*:?\\s*[\\n\\r]+\\s*(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})`,
    "i",
  ).exec(normalized);
  if (labeledMultiline?.[1]) {
    const formatted = parseLongDateMatch(labeledMultiline[1]);
    if (formatted) return formatted;
  }

  const long = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})\\b`, "i").exec(normalized);
  if (long?.[1] && long[2] && long[3]) {
    return formatLongDate(long[1], long[2], long[3]);
  }

  const loose = findReceiptDateLoose(normalized);
  if (loose) return loose;

  const short = normalized.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (short?.[1] && short[2] && short[3]) {
    const monthNum = Number(short[2]);
    const monthName = Object.keys(MONTH_INDEX).find((key) => MONTH_INDEX[key] === monthNum);
    if (monthName) {
      return formatLongDate(
        short[1],
        monthName.charAt(0).toUpperCase() + monthName.slice(1),
        short[3],
      );
    }
  }

  return "";
}

/** Parse date from right-header column crop. */
export function findReceiptDateInColumn(text: string): string {
  const normalized = normalizeWhitespace(text);
  const fromLabel = findReceiptDate(normalized);
  if (fromLabel) return fromLabel;

  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const formatted = parseLongDateMatch(line);
    if (formatted && isValidReceiptDate(formatted)) return formatted;
  }

  return "";
}

/** Printed label on NTSA payment receipts — always "ID No:" (not "ID Number"). */
export const RECEIPT_ID_LABEL = "ID No:";

const RECEIPT_ID_LABEL_PATTERN = String.raw`ID\s*No\s*:?`;

/**
 * ID No: sits below the grey "RECEIPT PAID" banner on the left,
 * above Name and before Email/Tel (e.g. ID No: 822661092).
 */
function isLikelyPhoneNumber(digits: string): boolean {
  return digits.startsWith("254") && digits.length >= 11;
}

function findReceiptIdNumber(text: string): string {
  const normalized = normalizeWhitespace(text);

  const afterReceiptPaidBare = /RECEIPT\s+PAID[\s\S]{0,120}?(\d{7,9})\s*(?:Email|E-mail)/i.exec(
    normalized,
  );
  if (afterReceiptPaidBare?.[1]) {
    const digits = parseReceiptIdDigits(afterReceiptPaidBare[1]);
    if (digits && !isLikelyPhoneNumber(digits)) return digits;
  }

  const afterReceiptPaid = new RegExp(
    `RECEIPT\\s+PAID[\\s\\S]{0,160}?\\b${RECEIPT_ID_LABEL_PATTERN}\\s*((?:\\d\\s*){7,14})`,
    "i",
  ).exec(normalized);
  if (afterReceiptPaid?.[1]) {
    const digits = parseReceiptIdDigits(afterReceiptPaid[1]);
    if (digits) return digits;
  }

  const beforeEmail = new RegExp(
    `\\b${RECEIPT_ID_LABEL_PATTERN}\\s*((?:\\d\\s*){7,14})[\\s\\S]{0,50}?\\bEmail\\b`,
    "i",
  ).exec(normalized);
  if (beforeEmail?.[1]) {
    const digits = parseReceiptIdDigits(beforeEmail[1]);
    if (digits) return digits;
  }

  const beforeName = new RegExp(
    `\\b${RECEIPT_ID_LABEL_PATTERN}\\s*((?:\\d\\s*){7,14})[\\s\\S]{0,40}?\\bName\\b`,
    "i",
  ).exec(normalized);
  if (beforeName?.[1]) {
    const digits = parseReceiptIdDigits(beforeName[1]);
    if (digits) return digits;
  }

  const primaryLabel = new RegExp(
    `\\b${RECEIPT_ID_LABEL_PATTERN}\\s*((?:\\d\\s*){7,14})\\b`,
    "i",
  ).exec(normalized);
  if (primaryLabel?.[1]) {
    const digits = parseReceiptIdDigits(primaryLabel[1]);
    if (digits) return digits;
  }

  const ocrNoVariants = [
    new RegExp(`\\bI\\s*D\\s*No\\s*:?\\s*((?:\\d\\s*){7,14})\\b`, "i"),
    new RegExp(`\\bID\\s*N[o0]\\s*:?\\s*((?:\\d\\s*){7,14})\\b`, "i"),
  ];
  for (const pattern of ocrNoVariants) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const digits = parseReceiptIdDigits(match[1]);
    if (digits) return digits;
  }

  const looseAnchors = [
    ...normalized.matchAll(
      new RegExp(`\\b(?:I\\s*D\\s*No|ID\\s*No)\\s*:?\\s*((?:\\d[\\s]*){7,14})`, "gi"),
    ),
  ];
  for (const anchor of looseAnchors) {
    const digits = parseReceiptIdDigits(anchor[1] ?? "");
    if (digits) return digits;
  }

  return "";
}

/** Deep retry for ID number using customer-band OCR text. */
export function digDeeperReceiptIdNumber(texts: string[]): string {
  for (const source of texts) {
    const found = findReceiptIdNumber(source);
    if (found) return found;
  }

  const combined = texts.join("\n");
  const digitRuns = [...combined.matchAll(/\b(\d[\d\s]{6,12}\d)\b/g)];
  for (const match of digitRuns) {
    const digits = parseReceiptIdDigits(match[1] ?? "");
    if (!digits) continue;
    const index = match.index ?? -1;
    if (index < 0) continue;
    const context = combined.slice(Math.max(0, index - 40), index + 40);
    if (new RegExp(RECEIPT_ID_LABEL_PATTERN, "i").test(context) || /RECEIPT\s+PAID|Email|Name/i.test(context)) {
      return digits;
    }
  }

  return "";
}

function tryReceiptNameCandidate(raw: string): string {
  const refined = refineReceiptName(raw);
  return isLikelyReceiptName(refined) ? refined : "";
}

function findReceiptName(text: string, idNumber: string): string {
  const labeled = text.match(
    /\bName\s*:?\s*([A-Za-z][A-Za-z\s'./-]{4,}?)(?:\s+Email|\s+Tel|\s+Telephone|\s*$)/i,
  );
  if (labeled?.[1]) {
    const found = tryReceiptNameCandidate(labeled[1]);
    if (found) return found;
  }

  if (idNumber) {
    const afterId = new RegExp(
      `${RECEIPT_ID_LABEL_PATTERN}\\s*${idNumber}[\\s\\S]{0,80}?Name\\s*:?\\s*([A-Za-z][A-Za-z\\s'./-]{4,}?)(?:\\s+Email|\\s+Tel|$)`,
      "i",
    ).exec(text);
    if (afterId?.[1]) {
      const found = tryReceiptNameCandidate(afterId[1]);
      if (found) return found;
    }

    const idAnchor = text.match(
      new RegExp(
        `${RECEIPT_ID_LABEL_PATTERN}\\s*${idNumber}\\s+([A-Z][A-Z\\s'./-]{8,}?)(?:\\s+Email|\\s+Tel|\\s+@|$)`,
        "i",
      ),
    );
    if (idAnchor?.[1]) {
      const found = tryReceiptNameCandidate(idAnchor[1]);
      if (found) return found;
    }
  }

  const beforeEmail = text.match(
    /\b([A-Z][A-Z\s'./-]{8,}?)\s+(?:@|gmail|telephone|tel)\b/i,
  );
  if (beforeEmail?.[1]) {
    const found = tryReceiptNameCandidate(beforeEmail[1]);
    if (found) return found;
  }

  return "";
}

function findTotalKes(text: string): string {
  const patterns = [
    /Total\s+KES\s*[^\d]{0,12}([\d,]+(?:\.\d{2})?)/i,
    /Total\s+KES\s+([\d,]+(?:\.\d{2})?)/i,
    /\bTotal\b[^\n]{0,20}?([\d,]+)\s*$/im,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = parseAmountKes(match[1]);
    if (isValidReceiptTotalKes(String(value))) return String(value);
  }

  const serviceRows = [...text.matchAll(/\|\s*\d+\s*\|[^|]+\|\s*([\d,]+)\s*\|/g)];
  if (serviceRows.length >= 2) {
    const last = serviceRows[serviceRows.length - 1]?.[1];
    if (last) {
      const value = parseAmountKes(last);
      if (isValidReceiptTotalKes(String(value))) return String(value);
    }
  }

  return "";
}

export function extractRawReceiptFields(
  text: string,
  options?: {
    headerText?: string;
    customerText?: string;
    idText?: string;
    billRefText?: string;
    applicationText?: string;
    dateText?: string;
    headerValuesText?: string;
  },
): ReceiptFormRow {
  const normalized = normalizeWhitespace(text);
  const header = options?.headerText ? normalizeWhitespace(options.headerText) : "";
  const customer = options?.customerText ? normalizeWhitespace(options.customerText) : "";
  const idBand = options?.idText ? normalizeWhitespace(options.idText) : "";
  const billBand = options?.billRefText ? normalizeWhitespace(options.billRefText) : "";
  const applicationBand = options?.applicationText ? normalizeWhitespace(options.applicationText) : "";
  const dateBand = options?.dateText ? normalizeWhitespace(options.dateText) : "";
  const headerValuesBand = options?.headerValuesText
    ? normalizeWhitespace(options.headerValuesText)
    : "";

  const idSources = [idBand, customer, normalized].filter(Boolean);
  let idNumber = "";
  for (const source of idSources) {
    idNumber = findReceiptIdNumber(source);
    if (idNumber) break;
  }

  const nameSource = customer || normalized;
  const name = findReceiptName(nameSource, idNumber);

  const applicationSources = [applicationBand, headerValuesBand, header, normalized].filter(
    Boolean,
  );
  let applicationNo = "";
  const appContext = { idNumber };
  for (const source of applicationSources) {
    applicationNo =
      findApplicationNoInColumn(source, appContext) || findApplicationNo(source, appContext);
    if (applicationNo) break;
  }

  const dateSources = [dateBand, headerValuesBand, header, normalized].filter(Boolean);
  let date = "";
  for (const source of dateSources) {
    date = findReceiptDateInColumn(source) || findReceiptDate(source);
    if (date) break;
  }

  const billContext = { applicationNo, idNumber, date };
  const billSources = [billBand, header, normalized].filter(Boolean);
  let billReferenceNo = "";
  for (const source of billSources) {
    billReferenceNo =
      findBillReferenceInColumn(source, billContext) ||
      findBillReferenceNo(source, billContext);
    if (billReferenceNo) break;
  }

  return {
    name,
    idNumber,
    applicationNo,
    billReferenceNo,
    totalKes: findTotalKes(normalized),
    date,
  };
}

function pickField(
  rows: ReceiptFormRow[],
  field: keyof ReceiptFormRow,
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

function pickBestApplicationNo(rows: ReceiptFormRow[]): string {
  const idNumber = pickField(rows, "idNumber", isValidReceiptIdNumber, collapseDigits);
  const context = { idNumber };
  const candidates: string[] = [];
  for (const row of rows) {
    const raw = normalizeApplicationNo(String(row.applicationNo ?? "").trim());
    if (raw && isValidReceiptApplicationNo(raw, context)) candidates.push(raw);
  }
  if (!candidates.length) return "";
  return candidates.sort(
    (a, b) => scoreApplicationNo(b, context) - scoreApplicationNo(a, context),
  )[0]!;
}

function pickBestBillReferenceNo(rows: ReceiptFormRow[]): string {
  const context = {
    applicationNo: rows.find((r) => r.applicationNo)?.applicationNo,
    idNumber: rows.find((r) => r.idNumber)?.idNumber,
    date: rows.find((r) => r.date)?.date,
  };
  const candidates: string[] = [];
  for (const row of rows) {
    const corrected = applyBillRefOcrCorrections(String(row.billReferenceNo ?? "").trim(), context);
    if (corrected && isAcceptedReceiptBillRef(corrected, context)) {
      candidates.push(corrected);
    }
  }
  if (!candidates.length) return "";
  const real = candidates.find((code) => isValidReceiptBillRef(code, context));
  if (real) return real;
  return candidates.find((code) => isValidSyntheticBillReferenceNo(code)) ?? "";
}

export function mergeReceiptFormRows(rows: ReceiptFormRow[]): ReceiptFormRow {
  const idNumber = pickField(rows, "idNumber", isValidReceiptIdNumber, collapseDigits);
  return {
    name: pickField(rows, "name", isValidReceiptName, refineReceiptName),
    idNumber,
    applicationNo: pickBestApplicationNo(rows),
    billReferenceNo: pickBestBillReferenceNo(rows),
    totalKes: pickField(rows, "totalKes", isValidReceiptTotalKes, (v) => String(parseAmountKes(v))),
    date: pickField(rows, "date", isValidReceiptDate),
  };
}

export function verifyMissingReceiptFields(
  combinedText: string,
  row: ReceiptFormRow,
): ReceiptFormRow {
  const text = normalizeWhitespace(combinedText);
  const next = { ...row };

  const headerFields = parseHeaderValueRowFields(combinedText, {
    idNumber: next.idNumber,
    applicationNo: next.applicationNo,
    date: next.date,
  });

  if (!isValidReceiptApplicationNo(next.applicationNo, { idNumber: next.idNumber })) {
    const applicationNo =
      headerFields.applicationNo || findApplicationNo(text, { idNumber: next.idNumber });
    if (isValidReceiptApplicationNo(applicationNo, { idNumber: next.idNumber })) {
      next.applicationNo = applicationNo;
    }
  }

  const billContext = {
    applicationNo: next.applicationNo,
    idNumber: next.idNumber,
    date: next.date,
  };

  if (!isValidReceiptBillRef(next.billReferenceNo, billContext)) {
    const billReferenceNo =
      headerFields.billReferenceNo ||
      findBillReferenceNo(text, billContext) ||
      digDeeperBillReferenceNo([text], billContext);
    if (isValidReceiptBillRef(billReferenceNo, billContext)) {
      next.billReferenceNo = billReferenceNo;
    }
  }

  if (!isValidReceiptIdNumber(next.idNumber)) {
    const idNumber = findReceiptIdNumber(text) || digDeeperReceiptIdNumber([text]);
    if (isValidReceiptIdNumber(idNumber)) next.idNumber = idNumber;
  }

  if (!isValidReceiptName(next.name)) {
    const name = refineReceiptName(findReceiptName(text, next.idNumber));
    if (isValidReceiptName(name)) next.name = name;
  } else {
    next.name = refineReceiptName(next.name);
  }

  if (!isValidReceiptDate(next.date)) {
    const date = headerFields.date || findReceiptDate(text);
    if (isValidReceiptDate(date)) next.date = date;
  }

  if (!isValidReceiptTotalKes(next.totalKes)) {
    const totalKes = findTotalKes(text);
    if (isValidReceiptTotalKes(totalKes)) next.totalKes = totalKes;
  }

  return next;
}

export function finalizeReceiptFormRow(row: ReceiptFormRow): ReceiptFormRow {
  const applicationNo = normalizeApplicationNo(row.applicationNo);
  const idNumber = collapseDigits(row.idNumber);
  const dateRaw = row.date.trim();
  const date = isValidReceiptDate(dateRaw) ? dateRaw : parseLongDateMatch(dateRaw);
  const billReferenceNo = applyBillRefOcrCorrections(row.billReferenceNo, {
    applicationNo,
    idNumber,
    date,
  });
  const name = refineReceiptName(row.name);
  const totalKes = isValidReceiptTotalKes(row.totalKes)
    ? String(parseAmountKes(row.totalKes))
    : "";

  return {
    name: isValidReceiptName(name) ? name : "",
    idNumber: isValidReceiptIdNumber(idNumber) ? idNumber : "",
    applicationNo: isValidReceiptApplicationNo(applicationNo, { idNumber }) ? applicationNo : "",
    billReferenceNo: isAcceptedReceiptBillRef(billReferenceNo, {
      idNumber,
      applicationNo,
      date,
    })
      ? billReferenceNo
      : "",
    totalKes,
    date: isValidReceiptDate(date) ? date : "",
  };
}

export type ParseReceiptOcrOptions = {
  /** OCR from the top header band (application / bill ref / date row). */
  headerText?: string;
  /** OCR from the center bill-reference column crop. */
  billRefText?: string;
  /** OCR from the left application-number column crop. */
  applicationText?: string;
  /** OCR from the right date column crop. */
  dateText?: string;
  /** OCR from the header value row (PDL-… MM4R4Q3 date). */
  headerValuesText?: string;
  /** OCR from below RECEIPT PAID (ID No / Name / Email / Tel). */
  customerText?: string;
  /** OCR from the left ID No column crop. */
  idText?: string;
  extraTexts?: string[];
};

export function parseReceiptOcrText(rawText: string, options?: ParseReceiptOcrOptions): ReceiptFormRow {
  const headerSources = [
    options?.headerText,
    options?.headerValuesText,
    options?.billRefText,
    options?.applicationText,
    options?.dateText,
  ].filter((t): t is string => Boolean(t?.trim()));
  const customerSources = [options?.idText, options?.customerText].filter((t): t is string =>
    Boolean(t?.trim()),
  );
  const sources = [rawText, ...(options?.extraTexts ?? []), ...headerSources, ...customerSources].filter(
    (t) => t.trim().length > 0,
  );

  const fieldOptions = {
    headerText: options?.headerText,
    customerText: options?.customerText,
    idText: options?.idText,
    billRefText: options?.billRefText,
    applicationText: options?.applicationText,
    dateText: options?.dateText,
    headerValuesText: options?.headerValuesText,
  };

  const partials = sources.map((source) => extractRawReceiptFields(source, fieldOptions));

  if (options?.billRefText?.trim()) {
    partials.push(extractRawReceiptFields(options.billRefText, fieldOptions));
  }

  const merged = mergeReceiptFormRows(partials);
  const verified = verifyMissingReceiptFields(sources.join("\n"), merged);

  if (!isValidReceiptBillRef(verified.billReferenceNo, {
    applicationNo: verified.applicationNo,
    idNumber: verified.idNumber,
    date: verified.date,
  })) {
    const deeper = digDeeperBillReferenceNo(headerSources.length ? headerSources : sources, {
      applicationNo: verified.applicationNo,
      idNumber: verified.idNumber,
      date: verified.date,
    });
    if (deeper) verified.billReferenceNo = deeper;
  }

  if (!isValidReceiptIdNumber(verified.idNumber)) {
    const deeperId = digDeeperReceiptIdNumber(
      customerSources.length ? customerSources : sources,
    );
    if (deeperId) verified.idNumber = deeperId;
  }

  return finalizeReceiptFormRow(verified);
}

export function countValidReceiptFields(row: ReceiptFormRow): number {
  let count = 0;
  if (isValidReceiptName(row.name)) count += 1;
  if (isValidReceiptIdNumber(row.idNumber)) count += 1;
  if (isValidReceiptApplicationNo(row.applicationNo)) count += 1;
  if (isAcceptedReceiptBillRef(row.billReferenceNo)) count += 1;
  if (isValidReceiptTotalKes(row.totalKes)) count += 1;
  if (isValidReceiptDate(row.date)) count += 1;
  return count;
}

export function getMissingReceiptFieldIds(row: ReceiptFormRow): Array<keyof ReceiptFormRow> {
  const missing: Array<keyof ReceiptFormRow> = [];
  if (!isValidReceiptName(row.name)) missing.push("name");
  if (!isValidReceiptIdNumber(row.idNumber)) missing.push("idNumber");
  if (!isValidReceiptApplicationNo(row.applicationNo)) missing.push("applicationNo");
  if (!isAcceptedReceiptBillRef(row.billReferenceNo)) missing.push("billReferenceNo");
  if (!isValidReceiptTotalKes(row.totalKes)) missing.push("totalKes");
  if (!isValidReceiptDate(row.date)) missing.push("date");
  return missing;
}
