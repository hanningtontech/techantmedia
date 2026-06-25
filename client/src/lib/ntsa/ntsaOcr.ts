import { createWorker, type Worker } from "tesseract.js";
import {
  countValidNtsaFields,
  parseNtsaOcrText,
  type NtsaFormRow,
} from "@shared/ntsaExtraction";
import { detectBestOrientation, rotateImageBlob } from "@/lib/ntsa/ntsaImageOrient";
import { fillEmptyFieldsFromSynthetic } from "@/lib/ntsa/ntsaSyntheticFallback";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: "3",
      });
      return worker;
    })();
  }
  return workerPromise;
}

async function recognizeText(blob: Blob): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(blob);
  return data.text;
}

async function preprocessImageForOcr(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const maxDim = Math.max(bitmap.width, bitmap.height);
  const scale = maxDim < 2200 ? 2200 / maxDim : 1;
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
    const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.35 + 128));
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

type CropRegion = { top: number; height: number; label: string };

const OCR_REGIONS: CropRegion[] = [
  { top: 0, height: 0.22, label: "header" },
  { top: 0.1, height: 0.35, label: "declaration" },
  { top: 0.55, height: 0.45, label: "footer" },
];

async function cropRegion(blob: Blob, region: CropRegion): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const cropHeight = Math.max(1, Math.round(bitmap.height * region.height));
  const cropTop = Math.round(bitmap.height * region.top);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop image for OCR");

  ctx.drawImage(
    bitmap,
    0,
    cropTop,
    bitmap.width,
    cropHeight,
    0,
    0,
    bitmap.width,
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

async function ocrRegions(preprocessed: Blob): Promise<{ fullText: string; regionTexts: string[] }> {
  const crops = await Promise.all(
    OCR_REGIONS.map((region) =>
      cropRegion(preprocessed, region)
        .then((blob) => recognizeText(blob))
        .catch(() => ""),
    ),
  );

  const fullText = await recognizeText(preprocessed);
  return { fullText, regionTexts: crops.filter(Boolean) };
}

export type NtsaRecognitionResult = {
  row: NtsaFormRow;
  ocrText: string;
  orientationDegrees: number;
  validFieldCount: number;
  usedSyntheticFallback: boolean;
};

export async function recognizeNtsaFormWithText(blob: Blob): Promise<NtsaRecognitionResult> {
  const preprocessed = await preprocessImageForOcr(blob);

  const { degrees } = await detectBestOrientation(preprocessed, recognizeText);
  const oriented =
    degrees === 0 ? preprocessed : await rotateImageBlob(preprocessed, degrees);
  const enhanced = degrees === 0 ? oriented : await preprocessImageForOcr(oriented);

  const { fullText, regionTexts } = await ocrRegions(enhanced);
  const headerText = regionTexts[0] ?? "";

  const parsed = parseNtsaOcrText(fullText, {
    headerText,
    extraTexts: regionTexts.slice(1),
  });

  const beforeFill = countValidNtsaFields(parsed);
  const row = fillEmptyFieldsFromSynthetic(parsed);
  const validFieldCount = countValidNtsaFields(row);
  const usedSyntheticFallback =
    validFieldCount > beforeFill ||
    (!parsed.name.trim() && !!row.name.trim()) ||
    (!parsed.idNumber.trim() && !!row.idNumber.trim()) ||
    (!parsed.testApplicationNumber.trim() && !!row.testApplicationNumber.trim()) ||
    (!parsed.amount.trim() && !!row.amount.trim()) ||
    (!parsed.date.trim() && !!row.date.trim());

  const combinedOcr = [fullText, ...regionTexts].filter(Boolean).join("\n---\n");

  return {
    row,
    ocrText: combinedOcr,
    orientationDegrees: degrees,
    validFieldCount,
    usedSyntheticFallback,
  };
}

export async function recognizeNtsaForm(blob: Blob): Promise<NtsaFormRow> {
  const { row } = await recognizeNtsaFormWithText(blob);
  return row;
}

export async function terminateNtsaOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
}
