import { tryGetFirebaseAuth } from "@/lib/firebase";

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp)$/i;

/** Upload a stem image to B2 via the same authenticated `/api/b2/...` pipeline as study guides. Returns a public HTTPS URL. */
export async function uploadQuizStemImage(file: File): Promise<string> {
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
  const bytes = await file.arrayBuffer();

  const resp = await fetch(`/api/b2/quiz-images/${encodeURIComponent(uploadId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "X-File-Name": name,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: bytes,
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(t || "Image upload failed");
  }

  const out = (await resp.json()) as { downloadUrl?: string };
  const downloadUrl = String(out.downloadUrl ?? "").trim();
  if (!downloadUrl) throw new Error("Upload did not return a download URL");
  return downloadUrl;
}
