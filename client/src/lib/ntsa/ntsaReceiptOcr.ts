import type { ReceiptFormRow } from "@shared/documentExtraction";
import { tokensFromTesseractWords } from "@shared/ocrLayout";
import {
  applyStructuredToFormRow,
  applySyntheticFieldsToStructured,
  extractReceiptDocument,
  type ReceiptStructuredOutput,
} from "@shared/receiptExtractionEngine";
import {
  countValidReceiptFields,
  digDeeperApplicationNo,
  digDeeperBillReferenceNo,
  digDeeperReceiptDate,
  digDeeperReceiptIdNumber,
  finalizeReceiptFormRow,
  getMissingReceiptFieldIds,
  isValidReceiptApplicationNo,
  isValidReceiptBillRef,
  isValidReceiptDate,
  isValidReceiptIdNumber,
  mergeReceiptFormRows,
  parseReceiptOcrText,
} from "@shared/ntsaReceiptExtraction";
import {
  applyReceiptSyntheticFallback,
  strictFinalizeReceiptHeaders,
} from "@/lib/ntsa/ntsaReceiptSyntheticFallback";
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

type OcrResult = {
  text: string;
  layoutTokens: ReturnType<typeof tokensFromTesseractWords>;
};

async function recognizeWithLayout(
  blob: Blob,
  psm: "3" | "6" | "7" | "11" = "3",
): Promise<OcrResult> {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await worker.recognize(blob);
  return {
    text: data.text,
    layoutTokens: tokensFromTesseractWords(data.words as Parameters<typeof tokensFromTesseractWords>[0]),
  };
}

async function recognizeText(blob: Blob, psm: "3" | "6" | "7" | "11" = "3"): Promise<string> {
  const { text } = await recognizeWithLayout(blob, psm);
  return text;
}

async function preprocessImageForOcr(blob: Blob, contrastBoost = 1.35): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const maxDim = Math.max(bitmap.width, bitmap.height);
  const scale = maxDim < 2400 ? 2400 / maxDim : 1;
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
};

/** Full top band: APPLICATION NO | BILL REFERENCE NO | DATE row. */
const HEADER_BAND_REGION: CropRegion = {
  top: 0,
  height: 0.2,
  left: 0,
  width: 1,
  label: "headerBand",
};

/** Value row directly under the three header labels (PDL-… | MM4R4Q3 | 24 July 2025). */
const HEADER_VALUES_ROW_REGION: CropRegion = {
  top: 0.055,
  height: 0.075,
  left: 0,
  width: 1,
  label: "headerValues",
};

/** Right header value cell — date only, below DATE: label. */
const DATE_VALUE_REGION: CropRegion = {
  top: 0.05,
  height: 0.09,
  left: 0.52,
  width: 0.48,
  label: "dateValue",
};

/** Left column under "APPLICATION NO:" label (e.g. PDL-YLLH289ML). */
const APPLICATION_NO_COLUMN_REGION: CropRegion = {
  top: 0.02,
  height: 0.18,
  left: 0,
  width: 0.34,
  label: "applicationNoColumn",
};

/** Center column under "BILL REFERENCE NO:" label (e.g. MM4R4Q3). */
const BILL_REF_COLUMN_REGION: CropRegion = {
  top: 0.04,
  height: 0.14,
  left: 0.28,
  width: 0.44,
  label: "billRefColumn",
};

/** Right column under "DATE:" label (e.g. 24 July 2025). */
const DATE_COLUMN_REGION: CropRegion = {
  top: 0.02,
  height: 0.18,
  left: 0.66,
  width: 0.34,
  label: "dateColumn",
};

/** Below RECEIPT PAID — left ID No field (highlighted on form). */
const ID_COLUMN_REGION: CropRegion = {
  top: 0.3,
  height: 0.12,
  left: 0,
  width: 0.5,
  label: "idColumn",
};

/** Customer block: ID No, Name, Email, Tel below grey banner. */
const CUSTOMER_INFO_REGION: CropRegion = {
  top: 0.28,
  height: 0.2,
  left: 0,
  width: 0.62,
  label: "customerInfo",
};

const RECEIPT_REGIONS: CropRegion[] = [
  HEADER_BAND_REGION,
  HEADER_VALUES_ROW_REGION,
  DATE_VALUE_REGION,
  APPLICATION_NO_COLUMN_REGION,
  BILL_REF_COLUMN_REGION,
  DATE_COLUMN_REGION,
  ID_COLUMN_REGION,
  CUSTOMER_INFO_REGION,
  { top: 0.55, height: 0.45, label: "footer" },
];

const DEEP_RETRY_REGIONS: CropRegion[] = [
  HEADER_VALUES_ROW_REGION,
  DATE_VALUE_REGION,
  APPLICATION_NO_COLUMN_REGION,
  DATE_COLUMN_REGION,
  ID_COLUMN_REGION,
  CUSTOMER_INFO_REGION,
  BILL_REF_COLUMN_REGION,
  HEADER_BAND_REGION,
  { top: 0, height: 0.18, left: 0.22, width: 0.56, label: "billRef" },
  { top: 0, height: 0.2, left: 0, width: 0.45, label: "applicationNo" },
  { top: 0, height: 0.2, left: 0.65, width: 0.35, label: "date" },
  { top: 0.7, height: 0.28, left: 0.45, width: 0.55, label: "total" },
];

async function cropRegion(blob: Blob, region: CropRegion): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const cropHeight = Math.max(1, Math.round(bitmap.height * region.height));
  const cropTop = Math.round(bitmap.height * region.top);
  const cropLeft = Math.round(bitmap.width * (region.left ?? 0));
  const cropWidth = Math.max(1, Math.round(bitmap.width * (region.width ?? 1)));

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop image for OCR");

  ctx.drawImage(
    bitmap,
    cropLeft,
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

async function ocrRegions(
  preprocessed: Blob,
  regions: CropRegion[],
): Promise<{
  fullText: string;
  regionTexts: string[];
  headerText: string;
  billRefText: string;
  applicationText: string;
  dateText: string;
  customerText: string;
  idText: string;
}> {
  const cropResults = await Promise.all(
    regions.map(async (region) => {
      try {
        const blob = await cropRegion(preprocessed, region);
        const psm =
          region.label === "billRefColumn" ||
          region.label === "billRef" ||
          region.label === "applicationNoColumn" ||
          region.label === "dateColumn" ||
          region.label === "dateValue" ||
          region.label === "headerValues" ||
          region.label === "idColumn"
            ? "7"
            : "6";
        const text = await recognizeText(blob, psm as "6" | "7" | "3");
        return { label: region.label, text };
      } catch {
        return { label: region.label, text: "" };
      }
    }),
  );

  const fullText = await recognizeText(preprocessed);
  const headerText =
    cropResults.find((r) => r.label === "headerBand")?.text ??
    cropResults.find((r) => r.label === "billRef")?.text ??
    "";
  const billRefText =
    cropResults.find((r) => r.label === "billRefColumn")?.text ??
    cropResults.find((r) => r.label === "billRef")?.text ??
    "";
  const applicationText =
    cropResults.find((r) => r.label === "applicationNoColumn")?.text ??
    cropResults.find((r) => r.label === "applicationNo")?.text ??
    "";
  const dateText = [
    cropResults.find((r) => r.label === "dateValue")?.text,
    cropResults.find((r) => r.label === "dateColumn")?.text,
    cropResults.find((r) => r.label === "headerValues")?.text,
    cropResults.find((r) => r.label === "date")?.text,
  ]
    .filter(Boolean)
    .join("\n");
  const headerValuesText = cropResults.find((r) => r.label === "headerValues")?.text ?? "";
  const customerText = cropResults.find((r) => r.label === "customerInfo")?.text ?? "";
  const idText = cropResults.find((r) => r.label === "idColumn")?.text ?? "";

  return {
    fullText,
    regionTexts: cropResults.map((r) => r.text).filter(Boolean),
    headerText,
    billRefText,
    applicationText,
    dateText,
    headerValuesText,
    customerText,
    idText,
  };
}

export type ReceiptRecognitionResult = {
  row: ReceiptFormRow;
  structured: ReceiptStructuredOutput;
  ocrText: string;
  orientationDegrees: number;
  validFieldCount: number;
  missingFields: Array<keyof ReceiptFormRow>;
  deepRetryUsed: boolean;
  usedSyntheticFallback: boolean;
  needsReview: boolean;
  overallConfidence: number;
};

function regionParseOptions(
  regionLabel: string,
  text: string,
): Parameters<typeof parseReceiptOcrText>[1] {
  return {
    headerText: regionLabel === "headerBand" ? text : undefined,
    billRefText:
      regionLabel === "billRef" || regionLabel === "billRefColumn" ? text : undefined,
    applicationText:
      regionLabel === "applicationNo" ||
      regionLabel === "applicationNoColumn" ||
      regionLabel === "headerValues"
        ? text
        : undefined,
    dateText:
      regionLabel === "date" ||
      regionLabel === "dateColumn" ||
      regionLabel === "dateValue" ||
      regionLabel === "headerValues"
        ? text
        : undefined,
    headerValuesText: regionLabel === "headerValues" ? text : undefined,
    customerText: regionLabel === "customerInfo" ? text : undefined,
    idText: regionLabel === "idColumn" ? text : undefined,
  };
}

async function ocrDateRegionsHard(enhanced: Blob): Promise<string[]> {
  const highContrast = await preprocessImageForOcr(enhanced, 1.85);
  const regions = [DATE_VALUE_REGION, DATE_COLUMN_REGION, HEADER_VALUES_ROW_REGION];
  const texts: string[] = [];
  for (const region of regions) {
    try {
      const crop = await cropRegion(highContrast, region);
      for (const psm of ["7", "6", "11"] as const) {
        const text = await recognizeText(crop, psm);
        if (text.trim()) texts.push(text);
      }
    } catch {
      /* try next */
    }
  }
  return texts;
}

async function deepRetryMissingFields(
  enhanced: Blob,
  row: ReceiptFormRow,
): Promise<{ row: ReceiptFormRow; extraTexts: string[] }> {
  const missing = getMissingReceiptFieldIds(row);
  if (!missing.length) return { row, extraTexts: [] };

  const extraTexts: string[] = [];
  const highContrast = await preprocessImageForOcr(enhanced, 1.65);

  for (const region of DEEP_RETRY_REGIONS) {
    const stillMissing = getMissingReceiptFieldIds(row);
    if (!stillMissing.length) break;

    const regionMissing =
      ((region.label === "applicationNo" || region.label === "applicationNoColumn") &&
        stillMissing.includes("applicationNo")) ||
      ((region.label === "billRef" || region.label === "billRefColumn") &&
        stillMissing.includes("billReferenceNo")) ||
      ((region.label === "date" || region.label === "dateColumn") &&
        stillMissing.includes("date")) ||
      ((region.label === "idColumn" || region.label === "customerInfo") &&
        (stillMissing.includes("idNumber") || stillMissing.includes("name"))) ||
      (region.label === "total" && stillMissing.includes("totalKes"));

    if (!regionMissing) continue;

    try {
      const crop = await cropRegion(highContrast, region);
      const psm =
        region.label === "billRef" ||
        region.label === "billRefColumn" ||
        region.label === "applicationNoColumn" ||
        region.label === "dateColumn" ||
        region.label === "dateValue" ||
        region.label === "headerValues" ||
        region.label === "idColumn"
          ? "7"
          : "6";
      const text = await recognizeText(crop, psm);
      if (text.trim()) extraTexts.push(text);

      if (
        (region.label === "billRef" || region.label === "billRefColumn") &&
        stillMissing.includes("billReferenceNo")
      ) {
        const deeper = digDeeperBillReferenceNo([text], {
          applicationNo: row.applicationNo,
          idNumber: row.idNumber,
          date: row.date,
        });
        if (deeper) row.billReferenceNo = deeper;
      }

      if (
        (region.label === "applicationNo" ||
          region.label === "applicationNoColumn" ||
          region.label === "headerValues") &&
        stillMissing.includes("applicationNo")
      ) {
        const deeperApp = digDeeperApplicationNo([text], { idNumber: row.idNumber });
        if (deeperApp) row.applicationNo = deeperApp;
      }

      if (
        (region.label === "date" ||
          region.label === "dateColumn" ||
          region.label === "dateValue" ||
          region.label === "headerValues") &&
        stillMissing.includes("date")
      ) {
        const deeperDate = digDeeperReceiptDate([text]);
        if (deeperDate) row.date = deeperDate;
      }

      if (
        (region.label === "idColumn" || region.label === "customerInfo") &&
        stillMissing.includes("idNumber")
      ) {
        const deeperId = digDeeperReceiptIdNumber([text]);
        if (deeperId) row.idNumber = deeperId;
      }

      const reparsed = parseReceiptOcrText(text, regionParseOptions(region.label, text));
      row = mergeReceiptFormRows([row, reparsed]);
    } catch {
      /* try next region */
    }
  }

  if (getMissingReceiptFieldIds(row).length) {
    try {
      const sparseText = await recognizeText(highContrast, "11");
      if (sparseText.trim()) {
        extraTexts.push(sparseText);
        const reparsed = parseReceiptOcrText(sparseText);
        row = {
          name: row.name || reparsed.name,
          idNumber: row.idNumber || reparsed.idNumber,
          applicationNo: row.applicationNo || reparsed.applicationNo,
          billReferenceNo: row.billReferenceNo || reparsed.billReferenceNo,
          totalKes: row.totalKes || reparsed.totalKes,
          date: row.date || reparsed.date,
        };
      }
    } catch {
      /* ignore */
    }
  }

  return { row, extraTexts };
}

export async function recognizeNtsaReceiptWithText(blob: Blob): Promise<ReceiptRecognitionResult> {
  const preprocessed = await preprocessImageForOcr(blob);

  const { degrees } = await detectBestOrientation(preprocessed, recognizeText, "ntsa_receipt");
  const oriented = degrees === 0 ? preprocessed : await rotateImageBlob(preprocessed, degrees);
  const enhanced = degrees === 0 ? oriented : await preprocessImageForOcr(oriented);

  const fullOcr = await recognizeWithLayout(enhanced);
  const mildHeader = await preprocessImageForOcr(oriented, 1.12);
  const mildHeaderText = await recognizeText(mildHeader, "6");
  let mildHeaderValuesText = "";
  let mildTopHeaderText = "";
  try {
    const mildValuesCrop = await cropRegion(mildHeader, HEADER_VALUES_ROW_REGION);
    mildHeaderValuesText = await recognizeText(mildValuesCrop, "7");
    const mildTopCrop = await cropRegion(mildHeader, {
      top: 0,
      height: 0.22,
      left: 0,
      width: 1,
      label: "mildTopHeader",
    });
    mildTopHeaderText = await recognizeText(mildTopCrop, "6");
  } catch {
    /* optional mild header crops */
  }
  const {
    fullText,
    regionTexts,
    headerText,
    billRefText,
    applicationText,
    dateText,
    headerValuesText,
    customerText,
    idText,
  } = await ocrRegions(enhanced, RECEIPT_REGIONS);

  const mildHeaderBundle = [mildTopHeaderText, mildHeaderValuesText, mildHeaderText]
    .filter(Boolean)
    .join("\n");
  const combinedHeaderText = [headerText, mildHeaderBundle, fullText, fullOcr.text]
    .filter(Boolean)
    .join("\n");

  const ocrOptions = {
    headerText: combinedHeaderText,
    billRefText: [billRefText, mildHeaderValuesText, mildTopHeaderText].filter(Boolean).join("\n"),
    applicationText: [applicationText, mildHeaderValuesText, mildTopHeaderText]
      .filter(Boolean)
      .join("\n"),
    dateText: [dateText, mildHeaderValuesText, mildTopHeaderText, mildHeaderText]
      .filter(Boolean)
      .join("\n"),
    headerValuesText: [headerValuesText, mildHeaderValuesText, mildTopHeaderText, mildHeaderText]
      .filter(Boolean)
      .join("\n"),
    customerText,
    idText,
    extraTexts: [...regionTexts, mildHeaderBundle],
  };

  let structured = extractReceiptDocument({
    rawText: fullText || fullOcr.text,
    layoutTokens: fullOcr.layoutTokens,
    options: ocrOptions,
  });
  const legacyParsed = parseReceiptOcrText(fullText || fullOcr.text, ocrOptions);
  let parsed = mergeReceiptFormRows([applyStructuredToFormRow(structured), legacyParsed]);

  let deepRetryUsed = false;
  let deepRow: ReceiptFormRow | null = null;
  const missingBeforeDeep = getMissingReceiptFieldIds(parsed);

  if (missingBeforeDeep.length > 0) {
    deepRetryUsed = true;
    const deep = await deepRetryMissingFields(enhanced, parsed);
    deepRow = deep.row;
    structured = extractReceiptDocument({
      rawText: fullText || fullOcr.text,
      layoutTokens: fullOcr.layoutTokens,
      options: {
        ...ocrOptions,
        extraTexts: [...regionTexts, ...deep.extraTexts],
      },
    });
    parsed = mergeReceiptFormRows([
      deep.row,
      legacyParsed,
      applyStructuredToFormRow(structured),
      parsed,
    ]);
  }

  const headerSources = [
    applicationText,
    dateText,
    headerText,
    billRefText,
    mildHeaderBundle,
    mildHeaderValuesText,
    mildTopHeaderText,
    ...regionTexts,
    fullText,
  ];
  if (!isValidReceiptApplicationNo(parsed.applicationNo, { idNumber: parsed.idNumber })) {
    deepRetryUsed = true;
    const deeperApp = digDeeperApplicationNo(headerSources, { idNumber: parsed.idNumber });
    if (deeperApp) parsed = { ...parsed, applicationNo: deeperApp };
  }
  if (!isValidReceiptDate(parsed.date)) {
    deepRetryUsed = true;
    const dateHardTexts = await ocrDateRegionsHard(enhanced);
    const deeperDate = digDeeperReceiptDate([...dateHardTexts, ...headerSources]);
    if (deeperDate) {
      parsed = mergeReceiptFormRows([
        { ...parsed, date: deeperDate },
        parseReceiptOcrText(fullText || fullOcr.text, {
          ...ocrOptions,
          dateText: [...dateHardTexts, dateText].filter(Boolean).join("\n"),
          extraTexts: dateHardTexts,
        }),
      ]);
    }
  }
  if (
    !isValidReceiptBillRef(parsed.billReferenceNo, {
      applicationNo: parsed.applicationNo,
      idNumber: parsed.idNumber,
      date: parsed.date,
    })
  ) {
    deepRetryUsed = true;
    const deeperBillRef = digDeeperBillReferenceNo(headerSources, {
      applicationNo: parsed.applicationNo,
      idNumber: parsed.idNumber,
      date: parsed.date,
    });
    if (deeperBillRef) parsed = { ...parsed, billReferenceNo: deeperBillRef };
  }

  parsed = mergeReceiptFormRows([
    deepRow ?? parsed,
    legacyParsed,
    applyStructuredToFormRow(structured),
    parsed,
  ]);

  if (!isValidReceiptIdNumber(parsed.idNumber)) {
    deepRetryUsed = true;
    const deeperId = digDeeperReceiptIdNumber([idText, customerText, ...regionTexts, fullText]);
    if (deeperId) parsed = { ...parsed, idNumber: deeperId };
  }

  const beforeSynthetic = mergeReceiptFormRows([parsed]);
  const synthetic = applyReceiptSyntheticFallback(beforeSynthetic);
  const headerStrict = strictFinalizeReceiptHeaders(synthetic.row);
  parsed = finalizeReceiptFormRow({
    ...mergeReceiptFormRows([synthetic.row, beforeSynthetic]),
    applicationNo: headerStrict.row.applicationNo,
    billReferenceNo: headerStrict.row.billReferenceNo,
    totalKes: headerStrict.row.totalKes || synthetic.row.totalKes,
  });
  const usedSyntheticFallback =
    synthetic.usedSyntheticFallback || headerStrict.usedSyntheticFallback;

  if (usedSyntheticFallback) {
    structured = applySyntheticFieldsToStructured(
      extractReceiptDocument({
        rawText: fullText || fullOcr.text,
        options: ocrOptions,
      }),
      beforeSynthetic,
      parsed,
    );
  }

  const combinedOcr = [fullText, ...regionTexts].filter(Boolean).join("\n---\n");

  return {
    row: parsed,
    structured,
    ocrText: combinedOcr,
    orientationDegrees: degrees,
    validFieldCount: countValidReceiptFields(parsed),
    missingFields: getMissingReceiptFieldIds(beforeSynthetic),
    deepRetryUsed,
    usedSyntheticFallback,
    needsReview: structured.needsReview,
    overallConfidence: structured.overallConfidence,
  };
}

export async function recognizeNtsaReceipt(blob: Blob): Promise<ReceiptFormRow> {
  const { row } = await recognizeNtsaReceiptWithText(blob);
  return row;
}

export async function terminateReceiptOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
}
