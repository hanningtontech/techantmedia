import { tryGetFirebaseAuth } from "@/lib/firebase";

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp)$/i;

export type PortfolioImageUploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

function parseUploadErrorBody(text: string, status: number): string {
  let msg = text;
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j.error) msg = j.error;
  } catch {
    /* plain-text error body */
  }
  return msg || `Image upload failed (${status})`;
}

/** Upload a portfolio image to Backblaze B2. Returns a public HTTPS URL. */
export async function uploadPortfolioImage(
  file: File,
  onProgress?: (progress: PortfolioImageUploadProgress) => void,
): Promise<string> {
  const auth = tryGetFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured");
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first");

  const name = (file.name || "image.png").trim() || "image.png";
  if (!IMAGE_EXT.test(name)) {
    throw new Error("Only PNG, JPG, JPEG, GIF, or WEBP images are supported");
  }

  const idToken = await user.getIdToken();
  const rnd =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);
  const uploadId = `${Date.now().toString(36)}_${rnd}`;
  const url = `/api/b2/portfolio-images/${encodeURIComponent(uploadId)}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (!onProgress) return;
      const total = e.lengthComputable ? e.total : file.size;
      const loaded = e.loaded;
      const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      onProgress({ loaded, total, percent });
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
      reject(new Error(parseUploadErrorBody(xhr.responseText, xhr.status)));
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
