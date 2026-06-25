import type { PhotoOrientation, SitePhotoItem } from "@/lib/portfolio/portfolioTypes";

export type ImageDimensions = {
  width: number;
  height: number;
  /** Width divided by height (e.g. 1.5 for 3:2 landscape). */
  aspectRatio: number;
  orientation: PhotoOrientation;
};

const DEFAULT_LANDSCAPE: ImageDimensions = {
  width: 4,
  height: 3,
  aspectRatio: 4 / 3,
  orientation: "landscape",
};

export function orientationFromSize(width: number, height: number): PhotoOrientation {
  if (!width || !height) return "landscape";
  const ratio = width / height;
  if (ratio > 1.08) return "landscape";
  if (ratio < 0.92) return "portrait";
  return "square";
}

export function dimensionsFromSize(width: number, height: number): ImageDimensions {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  return {
    width: w,
    height: h,
    aspectRatio: w / h,
    orientation: orientationFromSize(w, h),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image dimensions"));
    img.src = src;
  });
}

/** Read natural size from a File before upload. */
export async function probeImageFile(file: File): Promise<ImageDimensions> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return dimensionsFromSize(img.naturalWidth, img.naturalHeight);
  } catch {
    return DEFAULT_LANDSCAPE;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Read natural size from a remote URL (after upload). */
export async function probeImageUrl(url: string): Promise<ImageDimensions> {
  if (!url.trim()) return DEFAULT_LANDSCAPE;
  try {
    const img = await loadImage(url);
    return dimensionsFromSize(img.naturalWidth, img.naturalHeight);
  } catch {
    return DEFAULT_LANDSCAPE;
  }
}

/** Aspect ratio for justified-layout (width / height). */
export function getPhotoAspectRatio(photo: SitePhotoItem): number {
  if (photo.orientation === "portrait") return 0.75;
  if (photo.orientation === "landscape") return 1.5;
  if (photo.orientation === "square") return 1;
  if (photo.aspectRatio && photo.aspectRatio > 0) return photo.aspectRatio;
  if (photo.width && photo.height) return photo.width / photo.height;
  if (photo.tall) return 0.75;
  return DEFAULT_LANDSCAPE.aspectRatio;
}

export type GalleryUploadPayload = {
  url: string;
  width: number;
  height: number;
  aspectRatio: number;
  orientation?: PhotoOrientation;
};

export async function buildGalleryUploadPayload(
  url: string,
  file?: File,
): Promise<GalleryUploadPayload> {
  const dims = file ? await probeImageFile(file) : await probeImageUrl(url);
  return { url, ...dims };
}
