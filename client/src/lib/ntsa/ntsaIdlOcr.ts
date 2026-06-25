import type { IdlFormRow } from "@shared/documentExtraction";
import {
  extractIdlDocument,
  mergeStructuredWithParsed,
  type IdlStructuredOutput,
} from "@shared/idlExtractionEngine";
import { tokensFromTesseractWords } from "@shared/ocrLayout";
import {
  countValidIdlFields,
  digDeeperIdlDate,
  digDeeperIdlIdNumber,
  digDeeperIdlName,
  finalizeIdlFormRow,
  getMissingIdlFieldIds,
  mergeIdlFormRows,
  parseIdlOcrText,
} from "@shared/ntsaIdlExtraction";
import { applyIdlSyntheticFallback } from "@/lib/ntsa/ntsaIdlSyntheticFallback";
import { detectBestOrientation, rotateImageBlob } from "@/lib/ntsa/ntsaImageOrient";
import { createWorker, type Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng");
      await worker.setParameters({ tessedit_pageseg_mode: "3" });
      return worker;
    })();
  }
  return workerPromise;
}

type OcrPsm = "3" | "6" | "7" | "11";

type OcrResult = {
  text: string;
  layoutTokens: ReturnType<typeof tokensFromTesseractWords>;
};

async function recognizeWithLayout(blob: Blob, psm: OcrPsm = "3"): Promise<OcrResult> {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await worker.recognize(blob);
  return {
    text: data.text,
    layoutTokens: tokensFromTesseractWords(
      data.words as Parameters<typeof tokensFromTesseractWords>[0],
    ),
  };
}

async function recognizeText(blob: Blob, psm: OcrPsm = "3"): Promise<string> {
  const { text } = await recognizeWithLayout(blob, psm);
  return text;
}

async function preprocessBinaryForOcr(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const maxDim = Math.max(bitmap.width, bitmap.height);
  const scale = maxDim < 3000 ? 3000 / maxDim : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image for OCR");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    const binary = gray >= 150 ? 255 : 0;
    data[i] = binary;
    data[i + 1] = binary;
    data[i + 2] = binary;
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error("Binary preprocessing failed"));
        else resolve(result);
      },
      "image/jpeg",
      0.95,
    );
  });
}

async function preprocessImageForOcr(blob: Blob, contrastBoost = 1.5): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const maxDim = Math.max(bitmap.width, bitmap.height);
  const scale = maxDim < 3000 ? 3000 / maxDim : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image for OCR");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    const contrast = Math.min(255, Math.max(0, (gray - 128) * contrastBoost + 128));
    data[i] = contrast;
    data[i + 1] = contrast;
    data[i + 2] = contrast;
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error("Image preprocessing failed"));
        else resolve(result);
      },
      "image/jpeg",
      0.95,
    );
  });
}

type CropRegion = {
  top: number;
  height: number;
  left?: number;
  width?: number;
  label: string;
  psm?: OcrPsm;
};

const IDL_REGIONS: CropRegion[] = [
  { top: 0, height: 0.28, left: 0, width: 1, label: "headerBand", psm: "6" },
  { top: 0.38, height: 0.38, left: 0.38, width: 0.62, label: "rightBlock", psm: "11" },
  { top: 0.48, height: 0.12, left: 0.38, width: 0.62, label: "nameIdRow", psm: "11" },
  { top: 0.52, height: 0.1, left: 0.38, width: 0.62, label: "idNumberRow", psm: "7" },
  { top: 0.58, height: 0.22, left: 0.35, width: 0.65, label: "datesBlock", psm: "11" },
  { top: 0.64, height: 0.12, left: 0.35, width: 0.65, label: "fromDateRow", psm: "7" },
  { top: 0.4, height: 0.35, left: 0.52, width: 0.45, label: "valuesColumn", psm: "6" },
];

async function cropRegion(blob: Blob, region: CropRegion): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const left = Math.round(bitmap.width * (region.left ?? 0));
  const cropWidth = Math.max(1, Math.round(bitmap.width * (region.width ?? 1)));
  const cropHeight = Math.max(1, Math.round(bitmap.height * region.height));
  const cropTop = Math.round(bitmap.height * region.top);

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop image for OCR");

  ctx.drawImage(
    bitmap,
    left,
    cropTop,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error("Image crop failed"));
        else resolve(result);
      },
      "image/jpeg",
      0.95,
    );
  });
}

async function ocrRegions(preprocessed: Blob): Promise<{
  fullText: string;
  fullLayoutTokens: ReturnType<typeof tokensFromTesseractWords>;
  regionTexts: Record<string, string>;
}> {
  const fullOcr = await recognizeWithLayout(preprocessed);
  const regionTexts: Record<string, string> = {};

  await Promise.all(
    IDL_REGIONS.map(async (region) => {
      try {
        const crop = await cropRegion(preprocessed, region);
        regionTexts[region.label] = await recognizeText(crop, region.psm ?? "6");
      } catch {
        regionTexts[region.label] = "";
      }
    }),
  );

  return {
    fullText: fullOcr.text,
    fullLayoutTokens: fullOcr.layoutTokens,
    regionTexts,
  };
}

function allRegionTexts(
  fullText: string,
  regionTexts: Record<string, string>,
  extra: string[] = [],
): string[] {
  return [fullText, ...Object.values(regionTexts), ...extra].filter((t) => Boolean(t?.trim()));
}

async function deepRetryMissingFields(
  enhanced: Blob,
  row: IdlFormRow,
): Promise<{ row: IdlFormRow; extraTexts: string[] }> {
  const missing = getMissingIdlFieldIds(row);
  if (!missing.length) return { row, extraTexts: [] };

  const extraTexts: string[] = [];
  const highContrast = await preprocessImageForOcr(enhanced, 1.75);

  for (const region of IDL_REGIONS) {
    const stillMissing = getMissingIdlFieldIds(row);
    if (!stillMissing.length) break;

    const regionRelevant =
      (region.label === "rightBlock" || region.label === "nameIdRow") &&
      (stillMissing.includes("name") || stillMissing.includes("idNumber")) ||
      (region.label === "idNumberRow" && stillMissing.includes("idNumber")) ||
      ((region.label === "datesBlock" ||
        region.label === "fromDateRow" ||
        region.label === "valuesColumn") &&
        stillMissing.includes("date")) ||
      (region.label === "headerBand" && stillMissing.includes("idlNo"));

    if (!regionRelevant) continue;

    try {
      const source =
        region.label === "datesBlock" ||
        region.label === "fromDateRow" ||
        region.label === "valuesColumn"
          ? await preprocessBinaryForOcr(enhanced)
          : highContrast;
      const crop = await cropRegion(source, region);
      const text = await recognizeText(crop, region.psm ?? "6");
      if (!text.trim()) continue;
      extraTexts.push(text);

      const reparsed = parseIdlOcrText(text);
      row = mergeIdlFormRows([row, reparsed]);

      if (stillMissing.includes("idNumber")) {
        const deeper = digDeeperIdlIdNumber([text]);
        if (deeper) row.idNumber = deeper;
      }
      if (stillMissing.includes("name")) {
        const deeper = digDeeperIdlName([text]);
        if (deeper) row.name = deeper;
      }
      if (stillMissing.includes("date")) {
        const deeper = digDeeperIdlDate([text]);
        if (deeper) row.date = deeper;
      }
    } catch {
      /* try next region */
    }
  }

  if (getMissingIdlFieldIds(row).length) {
    try {
      const sparseText = await recognizeText(highContrast, "11");
      if (sparseText.trim()) {
        extraTexts.push(sparseText);
        row = mergeIdlFormRows([row, parseIdlOcrText(sparseText)]);
        if (!row.idNumber) row.idNumber = digDeeperIdlIdNumber([sparseText]);
        if (!row.name) row.name = digDeeperIdlName([sparseText]);
        if (!row.date) row.date = digDeeperIdlDate([sparseText]);
      }
    } catch {
      /* ignore */
    }
  }

  return { row, extraTexts };
}

export type IdlRecognitionResult = {
  row: IdlFormRow;
  ocrText: string;
  orientationDegrees: number;
  validFieldCount: number;
  missingFields: Array<keyof IdlFormRow>;
  deepRetryUsed: boolean;
  usedSyntheticFallback: boolean;
  overallConfidence: number;
  needsReview: boolean;
  structured: IdlStructuredOutput;
};

export async function recognizeIdlWithText(blob: Blob): Promise<IdlRecognitionResult> {
  const preprocessed = await preprocessImageForOcr(blob);

  const { degrees } = await detectBestOrientation(
    preprocessed,
    recognizeText,
    "ntsa_interim_license",
  );
  const oriented =
    degrees === 0 ? preprocessed : await rotateImageBlob(preprocessed, degrees);
  const enhanced = degrees === 0 ? oriented : await preprocessImageForOcr(oriented);

  const { fullText, fullLayoutTokens, regionTexts } = await ocrRegions(enhanced);
  const texts = allRegionTexts(fullText, regionTexts);
  const parsedRows = texts.map((text) => parseIdlOcrText(text));

  const structured = extractIdlDocument({
    rawText: fullText,
    layoutTokens: fullLayoutTokens,
    extraTexts: Object.values(regionTexts),
  });

  let row = mergeStructuredWithParsed(structured, parsedRows);

  const { row: retriedRow, extraTexts } = await deepRetryMissingFields(enhanced, row);
  row = finalizeIdlFormRow(retriedRow);
  const deepRetryUsed = extraTexts.length > 0;

  const beforeSynthetic = row;
  const synthetic = applyIdlSyntheticFallback(row);
  row = synthetic.row;

  const combinedOcr = allRegionTexts(fullText, regionTexts, extraTexts).join("\n---\n");

  return {
    row,
    ocrText: combinedOcr,
    orientationDegrees: degrees,
    validFieldCount: countValidIdlFields(row),
    missingFields: getMissingIdlFieldIds(beforeSynthetic),
    deepRetryUsed,
    usedSyntheticFallback: synthetic.usedSyntheticFallback,
    overallConfidence: structured.overallConfidence,
    needsReview: structured.needsReview || synthetic.usedSyntheticFallback,
    structured,
  };
}
