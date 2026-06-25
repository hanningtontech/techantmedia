import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LivestreamStreamStatus } from "@/lib/livestream/livestreamTypes";

type PlayerStatus = LivestreamStreamStatus | "buffering";

type Props = {
  hlsUrl: string;
  dashUrl?: string;
  title: string;
  initialStatus?: LivestreamStreamStatus;
  autoPlay?: boolean;
  className?: string;
};

const SKIP_SECONDS = 10;

function statusLabel(status: PlayerStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "connecting":
      return "Connecting…";
    case "buffering":
      return "Buffering…";
    default:
      return "Offline";
  }
}

function statusClass(status: PlayerStatus): string {
  switch (status) {
    case "live":
      return "bg-red-500/90 text-white";
    case "connecting":
    case "buffering":
      return "bg-amber-500/90 text-black";
    default:
      return "bg-zinc-700/90 text-zinc-200";
  }
}

export function LivestreamHlsPlayer({
  hlsUrl,
  dashUrl = "",
  title,
  initialStatus = "offline",
  autoPlay = true,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideControlsTimer = useRef<number | null>(null);

  const [status, setStatus] = useState<PlayerStatus>(initialStatus);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const playbackUrl = hlsUrl.trim() || dashUrl.trim();

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    setControlsVisible(true);
    hideControlsTimer.current = window.setTimeout(() => {
      if (playing) setControlsVisible(false);
    }, 3200);
  }, [playing]);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
        setPlaying(true);
      } catch {
        setErrorMessage("Tap play to start — your browser blocked autoplay.");
      }
    } else {
      video.pause();
      setPlaying(false);
    }
    scheduleHideControls();
  }, [scheduleHideControls]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    scheduleHideControls();
  }, [scheduleHideControls]);

  const handleVolume = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video) return;
      const v = Math.max(0, Math.min(1, value));
      video.volume = v;
      setVolume(v);
      if (v > 0 && video.muted) {
        video.muted = false;
        setMuted(false);
      }
      scheduleHideControls();
    },
    [scheduleHideControls],
  );

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const max = Number.isFinite(video.duration) ? video.duration : video.currentTime + SKIP_SECONDS;
    video.currentTime = Math.min(max, video.currentTime + SKIP_SECONDS);
    scheduleHideControls();
  }, [scheduleHideControls]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      /* unsupported */
    }
    scheduleHideControls();
  }, [scheduleHideControls]);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      /* unsupported */
    }
    scheduleHideControls();
  }, [scheduleHideControls]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;

    setErrorMessage("");
    setStatus("connecting");
    setPlaying(false);

    const isHls = /\.m3u8(\?|$)/i.test(playbackUrl) || Boolean(hlsUrl.trim());
    const canNativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
    };

    const tryAutoplay = () => {
      if (!autoPlay) return;
      void video.play().then(() => setPlaying(true)).catch(() => {
        setErrorMessage("Tap play to start the stream.");
      });
    };

    if (isHls && canNativeHls && !Hls.isSupported()) {
      video.src = playbackUrl;
      const onMeta = () => {
        setStatus("live");
        tryAutoplay();
      };
      video.addEventListener("loadedmetadata", onMeta);
      return () => {
        video.removeEventListener("loadedmetadata", onMeta);
        cleanup();
      };
    }

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxLiveSyncPlaybackRate: 1.5,
      });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus("live");
        tryAutoplay();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        setStatus("offline");
        setErrorMessage("Stream unavailable — check OBS is broadcasting.");
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else {
          hls.destroy();
          hlsRef.current = null;
        }
      });
      return cleanup;
    }

    video.src = playbackUrl;
    const onMeta = () => {
      setStatus("live");
      tryAutoplay();
    };
    video.addEventListener("loadedmetadata", onMeta);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      cleanup();
    };
  }, [playbackUrl, hlsUrl, autoPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setStatus((s) => (s === "offline" ? s : "buffering"));
    const onPlaying = () => setStatus("live");
    const onTime = () => {
      setCurrentTime(video.currentTime);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };
    const onVolume = () => {
      setMuted(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("volumechange", onVolume);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("volumechange", onVolume);
    };
  }, []);

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  if (!playbackUrl) {
    return (
      <div className={cn("livestream-player-shell livestream-player-empty", className)}>
        <p className="text-zinc-400">Stream URL not configured yet.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("livestream-player-shell group", className)}
      onMouseMove={scheduleHideControls}
      onTouchStart={scheduleHideControls}
      onClick={scheduleHideControls}
    >
      <video
        ref={videoRef}
        className="livestream-player-video"
        playsInline
        preload="auto"
        aria-label={title}
      />

      <div
        className={cn(
          "livestream-player-top-bar pointer-events-none transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <span className={cn("livestream-status-pill", statusClass(status))}>
          {status === "live" ? <Radio className="h-3 w-3 animate-pulse" aria-hidden /> : null}
          {status === "connecting" || status === "buffering" ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : null}
          {statusLabel(status)}
        </span>
        {title ? <p className="livestream-player-title">{title}</p> : null}
      </div>

      {errorMessage ? (
        <p className="livestream-player-error" role="status">
          {errorMessage}
        </p>
      ) : null}

      <div
        className={cn(
          "livestream-player-controls transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button type="button" className="livestream-control-btn" onClick={() => void togglePlay()} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          <button type="button" className="livestream-control-btn" onClick={skipForward} aria-label={`Skip forward ${SKIP_SECONDS} seconds`}>
            <SkipForward className="h-5 w-5" />
          </button>

          <button type="button" className="livestream-control-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
            {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>

          <span className="livestream-volume-slider-wrap">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => handleVolume(Number(e.target.value))}
              className="livestream-volume-slider w-20 sm:w-28"
              aria-label="Volume"
            />
          </span>

          <span className="ml-auto hidden text-xs tabular-nums text-zinc-300 sm:inline">
            {formatTime(currentTime)}
            {duration > 0 && Number.isFinite(duration) ? ` / ${formatTime(duration)}` : " · LIVE"}
          </span>

          <button
            type="button"
            className="livestream-control-btn"
            onClick={() => void togglePiP()}
            aria-label="Picture in picture"
            title="Small screen (Picture in Picture)"
          >
            <PictureInPicture2 className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="livestream-control-btn"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
