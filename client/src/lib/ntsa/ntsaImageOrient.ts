import type { DocumentTypeId } from "@shared/documentExtraction";
import { classifyDocumentFromOcr } from "@shared/documentExtraction";

/** Score how likely OCR text came from an upright NTSA form. */
export function scoreNtsaOcrText(text: string): number {
  const normalized = text.replace(/\s+/g, " ");
  let score = 0;

  const markers: Array<[RegExp, number]> = [
    [/TEST\s+APPLICATION\s+FORM/i, 25],
    [/TDB[-\s]?[A-Z0-9]{6,}/i, 30],
    [/ID\s*NO/i, 20],
    [/Fee\s+Paid/i, 15],
    [/Driving\s+Test\s+allocated/i, 15],
    [/KES/i, 10],
    [/REPUBLIC\s+OF\s+KENYA/i, 10],
    [/NATIONAL\s+TRANSPORT/i, 8],
    [/provisional\s+licen/i, 8],
    [/vehicle\s+class/i, 5],
  ];

  for (const [pattern, weight] of markers) {
    if (pattern.test(normalized)) score += weight;
  }

  const alnum = (normalized.match(/[a-zA-Z0-9]/g) ?? []).length;
  const ratio = alnum / Math.max(normalized.length, 1);
  score += Math.round(ratio * 40);

  const garbage = (normalized.match(/[^a-zA-Z0-9\s.,:;'\-/()]/g) ?? []).length;
  score -= Math.min(30, Math.round((garbage / Math.max(normalized.length, 1)) * 100));

  return score;
}

/** Score how likely OCR text came from an upright NTSA payment receipt. */
export function scoreReceiptOcrText(text: string): number {
  const normalized = text.replace(/\s+/g, " ");
  let score = 0;

  const markers: Array<[RegExp, number]> = [
    [/RECEIPT\s+PAID/i, 30],
    [/APPLICATION\s+NO/i, 22],
    [/BILL\s+REFERENCE/i, 22],
    [/\bPDL[-\s]?[A-Z0-9]{5,}/i, 28],
    [/Total\s+KES/i, 18],
    [/ID\s*NO/i, 15],
    [/CUSTOMER\s+COPY/i, 12],
    [/NATIONAL\s+TRANSPORT/i, 8],
    [/KES/i, 8],
  ];

  for (const [pattern, weight] of markers) {
    if (pattern.test(normalized)) score += weight;
  }

  const alnum = (normalized.match(/[a-zA-Z0-9]/g) ?? []).length;
  const ratio = alnum / Math.max(normalized.length, 1);
  score += Math.round(ratio * 35);

  return score;
}

/** Score how likely OCR text came from an upright NTSA interim driving license. */
export function scoreIdlOcrText(text: string): number {
  const normalized = text.replace(/\s+/g, " ");
  let score = 0;

  const markers: Array<[RegExp, number]> = [
    [/INTERIM\s+DRIVING\s+LICEN[CS]E/i, 30],
    [/\bIDL[-\s]?[A-Z0-9]{6,}/i, 28],
    [/From\s+Date/i, 18],
    [/Expiry\s+Date/i, 14],
    [/Full\s+Name/i, 12],
    [/ID\s+Number/i, 12],
    [/To\s+drive\s+class/i, 10],
    [/NATIONAL\s+TRANSPORT/i, 8],
  ];

  for (const [pattern, weight] of markers) {
    if (pattern.test(normalized)) score += weight;
  }

  const alnum = (normalized.match(/[a-zA-Z0-9]/g) ?? []).length;
  const ratio = alnum / Math.max(normalized.length, 1);
  score += Math.round(ratio * 35);

  return score;
}

export function scoreDocumentOcrText(text: string, documentType: DocumentTypeId): number {
  if (documentType === "ntsa_receipt") return scoreReceiptOcrText(text);
  if (documentType === "ntsa_interim_license") return scoreIdlOcrText(text);
  return scoreNtsaOcrText(text);
}

export async function rotateImageBlob(blob: Blob, degrees: 0 | 90 | 180 | 270): Promise<Blob> {
  if (degrees === 0) return blob;

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not rotate image");

  const swap = degrees === 90 || degrees === 270;
  canvas.width = swap ? bitmap.height : bitmap.width;
  canvas.height = swap ? bitmap.width : bitmap.height;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error("Rotation failed"));
        else resolve(result);
      },
      "image/jpeg",
      0.95,
    );
  });
}

async function downscaleForOrientation(blob: Blob, maxDim = 900): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not downscale image");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error("Downscale failed"));
        else resolve(result);
      },
      "image/jpeg",
      0.85,
    );
  });
}

export type OrientationResult = {
  degrees: 0 | 90 | 180 | 270;
  score: number;
};

/**
 * Quick OCR on four rotations (downscaled) to pick upright orientation.
 * `recognize` should return raw OCR text for a blob.
 */
const ORIENTATION_CONFIDENCE_THRESHOLD = 45;

export async function detectBestOrientation(
  blob: Blob,
  recognize: (blob: Blob) => Promise<string>,
  documentType: DocumentTypeId = "ntsa_test_form",
): Promise<OrientationResult> {
  const scoreText = (text: string) => scoreDocumentOcrText(text, documentType);
  const small = await downscaleForOrientation(blob);
  const uprightText = await recognize(small);
  const uprightScore = scoreText(uprightText);

  if (uprightScore >= ORIENTATION_CONFIDENCE_THRESHOLD) {
    return { degrees: 0, score: uprightScore };
  }

  const rotations: Array<0 | 90 | 180 | 270> = [90, 180, 270];
  let best: OrientationResult = { degrees: 0, score: uprightScore };

  for (const degrees of rotations) {
    const rotated = await rotateImageBlob(small, degrees);
    const text = await recognize(rotated);
    const score = scoreText(text);
    if (score > best.score) {
      best = { degrees, score };
    }
  }

  return best;
}

/** Pick document type from quick OCR on an upright/downscaled preview. */
export function classifyOrientationPreview(text: string) {
  return classifyDocumentFromOcr(text);
}
