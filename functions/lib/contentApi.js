"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.putPortfolioSite = putPortfolioSite;
exports.putPortfolioXai = putPortfolioXai;
exports.putLivestreamSettings = putLivestreamSettings;
exports.ensureClientGallery = ensureClientGallery;
exports.setClientGalleryPayment = setClientGalleryPayment;
exports.addClientGalleryPhoto = addClientGalleryPhoto;
exports.patchClientGalleryPhoto = patchClientGalleryPhoto;
exports.deleteClientGalleryPhoto = deleteClientGalleryPhoto;
exports.createSignedContractSubmission = createSignedContractSubmission;
exports.updateSignedContractStatus = updateSignedContractStatus;
exports.createInspoBoard = createInspoBoard;
exports.deleteInspoBoard = deleteInspoBoard;
const admin = __importStar(require("firebase-admin"));
const MAX_PORTFOLIO_BYTES = 8 * 1024 * 1024;
const MAX_INSPO_PHOTOS = 40;
function sanitizeForFirestore(value) {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    if (typeof value !== "object")
        return value;
    if (Array.isArray(value))
        return value.map((item) => sanitizeForFirestore(item));
    const out = {};
    for (const [key, val] of Object.entries(value)) {
        if (val === undefined)
            continue;
        out[key] = sanitizeForFirestore(val);
    }
    return out;
}
function assertPayloadSize(body, label) {
    const bytes = Buffer.byteLength(JSON.stringify(body ?? {}), "utf8");
    if (bytes > MAX_PORTFOLIO_BYTES) {
        throw new Error(`${label} payload too large`);
    }
}
async function putPortfolioSite(body) {
    assertPayloadSize(body, "Site content");
    const payload = sanitizeForFirestore({ ...body, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await admin.firestore().doc("portfolio/site").set(payload, { merge: true });
}
async function putPortfolioXai(body) {
    assertPayloadSize(body, "xAI portfolio");
    const payload = sanitizeForFirestore({ ...body, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await admin.firestore().doc("portfolio/xai").set(payload, { merge: true });
}
async function putLivestreamSettings(body) {
    assertPayloadSize(body, "Livestream settings");
    const { streamKey: _removed, ...publicFields } = body;
    const payload = sanitizeForFirestore({ ...publicFields, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await admin.firestore().doc("portfolio/livestream").set(payload, { merge: true });
}
async function ensureClientGallery(userId) {
    const ref = admin.firestore().doc(`clientGalleries/${userId}`);
    const snap = await ref.get();
    if (snap.exists)
        return;
    await ref.set({
        userId,
        paymentConfirmed: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function setClientGalleryPayment(userId, paymentConfirmed) {
    await ensureClientGallery(userId);
    await admin.firestore().doc(`clientGalleries/${userId}`).update({
        paymentConfirmed: paymentConfirmed === true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function addClientGalleryPhoto(userId, photo) {
    await ensureClientGallery(userId);
    const id = String(photo.id ?? "").trim() ||
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
async function patchClientGalleryPhoto(userId, photoId, patch) {
    const allowed = {};
    if ("visible" in patch)
        allowed.visible = patch.visible === true;
    if ("isSample" in patch)
        allowed.isSample = patch.isSample === true;
    if ("alt" in patch)
        allowed.alt = String(patch.alt ?? "");
    if ("order" in patch)
        allowed.order = typeof patch.order === "number" ? patch.order : 0;
    await admin.firestore().doc(`clientGalleries/${userId}/photos/${photoId}`).update(allowed);
    await admin.firestore().doc(`clientGalleries/${userId}`).update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function deleteClientGalleryPhoto(userId, photoId) {
    await admin.firestore().doc(`clientGalleries/${userId}/photos/${photoId}`).delete();
    await admin.firestore().doc(`clientGalleries/${userId}`).update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function createSignedContractSubmission(body) {
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
async function updateSignedContractStatus(id, status) {
    if (status !== "pending" && status !== "reviewed")
        throw new Error("Invalid status");
    await admin.firestore().doc(`signedContractSubmissions/${id}`).set({ status }, { merge: true });
}
async function createInspoBoard(body) {
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
async function deleteInspoBoard(boardId) {
    await admin.firestore().doc(`inspoBoards/${boardId}`).delete();
}
