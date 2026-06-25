import { tryGetFirebaseAuth } from "@/lib/firebase";
import type { PhotoContractSlug } from "@/lib/contracts/contractTypes";

function parseUploadErrorBody(text: string, status: number): string {
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j.error) return j.error;
  } catch {
    /* ignore */
  }
  return text || `Upload failed (${status})`;
}

/** Admin uploads a downloadable contract PDF template. */
export async function uploadContractPdf(
  slug: PhotoContractSlug,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ downloadUrl: string; fileName: string }> {
  const auth = tryGetFirebaseAuth();
  if (!auth?.currentUser) throw new Error("Sign in as admin to upload");

  const name = (file.name || `${slug}.pdf`).trim() || `${slug}.pdf`;
  if (!/\.pdf$/i.test(name)) throw new Error("Upload a PDF file");
  if (file.size > 25 * 1024 * 1024) throw new Error("PDF must be 25 MB or smaller");

  const idToken = await auth.currentUser.getIdToken();
  const rnd =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);
  const uploadId = `${Date.now().toString(36)}_${rnd}`;
  const url = `/api/b2/contract-pdfs/${encodeURIComponent(slug)}/${encodeURIComponent(uploadId)}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable || !onProgress) return;
      onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const out = JSON.parse(xhr.responseText) as { downloadUrl?: string; fileName?: string };
          const downloadUrl = String(out.downloadUrl ?? "").trim();
          if (!downloadUrl) {
            reject(new Error("Upload did not return a URL"));
            return;
          }
          onProgress?.(100);
          resolve({ downloadUrl, fileName: String(out.fileName ?? name) });
        } catch {
          reject(new Error("Invalid upload response"));
        }
        return;
      }
      reject(new Error(parseUploadErrorBody(xhr.responseText, xhr.status)));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${idToken}`);
    xhr.setRequestHeader("X-File-Name", name);
    xhr.setRequestHeader("Content-Type", file.type || "application/pdf");
    xhr.send(file);
  });
}
