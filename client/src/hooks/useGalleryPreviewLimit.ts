import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 639px)";
const TABLET_QUERY = "(min-width: 640px) and (max-width: 1023px)";
const ULTRA_WIDE_QUERY = "(min-width: 1500px)";

type ViewportBucket = "mobile" | "tablet" | "desktop" | "ultra";

function resolveBucket(mobile: boolean, tablet: boolean, ultraWide: boolean): ViewportBucket {
  if (mobile) return "mobile";
  if (tablet) return "tablet";
  if (ultraWide) return "ultra";
  return "desktop";
}

/** Preview count on main gallery — tuned for phone, iPad portrait/landscape, and desktop. */
export function useGalleryPreviewLimit() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false,
  );
  const [tablet, setTablet] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(TABLET_QUERY).matches : false,
  );
  const [ultraWide, setUltraWide] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(ULTRA_WIDE_QUERY).matches : false,
  );

  useEffect(() => {
    const mqMobile = window.matchMedia(MOBILE_QUERY);
    const mqTablet = window.matchMedia(TABLET_QUERY);
    const mqUltra = window.matchMedia(ULTRA_WIDE_QUERY);
    const onChange = () => {
      setMobile(mqMobile.matches);
      setTablet(mqTablet.matches);
      setUltraWide(mqUltra.matches);
    };
    onChange();
    mqMobile.addEventListener("change", onChange);
    mqTablet.addEventListener("change", onChange);
    mqUltra.addEventListener("change", onChange);
    return () => {
      mqMobile.removeEventListener("change", onChange);
      mqTablet.removeEventListener("change", onChange);
      mqUltra.removeEventListener("change", onChange);
    };
  }, []);

  const bucket = resolveBucket(mobile, tablet, ultraWide);

  const previewCount =
    bucket === "mobile" ? 5 : bucket === "tablet" ? 8 : bucket === "ultra" ? 12 : 10;

  const previewRowHeight =
    bucket === "mobile" ? 140 : bucket === "tablet" ? 220 : bucket === "ultra" ? 340 : 280;

  return {
    isMobile: mobile,
    isTablet: tablet,
    isUltraWide: ultraWide,
    previewCount,
    previewRowHeight,
  };
}
