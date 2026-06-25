import type { XaiCaseStudy, XaiCaseStudyVideo } from "./xaiPortfolioTypes";

function legacyVideoEntry(study: XaiCaseStudy): XaiCaseStudyVideo | null {
  if (!study.videoUrl.trim()) return null;
  return {
    id: "legacy",
    order: 0,
    videoUrl: study.videoUrl.trim(),
    videoKind: study.videoKind,
    label: "",
    thumbnailUrl: "",
  };
}

/** All videos for admin editing (includes empty slots; migrates legacy `videoUrl`). */
export function getAdminCaseStudyVideos(study: XaiCaseStudy): XaiCaseStudyVideo[] {
  const fromList = [...(study.videos ?? [])].sort((a, b) => a.order - b.order);
  if (fromList.length) return fromList;
  const legacy = legacyVideoEntry(study);
  return legacy ? [legacy] : [];
}

/** Videos with a URL for the public portfolio (hides empty admin slots). */
export function getCaseStudyVideos(study: XaiCaseStudy): XaiCaseStudyVideo[] {
  return getAdminCaseStudyVideos(study).filter((v) => v.videoUrl.trim());
}

/** Keep legacy fields in sync with the first video that has a URL. */
export function syncLegacyVideoFields(study: XaiCaseStudy): XaiCaseStudy {
  const videos = [...(study.videos ?? [])].sort((a, b) => a.order - b.order);
  const firstWithUrl = videos.find((v) => v.videoUrl.trim());
  return {
    ...study,
    videos,
    videoUrl: firstWithUrl?.videoUrl ?? "",
    videoKind: firstWithUrl?.videoKind ?? "none",
  };
}

export function newCaseStudyVideo(order: number, partial?: Partial<XaiCaseStudyVideo>): XaiCaseStudyVideo {
  const id =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `vid_${Date.now()}`;
  return {
    id,
    order,
    videoKind: "none",
    videoUrl: "",
    thumbnailUrl: "",
    label: "",
    ...partial,
  };
}
