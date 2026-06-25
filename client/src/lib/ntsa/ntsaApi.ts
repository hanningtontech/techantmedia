import type { NtsaFormRow } from "@shared/ntsaExtraction";
import { recognizeNtsaForm } from "@/lib/ntsa/ntsaOcr";

/** Extract NTSA form fields locally via Tesseract OCR (no external API keys). */
export async function extractNtsaFromImage(input: {
  blob: Blob;
  mimeType: string;
  fileName: string;
}): Promise<NtsaFormRow> {
  void input.mimeType;
  void input.fileName;
  return recognizeNtsaForm(input.blob);
}
