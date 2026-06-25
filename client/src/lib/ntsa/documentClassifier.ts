import { classifyDocumentFromOcr, type DocumentClassification } from "@shared/documentExtraction";
import { createWorker, type Worker } from "tesseract.js";

let previewWorkerPromise: Promise<Worker> | null = null;

async function getPreviewWorker(): Promise<Worker> {
  if (!previewWorkerPromise) {
    previewWorkerPromise = (async () => {
      const worker = await createWorker("eng");
      await worker.setParameters({ tessedit_pageseg_mode: "3" });
      return worker;
    })();
  }
  return previewWorkerPromise;
}

async function downscale(blob: Blob, maxDim = 1000): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare preview image");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error("Preview downscale failed"));
        else resolve(result);
      },
      "image/jpeg",
      0.88,
    );
  });
}

/** Quick OCR on a downscaled image to classify document type before full extraction. */
export async function classifyDocumentFromImage(blob: Blob): Promise<DocumentClassification> {
  const preview = await downscale(blob);
  const worker = await getPreviewWorker();
  const { data } = await worker.recognize(preview);
  return classifyDocumentFromOcr(data.text);
}

export async function terminatePreviewOcrWorker(): Promise<void> {
  if (!previewWorkerPromise) return;
  const worker = await previewWorkerPromise;
  await worker.terminate();
  previewWorkerPromise = null;
}
