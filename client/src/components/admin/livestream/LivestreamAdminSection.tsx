import { useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Radio, RefreshCw, Save, Trash2, Video, VideoOff } from "lucide-react";
import { AdminField } from "@/components/admin/shared/AdminField";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import { PortfolioImageUpload } from "@/components/admin/portfolio/PortfolioImageUpload";
import { SITE_URL } from "@/lib/seo/constants";
import { defaultLivestreamHlsUrl, defaultLivestreamRtmpUrl } from "@/lib/livestream/livestreamUrls";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { DEFAULT_LIVESTREAM_SETTINGS } from "@/lib/livestream/livestreamDefaults";
import {
  newLivestreamImageId,
  saveLivestreamSettings,
  subscribeLivestreamSettings,
} from "@/lib/livestream/livestreamFirestore";
import { uploadLivestreamAudio } from "@/lib/livestream/livestreamUpload";
import {
  fetchLivestreamIngest,
  probeLivestreamStatus,
  regenerateLivestreamKey,
  type LivestreamIngestInfo,
} from "@/lib/livestream/livestreamIngestApi";
import {
  COUNTDOWN_UNIT_LABELS,
  COUNTDOWN_UNIT_ORDER,
  type LivestreamSettings,
} from "@/lib/livestream/livestreamTypes";
import { toast } from "sonner";

function copyText(label: string, value: string) {
  if (!value) return;
  void navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied.`));
}

export function LivestreamAdminSection() {
  const [published, setPublished] = useState<LivestreamSettings>(DEFAULT_LIVESTREAM_SETTINGS);
  const [draft, setDraft] = useState<LivestreamSettings>(DEFAULT_LIVESTREAM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [ingest, setIngest] = useState<LivestreamIngestInfo | null>(null);
  const [ingestLoading, setIngestLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState(false);

  const loadIngest = async () => {
    setIngestLoading(true);
    try {
      const info = await fetchLivestreamIngest();
      setIngest(info);
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setIngestLoading(false);
    }
  };

  useEffect(() => {
    void loadIngest();
  }, []);

  useEffect(() => {
    const unsub = subscribeLivestreamSettings(
      (settings) => {
        setPublished(settings);
        setDraft(settings);
        setLoading(false);
      },
      (err) => {
        toast.error(formatAuthOrFirestoreError(err));
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(published);

  const handleSave = async () => {
    if (!draft.targetDateTime.trim() && draft.enabled) {
      toast.error("Set a target date and time before enabling the countdown.");
      return;
    }
    setSaving(true);
    try {
      await saveLivestreamSettings(draft);
      setPublished(draft);
      toast.success("Livestream settings saved successfully.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAudioFile = async (file: File | null) => {
    if (!file) return;
    setUploadingAudio(true);
    try {
      const url = await uploadLivestreamAudio(file);
      setDraft((d) => ({ ...d, musicUrl: url, musicTitle: d.musicTitle || file.name.replace(/\.[^.]+$/, "") }));
      toast.success("Music uploaded.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setUploadingAudio(false);
    }
  };

  const livestreamUrl = `${SITE_URL.replace(/\/$/, "")}/livestream`;

  return (
    <AdminPage
      title="Livestream countdown"
      description="Countdown and live HLS player at /livestream and /live — listed under Off pages in the nav."
      width="standard"
      showLayoutGuide={false}
      actions={
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!dirty || saving || loading}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </button>
      }
    >
      <AdminSection
        title="Visibility & go live"
        description="Enable the countdown, or switch to the video player immediately. When the timer hits zero, the stream starts automatically if a playback URL is set."
        accent="slate"
      >
        <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-200">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-white/20"
            checked={draft.enabled}
            disabled={draft.videoEnabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
          />
          Enable countdown on public page
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!draft.hlsPlaybackUrl.trim() && !draft.dashPlaybackUrl.trim()}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                videoEnabled: true,
                enabled: false,
                streamStatus: "connecting",
              }))
            }
            className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Video className="h-4 w-4" />
            Enable video (hide countdown)
          </button>
          <button
            type="button"
            disabled={!draft.videoEnabled}
            onClick={() => setDraft((d) => ({ ...d, videoEnabled: false, enabled: true }))}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <VideoOff className="h-4 w-4" />
            Disable video (restore countdown)
          </button>
        </div>

        <p className="mt-3 text-sm text-zinc-400">
          Stream status:{" "}
          <span
            className={
              draft.streamStatus === "live"
                ? "font-semibold text-red-400"
                : draft.streamStatus === "connecting"
                  ? "font-semibold text-amber-400"
                  : "font-semibold text-zinc-500"
            }
          >
            {draft.streamStatus}
          </span>
          {" · "}
          Public URLs:{" "}
          <a href={livestreamUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">
            /livestream
          </a>
          ,{" "}
          <a href={`${SITE_URL.replace(/\/$/, "")}/live`} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">
            /live
          </a>
          <ExternalLink className="ml-1 inline h-3.5 w-3.5 text-teal-400" />
        </p>
      </AdminSection>

      <AdminSection
        title="Live stream (HLS)"
        description={`Auto-filled for ${SITE_URL.replace(/^https?:\/\//, "")} — point your media server at these paths (or edit if your HLS path differs).`}
        accent="orange"
      >
        <p className="mb-4 rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-sm text-zinc-400">
          Defaults: HLS <code className="text-orange-200">{defaultLivestreamHlsUrl()}</code> · RTMP{" "}
          <code className="text-orange-200">{defaultLivestreamRtmpUrl()}</code>
        </p>
        <AdminField label="HLS playback URL (.m3u8)" fieldSize="full">
          <input
            className="admin-input"
            value={draft.hlsPlaybackUrl}
            placeholder={defaultLivestreamHlsUrl()}
            onChange={(e) => setDraft((d) => ({ ...d, hlsPlaybackUrl: e.target.value }))}
          />
        </AdminField>
        <AdminField label="DASH playback URL (.mpd) — optional fallback" fieldSize="full">
          <input
            className="admin-input"
            value={draft.dashPlaybackUrl}
            placeholder={`${SITE_URL.replace(/\/$/, "")}/live/index.mpd`}
            onChange={(e) => setDraft((d) => ({ ...d, dashPlaybackUrl: e.target.value }))}
          />
        </AdminField>
        <AdminField label="RTMP ingest URL (OBS server)" fieldSize="full">
          <input
            className="admin-input"
            value={draft.rtmpIngestUrl}
            placeholder={defaultLivestreamRtmpUrl()}
            onChange={(e) => setDraft((d) => ({ ...d, rtmpIngestUrl: e.target.value }))}
          />
        </AdminField>
        <AdminField label="Player overlay title" fieldSize="medium">
          <input
            className="admin-input"
            value={draft.streamTitle}
            onChange={(e) => setDraft((d) => ({ ...d, streamTitle: e.target.value }))}
          />
        </AdminField>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={probing}
            onClick={async () => {
              setProbing(true);
              try {
                const result = await probeLivestreamStatus();
                setDraft((d) => ({
                  ...d,
                  streamStatus: result.streamStatus as LivestreamSettings["streamStatus"],
                }));
                toast.success(result.ok ? "Stream is live." : "Stream offline — no HLS manifest found.");
              } catch (e) {
                toast.error(formatAuthOrFirestoreError(e));
              } finally {
                setProbing(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200"
          >
            {probing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
            Check stream status
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm font-semibold text-zinc-200">OBS Studio settings</p>
          <p className="mt-1 text-xs text-zinc-500">Settings → Stream → Service: Custom</p>
          {ingestLoading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading ingest credentials…
            </p>
          ) : ingest ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-zinc-400">Server</span>
                <button
                  type="button"
                  className="inline-flex max-w-full items-center gap-2 break-all text-left text-teal-300 hover:underline"
                  onClick={() => copyText("OBS server", ingest.obsServer)}
                >
                  {ingest.obsServer || "Set RTMP URL above and save"}
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-zinc-400">Stream key</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 font-mono text-xs text-teal-300 hover:underline"
                  onClick={() => copyText("Stream key", ingest.obsStreamKey)}
                >
                  {ingest.obsStreamKey}
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
              <button
                type="button"
                disabled={regeneratingKey}
                onClick={async () => {
                  setRegeneratingKey(true);
                  try {
                    const next = await regenerateLivestreamKey();
                    setIngest(next);
                    toast.success("New stream key generated — update OBS.");
                  } catch (e) {
                    toast.error(formatAuthOrFirestoreError(e));
                  } finally {
                    setRegeneratingKey(false);
                  }
                }}
                className="inline-flex items-center gap-2 text-sm text-orange-300 hover:underline disabled:opacity-50"
              >
                {regeneratingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Regenerate stream key
              </button>
            </div>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection title="Copy" description="Headline and subtext on the livestream page." accent="teal">
        <AdminField label="Title" fieldSize="long">
          <input
            className="admin-input"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </AdminField>
        <AdminField label="Subtitle" fieldSize="full">
          <textarea
            className="admin-input min-h-[80px] resize-y"
            value={draft.subtitle}
            onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
          />
        </AdminField>
      </AdminSection>

      <AdminSection title="Countdown timer" description="Target moment and which units appear on the page." accent="orange">
        <AdminField label="Target date & time" fieldSize="medium">
          <input
            type="datetime-local"
            className="admin-input max-w-full"
            value={draft.targetDateTime}
            onChange={(e) => setDraft((d) => ({ ...d, targetDateTime: e.target.value }))}
          />
        </AdminField>
        <AdminField label="Display units" fieldSize="full">
          <div className="admin-unit-grid">
            {COUNTDOWN_UNIT_ORDER.map((unit) => (
              <label
                key={unit}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0"
                  checked={draft.showUnits[unit]}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      showUnits: { ...d.showUnits, [unit]: e.target.checked },
                    }))
                  }
                />
                {COUNTDOWN_UNIT_LABELS[unit]}
              </label>
            ))}
          </div>
        </AdminField>
      </AdminSection>

      <AdminSection
        title="Background slideshow"
        description="Full-screen images that cross-fade behind the timer."
        accent="violet"
      >
        <AdminField label="Transition interval (seconds)" fieldSize="short">
          <input
            type="number"
            min={2}
            max={120}
            className="admin-input"
            value={draft.slideshowIntervalSec}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                slideshowIntervalSec: Math.max(2, Math.min(120, Number(e.target.value) || 5)),
              }))
            }
          />
        </AdminField>

        <div className="admin-grid-2">
          <AdminField label={`Transparency — ${draft.backgroundTransparency}%`} fieldSize="full">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              className="w-full accent-violet-400"
              value={draft.backgroundTransparency}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  backgroundTransparency: Math.max(0, Math.min(100, Number(e.target.value))),
                }))
              }
            />
            <p className="mt-1 text-xs text-zinc-500">0% solid · 100% faded</p>
          </AdminField>

          <AdminField label={`Blur — ${draft.backgroundBlurPx}px`} fieldSize="full">
            <input
              type="range"
              min={0}
              max={32}
              step={1}
              className="w-full accent-violet-400"
              value={draft.backgroundBlurPx}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  backgroundBlurPx: Math.max(0, Math.min(32, Number(e.target.value))),
                }))
              }
            />
            <p className="mt-1 text-xs text-zinc-500">Softens photos for readability</p>
          </AdminField>
        </div>

        <div className="space-y-4">
          {draft.backgroundImages.map((img) => (
            <div key={img.id} className="rounded-xl border border-white/10 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-300">Slide {img.order + 1}</span>
                <button
                  type="button"
                  className="rounded-lg border border-red-500/30 px-2 py-1 text-red-400 hover:bg-red-500/10"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      backgroundImages: d.backgroundImages
                        .filter((s) => s.id !== img.id)
                        .map((s, i) => ({ ...s, order: i })),
                    }))
                  }
                  aria-label="Remove slide"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <PortfolioImageUpload
                label="Image"
                value={img.url}
                onChange={(url) =>
                  setDraft((d) => ({
                    ...d,
                    backgroundImages: d.backgroundImages.map((s) => (s.id === img.id ? { ...s, url } : s)),
                  }))
                }
                previewSize="large"
                accent="purple"
              />
              <AdminField label="Alt text" fieldSize="medium">
                <input
                  className="admin-input"
                  value={img.alt ?? ""}
                  placeholder="Optional description"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      backgroundImages: d.backgroundImages.map((s) =>
                        s.id === img.id ? { ...s, alt: e.target.value } : s,
                      ),
                    }))
                  }
                />
              </AdminField>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/40"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              backgroundImages: [
                ...d.backgroundImages,
                { id: newLivestreamImageId(), url: "", alt: "", order: d.backgroundImages.length },
              ],
            }))
          }
        >
          Add background image
        </button>
      </AdminSection>

      <AdminSection title="Background music" description="Upload a track or paste a direct audio URL." accent="teal">
        <AdminField label="Track title (optional)" fieldSize="medium">
          <input
            className="admin-input"
            value={draft.musicTitle}
            onChange={(e) => setDraft((d) => ({ ...d, musicTitle: e.target.value }))}
          />
        </AdminField>
        <AdminField label="Audio URL" fieldSize="full">
          <input
            className="admin-input"
            value={draft.musicUrl}
            placeholder="https://… or upload below"
            onChange={(e) => setDraft((d) => ({ ...d, musicUrl: e.target.value }))}
          />
        </AdminField>
        <AdminField label="Upload audio file" fieldSize="full">
          <input
            type="file"
            accept=".mp3,.m4a,.wav,.ogg,.aac,audio/*"
            disabled={uploadingAudio}
            className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500/20 file:px-3 file:py-2 file:text-sm file:font-medium file:text-orange-200"
            onChange={(e) => void handleAudioFile(e.target.files?.[0] ?? null)}
          />
          {uploadingAudio ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </p>
          ) : null}
        </AdminField>
      </AdminSection>
    </AdminPage>
  );
}
