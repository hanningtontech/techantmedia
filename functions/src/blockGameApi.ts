import * as admin from "firebase-admin";
import * as crypto from "crypto";

function json(res: { status: (n: number) => void; set: (k: string, v: string) => void; send: (b: string) => void }, status: number, body: unknown) {
  res.status(status);
  res.set("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

function generatePin(): string {
  return String(crypto.randomInt(100000, 999999));
}

function serializePinDoc(pinId: string, data: Record<string, unknown>) {
  const createdAt = data.createdAt;
  let createdAtIso: string | null = null;
  if (createdAt && typeof createdAt === "object" && "toDate" in createdAt && typeof createdAt.toDate === "function") {
    createdAtIso = createdAt.toDate().toISOString();
  } else if (createdAt) {
    createdAtIso = String(createdAt);
  }
  return {
    pinId,
    pin: String(data.pin ?? ""),
    label: String(data.label ?? "Simulation access"),
    recipientName: data.recipientName ? String(data.recipientName) : null,
    recipientEmail: data.recipientEmail ? String(data.recipientEmail) : null,
    expiresAt: Number(data.expiresAt ?? 0),
    usedAt: data.usedAt ? String(data.usedAt) : null,
    usedEmail: data.usedEmail ? String(data.usedEmail) : null,
    createdAt: createdAtIso,
  };
}

export async function handleBlockGameApi(
  req: { method?: string; body?: unknown; headers?: Record<string, unknown> },
  res: { status: (n: number) => void; set: (k: string, v: string) => void; send: (b: string) => void },
  path: string,
  deps: {
    ensureAdmin: () => void;
    requireAdminFromBearer: (req: unknown) => Promise<{ uid: string; email: string | null }>;
  },
): Promise<boolean> {
  const { ensureAdmin, requireAdminFromBearer } = deps;

  if (req.method === "GET" && path === "/block-game/sim-pin/recent") {
    ensureAdmin();
    await requireAdminFromBearer(req);
    const db = admin.firestore();
    const snap = await db.collection("blockGameSimPins").orderBy("createdAt", "desc").limit(25).get();
    const pins = snap.docs.map((doc) => serializePinDoc(doc.id, doc.data()));
    json(res, 200, { pins });
    return true;
  }

  if (req.method === "POST" && path === "/block-game/sim-pin/generate") {
    ensureAdmin();
    const { uid } = await requireAdminFromBearer(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const recipientName = body.recipientName ? String(body.recipientName).trim() : "";
    const recipientEmail = body.recipientEmail ? String(body.recipientEmail).trim() : "";
    const label = String(body.label ?? (recipientName || recipientEmail || "Simulation access")).trim();
    const pin = generatePin();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const db = admin.firestore();
    const pinId = crypto.randomBytes(8).toString("hex");
    await db.doc(`blockGameSimPins/${pinId}`).set({
      pin,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      usedAt: null,
      usedBy: null,
      usedEmail: null,
      label,
      recipientName: recipientName || null,
      recipientEmail: recipientEmail || null,
    });
    const recipientNote =
      recipientName && recipientEmail
        ? `${recipientName} (${recipientEmail})`
        : recipientName || recipientEmail || "visitor";
    await db.collection("adminNotifications").add({
      type: "simulation_access_pin",
      status: "open",
      read: false,
      readAt: null,
      title: "Simulation access PIN",
      message: `PIN ${pin} for ${recipientNote} — expires ${new Date(expiresAt).toLocaleString()}`,
      pinId,
      recipientName: recipientName || null,
      recipientEmail: recipientEmail || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedAt: null,
    });
    json(res, 200, {
      pinId,
      pin,
      label,
      recipientName: recipientName || null,
      recipientEmail: recipientEmail || null,
      expiresAt,
      usedAt: null,
      usedEmail: null,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === "POST" && path === "/block-game/sim-pin/redeem") {
    ensureAdmin();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pin = String(body.pin ?? "").trim();
    if (!/^\d{4,8}$/.test(pin)) {
      json(res, 400, { error: "Invalid PIN format." });
      return true;
    }
    const db = admin.firestore();
    const snap = await db
      .collection("blockGameSimPins")
      .where("pin", "==", pin)
      .where("usedAt", "==", null)
      .limit(1)
      .get();
    if (snap.empty) {
      json(res, 403, { error: "Invalid or already used PIN." });
      return true;
    }
    const doc = snap.docs[0]!;
    const data = doc.data();
    const expiresAt = Number(data.expiresAt ?? 0);
    if (expiresAt > 0 && Date.now() > expiresAt) {
      json(res, 403, { error: "PIN expired. Ask admin for a new one." });
      return true;
    }
    await doc.ref.update({
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
      usedBy: body.uid ? String(body.uid) : null,
      usedEmail: body.email ? String(body.email) : null,
    });
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && path === "/block-game/settings") {
    const db = admin.firestore();
    const snap = await db.doc("blockGame/settings").get();
    const data = snap.exists ? snap.data() : {};
    const edge = Number(data?.houseEdge ?? 0.03);
    json(res, 200, {
      houseEdge: Math.min(0.5, Math.max(0.01, Number.isFinite(edge) ? edge : 0.03)),
      bombRanges: data?.bombRanges ?? null,
      updatedAt: data?.updatedAt ? String(data.updatedAt) : null,
    });
    return true;
  }

  if (req.method === "POST" && path === "/block-game/settings/bomb-ranges") {
    ensureAdmin();
    const { uid } = await requireAdminFromBearer(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const raw = body.bombRanges;
    if (!raw || typeof raw !== "object") {
      json(res, 400, { error: "Invalid bombRanges payload." });
      return true;
    }
    const bombRanges: Record<string, { pctMin: number; pctMax: number }> = {};
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      if (!val || typeof val !== "object") continue;
      const o = val as Record<string, unknown>;
      let pctMin = Math.min(0.9, Math.max(0.05, Number(o.pctMin)));
      let pctMax = Math.min(0.9, Math.max(0.05, Number(o.pctMax)));
      if (!Number.isFinite(pctMin)) pctMin = 0.3;
      if (!Number.isFinite(pctMax)) pctMax = 0.55;
      if (pctMin > pctMax) [pctMin, pctMax] = [pctMax, pctMin];
      bombRanges[key] = { pctMin, pctMax };
    }
    const db = admin.firestore();
    const updatedAt = new Date().toISOString();
    await db.doc("blockGame/settings").set({ bombRanges, updatedAt, updatedBy: uid }, { merge: true });
    json(res, 200, { bombRanges, updatedAt });
    return true;
  }

  if (req.method === "POST" && path === "/block-game/settings/house-edge") {
    ensureAdmin();
    const { uid } = await requireAdminFromBearer(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const raw = Number(body.houseEdge);
    if (!Number.isFinite(raw)) {
      json(res, 400, { error: "Invalid house edge." });
      return true;
    }
    const houseEdge = Math.min(0.5, Math.max(0.01, raw));
    const db = admin.firestore();
    const updatedAt = new Date().toISOString();
    await db.doc("blockGame/settings").set({ houseEdge, updatedAt, updatedBy: uid }, { merge: true });
    json(res, 200, { houseEdge, updatedAt });
    return true;
  }

  if (req.method === "POST" && path === "/block-game/fund-request/resolve") {
    ensureAdmin();
    await requireAdminFromBearer(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim();
    const note = body.note ? String(body.note) : null;
    if (!id || (status !== "approved" && status !== "rejected")) {
      json(res, 400, { error: "Invalid request id or status." });
      return true;
    }

    const db = admin.firestore();
    const reqRef = db.doc(`blockGameFundRequests/${id}`);
    const FREE_START = 10;

    try {
      const ok = await db.runTransaction(async (tx) => {
        const snap = await tx.get(reqRef);
        if (!snap.exists) return false;
        const req = snap.data() as {
          uid: string;
          amount: number;
          status: string;
        };
        if (req.status !== "pending") return false;

        const wRef = db.doc(`blockGameWallets/${req.uid}`);
        type WalletData = {
          balance?: number;
          totalGames?: number;
          totalStaked?: number;
          totalWon?: number;
        };
        let prevWallet: WalletData | null = null;
        if (status === "approved") {
          const wSnap = await tx.get(wRef);
          prevWallet = wSnap.exists ? (wSnap.data() as WalletData) : null;
        }

        tx.set(
          reqRef,
          {
            status,
            resolvedAt: new Date().toISOString(),
            note,
          },
          { merge: true },
        );

        if (status === "approved") {
          const nextBal = Math.max(
            0,
            Math.round((prevWallet?.balance ?? FREE_START) + Number(req.amount ?? 0)),
          );
          tx.set(
            wRef,
            {
              balance: nextBal,
              totalGames: prevWallet?.totalGames ?? 0,
              totalStaked: prevWallet?.totalStaked ?? 0,
              totalWon: prevWallet?.totalWon ?? 0,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }

        return true;
      });

      if (!ok) {
        json(res, 409, { error: "Request not found or already resolved." });
        return true;
      }
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 500, { error: e instanceof Error ? e.message : "Could not resolve request." });
    }
    return true;
  }

  return false;
}
