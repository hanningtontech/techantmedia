import type { AdminFeatureScope } from "@/lib/admin/adminPermissions";
import { tryGetFirebaseAuth } from "@/lib/firebase";

async function authHeaders(): Promise<HeadersInit> {
  const auth = tryGetFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function bootstrapSuperAdmin(): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch("/api/admin/bootstrap", { method: "POST", headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Bootstrap failed (${res.status})`);
  }
}

export type AdminUserRow = {
  uid: string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin?: boolean;
  adminScopes?: AdminFeatureScope[];
  createdAt?: string;
};

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const headers = await authHeaders();
  const res = await fetch("/api/admin/users", { headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to list admins (${res.status})`);
  }
  const data = (await res.json()) as { admins: AdminUserRow[] };
  return data.admins ?? [];
}

export async function createAdminAccount(opts: {
  email: string;
  password: string;
  name: string;
  adminScopes: AdminFeatureScope[];
}): Promise<{ uid: string; email: string }> {
  const headers = await authHeaders();
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers,
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to create admin (${res.status})`);
  }
  return res.json() as Promise<{ uid: string; email: string }>;
}

export async function updateAdminScopes(uid: string, adminScopes: AdminFeatureScope[]): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ adminScopes }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to update permissions (${res.status})`);
  }
}
