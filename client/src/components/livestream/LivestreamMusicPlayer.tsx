import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useOptionalLivestreamKeepAlive } from "@/contexts/LivestreamKeepAliveContext";

type Props = {
  url: string;
  title?: string;
};

export function LivestreamMusicPlayer({ url, title }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(true);
  const wasPlayingRef = useRef(false);
  const keepAlive = useOptionalLivestreamKeepAlive();

  useEffect(() => {
    wasPlayingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (!keepAlive) return;
    return keepAlive.onResume(() => {
      const audio = audioRef.current;
      if (!audio || !wasPlayingRef.current) return;
      void audio.play().catch(() => {
        setNeedsGesture(true);
      });
    });
  }, [keepAlive]);

  if (!url.trim()) return null;

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
        return;
      }
      await audio.play();
      setPlaying(true);
      setNeedsGesture(false);
      void keepAlive?.acquireWakeLock();
    } catch {
      setNeedsGesture(true);
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  };

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-3">
      <audio
        ref={audioRef}
        src={url}
        loop
        preload="none"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      {needsGesture && !playing ? (
        <button
          type="button"
          onClick={() => void togglePlay()}
          className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/50 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:border-orange-400/50 hover:bg-black/65"
        >
          <Play className="h-4 w-4 fill-current" />
          Play background music
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-3 py-2 backdrop-blur-md">
          <button
            type="button"
            onClick={() => void togglePlay()}
            className="rounded-full p-2 text-white transition hover:bg-white/10"
            aria-label={playing ? "Pause music" : "Play music"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-full p-2 text-white transition hover:bg-white/10"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <span className="flex items-center gap-1.5 pr-2 text-xs text-zinc-300">
            <Music className="h-3.5 w-3.5 text-orange-400" />
            {title?.trim() || "Background music"}
          </span>
        </div>
      )}
    </div>
  );
}
