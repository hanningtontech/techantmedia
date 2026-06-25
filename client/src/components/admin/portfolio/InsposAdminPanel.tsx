import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import { listInspoBoards, inspoShareUrl, type InspoBoard } from "@/lib/portfolio/inspoBoards";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";

export function InsposAdminPanel() {
  const [boards, setBoards] = useState<InspoBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listInspoBoards()
      .then(setBoards)
      .catch((e) => setError(formatAuthOrFirestoreError(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminPage
      title="Client inspos"
      description="Boards clients create when they share inspiration photos via WhatsApp or the share link."
      width="standard"
    >
      <div className="space-y-4">
        {loading ? <p className="text-zinc-400">Loading…</p> : null}
        {error ? <p className="text-red-400">{error}</p> : null}
        {!loading && !boards.length ? (
          <p className="text-zinc-400">No inspo boards yet. Clients add photos on category pages, then share from /inspos.</p>
        ) : null}
        {boards.map((board) => (
          <div
            key={board.id}
            className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-white">
                {board.clientName?.trim() || "Anonymous client"}
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  {new Date(board.createdAt).toLocaleString()}
                </span>
              </p>
              <p className="text-sm text-zinc-400">{board.photos.length} photos</p>
              {board.note ? <p className="mt-1 text-sm text-zinc-500">{board.note}</p> : null}
            </div>
            <a
              href={inspoShareUrl(board.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-orange-500/40 px-4 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/10"
            >
              Open board
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ))}
      </div>
    </AdminPage>
  );
}
