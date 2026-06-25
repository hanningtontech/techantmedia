import * as admin from "firebase-admin";

const MAX_PORTFOLIO_BYTES = 8 * 1024 * 1024;
const MAX_INSPO_PHOTOS = 40;

function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeForFirestore(item));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === undefined) continue;
    out[key] = sanitizeForFirestore(val);
  }
  return out;
}

function assertPayloadSize(body: unknown, label: string) {
  const bytes = Buffer.byteLength(JSON.stringify(body ?? {}), "utf8");
  if (bytes > MAX_PORTFOLIO_BYTES) {
    throw new Error(`${label} payload too large`);
  }
}

export async function putPortfolioSite(body: Record<string, unknown>) {
  assertPayloadSize(body, "Site content");
  const payload = sanitizeForFirestore({ ...body, updatedAt: admin.firestore.FieldValue.serverTimestamp() }) as admin.firestore.DocumentData;
  await admin.firestore().doc("portfolio/site").set(payload, { merge: true });
}

export async function putPortfolioXai(body: Record<string, unknown>) {
  assertPayloadSize(body, "xAI portfolio");
  const payload = sanitizeForFirestore({ ...body, updatedAt: admin.firestore.FieldValue.serverTimestamp() }) as admin.firestore.DocumentData;
  await admin.firestore().doc("portfolio/xai").set(payload, { merge: true });
}

export async function putLivestreamSettings(body: Record<string, unknown>) {
  assertPayloadSize(body, "Livestream settings");
  const { streamKey: _removed, ...publicFields } = body;
  const payload = sanitizeForFirestore({ ...publicFields, updatedAt: admin.firestore.FieldValue.serverTimestamp() }) as admin.firestore.DocumentData;
  await admin.firestore().doc("portfolio/livestream").set(payload, { merge: true });
}

export async function ensureClientGallery(userId: string) {
  const ref = admin.firestore().doc(`clientGalleries/${userId}`);
  const snap = await ref.get();
  if (snap.exists) return;
  await ref.set({
    userId,
    paymentConfirmed: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function setClientGalleryPayment(userId: string, paymentConfirmed: boolean) {
  await ensureClientGallery(userId);
  await admin.firestore().doc(`clientGalleries/${userId}`).update({
    paymentConfirmed: paymentConfirmed === true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function addClientGalleryPhoto(userId: string, photo: Record<string, unknown>): Promise<string> {
  await ensureClientGallery(userId);
  const id =
    String(photo.id ?? "").trim() ||
    `ph_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await admin
    .firestore()
    .doc(`clientGalleries/${userId}/photos/${id}`)
    .set({
      src: String(photo.src ?? ""),
      alt: String(photo.alt ?? ""),
      width: typeof photo.width === "number" ? photo.width : null,
      height: typeof photo.height === "number" ? photo.height : null,
      visible: photo.visible === true,
      isSample: photo.isSample === true,
      order: typeof photo.order === "number" ? photo.order : 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  await admin.firestore().doc(`clientGalleries/${userId}`).update({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return id;
}

export async function patchClientGalleryPhoto(userId: string, photoId: string, patch: Record<string, unknown>) {
  const allowed: Record<string, unknown> = {};
  if ("visible" in patch) allowed.visible = patch.visible === true;
  if ("isSample" in patch) allowed.isSample = patch.isSample === true;
  if ("alt" in patch) allowed.alt = String(patch.alt ?? "");
  if ("order" in patch) allowed.order = typeof patch.order === "number" ? patch.order : 0;
  await admin.firestore().doc(`clientGalleries/${userId}/photos/${photoId}`).update(allowed);
  await admin.firestore().doc(`clientGalleries/${userId}`).update({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteClientGalleryPhoto(userId: string, photoId: string) {
  await admin.firestore().doc(`clientGalleries/${userId}/photos/${photoId}`).delete();
  await admin.firestore().doc(`clientGalleries/${userId}`).update({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function createSignedContractSubmission(body: Record<string, unknown>): Promise<string> {
  const clientId = String(body.clientId ?? "").trim();
  const contractSlug = String(body.contractSlug ?? "").trim();
  const contractTitle = String(body.contractTitle ?? "").trim();
  const fileName = String(body.fileName ?? "").trim();
  const downloadUrl = String(body.downloadUrl ?? "").trim();
  if (!clientId || !contractSlug || !contractTitle || !fileName || !downloadUrl) {
    throw new Error("Missing required signed contract fields");
  }
  const ref = await admin
    .firestore()
    .collection("signedContractSubmissions")
    .add({
      clientId,
      clientEmail: String(body.clientEmail ?? ""),
      clientName: String(body.clientName ?? ""),
      contractSlug,
      contractTitle,
      fileName,
      downloadUrl,
      status: "pending",
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  return ref.id;
}

export async function updateSignedContractStatus(id: string, status: string) {
  if (status !== "pending" && status !== "reviewed") throw new Error("Invalid status");
  await admin.firestore().doc(`signedContractSubmissions/${id}`).set({ status }, { merge: true });
}

export async function createInspoBoard(body: Record<string, unknown>): Promise<string> {
  const photos = Array.isArray(body.photos) ? body.photos : [];
  if (!photos.length || photos.length > MAX_INSPO_PHOTOS) {
    throw new Error(`Inspo board must have 1–${MAX_INSPO_PHOTOS} photos`);
  }
  const ref = await admin
    .firestore()
    .collection("inspoBoards")
    .add({
      photos,
      clientName: String(body.clientName ?? "").trim(),
      note: String(body.note ?? "").trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  return ref.id;
}

export async function deleteInspoBoard(boardId: string) {
  await admin.firestore().doc(`inspoBoards/${boardId}`).delete();
}
