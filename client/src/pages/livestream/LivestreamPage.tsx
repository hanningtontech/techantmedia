import { useEffect, useState } from "react";
import { LivestreamPublicView } from "@/components/livestream/LivestreamPublicView";
import { LivestreamKeepAliveProvider, useLivestreamKeepAliveContext } from "@/contexts/LivestreamKeepAliveContext";
import { DEFAULT_LIVESTREAM_SETTINGS } from "@/lib/livestream/livestreamDefaults";
import { subscribeLivestreamSettings } from "@/lib/livestream/livestreamFirestore";
import type { LivestreamSettings } from "@/lib/livestream/livestreamTypes";
import "@/styles/tech-media.css";

function LivestreamPageContent() {
  const [settings, setSettings] = useState<LivestreamSettings>(DEFAULT_LIVESTREAM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const { acquireWakeLock } = useLivestreamKeepAliveContext();

  useEffect(() => {
    const unsub = subscribeLivestreamSettings(
      (next) => {
        setSettings(next);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  useEffect(() => {
    const onGesture = () => {
      void acquireWakeLock();
    };
    document.addEventListener("pointerdown", onGesture, { once: true });
    return () => document.removeEventListener("pointerdown", onGesture);
  }, [acquireWakeLock]);

  return <LivestreamPublicView settings={settings} loading={loading} />;
}

export default function LivestreamPage() {
  return (
    <LivestreamKeepAliveProvider>
      <LivestreamPageContent />
    </LivestreamKeepAliveProvider>
  );
}
