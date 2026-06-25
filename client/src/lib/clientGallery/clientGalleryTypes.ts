import type { Timestamp } from "firebase/firestore";

/** Firestore `clientGalleries/{userId}` */
export interface ClientGalleryMeta {
  userId: string;
  paymentConfirmed: boolean;
  updatedAt: Timestamp | null;
}

/** Firestore `clientGalleries/{userId}/photos/{photoId}` */
export interface ClientGalleryPhoto {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  /** When true the client can see this photo in their gallery (may still be blurred). */
  visible: boolean;
  /** Up to two samples stay unblurred until payment is confirmed. */
  isSample: boolean;
  order: number;
  createdAt: Timestamp | null;
}

export const MAX_CLIENT_GALLERY_SAMPLES = 2;
