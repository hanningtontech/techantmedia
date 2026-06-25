import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Copy, MessageCircle, Share2 } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { JustifiedGalleryGrid } from "@/components/tech-media/photography/JustifiedGalleryGrid";
import { PhotoLightbox } from "@/components/tech-media/photography/PhotoLightbox";
import { useInspo } from "@/contexts/InspoContext";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { fetchInspoBoard, type InspoBoard } from "@/lib/portfolio/inspoBoards";
import {
  buildInspoWhatsAppMessage,
  buildWhatsAppUrl,
  normalizeWhatsAppNumber,
} from "@/lib/tech-media/whatsapp";
import type { SitePhotoItem } from "@/lib/portfolio/portfolioTypes";
import { scrollPageToTop } from "@/lib/scrollToTop";
import { toast } from "sonner";

function boardToSitePhotos(board: InspoBoard): SitePhotoItem[] {
  return board.photos.map((p, i) => ({
    id: p.id,
    src: p.src,
    alt: p.alt,
    categoryId: p.categoryId ?? "",
    tall: false,
    featured: false,
    order: i,
    orientation: "auto",
  }));
}

export default function InsposPage() {
  const [, shareParams] = useRoute("/inspos/:boardId");
  const boardId = shareParams?.boardId;
  const isSharedView = Boolean(boardId);

  const { content } = useSiteContent();
  const { brand, photographySettings } = content;
  const inspo = useInspo();
  const [sharedBoard, setSharedBoard] = useState<InspoBoard | null>(null);
  const [loading, setLoading] = useState(isSharedView);
  const [clientName, setClientName] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const whatsappNumber =
    normalizeWhatsAppNumber(photographySettings.whatsappNumber) ||
    normalizeWhatsAppNumber(brand.phone);

  useEffect(() => {
    scrollPageToTop("instant");
  }, [boardId]);

  useEffect(() => {
    if (!boardId) {
      setSharedBoard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchInspoBoard(boardId)
      .then((b) => setSharedBoard(b))
      .finally(() => setLoading(false));
  }, [boardId]);

  const items: SitePhotoItem[] = isSharedView
    ? sharedBoard
      ? boardToSitePhotos(sharedBoard)
      : []
    : inspo.photos.map((p, i) => ({
        id: p.id,
        src: p.src,
        alt: p.alt,
        categoryId: p.categoryId ?? "",
        tall: false,
        featured: false,
        order: i,
        orientation: "auto" as const,
      }));

  const handlePublishShare = async () => {
    if (!inspo.count) {
      toast.error("Add photos to Inspos first.");
      return;
    }
    setPublishing(true);
    try {
      const url = await inspo.publishShare({ clientName });
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create share link.");
    } finally {
      setPublishing(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!whatsappNumber) {
      toast.error("WhatsApp number is not configured.");
      return;
    }
    let url = shareUrl;
    if (!url) {
      setPublishing(true);
      try {
        url = await inspo.publishShare({ clientName });
        setShareUrl(url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create share link.");
        return;
      } finally {
        setPublishing(false);
      }
    }
    const message = buildInspoWhatsAppMessage({
      brandName: brand.name,
      shareUrl: url,
      photoCount: inspo.count,
      clientName,
    });
    const wa = buildWhatsAppUrl(whatsappNumber, message);
    if (wa) window.open(wa, "_blank", "noopener,noreferrer");
  };

  const title = isSharedView ? "Inspiration board" : "My Inspos";

  return (
    <TechMediaLayout fullBleedMain>
      <div className="border-b border-white/10 bg-[#08080c]/90">
        <div className="mx-auto max-w-[min(100%,90rem)] px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/photography"
            className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Photography
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          {isSharedView ? (
            <p className="mt-1 text-sm tm-muted">
              {sharedBoard?.clientName
                ? `Shared by ${sharedBoard.clientName} · ${items.length} photos`
                : `${items.length} photos`}
            </p>
          ) : (
            <p className="mt-1 text-sm tm-muted">
              Tap photos on a category page to add them here, then share a link or send via WhatsApp.
            </p>
          )}
        </div>
      </div>

      {!isSharedView ? (
        <div className="mx-auto max-w-[min(100%,90rem)] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm text-zinc-300">
              Your name (optional)
              <input
                className="admin-input mt-1 w-full"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="For the photographer"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!inspo.count || publishing}
                onClick={() => void handlePublishShare()}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500/25 px-4 py-2 text-sm font-semibold text-orange-200 ring-1 ring-orange-500/50 disabled:opacity-40"
              >
                <Share2 className="h-4 w-4" />
                {publishing ? "Creating…" : "Create share link"}
              </button>
              {whatsappNumber ? (
                <button
                  type="button"
                  disabled={!inspo.count || publishing}
                  onClick={() => void handleWhatsApp()}
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  <MessageCircle className="h-4 w-4" />
                  Send via WhatsApp
                </button>
              ) : null}
            </div>
          </div>
          {shareUrl ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <span className="truncate text-zinc-300">{shareUrl}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-orange-300 hover:underline"
                onClick={() => void navigator.clipboard.writeText(shareUrl).then(() => toast.success("Copied."))}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="tm-muted py-16 text-center">Loading…</p>
      ) : items.length ? (
        <JustifiedGalleryGrid
          items={items}
          onOpen={(id) => {
            const idx = items.findIndex((p) => p.id === id);
            if (idx >= 0) setLightboxIndex(idx);
          }}
          className="tm-gallery-justified"
          targetRowHeight={220}
          boxSpacing={2}
        />
      ) : (
        <p className="tm-muted py-16 text-center">
          {isSharedView ? "This inspo board was not found." : "No photos in Inspos yet."}
        </p>
      )}

      {lightboxIndex !== null ? (
        <PhotoLightbox
          images={items.map((p) => ({ src: p.src, alt: p.alt }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      ) : null}
    </TechMediaLayout>
  );
}
