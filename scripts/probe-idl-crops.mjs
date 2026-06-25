import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

const IMAGE =
  process.argv[2] ??
  "C:/Users/Hannie/.cursor/projects/c-Users-Hannie-OneDrive-Documents-Trailer-blazer-Projects-My-Potofolio/assets/c__Users_Hannie_AppData_Roaming_Cursor_User_workspaceStorage_dc066970bd35e19d84a85376f99169a2_images_WhatsApp_Image_2026-06-09_at_12.26.29-bf17354f-9ccd-4751-8e84-fd3e6296d7c4.png";

const REGIONS = {
  nameRow1: { top: 0.4, height: 0.06, left: 0.38, width: 0.6 },
  nameRow2: { top: 0.42, height: 0.07, left: 0.4, width: 0.58 },
  nameRow3: { top: 0.44, height: 0.08, left: 0.42, width: 0.55 },
  idRow1: { top: 0.48, height: 0.06, left: 0.38, width: 0.6 },
  idRow2: { top: 0.5, height: 0.07, left: 0.4, width: 0.55 },
  fromDate1: { top: 0.58, height: 0.06, left: 0.38, width: 0.62 },
  fromDate2: { top: 0.6, height: 0.07, left: 0.4, width: 0.58 },
  rightBlock: { top: 0.38, height: 0.38, left: 0.38, width: 0.62 },
  rightBlockTight: { top: 0.4, height: 0.32, left: 0.42, width: 0.56 },
  fromDate3: { top: 0.66, height: 0.08, left: 0.35, width: 0.65 },
  fromDate4: { top: 0.68, height: 0.1, left: 0.38, width: 0.6 },
  expiryRow: { top: 0.72, height: 0.1, left: 0.35, width: 0.65 },
  lowerRight: { top: 0.6, height: 0.2, left: 0.35, width: 0.65 },
};

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
const img = await preprocess(raw);

for (const psm of ["6", "7", "11"]) {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  for (const [name, region] of Object.entries(REGIONS)) {
    const text = (await worker.recognize(await crop(img, region))).data.text.trim();
    if (text) console.log(`[psm=${psm}] ${name}: ${JSON.stringify(text)}`);
  }
}

await worker.terminate();
