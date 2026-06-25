import type express from "express";
import { requireAdminWithAnyScope, requireClientOwn, requireSuperAdmin } from "./adminAuth.js";
import { getFirestore } from "firebase-admin/firestore";
import {
  addClientGalleryPhoto,
  createInspoBoard,
  createSignedContractSubmission,
  deleteClientGalleryPhoto,
  deleteInspoBoard,
  ensureClientGallery,
  patchClientGalleryPhoto,
  putLivestreamSettings,
  putPortfolioSite,
  putPortfolioXai,
  setClientGalleryPayment,
  updateSignedContractStatus,
} from "./contentHandlers.js";
import {
  formatObsCredentials,
  getOrCreateStreamKey,
  probeHlsManifest,
  regenerateStreamKey,
  updateLivestreamStreamStatus,
} from "./livestreamSecrets.js";
import { defaultLivestreamHlsUrl, withLivestreamUrlDefaults } from "./livestreamUrls.js";

function sendContentError(res: express.Response, e: unknown) {
  const msg = e instanceof Error ? e.message : "Request failed";
  const status =
    msg === "Forbidden"
      ? 403
      : msg === "Missing auth token"
        ? 401
        : msg.includes("too large") || msg.includes("Missing") || msg.includes("Invalid") || msg.includes("must have")
          ? 400
          : 500;
  console.error("[content-api]", msg, e);
  return res.status(status).json({ error: msg });
}

export function registerContentRoutes(app: express.Application) {
  app.put("/api/livestream/settings", async (req, res) => {
    try {
      await requireSuperAdmin(req);
      await putLivestreamSettings((req.body ?? {}) as Record<string, unknown>);
      return res.json({ ok: true });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.get("/api/livestream/ingest", async (req, res) => {
    try {
      await requireSuperAdmin(req);
      const streamKey = await getOrCreateStreamKey();
      const snap = await getFirestore().doc("portfolio/livestream").get();
      const urls = withLivestreamUrlDefaults(snap.data() ?? {});
      const obs = formatObsCredentials(urls.rtmpIngestUrl, streamKey);
      return res.json({
        streamKey,
        rtmpIngestUrl: urls.rtmpIngestUrl,
        hlsPlaybackUrl: urls.hlsPlaybackUrl,
        obsServer: obs.obsServer,
        obsStreamKey: obs.obsStreamKey,
      });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.post("/api/livestream/regenerate-key", async (req, res) => {
    try {
      await requireSuperAdmin(req);
      const streamKey = await regenerateStreamKey();
      const snap = await getFirestore().doc("portfolio/livestream").get();
      const urls = withLivestreamUrlDefaults(snap.data() ?? {});
      const obs = formatObsCredentials(urls.rtmpIngestUrl, streamKey);
      return res.json({
        streamKey,
        rtmpIngestUrl: urls.rtmpIngestUrl,
        hlsPlaybackUrl: urls.hlsPlaybackUrl,
        obsServer: obs.obsServer,
        obsStreamKey: obs.obsStreamKey,
      });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.post("/api/livestream/probe", async (req, res) => {
    try {
      await requireSuperAdmin(req);
      const snap = await getFirestore().doc("portfolio/livestream").get();
      const hlsPlaybackUrl = withLivestreamUrlDefaults(snap.data() ?? {}).hlsPlaybackUrl;
      if (!hlsPlaybackUrl) {
        await updateLivestreamStreamStatus("offline");
        return res.json({ ok: false, streamStatus: "offline" });
      }
      await updateLivestreamStreamStatus("connecting");
      const ok = await probeHlsManifest(hlsPlaybackUrl);
      const streamStatus = ok ? "live" : "offline";
      await updateLivestreamStreamStatus(streamStatus);
      return res.json({ ok, streamStatus });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.put("/api/portfolio/site", async (req, res) => {
    try {
      await requireAdminWithAnyScope(req, ["development", "photography"]);
      await putPortfolioSite((req.body ?? {}) as Record<string, unknown>);
      return res.json({ ok: true });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.put("/api/portfolio/xai", async (req, res) => {
    try {
      await requireAdminWithAnyScope(req, ["xai"]);
      await putPortfolioXai((req.body ?? {}) as Record<string, unknown>);
      return res.json({ ok: true });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.post("/api/client-galleries/:userId/ensure", async (req, res) => {
    try {
      await requireAdminWithAnyScope(req, ["photography"]);
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      await ensureClientGallery(userId);
      return res.json({ ok: true });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.patch("/api/client-galleries/:userId/meta", async (req, res) => {
    try {
      await requireAdminWithAnyScope(req, ["photography"]);
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const body = (req.body ?? {}) as Record<string, unknown>;
      await setClientGalleryPayment(userId, body.paymentConfirmed === true);
      return res.json({ ok: true });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.post("/api/client-galleries/:userId/photos", async (req, res) => {
    try {
      await requireAdminWithAnyScope(req, ["photography"]);
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const id = await addClientGalleryPhoto(userId, (req.body ?? {}) as Record<string, unknown>);
      return res.json({ ok: true, id });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.patch("/api/client-galleries/:userId/photos/:photoId", async (req, res) => {
    try {
      await requireAdminWithAnyScope(req, ["photography"]);
      const userId = String(req.params.userId ?? "").trim();
      const photoId = String(req.params.photoId ?? "").trim();
      if (!userId || !photoId) return res.status(400).json({ error: "Missing ids" });
      await patchClientGalleryPhoto(userId, photoId, (req.body ?? {}) as Record<string, unknown>);
      return res.json({ ok: true });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.delete("/api/client-galleries/:userId/photos/:photoId", async (req, res) => {
    try {
      await requireAdminWithAnyScope(req, ["photography"]);
      const userId = String(req.params.userId ?? "").trim();
      const photoId = String(req.params.photoId ?? "").trim();
      if (!userId || !photoId) return res.status(400).json({ error: "Missing ids" });
      await deleteClientGalleryPhoto(userId, photoId);
      return res.json({ ok: true });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.post("/api/signed-contracts", async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const clientId = String(body.clientId ?? "").trim();
      if (!clientId) return res.status(400).json({ error: "Missing clientId" });
      await requireClientOwn(req, clientId);
      const id = await createSignedContractSubmission(body);
      return res.json({ ok: true, id });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.patch("/api/signed-contracts/:id/status", async (req, res) => {
    try {
      await requireAdminWithAnyScope(req, ["photography"]);
      const id = String(req.params.id ?? "").trim();
      const status = String((req.body as Record<string, unknown>)?.status ?? "");
      if (!id) return res.status(400).json({ error: "Missing id" });
      await updateSignedContractStatus(id, status);
      return res.json({ ok: true });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.post("/api/inspo-boards", async (req, res) => {
    try {
      const id = await createInspoBoard((req.body ?? {}) as Record<string, unknown>);
      return res.json({ ok: true, id });
    } catch (e) {
      return sendContentError(res, e);
    }
  });

  app.delete("/api/inspo-boards/:boardId", async (req, res) => {
    try {
      await requireAdminWithAnyScope(req, ["photography"]);
      const boardId = String(req.params.boardId ?? "").trim();
      if (!boardId) return res.status(400).json({ error: "Missing boardId" });
      await deleteInspoBoard(boardId);
      return res.json({ ok: true });
    } catch (e) {
      return sendContentError(res, e);
    }
  });
}
