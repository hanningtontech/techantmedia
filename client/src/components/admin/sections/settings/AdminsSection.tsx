import { useEffect, useState } from "react";
import { AdminField } from "@/components/admin/shared/AdminField";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import { AdminScopeCheckboxes } from "@/components/admin/sections/settings/AdminScopeCheckboxes";
import {
  createAdminAccount,
  listAdminUsers,
  updateAdminScopes,
  type AdminUserRow,
} from "@/lib/admin/adminApi";
import type { AdminFeatureScope } from "@/lib/admin/adminPermissions";
import { ALL_ADMIN_SCOPES, scopeLabel } from "@/lib/admin/adminPermissions";
import { SUPER_ADMIN_EMAIL } from "@/lib/admin/constants";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";

export function AdminsSection() {
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [newScopes, setNewScopes] = useState<AdminFeatureScope[]>(["development"]);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editScopes, setEditScopes] = useState<AdminFeatureScope[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      setAdmins(await listAdminUsers());
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    if (!newScopes.length) {
      toast.error("Select at least one feature area.");
      return;
    }
    setBusy(true);
    try {
      await createAdminAccount({
        email: email.trim(),
        password,
        name: name.trim(),
        adminScopes: newScopes,
      });
      toast.success("Admin account created. They can sign in with email and password.");
      setEmail("");
      setPassword("");
      setName("");
      setNewScopes(["development"]);
      await load();
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (admin: AdminUserRow) => {
    if (admin.isSuperAdmin || admin.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return;
    setEditingUid(admin.uid);
    setEditScopes(admin.adminScopes?.length ? [...admin.adminScopes] : [...ALL_ADMIN_SCOPES]);
  };

  const saveEdit = async () => {
    if (!editingUid || !editScopes.length) {
      toast.error("Select at least one feature area.");
      return;
    }
    setBusy(true);
    try {
      await updateAdminScopes(editingUid, editScopes);
      toast.success("Permissions updated.");
      setEditingUid(null);
      await load();
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Admin accounts"
      description={`You are the owner (${SUPER_ADMIN_EMAIL}). Create admins and choose which areas they can access: Development, xAI portfolio, Photography, Tutoring, or Settings.`}
      width="standard"
    >
      <div className="admin-grid-2 admin-span-full">
        <div className="admin-panel p-5 admin-span-2">
          <h3 className="text-lg font-semibold text-white">Current admins</h3>
          {loading ? (
            <p className="mt-3 text-zinc-400">Loading…</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/10">
              {admins.map((a) => {
                const isOwner = a.isSuperAdmin || a.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                const scopes = isOwner ? ALL_ADMIN_SCOPES : (a.adminScopes ?? []);
                const isEditing = editingUid === a.uid;
                return (
                  <li key={a.uid} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-100">{a.name || a.email}</p>
                        <p className="text-sm text-zinc-500">{a.email}</p>
                        <p className="mt-2 text-xs text-zinc-500">
                          {isOwner
                            ? "Full access (super admin)"
                            : scopes.map(scopeLabel).join(" · ") || "No areas assigned"}
                        </p>
                      </div>
                      {isOwner ? (
                        <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-300">
                          Super admin · Google
                        </span>
                      ) : (
                        <span className="rounded-full bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-300">
                          Scoped admin
                        </span>
                      )}
                    </div>
                    {!isOwner && isEditing ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="text-sm font-medium text-zinc-200">Feature access</p>
                        <div className="mt-3">
                          <AdminScopeCheckboxes value={editScopes} onChange={setEditScopes} disabled={busy} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy || !editScopes.length}
                            onClick={() => void saveEdit()}
                            className="rounded-full bg-teal-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
                          >
                            Save permissions
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setEditingUid(null)}
                            className="rounded-full border border-white/15 px-5 py-2 text-sm text-zinc-300 hover:bg-white/5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : !isOwner ? (
                      <button
                        type="button"
                        className="mt-3 text-sm font-medium text-teal-400 hover:text-teal-300"
                        onClick={() => startEdit(a)}
                      >
                        Edit permissions
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="admin-panel p-5 admin-span-2 lg:col-span-1">
          <h3 className="text-lg font-semibold text-white">Create admin (with password)</h3>
          <p className="mt-1 text-sm text-zinc-500">Choose which sections they can see in the admin dashboard.</p>
          <div className="mt-5 space-y-0">
            <AdminField label="Full name" tone="teal">
              <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Admin" />
            </AdminField>
            <AdminField label="Email">
              <input
                className="admin-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </AdminField>
            <AdminField label="Password" hint="Minimum 8 characters">
              <input
                className="admin-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </AdminField>
            <AdminField label="Feature access" tone="teal">
              <AdminScopeCheckboxes value={newScopes} onChange={setNewScopes} disabled={busy} />
            </AdminField>
            <button
              type="button"
              disabled={busy || !email.trim() || password.length < 8 || !newScopes.length}
              onClick={() => void handleCreate()}
              className="mt-2 rounded-full bg-teal-500 px-6 py-3 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create admin account"}
            </button>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}


