export type CountdownUnit = "years" | "months" | "days" | "hours" | "minutes" | "seconds";

export type LivestreamCountdownUnits = Record<CountdownUnit, boolean>;

export type LivestreamBackgroundImage = {
  id: string;
  url: string;
  alt?: string;
  order: number;
};

export type LivestreamStreamStatus = "offline" | "connecting" | "live";

export type LivestreamSettings = {
  /** ISO 8601 local datetime from admin input (e.g. 2026-12-25T18:00) */
  targetDateTime: string;
  title: string;
  subtitle: string;
  showUnits: LivestreamCountdownUnits;
  backgroundImages: LivestreamBackgroundImage[];
  /** Seconds between slideshow transitions */
  slideshowIntervalSec: number;
  /** 0 = fully opaque, 100 = fully transparent */
  backgroundTransparency: number;
  /** CSS blur in pixels (0 = sharp) */
  backgroundBlurPx: number;
  musicUrl: string;
  musicTitle: string;
  /** Show countdown timer (disabled when videoEnabled is true) */
  enabled: boolean;
  /** When true, show the HLS player and hide the countdown */
  videoEnabled: boolean;
  /** HLS manifest URL (.m3u8) from your media server */
  hlsPlaybackUrl: string;
  /** Optional MPEG-DASH manifest (.mpd) — HLS is preferred when both are set */
  dashPlaybackUrl: string;
  /** RTMP server URL for OBS (without stream key) */
  rtmpIngestUrl: string;
  /** Overlay title on the video player */
  streamTitle: string;
  /** Last known broadcast status (updated by probe or player) */
  streamStatus: LivestreamStreamStatus;
};

export const COUNTDOWN_UNIT_ORDER: CountdownUnit[] = [
  "years",
  "months",
  "days",
  "hours",
  "minutes",
  "seconds",
];

export const COUNTDOWN_UNIT_LABELS: Record<CountdownUnit, string> = {
  years: "Years",
  months: "Months",
  days: "Days",
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds",
};

export type LivestreamIngestSecrets = {
  streamKey: string;
};
