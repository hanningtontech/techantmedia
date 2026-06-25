import type { IdlFormRow } from "@shared/documentExtraction";
import {
  countValidIdlFields,
  isValidIdlDate,
  isValidIdlIdNumber,
  isValidIdlName,
  isValidIdlNo,
} from "@shared/ntsaIdlExtraction";
import credentials from "@/data/syntheticCredentials.json";

type PoolRow = {
  name: string;
  idNumber: string;
  date: string;
};

const POOL = credentials as PoolRow[];

export const SYNTHETIC_IDL_PATTERN = /^IDL-[A-Z0-9]{9}$/;
const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateSyntheticIdlNo(): string {
  let suffix = "";
  for (let i = 0; i < 9; i += 1) {
    suffix += ALPHANUM[randomInt(0, ALPHANUM.length - 1)];
  }
  return `IDL-${suffix}`;
}

export function generateSyntheticIdNumber(): string {
  const prefix = randomInt(25, 41);
  let rest = "";
  for (let i = 0; i < 6; i += 1) {
    rest += String(randomInt(0, 9));
  }
  return `${prefix}${rest}`;
}

export function generateSyntheticIdlDate(): string {
  const months = [
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
  const month = randomFrom([...months]);
  const day = String(randomInt(1, 28)).padStart(2, "0");
  const year = randomInt(2023, 2026);
  return `${day} ${month} ${year}`;
}

function pickSyntheticName(exclude?: Set<number>): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const idx = randomInt(0, POOL.length - 1);
    if (exclude?.has(idx)) continue;
    const name = POOL[idx]!.name.trim();
    if (isValidIdlName(name)) return name;
  }
  return "JOHN DOE SMITH";
}

function pickSyntheticIdNumber(exclude?: Set<number>): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const idx = randomInt(0, POOL.length - 1);
    if (exclude?.has(idx)) continue;
    const id = POOL[idx]!.idNumber.replace(/\D/g, "");
    if (id.length === 8) return id;
  }
  return generateSyntheticIdNumber();
}

function pickSyntheticDate(): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = POOL[randomInt(0, POOL.length - 1)]!.date.trim();
    if (isValidIdlDate(candidate)) return candidate;
  }
  return generateSyntheticIdlDate();
}

export function fillEmptyIdlFieldsFromSynthetic(row: IdlFormRow): IdlFormRow {
  const used = new Set<number>();
  const needsName = !isValidIdlName(row.name);
  const needsId = !isValidIdlIdNumber(row.idNumber);
  const needsDate = !isValidIdlDate(row.date);
  const needsIdl = !isValidIdlNo(row.idlNo);

  return {
    name: needsName ? pickSyntheticName(used) : row.name,
    idNumber: needsId ? pickSyntheticIdNumber(used) : row.idNumber,
    date: needsDate ? pickSyntheticDate() : row.date,
    idlNo: needsIdl ? generateSyntheticIdlNo() : row.idlNo,
  };
}

export function applyIdlSyntheticFallback(row: IdlFormRow): {
  row: IdlFormRow;
  usedSyntheticFallback: boolean;
} {
  const beforeCount = countValidIdlFields(row);
  const filled = fillEmptyIdlFieldsFromSynthetic(row);
  const afterCount = countValidIdlFields(filled);
  return {
    row: filled,
    usedSyntheticFallback: afterCount > beforeCount,
  };
}
