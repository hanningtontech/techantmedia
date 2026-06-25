import type express from "express";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const SUPER_ADMIN_EMAIL = "hanningtonkuria5@gmail.com";
export const VALID_ADMIN_SCOPES = ["development", "xai", "photography", "tutoring", "settings"] as const;

export function parseAdminScopes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is string => typeof s === "string" && (VALID_ADMIN_SCOPES as readonly string[]).includes(s),
  );
}

export function isSuperAdminDoc(data: Record<string, unknown> | null | undefined, email?: string | null): boolean {
  if (data?.isSuperAdmin === true) return true;
  const e = (email ?? String(data?.email ?? "")).trim().toLowerCase();
  return e === SUPER_ADMIN_EMAIL.toLowerCase();
}

async function bearerToken(req: express.Request): Promise<string> {
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("Missing auth token");
  return token;
}

export async function requireAdmin(req: express.Request): Promise<{ uid: string; email: string | null }> {
  const token = await bearerToken(req);
  const decoded = await getAuth().verifyIdToken(token);
  const uid = decoded.uid;
  const snap = await getFirestore().doc(`users/${uid}`).get();
  const role = (snap.exists ? String((snap.data() as Record<string, unknown>)?.role ?? "") : "").toLowerCase().trim();
  if (role !== "admin") throw new Error("Forbidden");
  return { uid, email: decoded.email ?? null };
}

export async function requireSuperAdmin(req: express.Request): Promise<{ uid: string }> {
  const { uid, email } = await requireAdmin(req);
  const snap = await getFirestore().doc(`users/${uid}`).get();
  const data = (snap.exists ? (snap.data() as Record<string, unknown>) : null) ?? null;
  if (!isSuperAdminDoc(data, email)) throw new Error("Forbidden");
  return { uid };
}

export async function requireAdminWithAnyScope(req: express.Request, scopes: string[]): Promise<{ uid: string }> {
  const { uid, email } = await requireAdmin(req);
  const snap = await getFirestore().doc(`users/${uid}`).get();
  const data = (snap.exists ? (snap.data() as Record<string, unknown>) : null) ?? null;
  if (isSuperAdminDoc(data, email)) return { uid };
  const granted = parseAdminScopes(data?.adminScopes);
  const legacy = data != null && !Object.prototype.hasOwnProperty.call(data, "adminScopes");
  if (legacy && granted.length === 0) return { uid };
  if (scopes.some((s) => granted.includes(s))) return { uid };
  throw new Error("Forbidden");
}

export async function requireTutorOrAdmin(req: express.Request): Promise<{ uid: string }> {
  const token = await bearerToken(req);
  const decoded = await getAuth().verifyIdToken(token);
  const uid = decoded.uid;
  const snap = await getFirestore().doc(`users/${uid}`).get();
  const role = (snap.exists ? String((snap.data() as Record<string, unknown>)?.role ?? "") : "").toLowerCase().trim();
  if (!(role === "admin" || role === "tutor")) throw new Error("Forbidden");
  return { uid };
}

export async function requireClientOwn(req: express.Request, clientUserId: string): Promise<{ uid: string }> {
  const token = await bearerToken(req);
  const decoded = await getAuth().verifyIdToken(token);
  const uid = decoded.uid;
  if (uid !== clientUserId) throw new Error("Forbidden");
  const snap = await getFirestore().doc(`users/${uid}`).get();
  const role = (snap.exists ? String((snap.data() as Record<string, unknown>)?.role ?? "") : "").toLowerCase().trim();
  if (role !== "client") throw new Error("Forbidden");
  return { uid };
}
