import { collection, doc, getDoc, getDocs, limit, orderBy, query, type Timestamp } from "firebase/firestore";
import { publicApiFetch } from "@/lib/api/authenticatedFetch";
import { tryGetFirestoreDb } from "@/lib/firebase";

export type InspoPhoto = {
  id: string;
  src: string;
  alt: string;
  categoryId?: string;
  categoryLabel?: string;
};

export type InspoBoard = {
  id: string;
  photos: InspoPhoto[];
  clientName?: string;
  note?: string;
  createdAt: number;
};

const COL = "inspoBoards";

function tsToMs(v: unknown): number {
  if (v && typeof v === "object" && "toMillis" in v) {
    return (v as Timestamp).toMillis();
  }
  if (typeof v === "number") return v;
  return Date.now();
}

function parseBoard(id: string, raw: Record<string, unknown>): InspoBoard | null {
  const photosRaw = Array.isArray(raw.photos) ? raw.photos : [];
  const photos: InspoPhoto[] = photosRaw
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const o = p as Record<string, unknown>;
      const src = String(o.src ?? "").trim();
      if (!src) return null;
      return {
        id: String(o.id ?? "").trim() || src,
        src,
        alt: String(o.alt ?? "Photo"),
        categoryId: o.categoryId ? String(o.categoryId) : undefined,
        categoryLabel: o.categoryLabel ? String(o.categoryLabel) : undefined,
      };
    })
    .filter(Boolean) as InspoPhoto[];
  if (!photos.length) return null;
  return {
    id,
    photos,
    clientName: raw.clientName ? String(raw.clientName) : undefined,
    note: raw.note ? String(raw.note) : undefined,
    createdAt: tsToMs(raw.createdAt),
  };
}

export async function createInspoBoard(input: {
  photos: InspoPhoto[];
  clientName?: string;
  note?: string;
}): Promise<string> {
  if (!input.photos.length) throw new Error("Add at least one photo to Inspos");
  const res = await publicApiFetch("/api/inspo-boards", {
    method: "POST",
    body: JSON.stringify({
      photos: input.photos,
      clientName: input.clientName?.trim() || "",
      note: input.note?.trim() || "",
    }),
  });
  const data = (await res.json()) as { id?: string };
  return data.id ?? "";
}

export async function fetchInspoBoard(boardId: string): Promise<InspoBoard | null> {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, COL, boardId));
  if (!snap.exists()) return null;
  return parseBoard(snap.id, snap.data() as Record<string, unknown>);
}

export async function listInspoBoards(max = 80): Promise<InspoBoard[]> {
  const db = tryGetFirestoreDb();
  if (!db) return [];
  const qy = query(collection(db, COL), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(qy);
  return snap.docs
    .map((d) => parseBoard(d.id, d.data() as Record<string, unknown>))
    .filter(Boolean) as InspoBoard[];
}

export function inspoShareUrl(boardId: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/inspos/${boardId}`;
}
