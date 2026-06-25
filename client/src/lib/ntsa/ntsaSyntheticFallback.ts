import { countValidNtsaFields, finalizeNtsaFormRow, type NtsaFormRow } from "@shared/ntsaExtraction";
import credentials from "@/data/syntheticCredentials.json";

export type SyntheticCredential = {
  name: string;
  idNumber: string;
  testApplicationNumber: string;
  amount: string;
  date: string;
};

const POOL = credentials as SyntheticCredential[];

/** Synthetic fallback ID: 8 digits, first two digits between 30 and 41. */
export const SYNTHETIC_ID_PREFIX_MIN = 30;
export const SYNTHETIC_ID_PREFIX_MAX = 41;
export const SYNTHETIC_TDB_SUFFIX_LENGTH = 9;

const TDB_SUFFIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function isValidSyntheticIdNumber(id: string): boolean {
  const digits = id.replace(/\D/g, "");
  if (digits.length !== 8) return false;
  const prefix = Number(digits.slice(0, 2));
  return prefix >= SYNTHETIC_ID_PREFIX_MIN && prefix <= SYNTHETIC_ID_PREFIX_MAX;
}

export function isValidSyntheticTestApp(value: string): boolean {
  const normalized = value.toUpperCase().replace(/\s+/g, "");
  return /^TDB-[A-Z0-9]{9}$/.test(normalized);
}

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

function randomSuffixChar(): string {
  return TDB_SUFFIX_CHARS[Math.floor(Math.random() * TDB_SUFFIX_CHARS.length)]!;
}

/** Build an 8-digit ID with prefix 30–41 (fallback-only). */
export function generateSyntheticIdNumber(): string {
  const prefix = SYNTHETIC_ID_PREFIX_MIN + Math.floor(Math.random() * (SYNTHETIC_ID_PREFIX_MAX - SYNTHETIC_ID_PREFIX_MIN + 1));
  const suffix = Array.from({ length: 6 }, randomDigit).join("");
  return `${prefix}${suffix}`;
}

/** Normalize pool ID to 8 digits with prefix 30–41 (fallback-only). */
export function normalizeSyntheticIdNumber(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length < 8) digits = digits.padEnd(8, randomDigit());
  if (digits.length > 8) digits = digits.slice(0, 8);

  let prefix = Number(digits.slice(0, 2));
  if (!Number.isFinite(prefix) || prefix < SYNTHETIC_ID_PREFIX_MIN || prefix > SYNTHETIC_ID_PREFIX_MAX) {
    prefix = SYNTHETIC_ID_PREFIX_MIN + Math.floor(Math.random() * (SYNTHETIC_ID_PREFIX_MAX - SYNTHETIC_ID_PREFIX_MIN + 1));
    digits = `${prefix}${digits.slice(2, 8)}`.padEnd(8, randomDigit()).slice(0, 8);
  }

  return digits;
}

/** Build TDB- + exactly 9 alphanumeric characters (fallback-only). */
export function generateSyntheticTestApp(): string {
  const suffix = Array.from({ length: SYNTHETIC_TDB_SUFFIX_LENGTH }, randomSuffixChar).join("");
  return `TDB-${suffix}`;
}

/** Normalize pool test app to TDB- + 9 alphanumeric (fallback-only). */
export function normalizeSyntheticTestApp(raw: string): string {
  let suffix = raw.toUpperCase().replace(/^TDB-?/, "").replace(/[^A-Z0-9]/g, "");

  if (suffix.length < SYNTHETIC_TDB_SUFFIX_LENGTH) {
    while (suffix.length < SYNTHETIC_TDB_SUFFIX_LENGTH) {
      suffix += randomSuffixChar();
    }
  } else if (suffix.length > SYNTHETIC_TDB_SUFFIX_LENGTH) {
    suffix = suffix.slice(0, SYNTHETIC_TDB_SUFFIX_LENGTH);
  }

  return `TDB-${suffix}`;
}

function pickSyntheticIdNumber(exclude?: Set<number>): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const idx = randomIndex(exclude);
    const candidate = normalizeSyntheticIdNumber(POOL[idx]!.idNumber);
    if (isValidSyntheticIdNumber(candidate)) return candidate;
  }
  return generateSyntheticIdNumber();
}

function pickSyntheticTestApplicationNumber(exclude?: Set<number>): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const idx = randomIndex(exclude);
    const candidate = normalizeSyntheticTestApp(POOL[idx]!.testApplicationNumber);
    if (isValidSyntheticTestApp(candidate)) return candidate;
  }
  return generateSyntheticTestApp();
}

/** Pick each field from a different random row; ID and TDB follow fallback rules. */
export function pickIndependentSyntheticFields(): SyntheticCredential {
  const used = new Set<number>();
  const nameIdx = randomIndex(used);
  used.add(nameIdx);
  const amountIdx = randomIndex(used);
  used.add(amountIdx);
  const dateIdx = randomIndex(used);

  return {
    name: POOL[nameIdx]!.name,
    idNumber: pickSyntheticIdNumber(used),
    testApplicationNumber: pickSyntheticTestApplicationNumber(used),
    amount: POOL[amountIdx]!.amount,
    date: POOL[dateIdx]!.date,
  };
}

function fieldEmpty(value: string): boolean {
  return !value.trim();
}

/**
 * Fill empty fields from synthetic data (independent random rows per field).
 * ID and test application number use fallback-only formats when OCR failed.
 */
export function fillEmptyFieldsFromSynthetic(row: NtsaFormRow): NtsaFormRow {
  if (!POOL.length) return row;

  const finalized = finalizeNtsaFormRow(row);
  const needsName = fieldEmpty(finalized.name);
  const needsId = fieldEmpty(finalized.idNumber);
  const needsTdb = fieldEmpty(finalized.testApplicationNumber);
  const needsAmount = fieldEmpty(finalized.amount);
  const needsDate = fieldEmpty(finalized.date);

  if (!needsName && !needsId && !needsTdb && !needsAmount && !needsDate) {
    return finalized;
  }

  const synthetic = pickIndependentSyntheticFields();
  return finalizeNtsaFormRow({
    name: needsName ? synthetic.name : finalized.name,
    idNumber: needsId ? synthetic.idNumber : finalized.idNumber,
    testApplicationNumber: needsTdb ? synthetic.testApplicationNumber : finalized.testApplicationNumber,
    amount: needsAmount ? synthetic.amount : finalized.amount,
    date: needsDate ? synthetic.date : finalized.date,
  });
}

/**
 * When most extraction stages failed (< 3 valid fields), fill all still-empty fields.
 */
export function applySyntheticFallback(row: NtsaFormRow, validFieldCount?: number): NtsaFormRow {
  const valid = validFieldCount ?? countValidNtsaFields(row);
  if (valid >= 3) return finalizeNtsaFormRow(row);
  return fillEmptyFieldsFromSynthetic(row);
}
