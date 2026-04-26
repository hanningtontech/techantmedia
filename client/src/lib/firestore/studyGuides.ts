import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { tryGetFirestoreDb, tryGetFirebaseAuth } from "@/lib/firebase";

export type StudyGuide = {
  id: string;
  title: string;
  description: string;
  className: string;
  published: boolean;
  filename: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  b2FileId: string;
  b2FileName: string;
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
};

const COL = "classStudyGuides";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asBool(v: unknown): boolean {
  return v === true;
}
function asNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapRow(s: QueryDocumentSnapshot<DocumentData>): StudyGuide {
  const d = s.data();
  return {
    id: s.id,
    title: asString(d.title),
    description: asString(d.description),
    className: asString(d.className),
    published: asBool(d.published),
    filename: asString(d.filename),
    contentType: asString(d.contentType),
    sizeBytes: asNum(d.sizeBytes),
    downloadUrl: asString(d.downloadUrl),
    b2FileId: asString(d.b2FileId),
    b2FileName: asString(d.b2FileName),
    createdBy: asString(d.createdBy),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function listPublishedStudyGuides(opts?: { className?: string; limit?: number }) {
  const db = tryGetFirestoreDb();
  if (!db) return [] as StudyGuide[];
  const lim = Math.max(1, Math.min(200, opts?.limit ?? 60));
  const cls = (opts?.className ?? "").trim();
  const base = collection(db, COL);
  const qy =
    cls.length > 0
      ? query(base, where("published", "==", true), where("className", "==", cls), orderBy("createdAt", "desc"), limit(lim))
      : query(base, where("published", "==", true), orderBy("createdAt", "desc"), limit(lim));
  const snap = await getDocs(qy);
  return snap.docs.map(mapRow);
}

export async function listAllStudyGuides(opts?: { limit?: number }) {
  const db = tryGetFirestoreDb();
  if (!db) return [] as StudyGuide[];
  const lim = Math.max(1, Math.min(400, opts?.limit ?? 200));
  const qy = query(collection(db, COL), orderBy("createdAt", "desc"), limit(lim));
  const snap = await getDocs(qy);
  return snap.docs.map(mapRow);
}

export async function uploadStudyGuide(args: {
  file: File;
  title: string;
  description?: string;
  className?: string;
  createdBy: string;
  published?: boolean;
}) {
  const db = tryGetFirestoreDb();
  const auth = tryGetFirebaseAuth();
  if (!db || !auth) throw new Error("Firebase is not configured");
  const f = args.file;
  if (!f) throw new Error("Missing file");
  const name = f.name || "study-guide.pdf";
  const lower = name.toLowerCase();
  if (!(lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx"))) {
    throw new Error("Only .pdf, .doc, or .docx files are supported");
  }
  const contentType = f.type || "application/octet-stream";
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first");
  const idToken = await user.getIdToken();

  const ref = await addDoc(collection(db, COL), {
    title: args.title.trim(),
    description: (args.description ?? "").trim(),
    className: (args.className ?? "").trim(),
    // Prevent broken published docs if upload fails mid-way.
    published: false,
    filename: name,
    contentType,
    sizeBytes: f.size ?? 0,
    downloadUrl: "",
    b2FileId: "",
    b2FileName: "",
    createdBy: args.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const bytes = await f.arrayBuffer();
  const resp = await fetch(`/api/b2/study-guides/${encodeURIComponent(ref.id)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "X-File-Name": name,
      "Content-Type": contentType,
    },
    body: bytes,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(t || "Upload failed");
  }
  const out = (await resp.json()) as { fileId?: string; fileName?: string; downloadUrl?: string; sizeBytes?: number; contentType?: string };
  const downloadUrl = String(out.downloadUrl ?? "");
  const b2FileId = String(out.fileId ?? "");
  const b2FileName = String(out.fileName ?? "");
  if (!downloadUrl || !b2FileId || !b2FileName) throw new Error("Upload did not return B2 identifiers");

  await updateDoc(doc(db, COL, ref.id), {
    downloadUrl,
    b2FileId,
    b2FileName,
    published: Boolean(args.published),
    sizeBytes: typeof out.sizeBytes === "number" ? out.sizeBytes : f.size ?? 0,
    contentType: typeof out.contentType === "string" && out.contentType ? out.contentType : contentType,
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function setStudyGuidePublished(id: string, published: boolean) {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firebase is not configured");
  await updateDoc(doc(db, COL, id), { published, updatedAt: serverTimestamp() });
}

export async function deleteStudyGuide(id: string, b2: { fileId: string; fileName: string }) {
  const db = tryGetFirestoreDb();
  const auth = tryGetFirebaseAuth();
  if (!db || !auth) throw new Error("Firebase is not configured");
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first");
  const idToken = await user.getIdToken();

  // If a legacy/broken doc has no B2 reference, allow deleting metadata only.
  if (!b2.fileId || !b2.fileName) {
    await deleteDoc(doc(db, COL, id));
    return;
  }

  const resp = await fetch(`/api/b2/study-guides`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId: b2.fileId, fileName: b2.fileName }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(t || "Delete failed");
  }

  await deleteDoc(doc(db, COL, id));
}

