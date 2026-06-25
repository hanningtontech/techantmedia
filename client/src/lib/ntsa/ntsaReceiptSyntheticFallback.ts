import type { ReceiptFormRow } from "@shared/documentExtraction";
import {
  countValidReceiptFields,
  finalizeReceiptFormRow,
  isValidReceiptApplicationNo,
  isValidReceiptBillRef,
  isValidReceiptTotalKes,
  isValidSyntheticBillReferenceNo,
  isValidReceiptDate,
  isValidReceiptName,
  normalizeApplicationNo,
  normalizeBillReferenceNo,
  RECEIPT_TOTAL_KES_AMOUNTS,
  refineReceiptName,
} from "@shared/ntsaReceiptExtraction";
import credentials from "@/data/syntheticCredentials.json";

type PoolRow = {
  name: string;
  idNumber: string;
};

const POOL = credentials as PoolRow[];

export const SYNTHETIC_APPLICATION_PREFIX = "PDL-";
export const SYNTHETIC_APPLICATION_SUFFIX_LENGTH = 9;
export const SYNTHETIC_BILL_REF_LENGTH = 9;
export const SYNTHETIC_APPLICATION_PATTERN = /^PDL-[A-Z0-9]{9}$/;
export const SYNTHETIC_BILL_REF_PATTERN = /^[A-Z0-9]{9}$/;
export const RECEIPT_TOTAL_KES_OPTIONS = RECEIPT_TOTAL_KES_AMOUNTS.map(String) as [
  "550",
  "650",
];

const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MAX_SYNTHETIC_RECEIPT_YEAR = 2026;
const SYNTHETIC_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function randomIndex(exclude?: Set<number>): number {
  if (!POOL.length) return 0;
  const banned = exclude ?? new Set<number>();
  if (banned.size >= POOL.length) {
    return Math.floor(Math.random() * POOL.length);
  }
  let idx = Math.floor(Math.random() * POOL.length);
  let guard = 0;
  while (banned.has(idx) && guard < 50) {
    idx = Math.floor(Math.random() * POOL.length);
    guard += 1;
  }
  return idx;
}

function randomDigit(): string {
  return String(Math.floor(Math.random() * 10));
}

function randomAlphanumeric(length: number): string {
  return Array.from(
    { length },
    () => ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)]!,
  ).join("");
}

function randomMixedAlphanumeric(length: number): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = randomAlphanumeric(length);
    if (/[A-Z]/.test(value) && /\d/.test(value)) return value;
  }
  return `A${randomAlphanumeric(Math.max(1, length - 2))}1`.slice(0, length);
}

/** PDL- + exactly 9 alphanumeric characters (e.g. PDL-ZLE28K90G). */
export function generateSyntheticApplicationNo(): string {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = randomMixedAlphanumeric(SYNTHETIC_APPLICATION_SUFFIX_LENGTH);
    const candidate = `${SYNTHETIC_APPLICATION_PREFIX}${suffix}`;
    if (SYNTHETIC_APPLICATION_PATTERN.test(candidate) && isValidReceiptApplicationNo(candidate)) {
      return candidate;
    }
  }
  const suffix = randomMixedAlphanumeric(SYNTHETIC_APPLICATION_SUFFIX_LENGTH);
  return `${SYNTHETIC_APPLICATION_PREFIX}${suffix}`;
}

/** Pad a partial bill ref with random alphanumeric characters to exactly 9. */
export function padBillReferenceToNine(partial: string): string {
  const base = partial
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, SYNTHETIC_BILL_REF_LENGTH);
  if (base.length >= SYNTHETIC_BILL_REF_LENGTH) {
    const nine = base.slice(0, SYNTHETIC_BILL_REF_LENGTH);
    if (isValidSyntheticBillReferenceNo(nine)) return nine;
    return generateSyntheticBillReferenceNo();
  }
  const needed = SYNTHETIC_BILL_REF_LENGTH - base.length;
  if (needed <= 0) return generateSyntheticBillReferenceNo();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = `${base}${randomMixedAlphanumeric(needed)}`;
    if (SYNTHETIC_BILL_REF_PATTERN.test(candidate) && isValidSyntheticBillReferenceNo(candidate)) {
      return candidate;
    }
  }
  return `${base}${randomAlphanumeric(needed)}`;
}

/** Exactly 9 alphanumeric characters (e.g. ZLE28K90G). */
export function generateSyntheticBillReferenceNo(): string {
  return padBillReferenceToNine("");
}

/** Random KES 550 or KES 650. */
export function pickSyntheticTotalKes(): string {
  const options = RECEIPT_TOTAL_KES_OPTIONS;
  return options[Math.floor(Math.random() * options.length)]!;
}

/** Random receipt date with year not exceeding 2026. */
export function generateSyntheticReceiptDate(): string {
  const minYear = 2024;
  const year =
    minYear + Math.floor(Math.random() * (MAX_SYNTHETIC_RECEIPT_YEAR - minYear + 1));
  const month = SYNTHETIC_MONTHS[Math.floor(Math.random() * SYNTHETIC_MONTHS.length)]!;
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
  return `${day} ${month} ${year}`;
}

function normalizePoolIdNumber(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length < 7) digits = digits.padEnd(7, randomDigit());
  if (digits.length > 9) digits = digits.slice(0, 9);
  return digits;
}

function pickSyntheticName(exclude?: Set<number>): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const idx = randomIndex(exclude);
    const name = refineReceiptName(POOL[idx]!.name);
    if (isValidReceiptName(name)) return name;
  }
  const fallback = refineReceiptName(POOL[0]?.name ?? "JOHN DOE SMITH");
  return isValidReceiptName(fallback) ? fallback : "JOHN DOE SMITH";
}

function pickSyntheticIdNumber(exclude?: Set<number>): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const idx = randomIndex(exclude);
    const digits = normalizePoolIdNumber(POOL[idx]!.idNumber);
    if (digits.length >= 7 && digits.length <= 9) return digits;
  }
  const prefix = 30 + Math.floor(Math.random() * 12);
  return `${prefix}${Array.from({ length: 7 }, randomDigit).join("")}`.slice(0, 9);
}

function pickSyntheticApplicationNo(idNumber: string): string {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = generateSyntheticApplicationNo();
    if (isValidReceiptApplicationNo(candidate, { idNumber })) return candidate;
  }
  return generateSyntheticApplicationNo();
}

function resolveBillReferenceNo(
  partial: string,
  context: { applicationNo?: string; idNumber?: string; date?: string },
): string {
  const collapsed = normalizeBillReferenceNo(partial.trim());
  if (collapsed && isValidReceiptBillRef(collapsed, context)) {
    return collapsed;
  }
  if (collapsed && isValidSyntheticBillReferenceNo(collapsed)) {
    return collapsed;
  }
  const prefix = partial.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (prefix.length > 0) {
    return padBillReferenceToNine(prefix);
  }
  return generateSyntheticBillReferenceNo();
}

function pickSyntheticDate(): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateSyntheticReceiptDate();
    if (isValidReceiptDate(candidate)) return candidate;
  }
  return `01 January ${MAX_SYNTHETIC_RECEIPT_YEAR}`;
}

function fieldEmpty(value: string): boolean {
  return !value.trim();
}

function needsSyntheticApplicationNo(value: string, idNumber: string): boolean {
  const normalized = normalizeApplicationNo(value.trim());
  if (!normalized) return true;
  return !isValidReceiptApplicationNo(normalized, { idNumber });
}

function needsSyntheticBillReferenceNo(
  value: string,
  context: { applicationNo?: string; idNumber?: string; date?: string },
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (isValidSyntheticBillReferenceNo(trimmed)) return false;
  return !isValidReceiptBillRef(trimmed, context);
}

/** Guarantee Application No and Bill Reference are valid — real OCR or strict fallback formats. */
export function strictFinalizeReceiptHeaders(row: ReceiptFormRow): {
  row: ReceiptFormRow;
  usedSyntheticFallback: boolean;
} {
  const { row: ensured, usedSyntheticFallback } = ensureReceiptHeaderFallbacks(row);
  let applicationNo = normalizeApplicationNo(ensured.applicationNo);
  let billReferenceNo = ensured.billReferenceNo;
  let usedFallback = usedSyntheticFallback;

  const idNumber = ensured.idNumber;
  if (!isValidReceiptApplicationNo(applicationNo, { idNumber })) {
    applicationNo = pickSyntheticApplicationNo(idNumber);
    usedFallback = true;
  }

  const billContext = {
    applicationNo,
    idNumber,
    date: ensured.date,
  };

  const normalizedBill = normalizeBillReferenceNo(billReferenceNo);
  const billAccepted =
    isValidReceiptBillRef(normalizedBill, billContext) ||
    isValidSyntheticBillReferenceNo(normalizedBill);

  if (!billAccepted) {
    billReferenceNo = resolveBillReferenceNo(billReferenceNo, billContext);
    usedFallback = true;
  } else {
    billReferenceNo = normalizedBill;
  }

  return {
    row: finalizeReceiptFormRow({
      ...ensured,
      applicationNo,
      billReferenceNo,
    }),
    usedSyntheticFallback: usedFallback,
  };
}

/**
 * Always fill Application No and Bill Reference when missing or invalid.
 * Application No → PDL- + 9 alphanumeric. Bill Reference → 9 alphanumeric.
 */
export function ensureReceiptHeaderFallbacks(row: ReceiptFormRow): {
  row: ReceiptFormRow;
  usedSyntheticFallback: boolean;
} {
  const finalized = finalizeReceiptFormRow(row);
  const idNumber = finalized.idNumber;
  let applicationNo = finalized.applicationNo;
  let billReferenceNo = finalized.billReferenceNo;
  let usedSyntheticFallback = false;

  if (needsSyntheticApplicationNo(applicationNo, idNumber)) {
    applicationNo = pickSyntheticApplicationNo(idNumber);
    usedSyntheticFallback = true;
  }

  const billContext = {
    applicationNo,
    idNumber,
    date: finalized.date,
  };

  if (needsSyntheticBillReferenceNo(billReferenceNo, billContext)) {
    billReferenceNo = resolveBillReferenceNo(row.billReferenceNo || billReferenceNo, billContext);
    usedSyntheticFallback = true;
  }

  let totalKes = finalized.totalKes;
  if (!isValidReceiptTotalKes(totalKes)) {
    totalKes = pickSyntheticTotalKes();
    usedSyntheticFallback = true;
  }

  return {
    row: finalizeReceiptFormRow({
      ...finalized,
      applicationNo,
      billReferenceNo,
      totalKes,
    }),
    usedSyntheticFallback,
  };
}

/** Fill empty receipt fields from the random credential pool / generated codes. */
export function fillEmptyReceiptFieldsFromSynthetic(row: ReceiptFormRow): ReceiptFormRow {
  const finalized = finalizeReceiptFormRow(row);
  const header = ensureReceiptHeaderFallbacks(finalized);
  const needsName = fieldEmpty(header.row.name);
  const needsId = fieldEmpty(header.row.idNumber);
  const needsDate = fieldEmpty(header.row.date);
  const needsTotal = !isValidReceiptTotalKes(header.row.totalKes);

  if (!needsName && !needsId && !needsDate && !needsTotal) {
    return header.row;
  }

  const used = new Set<number>();
  const name = needsName ? pickSyntheticName(used) : header.row.name;
  if (needsName) used.add(0);

  const idNumber = needsId ? pickSyntheticIdNumber(used) : header.row.idNumber;
  const date = needsDate ? pickSyntheticDate() : header.row.date;
  const totalKes = needsTotal ? pickSyntheticTotalKes() : header.row.totalKes;

  return finalizeReceiptFormRow({
    ...header.row,
    name,
    idNumber,
    date,
    totalKes,
  });
}

export function applyReceiptSyntheticFallback(
  row: ReceiptFormRow,
  validFieldCount?: number,
): { row: ReceiptFormRow; usedSyntheticFallback: boolean } {
  const before = finalizeReceiptFormRow(row);
  const header = ensureReceiptHeaderFallbacks(before);
  const valid = validFieldCount ?? countValidReceiptFields(before);
  const needsOtherFallback =
    valid < 3 ||
    fieldEmpty(before.name) ||
    fieldEmpty(before.idNumber) ||
    fieldEmpty(before.date) ||
    !isValidReceiptTotalKes(before.totalKes);

  if (!needsOtherFallback && !header.usedSyntheticFallback) {
    return { row: header.row, usedSyntheticFallback: false };
  }

  const filled = fillEmptyReceiptFieldsFromSynthetic(before);
  const usedSyntheticFallback =
    header.usedSyntheticFallback ||
    (fieldEmpty(before.name) && !!filled.name.trim()) ||
    (fieldEmpty(before.idNumber) && !!filled.idNumber.trim()) ||
    (fieldEmpty(before.date) && !!filled.date.trim()) ||
    needsSyntheticApplicationNo(before.applicationNo, before.idNumber) ||
    needsSyntheticBillReferenceNo(before.billReferenceNo, {
      applicationNo: before.applicationNo,
      idNumber: before.idNumber,
      date: before.date,
    });

  return { row: filled, usedSyntheticFallback };
}
