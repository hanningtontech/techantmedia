import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { apiFetch } from "@/lib/api/authenticatedFetch";
import { tryGetFirestoreDb } from "@/lib/firebase";
import type { ClientGalleryMeta, ClientGalleryPhoto } from "@/lib/clientGallery/clientGalleryTypes";

const GALLERIES = "clientGalleries";
const PHOTOS = "photos";

function requireDb() {
  const db = tryGetFirestoreDb();
  if (!db) throw new Error("Firestore is not configured.");
  return db;
}

function galleryRef(userId: string) {
  return doc(requireDb(), GALLERIES, userId);
}

function photosCol(userId: string) {
  return collection(requireDb(), GALLERIES, userId, PHOTOS);
}

function mapPhoto(id: string, data: Record<string, unknown>): ClientGalleryPhoto {
  return {
    id,
    src: typeof data.src === "string" ? data.src : "",
    alt: typeof data.alt === "string" ? data.alt : "",
    width: typeof data.width === "number" ? data.width : undefined,
    height: typeof data.height === "number" ? data.height : undefined,
    visible: data.visible === true,
    isSample: data.isSample === true,
    order: typeof data.order === "number" ? data.order : 0,
    createdAt: (data.createdAt as ClientGalleryPhoto["createdAt"]) ?? null,
  };
}

export async function getClientGalleryMeta(userId: string): Promise<ClientGalleryMeta | null> {
  const snap = await getDoc(galleryRef(userId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    userId,
    paymentConfirmed: d.paymentConfirmed === true,
    updatedAt: (d.updatedAt as ClientGalleryMeta["updatedAt"]) ?? null,
  };
}

export async function listClientGalleryPhotos(userId: string): Promise<ClientGalleryPhoto[]> {
  const q = query(photosCol(userId), orderBy("order", "asc"));
  const snaps = await getDocs(q);
  return snaps.docs.map((s) => mapPhoto(s.id, s.data() as Record<string, unknown>));
}

export function subscribeClientGallery(
  userId: string,
  onMeta: (meta: ClientGalleryMeta | null) => void,
  onPhotos: (photos: ClientGalleryPhoto[]) => void,
): Unsubscribe | undefined {
  const db = tryGetFirestoreDb();
  if (!db) return undefined;

  const metaUnsub = onSnapshot(
    galleryRef(userId),
    (snap) => {
      if (!snap.exists()) {
        onMeta(null);
        return;
      }
      const d = snap.data();
      onMeta({
        userId,
        paymentConfirmed: d.paymentConfirmed === true,
        updatedAt: (d.updatedAt as ClientGalleryMeta["updatedAt"]) ?? null,
      });
    },
    (err) => console.error("client gallery meta:", err),
  );

  const photosUnsub = onSnapshot(
    query(photosCol(userId), orderBy("order", "asc")),
    (snaps) => {
      onPhotos(snaps.docs.map((s) => mapPhoto(s.id, s.data() as Record<string, unknown>)));
    },
    (err) => console.error("client gallery photos:", err),
  );

  return () => {
    metaUnsub();
    photosUnsub();
  };
}

export async function ensureClientGallery(userId: string): Promise<void> {
  await apiFetch(`/api/client-galleries/${encodeURIComponent(userId)}/ensure`, { method: "POST" });
}

export async function setClientGalleryPaymentConfirmed(userId: string, paymentConfirmed: boolean): Promise<void> {
  await apiFetch(`/api/client-galleries/${encodeURIComponent(userId)}/meta`, {
    method: "PATCH",
    body: JSON.stringify({ paymentConfirmed }),
  });
}

export async function addClientGalleryPhoto(
  userId: string,
  photo: Omit<ClientGalleryPhoto, "id" | "createdAt"> & { id?: string },
): Promise<string> {
  const res = await apiFetch(`/api/client-galleries/${encodeURIComponent(userId)}/photos`, {
    method: "POST",
    body: JSON.stringify(photo),
  });
  const data = (await res.json()) as { id?: string };
  return data.id ?? photo.id ?? "";
}

export async function updateClientGalleryPhoto(
  userId: string,
  photoId: string,
  patch: Partial<Pick<ClientGalleryPhoto, "visible" | "isSample" | "alt" | "order">>,
): Promise<void> {
  await apiFetch(`/api/client-galleries/${encodeURIComponent(userId)}/photos/${encodeURIComponent(photoId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteClientGalleryPhoto(userId: string, photoId: string): Promise<void> {
  await apiFetch(`/api/client-galleries/${encodeURIComponent(userId)}/photos/${encodeURIComponent(photoId)}`, {
    method: "DELETE",
  });
}

export async function listClientUserIdsWithGalleries(): Promise<string[]> {
  const snaps = await getDocs(collection(requireDb(), GALLERIES));
  return snaps.docs.map((d) => d.id);
}
