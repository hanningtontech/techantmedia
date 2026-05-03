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
import { tryGetFirestoreDb } from "@/lib/firebase";
import type { NclexExamType } from "@/lib/firestore/nclexTypes";
import { noteMatchesStudentTrack } from "@/lib/nclex/examTypeFilters";
import type { NursingTrack } from "@/lib/userTypes";

const COL = "classNotes";

export type ClassNote = {
  id: string;
  title: string;
  description: string;
  /** Plain text or light markdown; rendered as pre-wrap on student view. */
  body: string;
  examType: NclexExamType | null;
  nclexCategory: string;
  nclexTopic: string;
  nclexSubtopic: string;
  isGeneral: boolean;
  published: boolean;
  createdBy: string;
  createdAt: unknown;
  updatedAt?: unknown;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asBool(v: unknown): boolean {
  return v === true;
}

function parseExam(raw: unknown): NclexExamType | null {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "rn" || s === "pn" || s === "both") return s;
  return null;
}

function mapRow(s: QueryDocumentSnapshot<DocumentData>): ClassNote {
  const d = s.data();
  return {
    id: s.id,
    title: asString(d.title),
    description: asString(d.description),
    body: asString(d.body),
    examType: parseExam(d.examType),
    nclexCategory: asString(d.nclexCategory),
    nclexTopic: asString(d.nclexTopic),
    nclexSubtopic: asString(d.nclexSubtopic),
    isGeneral: asBool(d.isGeneral),
    published: asBool(d.published),
    createdBy: asString(d.createdBy),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function listPublishedClassNotes(opts?: {
  studentTrack?: NursingTrack | null;
  category?: string;
  topic?: string;
  subtopic?: string;
  take?: number;
}): Promise<ClassNote[]> {
  const db = tryGetFirestoreDb();
  if (!db) return [];
  const lim = Math.max(1, Math.min(200, opts?.take ?? 80));
  const qy = query(collection(db, COL), where("published", "==", true), orderBy("createdAt", "desc"), limit(lim));
  const snap = await getDocs(qy);
  let rows = snap.docs.map(mapRow);
  const st = opts?.studentTrack;
  if (st) {
    rows = rows.filter((n) => noteMatchesStudentTrack(n.examType, st) || n.isGeneral);
  }
  if (opts?.category?.trim()) {
    const c = opts.category.trim().toLowerCase();
    rows = rows.filter((n) => n.isGeneral || n.nclexCategory.toLowerCase() === c);
  }
  if (opts?.topic?.trim()) {
    const t = opts.topic.trim().toLowerCase();
    rows = rows.filter((n) => n.isGeneral || n.nclexTopic.toLowerCase() === t);
  }
  if (opts?.subtopic?.trim()) {
    const s = opts.subtopic.trim().toLowerCase();
    rows = rows.filter((n) => n.isGeneral || n.nclexSubtopic.toLowerCase() === s);
  }
  return rows;
}

export async function listAllClassNotes(opts?: { limit?: number }): Promise<ClassNote[]> {
  const db = tryGetFirestoreDb();
  if (!db) return [];
  const lim = Math.max(1, Math.min(400, opts?.limit ?? 200));
  const qy = query(collection(db, COL), orderBy("createdAt", "desc"), limit(lim));
  const snap = await getDocs(qy);
  return snap.docs.map(mapRow);
}

export async function createClassNote(args: {
  title: string;
  description?: string;
  body: string;
  examType: NclexExamType | null;
  nclexCategory?: string;
  nclexTopic?: string;
  nclexSubtopic?: string;
  isGeneral?: boolean;
  published?: boolean;
  createdBy: string;
}): Promise<string> {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firestore is not configured");
  const ref = await addDoc(collection(db, COL), {
    title: args.title.trim(),
    description: (args.description ?? "").trim(),
    body: (args.body ?? "").trim(),
    examType: args.examType,
    nclexCategory: (args.nclexCategory ?? "").trim(),
    nclexTopic: (args.nclexTopic ?? "").trim(),
    nclexSubtopic: (args.nclexSubtopic ?? "").trim(),
    isGeneral: args.isGeneral === true,
    published: Boolean(args.published),
    createdBy: args.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateClassNote(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    body: string;
    examType: NclexExamType | null;
    nclexCategory: string;
    nclexTopic: string;
    nclexSubtopic: string;
    isGeneral: boolean;
    published: boolean;
  }>,
): Promise<void> {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firestore is not configured");
  const payload: DocumentData = { updatedAt: serverTimestamp() };
  if (data.title != null) payload.title = data.title.trim();
  if (data.description != null) payload.description = data.description.trim();
  if (data.body != null) payload.body = data.body.trim();
  if (data.examType !== undefined) payload.examType = data.examType;
  if (data.nclexCategory != null) payload.nclexCategory = data.nclexCategory.trim();
  if (data.nclexTopic != null) payload.nclexTopic = data.nclexTopic.trim();
  if (data.nclexSubtopic != null) payload.nclexSubtopic = data.nclexSubtopic.trim();
  if (data.isGeneral != null) payload.isGeneral = Boolean(data.isGeneral);
  if (data.published != null) payload.published = Boolean(data.published);
  await updateDoc(doc(db, COL, id), payload);
}

export async function deleteClassNote(id: string): Promise<void> {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firestore is not configured");
  await deleteDoc(doc(db, COL, id));
}
