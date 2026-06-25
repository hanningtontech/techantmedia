import { tryGetFirebaseAuth } from "@/lib/firebase";

export type XaiUploadProgress = { loaded: number; total: number; percent: number };

function parseUploadError(text: string, status: number): string {
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j.error) return j.error;
  } catch {
    /* plain text */
  }
  return text || `Upload failed (${status})`;
}

/** Upload CV, video, or image assets for the xAI portfolio (admin only). */
export async function uploadXaiPortfolioFile(
  file: File,
  onProgress?: (p: XaiUploadProgress) => void,
): Promise<string> {
  const auth = tryGetFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured");
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first");

  const name = (file.name || "file.bin").trim() || "file.bin";
  const idToken = await user.getIdToken();
  const rnd =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);
  const uploadId = `${Date.now().toString(36)}_${rnd}`;
  const url = `/api/b2/xai-portfolio-files/${encodeURIComponent(uploadId)}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (!onProgress) return;
      const total = e.lengthComputable ? e.total : file.size;
      const percent = total > 0 ? Math.min(100, Math.round((e.loaded / total) * 100)) : 0;
      onProgress({ loaded: e.loaded, total, percent });
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const out = JSON.parse(xhr.responseText) as { downloadUrl?: string };
          const downloadUrl = String(out.downloadUrl ?? "").trim();
          if (!downloadUrl) {
            reject(new Error("Upload did not return a download URL"));
            return;
          }
          onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
          resolve(downloadUrl);
        } catch {
          reject(new Error("Invalid upload response"));
        }
        return;
      }
      reject(new Error(parseUploadError(xhr.responseText, xhr.status)));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${idToken}`);
    xhr.setRequestHeader("X-File-Name", name);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}
