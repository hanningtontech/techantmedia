import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Download, Images, Loader2, Lock, LogOut, Sparkles } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { Button } from "@/components/ui/button";
import { useFirebaseAuth, isClient } from "@/contexts/FirebaseAuthContext";
import { subscribeClientGallery } from "@/lib/clientGallery/clientGalleryFirestore";
import type { ClientGalleryMeta, ClientGalleryPhoto } from "@/lib/clientGallery/clientGalleryTypes";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function photoIsClear(meta: ClientGalleryMeta | null, photo: ClientGalleryPhoto): boolean {
  if (!meta) return false;
  if (meta.paymentConfirmed) return true;
  return photo.isSample;
}

type BlurMode = "none" | "soft" | "locked-banner";

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download image");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

function GalleryTile({
  photo,
  blurMode,
  canDownload,
}: {
  photo: ClientGalleryPhoto;
  blurMode: BlurMode;
  canDownload: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  const onDownload = async () => {
    try {
      const ext = photo.src.match(/\.(jpe?g|png|gif|webp)(\?|$)/i)?.[1] ?? "jpg";
      await downloadImage(photo.src, `${photo.alt || photo.id}.${ext}`);
      toast.success("Saved to your device.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    }
  };

  return (
    <figure className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <img
        src={photo.src}
        alt={photo.alt || "Your photo"}
        className={cn(
          "aspect-[4/5] w-full object-cover transition-all duration-500",
          blurMode === "soft" && "scale-[1.02] blur-[6px] brightness-[0.94] saturate-[0.9]",
          blurMode === "locked-banner" && "scale-105 blur-xl brightness-75 saturate-75",
          !loaded && "opacity-0",
        )}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
      {blurMode === "soft" ? (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/5"
          aria-hidden
        />
      ) : null}
      {blurMode === "locked-banner" ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 p-4 text-center backdrop-blur-[2px]">
          <Lock className="h-6 w-6 text-white/90" />
          <span className="text-xs font-medium text-white">Preview locked</span>
          <span className="max-w-[14rem] text-[11px] leading-snug text-zinc-200">
            Full resolution after payment is confirmed
          </span>
        </div>
      ) : null}
      {photo.isSample && blurMode === "none" && !canDownload ? (
        <span className="absolute left-2 top-2 rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
          Sample
        </span>
      ) : null}
      {canDownload ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute bottom-2 right-2 gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => void onDownload()}
        >
          <Download className="h-3.5 w-3.5" />
          Save
        </Button>
      ) : null}
    </figure>
  );
}

export default function MyGalleryPage() {
  const [, setLocation] = useLocation();
  const { firebaseReady, loading, user, profile, signOut } = useFirebaseAuth();
  const [meta, setMeta] = useState<ClientGalleryMeta | null>(null);
  const [photos, setPhotos] = useState<ClientGalleryPhoto[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/photography/account");
    }
  }, [loading, user, setLocation]);

  useEffect(() => {
    if (!user?.uid) return;
    setGalleryLoading(true);
    const unsub = subscribeClientGallery(
      user.uid,
      (m) => setMeta(m),
      (p) => {
        setPhotos(p);
        setGalleryLoading(false);
      },
    );
    return () => unsub?.();
  }, [user?.uid]);

  const visiblePhotos = useMemo(() => photos.filter((p) => p.visible), [photos]);

  const paymentConfirmed = meta?.paymentConfirmed === true;

  const lockMessagePhotoId = useMemo(() => {
    if (paymentConfirmed) return null;
    const firstLocked = visiblePhotos.find((p) => !photoIsClear(meta, p));
    return firstLocked?.id ?? null;
  }, [visiblePhotos, meta, paymentConfirmed]);

  if (!firebaseReady) {
    return (
      <TechMediaLayout>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center text-zinc-400">My Gallery is unavailable.</div>
      </TechMediaLayout>
    );
  }

  if (loading || !user) {
    return (
      <TechMediaLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      </TechMediaLayout>
    );
  }

  if (profile && !isClient(profile)) {
    return (
      <TechMediaLayout>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-zinc-300">This page is for photography client accounts.</p>
          <Link href="/photography/account" className="mt-4 inline-block text-orange-400 hover:underline">
            Create or sign in to a client account
          </Link>
        </div>
      </TechMediaLayout>
    );
  }

  const sampleCount = visiblePhotos.filter((p) => p.isSample).length;

  return (
    <TechMediaLayout>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-orange-400">
              <Images className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">My Gallery</span>
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {profile?.name || profile?.username || "Your photos"}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {paymentConfirmed
                ? "Payment confirmed — view and download all your photos."
                : sampleCount > 0
                  ? `${sampleCount} sample photo${sampleCount === 1 ? "" : "s"} in full quality. Other shots stay blurred until payment is confirmed.`
                  : "Your photos appear here once your photographer shares them. Most will be blurred until payment is confirmed."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-white/15 text-zinc-300"
            onClick={() => void signOut().then(() => setLocation("/photography"))}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>

        {paymentConfirmed ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <Sparkles className="h-4 w-4 shrink-0" />
            All photos unlocked. Tap Save on any image to download to your device.
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            <Lock className="h-4 w-4 shrink-0" />
            Photos are shared as previews until your photographer confirms payment.
          </div>
        )}

        {galleryLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          </div>
        ) : visiblePhotos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
            <Images className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
            <p className="text-zinc-300">No photos in your gallery yet.</p>
            <p className="mt-1 text-sm text-zinc-500">Your photographer will add them after your session.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {visiblePhotos.map((photo) => {
              const clear = photoIsClear(meta, photo);
              const blurMode: BlurMode = clear
                ? "none"
                : photo.id === lockMessagePhotoId
                  ? "locked-banner"
                  : "soft";
              return (
                <GalleryTile
                  key={photo.id}
                  photo={photo}
                  blurMode={blurMode}
                  canDownload={paymentConfirmed && clear}
                />
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-zinc-500">
          <Link href="/photography" className="text-orange-400 hover:underline">
            Back to Photography & Video
          </Link>
        </p>
      </div>
    </TechMediaLayout>
  );
}
