/**
 * OCR a sample interim driving license image and run the IDL parser.
 */
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import {
  parseIdlOcrText,
  digDeeperIdlIdNumber,
  digDeeperIdlName,
  digDeeperIdlDate,
  mergeIdlFormRows,
} from "../shared/ntsaIdlExtraction.ts";
import { classifyDocumentFromOcr } from "../shared/documentExtraction.ts";

const IMAGE =
  process.argv[2] ??
  "C:/Users/Hannie/.cursor/projects/c-Users-Hannie-OneDrive-Documents-Trailer-blazer-Projects-My-Potofolio/assets/c__Users_Hannie_AppData_Roaming_Cursor_User_workspaceStorage_dc066970bd35e19d84a85376f99169a2_images_WhatsApp_Image_2026-06-09_at_12.26.29-bf17354f-9ccd-4751-8e84-fd3e6296d7c4.png";

const REGIONS = [
  { label: "headerBand", top: 0, height: 0.28, left: 0, width: 1, psm: "6" },
  { label: "rightBlock", top: 0.38, height: 0.38, left: 0.38, width: 0.62, psm: "11" },
  { label: "nameIdRow", top: 0.48, height: 0.12, left: 0.38, width: 0.62, psm: "11" },
  { label: "idNumberRow", top: 0.52, height: 0.1, left: 0.38, width: 0.62, psm: "7" },
  { label: "datesBlock", top: 0.58, height: 0.22, left: 0.35, width: 0.65, psm: "11" },
  { label: "fromDateRow", top: 0.64, height: 0.12, left: 0.35, width: 0.65, psm: "7" },
];

async function preprocess(buffer, boost = 1.5) {
  const meta = await sharp(buffer).metadata();
  const maxDim = Math.max(meta.width ?? 1, meta.height ?? 1);
  const scale = maxDim < 3000 ? 3000 / maxDim : 1;
  const width = Math.round((meta.width ?? 1) * scale);
  const height = Math.round((meta.height ?? 1) * scale);
  return sharp(buffer)
    .resize(width, height)
    .linear(boost, -(128 * (boost - 1)))
    .normalize()
    .sharpen()
    .jpeg({ quality: 95 })
    .toBuffer();
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

const worker = await createWorker("eng");
const raw = await readFile(IMAGE);
const preprocessed = await preprocess(raw);
const fullText = (await worker.recognize(preprocessed)).data.text;
const regionTexts = {};

for (const region of REGIONS) {
  await worker.setParameters({ tessedit_pageseg_mode: region.psm });
  regionTexts[region.label] = (await worker.recognize(await crop(preprocessed, region))).data.text;
}
await worker.terminate();

const texts = [fullText, ...Object.values(regionTexts)];
const row = mergeIdlFormRows(texts.map((text) => parseIdlOcrText(text)));
if (!row.idNumber) row.idNumber = digDeeperIdlIdNumber(texts);
if (!row.name) row.name = digDeeperIdlName(texts);
if (!row.date) row.date = digDeeperIdlDate(texts);

const classification = classifyDocumentFromOcr(texts.join("\n---\n"));

console.log("=== Parsed row ===");
console.log(JSON.stringify(row, null, 2));
console.log("\n=== Classification ===");
console.log(JSON.stringify(classification, null, 2));
console.log("\n=== Region OCR ===");
for (const [label, text] of Object.entries(regionTexts)) {
  console.log(`--- ${label} ---\n${text.trim()}\n`);
}
