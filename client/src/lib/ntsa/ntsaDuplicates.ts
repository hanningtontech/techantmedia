import type { NtsaFormRow } from "@shared/ntsaExtraction";

export function rowIdentityKey(row: Pick<NtsaFormRow, "name" | "idNumber">): string | null {
  const name = row.name.trim().toUpperCase();
  const idNumber = row.idNumber.replace(/\D/g, "");
  if (!name || !idNumber) return null;
  return `${name}|${idNumber}`;
}

export function isDuplicateForm(
  row: NtsaFormRow,
  existing: Pick<NtsaFormRow, "name" | "idNumber">[],
): boolean {
  const key = rowIdentityKey(row);
  if (!key) return false;
  return existing.some((item) => rowIdentityKey(item) === key);
}
