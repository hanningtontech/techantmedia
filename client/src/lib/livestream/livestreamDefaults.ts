import type { LivestreamSettings } from "./livestreamTypes";
import { defaultLivestreamHlsUrl, defaultLivestreamRtmpUrl } from "./livestreamUrls";

export const DEFAULT_LIVESTREAM_SETTINGS: LivestreamSettings = {
  targetDateTime: "",
  title: "Live event starting soon",
  subtitle: "Stay tuned — something special is on the way.",
  showUnits: {
    years: false,
    months: false,
    days: true,
    hours: true,
    minutes: true,
    seconds: true,
  },
  backgroundImages: [],
  slideshowIntervalSec: 5,
  backgroundTransparency: 0,
  backgroundBlurPx: 0,
  musicUrl: "",
  musicTitle: "",
  enabled: false,
  videoEnabled: false,
  hlsPlaybackUrl: defaultLivestreamHlsUrl(),
  dashPlaybackUrl: "",
  rtmpIngestUrl: defaultLivestreamRtmpUrl(),
  streamTitle: "Live broadcast",
  streamStatus: "offline",
};
