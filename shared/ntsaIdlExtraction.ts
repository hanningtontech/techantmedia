import type { IdlFormRow } from "./documentExtraction";

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

const IDL_NOISE_WORDS = new Set([
  "NATIONAL",
  "TRANSPORT",
  "SAFETY",
  "AUTHORITY",
  "NTSA",
  "REPUBLIC",
  "KENYA",
  "INTERIM",
  "DRIVING",
  "LICENSE",
  "LICENCE",
  "FULL",
  "NAME",
  "NUMBER",
  "DRIVE",
  "CLASS",
  "FROM",
  "DATE",
  "EXPIRY",
  "EXPIRES",
  "NOTE",
  "DOCUMENT",
  "COMPUTER",
  "GENERATED",
  "VALID",
  "ISSUED",
  "IDL",
  "NO",
]);

const EXPECTED_NAME_WORDS = 3;
const IDL_SUFFIX_LENGTH = 9;
const IDL_NUMBER_PATTERN = /^IDL-[A-Z0-9]{6,12}$/;
const IDL_STRICT_PATTERN = /^IDL-[A-Z0-9]{9}$/;
const MIN_IDL_YEAR = 2018;
const MAX_IDL_YEAR = 2030;

const ID_OCR_DIGIT_MAP: Record<string, string> = {
  O: "0",
  o: "0",
  I: "1",
  l: "1",
  S: "5",
  s: "5",
  B: "8",
  Z: "2",
};

const MONTH_ALIASES: Record<string, string> = {
  jan: "January",
  january: "January",
  feb: "February",
  february: "February",
  mar: "March",
  march: "March",
  apr: "April",
  april: "April",
  may: "May",
  jun: "June",
  june: "June",
  jul: "July",
  july: "July",
  aug: "August",
  august: "August",
  sep: "September",
  sept: "September",
  september: "September",
  oct: "October",
  october: "October",
  nov: "November",
  novem: "November",
  novemb: "November",
  november: "November",
  dec: "December",
  december: "December",
};

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function padDay(day: string): string {
  const n = Number(day);
  if (!Number.isFinite(n) || n < 1 || n > 31) return day;
  return String(n).padStart(2, "0");
}

function formatLongDate(day: string, monthName: string, year: string): string {
  const monthKey = monthName.toLowerCase();
  if (!MONTH_INDEX[monthKey]) return "";
  return `${padDay(day)} ${monthName} ${year}`;
}

function isIdlNameNoiseWord(word: string): boolean {
  if (!word) return true;
  if (IDL_NOISE_WORDS.has(word)) return true;
  if (word.length === 1) return true;
  if (/^\d+$/.test(word)) return true;
  if (/^IDL[-\s]?[A-Z0-9]+$/i.test(word)) return true;
  return false;
}

function cleanIdlName(value: string): string {
  let name = value
    .replace(/[|_]/g, " ")
    .replace(/^[\s•\-*.\d:]+/, "")
    .replace(/\b(?:Full\s+)?Name\s*:?\s*/i, "")
    .replace(/\bIDL[-\s]?[A-Z0-9]+\b/gi, " ")
    .replace(/\b0([A-Z]{3,})\b/gi, "O$1")
    .replace(/[^A-Za-z\s'./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  name = name
    .split(/\s+/)
    .filter((word) => word && !isIdlNameNoiseWord(word))
    .map(fixNameWordOcr)
    .join(" ");

  return name;
}

function trimToThreeIdlNameWords(name: string): string {
  const words = name.split(/\s+/).filter((word) => word && !isIdlNameNoiseWord(word));
  if (words.length <= EXPECTED_NAME_WORDS) return words.join(" ");
  return words.slice(0, EXPECTED_NAME_WORDS).join(" ");
}

function fixNameWordOcr(word: string): string {
  let fixed = word.toUpperCase();
  if (/^0/.test(fixed)) fixed = `O${fixed.slice(1)}`;
  if (fixed.endsWith("H") && fixed.length >= 4) {
    const alt = `${fixed.slice(0, -1)}O`;
    if (alt.length >= 4) fixed = alt;
  }
  return fixed;
}

export function refineIdlName(name: string): string {
  return trimToThreeIdlNameWords(cleanIdlName(name));
}

export function normalizeIdlNo(raw: string): string {
  let value = raw.toUpperCase().replace(/\s+/g, "");
  value = value.replace(/^1DL/, "IDL");
  value = value.replace(/^IDL([A-Z0-9])/, "IDL-$1");
  if (!value.startsWith("IDL-")) return "";

  const suffix = value.slice(4);
  if (suffix.length > IDL_SUFFIX_LENGTH) {
    return `IDL-${suffix.slice(0, IDL_SUFFIX_LENGTH)}`;
  }
  return value;
}

export function isStrictIdlNo(value: string): boolean {
  return IDL_STRICT_PATTERN.test(normalizeIdlNo(value));
}

export function isStrictIdlIdNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /^\d{8}$/.test(digits);
}

export function correctIdlIdNumber(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 8 && isStrictIdlIdNumber(digits)) return digits;

  const mapped = raw
    .split("")
    .map((ch) => ID_OCR_DIGIT_MAP[ch] ?? ch)
    .join("")
    .replace(/\D/g, "");
  if (mapped.length === 8) return mapped;

  if (digits.length === 9) {
    const trimmedStart = digits.slice(1);
    if (isStrictIdlIdNumber(trimmedStart)) return trimmedStart;
    const trimmedEnd = digits.slice(0, 8);
    if (isStrictIdlIdNumber(trimmedEnd)) return trimmedEnd;
  }

  if (digits.length === 7) {
    const padded = `0${digits}`;
    if (isStrictIdlIdNumber(padded)) return padded;
    const paddedEnd = `${digits}0`;
    if (isStrictIdlIdNumber(paddedEnd)) return paddedEnd;
  }

  return digits.length <= 8 ? digits : digits.slice(0, 8);
}

export function isValidIdlNo(value: string): boolean {
  const normalized = normalizeIdlNo(value);
  return IDL_NUMBER_PATTERN.test(normalized);
}

export function isValidIdlName(value: string): boolean {
  if (!value || value.length < 5) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length !== EXPECTED_NAME_WORDS) return false;
  return words.every(
    (word) => /^[A-Z][A-Z'./-]*$/.test(word) && !isIdlNameNoiseWord(word) && word.length > 1,
  );
}

export function isValidIdlIdNumber(value: string): boolean {
  const digits = correctIdlIdNumber(value);
  if (!digits || digits === "11") return false;
  return isStrictIdlIdNumber(digits) || (digits.length >= 7 && digits.length <= 8);
}

export function isPlausibleIdlDate(value: string): boolean {
  if (!isValidIdlDate(value)) return false;
  const yearMatch = /\d{4}$/.exec(value.trim());
  if (!yearMatch) return false;
  const year = Number(yearMatch[0]);
  return year >= MIN_IDL_YEAR && year <= MAX_IDL_YEAR;
}

export function isValidIdlDate(value: string): boolean {
  return new RegExp(`^\\d{2}\\s+(?:${MONTHS})\\s+\\d{4}$`, "i").test(value.trim());
}

function normalizeMonthToken(raw: string): string {
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  return MONTH_ALIASES[key] ?? "";
}

function parseLongDateMatch(raw: string): string {
  const exact = new RegExp(`^(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})$`, "i").exec(raw.trim());
  if (exact?.[1] && exact[2] && exact[3]) {
    return formatLongDate(exact[1], exact[2], exact[3]);
  }

  const fuzzy = /^(\d{1,2})\s+([A-Za-z]{3,12})\s+((?:20)?\d{2})$/.exec(raw.trim());
  if (fuzzy?.[1] && fuzzy[2] && fuzzy[3]) {
    const month = normalizeMonthToken(fuzzy[2]);
    let year = fuzzy[3];
    if (year.length === 2) year = `20${year}`;
    if (month) return formatLongDate(fuzzy[1], month, year);
  }

  return "";
}

function findIdlNo(text: string): string {
  const labeled = text.match(/\bIDL\s*No\s*:?\s*(IDL[-\s]?[A-Z0-9]{6,12})/i);
  if (labeled?.[1]) {
    const normalized = normalizeIdlNo(labeled[1]);
    if (isValidIdlNo(normalized)) return normalized;
  }

  const bare = text.match(/\b(IDL[-\s][A-Z0-9]{6,12})\b/i);
  if (bare?.[1]) {
    const normalized = normalizeIdlNo(bare[1]);
    if (isValidIdlNo(normalized)) return normalized;
  }

  return "";
}

function findIdNumber(text: string): string {
  const idLabel = "(?:I\\s*D|1\\s*D)\\s*Number";

  const labeled = new RegExp(`${idLabel}\\s*:?\\s*(\\d[\\d\\s]{6,12})`, "i").exec(text);
  if (labeled?.[1]) {
    const digits = correctIdlIdNumber(labeled[1]);
    if (isValidIdlIdNumber(digits)) return digits;
  }

  const afterLabel = new RegExp(`${idLabel}[\\s\\S]{0,40}?(\\d{7,9})`, "i").exec(text);
  if (afterLabel?.[1]) {
    const digits = correctIdlIdNumber(afterLabel[1]);
    if (isValidIdlIdNumber(digits)) return digits;
  }

  const fallback = text.match(/\b(?:I\s*D\s*No|ID\s*NO|Identification\s*No)\s*:?\s*(\d[\d\s]{6,12})/i);
  if (fallback?.[1]) {
    const digits = correctIdlIdNumber(fallback[1]);
    if (isValidIdlIdNumber(digits)) return digits;
  }

  const standalone = text.match(/\b(\d{8})\b/g) ?? [];
  for (const match of standalone) {
    if (isStrictIdlIdNumber(match)) return match;
  }

  const sevenOrNine = text.match(/\b(\d{7,9})\b/g) ?? [];
  for (const match of sevenOrNine) {
    const corrected = correctIdlIdNumber(match);
    if (isStrictIdlIdNumber(corrected)) return corrected;
  }

  return "";
}

function findNameCandidates(text: string): string[] {
  const candidates: string[] = [];

  const labeled = text.match(/\b(?:Full\s+)?Name\s*:?\s*([A-Za-z][A-Za-z\s,.'/-]{5,})/i);
  if (labeled?.[1]) candidates.push(labeled[1]);

  const applicant = text.match(/\bApplicant\s+Name\s*:?\s*([A-Za-z][A-Za-z\s,.'/-]{5,})/i);
  if (applicant?.[1]) candidates.push(applicant[1]);

  const tripleMatches = text.matchAll(/\b([A-Z][A-Z'./-]{1,}\s+[A-Z][A-Z'./-]{2,}\s+[A-Z0-9][A-Z'./-]{1,})\b/g);
  for (const match of Array.from(tripleMatches)) {
    if (match[1]) candidates.push(match[1]);
  }

  return candidates;
}

function findName(text: string, idNumber: string): string {
  for (const raw of findNameCandidates(text)) {
    const name = refineIdlName(raw);
    if (isValidIdlName(name)) return name;
  }

  if (idNumber) {
    const beforeId = new RegExp(
      `([A-Z][A-Z\\s'./-]{8,}?)\\s+(?:I\\s*D|1\\s*D)\\s*Number\\s*:?\\s*${idNumber}`,
      "i",
    ).exec(text);
    if (beforeId?.[1]) {
      const name = refineIdlName(beforeId[1]);
      if (isValidIdlName(name)) return name;
    }
  }

  return "";
}

function findFromDate(text: string): string {
  const labeled = text.match(
    new RegExp(
      `From\\s+Date\\s*:?\\s*(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})`,
      "i",
    ),
  );
  if (labeled?.[1]) {
    const formatted = parseLongDateMatch(labeled[1]);
    if (formatted && isValidIdlDate(formatted)) return formatted;
  }

  const nearFrom = text.match(
    new RegExp(`From[\\s\\S]{0,40}?(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{2,4})`, "i"),
  );
  if (nearFrom?.[1]) {
    const formatted = parseLongDateMatch(nearFrom[1]);
    if (formatted && isPlausibleIdlDate(formatted)) return formatted;
  }

  const datePattern = new RegExp(`\\b(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})\\b`, "gi");
  const dates = Array.from(text.matchAll(datePattern));
  if (dates[0]?.[1]) {
    const formatted = parseLongDateMatch(dates[0][1]);
    if (formatted && isPlausibleIdlDate(formatted)) return formatted;
  }

  const fuzzyPattern = /\b(\d{1,2})\s+([A-Za-z]{3,12})\s+((?:20)?\d{2})\b/g;
  const fuzzyDates = Array.from(text.matchAll(fuzzyPattern));
  for (const match of fuzzyDates) {
    if (!match[1] || !match[2] || !match[3]) continue;
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    const formatted = parseLongDateMatch(`${match[1]} ${match[2]} ${year}`);
    if (formatted && isPlausibleIdlDate(formatted)) return formatted;
  }

  return "";
}

export function digDeeperIdlIdNumber(texts: string[]): string {
  for (const text of texts) {
    const found = findIdNumber(text);
    if (found) return found;
  }
  return "";
}

export function digDeeperIdlName(texts: string[]): string {
  for (const text of texts) {
    const found = findName(text, findIdNumber(text));
    if (found) return found;
  }
  return "";
}

export function digDeeperIdlDate(texts: string[]): string {
  for (const text of texts) {
    const found = findFromDate(text);
    if (found) return found;
  }
  return "";
}

export function mergeIdlFormRows(rows: IdlFormRow[]): IdlFormRow {
  const merged: IdlFormRow = { name: "", idNumber: "", idlNo: "", date: "" };
  for (const row of rows) {
    if (!merged.name && row.name) merged.name = row.name;
    if (!merged.idNumber && row.idNumber) merged.idNumber = row.idNumber;
    if (!merged.idlNo && row.idlNo) merged.idlNo = row.idlNo;
    if (!merged.date && row.date) merged.date = row.date;
  }
  return merged;
}

/** Apply OCR corrections and strict normalization to a parsed row. */
export function finalizeIdlFormRow(row: IdlFormRow): IdlFormRow {
  const name = refineIdlName(row.name);
  const idNumber = correctIdlIdNumber(row.idNumber);
  const idlNo = normalizeIdlNo(row.idlNo);
  const parsedDate = digDeeperIdlDate([row.date]) || row.date.trim();

  return {
    name: isValidIdlName(name) ? name : "",
    idNumber: isStrictIdlIdNumber(idNumber)
      ? idNumber
      : isValidIdlIdNumber(idNumber)
        ? correctIdlIdNumber(idNumber)
        : "",
    idlNo: isValidIdlNo(idlNo) ? idlNo : "",
    date: isPlausibleIdlDate(parsedDate) ? parsedDate : isValidIdlDate(parsedDate) ? parsedDate : "",
  };
}

export function parseIdlOcrText(text: string): IdlFormRow {
  const normalized = normalizeWhitespace(text);
  const idlNo = findIdlNo(normalized);
  const idNumber = findIdNumber(normalized);
  const name = findName(normalized, idNumber);
  const date = findFromDate(normalized);

  return finalizeIdlFormRow({ name, idNumber, idlNo, date });
}

export function countValidIdlFields(row: IdlFormRow): number {
  let count = 0;
  if (isValidIdlName(row.name)) count += 1;
  if (isValidIdlIdNumber(row.idNumber)) count += 1;
  if (isValidIdlNo(row.idlNo)) count += 1;
  if (isValidIdlDate(row.date)) count += 1;
  return count;
}

export function getMissingIdlFieldIds(row: IdlFormRow): Array<keyof IdlFormRow> {
  const missing: Array<keyof IdlFormRow> = [];
  if (!isValidIdlName(row.name)) missing.push("name");
  if (!isValidIdlIdNumber(row.idNumber)) missing.push("idNumber");
  if (!isValidIdlNo(row.idlNo)) missing.push("idlNo");
  if (!isValidIdlDate(row.date)) missing.push("date");
  return missing;
}
