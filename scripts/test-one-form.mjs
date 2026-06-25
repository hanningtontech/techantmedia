import { createWorker } from "tesseract.js";
import { readFileSync } from "fs";
import { detectBestOrientation, rotateImageBlob, scoreNtsaOcrText } from "../client/src/lib/ntsa/ntsaImageOrient.ts";
import {
  countValidNtsaFields,
  parseNtsaOcrText,
} from "../shared/ntsaExtraction.ts";

const imgPath = process.argv[2];
if (!imgPath) {
  console.error("Usage: npx tsx scripts/test-one-form.mjs <image-path>");
  process.exit(1);
}

const worker = await createWorker("eng");
const recognize = async (blob) => {
  const buf = Buffer.from(await blob.arrayBuffer());
  const { data } = await worker.recognize(buf);
  return data.text;
};

const inputBlob = new Blob([readFileSync(imgPath)], { type: "image/png" });
const { degrees, score } = await detectBestOrientation(inputBlob, recognize);
const oriented = degrees === 0 ? inputBlob : await rotateImageBlob(inputBlob, degrees);
const fullText = await recognize(oriented);
const row = parseNtsaOcrText(fullText);
const valid = countValidNtsaFields(row);

await worker.terminate();

console.log(
  JSON.stringify(
    {
      orientation: { degrees, score },
      orientationScoreUpright: scoreNtsaOcrText(fullText),
      validFieldCount: valid,
      row,
      ocrPreview: fullText.slice(0, 1500),
    },
    null,
    2,
  ),
);
