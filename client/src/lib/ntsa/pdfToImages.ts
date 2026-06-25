import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type PdfPageImage = {
  blob: Blob;
  mimeType: string;
  fileName: string;
  pageNumber: number;
};

async function renderPageToBlob(page: pdfjsLib.PDFPageProxy, scale = 2): Promise<Blob> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Failed to render PDF page"));
        else resolve(blob);
      },
      "image/jpeg",
      0.92,
    );
  });
}

export async function pdfFileToImages(file: File): Promise<PdfPageImage[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const baseName = file.name.replace(/\.pdf$/i, "") || "document";
  const images: PdfPageImage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const blob = await renderPageToBlob(page);
    images.push({
      blob,
      mimeType: "image/jpeg",
      fileName: `${baseName}-page-${pageNumber}.jpg`,
      pageNumber,
    });
  }

  return images;
}
