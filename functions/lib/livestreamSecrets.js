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
exports.generateStreamKey = generateStreamKey;
exports.getOrCreateStreamKey = getOrCreateStreamKey;
exports.regenerateStreamKey = regenerateStreamKey;
exports.probeHlsManifest = probeHlsManifest;
exports.updateLivestreamStreamStatus = updateLivestreamStreamStatus;
exports.formatObsCredentials = formatObsCredentials;
const node_crypto_1 = require("node:crypto");
const admin = __importStar(require("firebase-admin"));
const SECRETS_DOC = "adminSecrets/livestream";
function generateStreamKey() {
    return `sk_${(0, node_crypto_1.randomBytes)(16).toString("hex")}`;
}
async function getOrCreateStreamKey() {
    const ref = admin.firestore().doc(SECRETS_DOC);
    const snap = await ref.get();
    const existing = String(snap.data()?.streamKey ?? "").trim();
    if (existing)
        return existing;
    const streamKey = generateStreamKey();
    await ref.set({ streamKey, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return streamKey;
}
async function regenerateStreamKey() {
    const streamKey = generateStreamKey();
    await admin.firestore().doc(SECRETS_DOC).set({ streamKey, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return streamKey;
}
async function probeHlsManifest(url) {
    const trimmed = url.trim();
    if (!trimmed)
        return false;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(trimmed, {
            method: "GET",
            headers: { Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*" },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok)
            return false;
        const text = await res.text();
        return text.includes("#EXTM3U");
    }
    catch {
        return false;
    }
}
async function updateLivestreamStreamStatus(status) {
    await admin.firestore().doc("portfolio/livestream").set({ streamStatus: status, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}
function formatObsCredentials(rtmpIngestUrl, streamKey) {
    return {
        obsServer: rtmpIngestUrl.trim().replace(/\/+$/, ""),
        obsStreamKey: streamKey,
    };
}
