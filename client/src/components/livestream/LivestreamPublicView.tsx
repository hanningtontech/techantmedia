import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CountdownDisplay } from "@/components/livestream/CountdownDisplay";
import { LivestreamBackground } from "@/components/livestream/LivestreamBackground";
import { LivestreamHlsPlayer } from "@/components/livestream/LivestreamHlsPlayer";
import { LivestreamKeepAwakeHint } from "@/components/livestream/LivestreamKeepAwakeHint";
import { LivestreamMusicPlayer } from "@/components/livestream/LivestreamMusicPlayer";
import { resolveLivestreamDisplayMode } from "@/lib/livestream/livestreamMode";
import type { LivestreamSettings } from "@/lib/livestream/livestreamTypes";
import "@/styles/livestream.css";

type Props = {
  settings: LivestreamSettings;
  loading?: boolean;
};

export function LivestreamPublicView({ settings, loading = false }: Props) {
  const [now, setNow] = useState(() => new Date());
  const mode = resolveLivestreamDisplayMode(settings, now);
  const showVideo = mode === "video";
  const showCountdown = mode === "countdown";

  useEffect(() => {
    if (settings.videoEnabled) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [settings.videoEnabled]);

  return (
    <div className="livestream-root">
      <section className="livestream-stage">
        {!showVideo ? (
          <LivestreamBackground
            images={settings.backgroundImages}
            intervalSec={settings.slideshowIntervalSec}
            transparency={settings.backgroundTransparency}
            blurPx={settings.backgroundBlurPx}
          />
        ) : (
          <div className="livestream-video-backdrop" aria-hidden />
        )}

        <div className="livestream-content-shell">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="livestream-content"
          >
            <p className="tm-eyebrow text-teal-400">
              {showVideo ? "Now streaming" : "Live event"}
            </p>
            <h1 className="livestream-title">{settings.title}</h1>
            {settings.subtitle && !showVideo ? <p className="livestream-subtitle">{settings.subtitle}</p> : null}

            <div className="mt-8 sm:mt-10 md:mt-12">
              {loading ? (
                <p className="text-zinc-400">Loading…</p>
              ) : (
                <AnimatePresence mode="wait">
                  {showVideo ? (
                    <motion.div
                      key="video"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45 }}
                      className="w-full"
                    >
                      <LivestreamHlsPlayer
                        hlsUrl={settings.hlsPlaybackUrl}
                        dashUrl={settings.dashPlaybackUrl}
                        title={settings.streamTitle || settings.title}
                        initialStatus={settings.streamStatus}
                        autoPlay
                      />
                    </motion.div>
                  ) : showCountdown ? (
                    <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <CountdownDisplay settings={settings} />
                    </motion.div>
                  ) : (
                    <motion.p
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-lg text-zinc-300"
                    >
                      Check back soon.
                    </motion.p>
                  )}
                </AnimatePresence>
              )}
            </div>

            {!showVideo && settings.musicUrl ? (
              <div className="mt-8 flex justify-center sm:mt-10">
                <LivestreamMusicPlayer url={settings.musicUrl} title={settings.musicTitle} />
              </div>
            ) : null}
          </motion.div>
        </div>

        <LivestreamKeepAwakeHint />
      </section>
    </div>
  );
}
