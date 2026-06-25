import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, ImagePlus, Star, Trash2 } from "lucide-react";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import { AdminField } from "@/components/admin/shared/AdminField";
import { PortfolioImageUpload } from "@/components/admin/portfolio/PortfolioImageUpload";
import { listClientUsersForAdmin } from "@/lib/firestore/usersAdmin";
import type { UserListRow } from "@/lib/userTypes";
import {
  addClientGalleryPhoto,
  deleteClientGalleryPhoto,
  setClientGalleryPaymentConfirmed,
  subscribeClientGallery,
  updateClientGalleryPhoto,
} from "@/lib/clientGallery/clientGalleryFirestore";
import { uploadClientGalleryImage } from "@/lib/clientGallery/clientGalleryImages";
import { MAX_CLIENT_GALLERY_SAMPLES } from "@/lib/clientGallery/clientGalleryTypes";
import type { ClientGalleryMeta, ClientGalleryPhoto } from "@/lib/clientGallery/clientGalleryTypes";
import type { GalleryUploadPayload } from "@/lib/portfolio/photoDimensions";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ClientGalleryAdminSection() {
  const [clients, setClients] = useState<UserListRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [meta, setMeta] = useState<ClientGalleryMeta | null>(null);
  const [photos, setPhotos] = useState<ClientGalleryPhoto[]>([]);

  useEffect(() => {
    void listClientUsersForAdmin()
      .then((rows) => {
        setClients(rows);
        if (rows.length && !selectedId) setSelectedId(rows[0].uid);
      })
      .catch((e) => toast.error(formatAuthOrFirestoreError(e)));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const unsub = subscribeClientGallery(selectedId, setMeta, setPhotos);
    return () => unsub?.();
  }, [selectedId]);

  const selectedClient = useMemo(() => clients.find((c) => c.uid === selectedId), [clients, selectedId]);

  const sampleCount = useMemo(() => photos.filter((p) => p.isSample).length, [photos]);

  const onAppendMany = useCallback(
    async (items: GalleryUploadPayload[]) => {
      if (!selectedId) return;
      const baseOrder = photos.length;
      try {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;
          await addClientGalleryPhoto(selectedId, {
            src: item.url,
            alt: `Photo ${baseOrder + i + 1}`,
            width: item.width,
            height: item.height,
            visible: true,
            isSample: false,
            order: baseOrder + i,
          });
        }
        toast.success(`${items.length} photo${items.length === 1 ? "" : "s"} added.`);
      } catch (e) {
        toast.error(formatAuthOrFirestoreError(e));
      }
    },
    [selectedId, photos.length],
  );

  const toggleVisible = async (photo: ClientGalleryPhoto) => {
    if (!selectedId) return;
    try {
      await updateClientGalleryPhoto(selectedId, photo.id, { visible: !photo.visible });
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    }
  };

  const toggleSample = async (photo: ClientGalleryPhoto) => {
    if (!selectedId) return;
    if (!photo.isSample && sampleCount >= MAX_CLIENT_GALLERY_SAMPLES) {
      toast.error(`You can only mark up to ${MAX_CLIENT_GALLERY_SAMPLES} sample photos.`);
      return;
    }
    try {
      await updateClientGalleryPhoto(selectedId, photo.id, { isSample: !photo.isSample });
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    }
  };

  const onConfirmPayment = async (confirmed: boolean) => {
    if (!selectedId) return;
    try {
      await setClientGalleryPaymentConfirmed(selectedId, confirmed);
      toast.success(confirmed ? "Payment confirmed — client can download all photos." : "Payment marked as pending.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    }
  };

  const onDelete = async (photoId: string) => {
    if (!selectedId) return;
    if (!window.confirm("Remove this photo from the client gallery?")) return;
    try {
      await deleteClientGalleryPhoto(selectedId, photoId);
      toast.success("Photo removed.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    }
  };

  const uploadForClient = useCallback(
    (file: File, onProgress?: (p: { loaded: number; total: number; percent: number }) => void) =>
      uploadClientGalleryImage(selectedId, file, onProgress),
    [selectedId],
  );

  return (
    <AdminSection
      title="Client galleries"
      description="Upload photos for a client, show blurred previews, mark up to two samples, then confirm payment to unlock downloads."
      accent="orange"
    >
      <AdminField label="Client" tone="orange">
        <select
          className="admin-input w-full max-w-md"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {clients.length === 0 ? (
            <option value="">No clients yet</option>
          ) : (
            clients.map((c) => (
              <option key={c.uid} value={c.uid}>
                {c.name || c.username || c.email} ({c.email})
              </option>
            ))
          )}
        </select>
      </AdminField>

      {selectedClient ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
          <span className="text-sm text-zinc-300">
            <strong className="text-white">{selectedClient.name}</strong>
            {selectedClient.username ? ` · @${selectedClient.username}` : null}
            {selectedClient.phoneNumber ? ` · ${selectedClient.phoneNumber}` : null}
          </span>
          <button
            type="button"
            className={cn(
              "ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              meta?.paymentConfirmed
                ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                : "bg-amber-500/15 text-amber-200 hover:bg-amber-500/25",
            )}
            onClick={() => void onConfirmPayment(!meta?.paymentConfirmed)}
          >
            <Check className="h-4 w-4" />
            {meta?.paymentConfirmed ? "Payment confirmed" : "Confirm payment"}
          </button>
        </div>
      ) : null}

      {selectedId ? (
        <>
          <div className="mt-6">
            <PortfolioImageUpload
              label="Upload client photos"
              value=""
              onChange={() => {}}
              mode="append"
              multiple
              confirmBeforeUpload
              onAppendMany={(items) => void onAppendMany(items)}
              uploadImage={uploadForClient}
              hint="Photos are visible to the client when “shown” is on. They appear blurred until payment is confirmed (except samples)."
            />
          </div>

          {photos.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">No photos for this client yet.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {photos.map((photo) => (
                <li
                  key={photo.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <img
                    src={photo.src}
                    alt=""
                    className={cn("h-20 w-20 rounded-lg object-cover", !photo.visible && "opacity-40")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{photo.alt || photo.id}</p>
                    <p className="text-xs text-zinc-500">
                      {photo.visible ? "Visible to client" : "Hidden"}
                      {photo.isSample ? " · Sample (unblurred)" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      title={photo.visible ? "Hide from client" : "Show to client"}
                      className="rounded-lg border border-white/10 p-2 text-zinc-300 hover:bg-white/5"
                      onClick={() => void toggleVisible(photo)}
                    >
                      {photo.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      title="Toggle sample preview"
                      className={cn(
                        "rounded-lg border p-2",
                        photo.isSample
                          ? "border-orange-500/50 bg-orange-500/15 text-orange-300"
                          : "border-white/10 text-zinc-300 hover:bg-white/5",
                      )}
                      onClick={() => void toggleSample(photo)}
                    >
                      <Star className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      className="rounded-lg border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10"
                      onClick={() => void onDelete(photo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <ImagePlus className="h-3.5 w-3.5" />
            {sampleCount}/{MAX_CLIENT_GALLERY_SAMPLES} sample slots used
          </p>
        </>
      ) : null}
    </AdminSection>
  );
}
