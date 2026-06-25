/**
 * OCR the sample NTSA receipt image with region crops and run the receipt parser.
 */
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { parseReceiptOcrText } from "../shared/ntsaReceiptExtraction.ts";
import { extractReceiptDocument, structuredOutputToJson } from "../shared/receiptExtractionEngine.ts";

const IMAGE =
  process.argv[2] ??
  "C:/Users/Hannie/.cursor/projects/c-Users-Hannie-OneDrive-Documents-Trailer-blazer-Projects-My-Potofolio/assets/c__Users_Hannie_AppData_Roaming_Cursor_User_workspaceStorage_dc066970bd35e19d84a85376f99169a2_images_WhatsApp_Image_2026-06-08_at_16.39.42-427f316a-27fa-4edc-8fd6-596485479611.png";

const EXPECTED = {
  name: "CORNELIUS MOSAGE KABURU",
  idNumber: "822661092",
  applicationNo: "PDL-YLLH289ML",
  billReferenceNo: "MM4R4Q3",
  date: "24 July 2025",
  totalKes: "650",
};

const REGIONS = {
  headerBand: { top: 0, height: 0.2, left: 0, width: 1 },
  headerValues: { top: 0.055, height: 0.075, left: 0, width: 1 },
  dateValue: { top: 0.05, height: 0.09, left: 0.52, width: 0.48 },
  applicationNoColumn: { top: 0.02, height: 0.18, left: 0, width: 0.34 },
  billRefColumn: { top: 0.04, height: 0.14, left: 0.28, width: 0.44 },
  dateColumn: { top: 0.02, height: 0.18, left: 0.66, width: 0.34 },
  idColumn: { top: 0.3, height: 0.12, left: 0, width: 0.5 },
  customerInfo: { top: 0.28, height: 0.2, left: 0, width: 0.62 },
};

async function preprocess(buffer) {
  const meta = await sharp(buffer).metadata();
  const maxDim = Math.max(meta.width ?? 1, meta.height ?? 1);
  const scale = maxDim < 2400 ? 2400 / maxDim : 1;
  const width = Math.round((meta.width ?? 1) * scale);
  const height = Math.round((meta.height ?? 1) * scale);
  return sharp(buffer).resize(width, height).linear(1.35, -(128 * 0.35)).jpeg({ quality: 95 }).toBuffer();
}

async function crop(buffer, region) {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const left = Math.round(w * (region.left ?? 0));
  const top = Math.round(h * region.top);
  const width = Math.max(1, Math.round(w * (region.width ?? 1)));
  const height = Math.max(1, Math.round(h * region.height));
  return sharp(buffer).extract({ left, top, width, height }).jpeg({ quality: 95 }).toBuffer();
}

async function ocrBuffer(buffer, psm = "3") {
  const worker = await createWorker("eng");
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await worker.recognize(buffer);
  await worker.terminate();
  return data.text;
}

const rawBuffer = await readFile(IMAGE);
const buffer = await preprocess(rawBuffer);
const fullText = await ocrBuffer(buffer);

const regionTexts = {};
for (const [label, region] of Object.entries(REGIONS)) {
  const cropped = await crop(buffer, region);
  const psm = label.includes("Column") || label === "idColumn" ? "7" : "6";
  regionTexts[label] = await ocrBuffer(cropped, psm);
}

const ocrOptions = {
  headerText: regionTexts.headerBand,
  headerValuesText: regionTexts.headerValues,
  applicationText: regionTexts.applicationNoColumn,
  billRefText: regionTexts.billRefColumn,
  dateText: [regionTexts.dateValue, regionTexts.dateColumn, regionTexts.headerValues]
    .filter(Boolean)
    .join("\n"),
  customerText: regionTexts.customerInfo,
  idText: regionTexts.idColumn,
  extraTexts: Object.values(regionTexts),
};

console.log("=== REGION OCR ===\n");
for (const [label, text] of Object.entries(regionTexts)) {
  console.log(`--- ${label} ---\n${text.trim()}\n`);
}

const meta = await sharp(rawBuffer).metadata();
const mildBuffer = await sharp(rawBuffer)
  .resize(Math.round((meta.width ?? 1) * 1.2), Math.round((meta.height ?? 1) * 1.2))
  .jpeg({ quality: 95 })
  .toBuffer();
const mildTop = await ocrBuffer(mildBuffer, "6");
const mildValues = await ocrBuffer(
  await sharp(mildBuffer)
    .extract({
      left: Math.round((meta.width ?? 1) * 1.2 * (REGIONS.headerValues.left ?? 0)),
      top: Math.round((meta.height ?? 1) * 1.2 * REGIONS.headerValues.top),
      width: Math.round((meta.width ?? 1) * 1.2 * (REGIONS.headerValues.width ?? 1)),
      height: Math.round((meta.height ?? 1) * 1.2 * REGIONS.headerValues.height),
    })
    .jpeg({ quality: 95 })
    .toBuffer(),
  "7",
);
const mildHeaderBundle = [mildTop, mildValues].filter(Boolean).join("\n");

const parseOptions = {
  ...ocrOptions,
  headerText: [ocrOptions.headerText, mildHeaderBundle, fullText].filter(Boolean).join("\n"),
  headerValuesText: [ocrOptions.headerValuesText, mildHeaderBundle].filter(Boolean).join("\n"),
  billRefText: [ocrOptions.billRefText, mildHeaderBundle].filter(Boolean).join("\n"),
  applicationText: [ocrOptions.applicationText, mildHeaderBundle].filter(Boolean).join("\n"),
  dateText: [ocrOptions.dateText, mildHeaderBundle].filter(Boolean).join("\n"),
  extraTexts: [...(ocrOptions.extraTexts ?? []), mildHeaderBundle],
};

const row = parseReceiptOcrText(fullText, parseOptions);
const structured = extractReceiptDocument({ rawText: fullText, options: parseOptions });
const json = structuredOutputToJson(structured);

console.log("=== PARSE RESULT ===\n");
let failed = 0;
for (const [key, expected] of Object.entries(EXPECTED)) {
  const got = row[key] ?? "";
  const ok = got === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${key}: got "${got}" expected "${expected}"`);
}
console.log("\nStructured JSON:", JSON.stringify(json, null, 2));
process.exit(failed > 0 ? 1 : 0);
