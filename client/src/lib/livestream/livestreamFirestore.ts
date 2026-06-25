import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { apiFetch } from "@/lib/api/authenticatedFetch";
import { tryGetFirestoreDb } from "@/lib/firebase";
import { DEFAULT_LIVESTREAM_SETTINGS } from "./livestreamDefaults";
import { withLivestreamUrlDefaults } from "./livestreamUrls";
import {
  COUNTDOWN_UNIT_ORDER,
  type CountdownUnit,
  type LivestreamBackgroundImage,
  type LivestreamSettings,
  type LivestreamStreamStatus,
} from "./livestreamTypes";

const STREAM_STATUSES: LivestreamStreamStatus[] = ["offline", "connecting", "live"];

const DOC_PATH = "portfolio/livestream";

function clampPercent(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampBlur(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(32, Math.round(value)));
}

function parseShowUnits(raw: unknown): LivestreamSettings["showUnits"] {
  const base = { ...DEFAULT_LIVESTREAM_SETTINGS.showUnits };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const unit of COUNTDOWN_UNIT_ORDER) {
    if (typeof o[unit] === "boolean") base[unit] = o[unit];
  }
  return base;
}

function parseBackgroundImages(raw: unknown): LivestreamBackgroundImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const url = String(o.url ?? "").trim();
      if (!url) return null;
      const id = String(o.id ?? `bg_${index}`).trim() || `bg_${index}`;
      return {
        id,
        url,
        alt: String(o.alt ?? "").trim() || undefined,
        order: typeof o.order === "number" ? o.order : index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.order - b!.order) as LivestreamBackgroundImage[];
}

export function parseLivestreamSettings(doc: Record<string, unknown> | null | undefined): LivestreamSettings {
  if (!doc) return { ...DEFAULT_LIVESTREAM_SETTINGS };
  const parsed = {
    targetDateTime: String(doc.targetDateTime ?? "").trim(),
    title: String(doc.title ?? DEFAULT_LIVESTREAM_SETTINGS.title).trim() || DEFAULT_LIVESTREAM_SETTINGS.title,
    subtitle: String(doc.subtitle ?? DEFAULT_LIVESTREAM_SETTINGS.subtitle).trim() || DEFAULT_LIVESTREAM_SETTINGS.subtitle,
    showUnits: parseShowUnits(doc.showUnits),
    backgroundImages: parseBackgroundImages(doc.backgroundImages),
    slideshowIntervalSec:
      typeof doc.slideshowIntervalSec === "number" && doc.slideshowIntervalSec > 0
        ? doc.slideshowIntervalSec
        : DEFAULT_LIVESTREAM_SETTINGS.slideshowIntervalSec,
    backgroundTransparency: clampPercent(doc.backgroundTransparency, DEFAULT_LIVESTREAM_SETTINGS.backgroundTransparency),
    backgroundBlurPx: clampBlur(doc.backgroundBlurPx, DEFAULT_LIVESTREAM_SETTINGS.backgroundBlurPx),
    musicUrl: String(doc.musicUrl ?? "").trim(),
    musicTitle: String(doc.musicTitle ?? "").trim(),
    enabled: doc.enabled === true,
    videoEnabled: doc.videoEnabled === true,
    hlsPlaybackUrl: String(doc.hlsPlaybackUrl ?? "").trim(),
    dashPlaybackUrl: String(doc.dashPlaybackUrl ?? "").trim(),
    rtmpIngestUrl: String(doc.rtmpIngestUrl ?? "").trim(),
    streamTitle: String(doc.streamTitle ?? DEFAULT_LIVESTREAM_SETTINGS.streamTitle).trim() || DEFAULT_LIVESTREAM_SETTINGS.streamTitle,
    streamStatus: STREAM_STATUSES.includes(doc.streamStatus as LivestreamStreamStatus)
      ? (doc.streamStatus as LivestreamStreamStatus)
      : DEFAULT_LIVESTREAM_SETTINGS.streamStatus,
  };
  return withLivestreamUrlDefaults(parsed);
}

export function enabledCountdownUnits(showUnits: LivestreamSettings["showUnits"]): CountdownUnit[] {
  return COUNTDOWN_UNIT_ORDER.filter((u) => showUnits[u]);
}

export function subscribeLivestreamSettings(
  onData: (settings: LivestreamSettings) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const db = tryGetFirestoreDb();
  if (!db) {
    onData({ ...DEFAULT_LIVESTREAM_SETTINGS });
    return () => {};
  }

  return onSnapshot(
    doc(db, DOC_PATH),
    (snap) => {
      onData(parseLivestreamSettings(snap.exists() ? (snap.data() as Record<string, unknown>) : null));
    },
    (err) => onError?.(err),
  );
}

export async function saveLivestreamSettings(settings: LivestreamSettings): Promise<void> {
  await apiFetch("/api/livestream/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function newLivestreamImageId(): string {
  const rnd =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `ls_${Date.now().toString(36)}_${rnd}`;
}
