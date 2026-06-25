import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import { listClientUsersForAdmin } from "@/lib/firestore/usersAdmin";
import type { UserListRow } from "@/lib/userTypes";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";

export function ClientUsersAdminSection() {
  const [rows, setRows] = useState<UserListRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listClientUsersForAdmin()
      .then(setRows)
      .catch((e) => toast.error(formatAuthOrFirestoreError(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminSection
      title="Photography client accounts"
      description="Clients who signed up for My Gallery. Manage their photos under Client galleries."
      accent="orange"
    >
      {loading ? (
        <p className="text-sm text-zinc-400">Loading clients…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-400">
          No client accounts yet. Clients register at /photography/account on the storefront.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.uid} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white">{r.name || "—"}</td>
                  <td className="px-4 py-3 text-zinc-300">{r.username || "—"}</td>
                  <td className="px-4 py-3 text-zinc-300">{r.email || "—"}</td>
                  <td className="px-4 py-3 text-zinc-300">{r.phoneNumber || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
        <Users className="h-3.5 w-3.5" />
        {rows.length} client{rows.length === 1 ? "" : "s"} registered
      </p>
    </AdminSection>
  );
}
