import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react";
import {
  PortfolioUploadProgress,
  type BatchUploadProgress,
} from "@/components/admin/portfolio/PortfolioUploadProgress";
import { probeImageFile, probeImageUrl, type GalleryUploadPayload } from "@/lib/portfolio/photoDimensions";
import { uploadPortfolioImage, type PortfolioImageUploadProgress } from "@/lib/portfolio/portfolioImages";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { AdminField } from "@/components/admin/shared/AdminField";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PendingFile = {
  id: string;
  file: File;
  previewUrl: string;
};

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  mode?: "replace" | "append";
  onAppend?: (url: string) => void;
  /** Batch append with dimensions (gallery bulk upload). */
  onAppendMany?: (items: GalleryUploadPayload[]) => void;
  /** Allow selecting multiple files before confirm upload. */
  multiple?: boolean;
  /** When false, uploads immediately on confirm (default true: preview first). */
  confirmBeforeUpload?: boolean;
  /** Visual accent for drop zone and preview (LQ hero uploads use purple). */
  accent?: "orange" | "purple";
  /** Larger preview thumbnail (hero slide uploads). */
  previewSize?: "default" | "large";
  /** Override default portfolio B2 upload (e.g. client gallery). */
  uploadImage?: (file: File, onProgress?: (p: PortfolioImageUploadProgress) => void) => Promise<string>;
};

function readFiles(fileList: FileList | null): File[] {
  if (!fileList) return [];
  return Array.from(fileList).filter((f) => f.type.startsWith("image/"));
}

export function PortfolioImageUpload({
  label,
  value,
  onChange,
  hint,
  mode = "replace",
  onAppend,
  onAppendMany,
  multiple = false,
  confirmBeforeUpload = true,
  accent = "orange",
  previewSize = "default",
  uploadImage = uploadPortfolioImage,
}: Props) {
  const isPurple = accent === "purple";
  const previewClass =
    previewSize === "large" ? "h-28 w-full max-w-xs rounded-lg sm:h-32" : "h-20 w-20 rounded-lg";
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<BatchUploadProgress | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const progressAccent = isPurple ? "purple" : "orange";

  const revokeAll = useCallback((items: PendingFile[]) => {
    items.forEach((p) => URL.revokeObjectURL(p.previewUrl));
  }, []);

  useEffect(() => {
    return () => revokeAll(pending);
  }, [pending, revokeAll]);

  const addPendingFiles = (files: File[]) => {
    if (!files.length) {
      toast.error("Please choose image files (PNG, JPG, GIF, or WEBP).");
      return;
    }
    const next = files.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    if (multiple) {
      setPending((prev) => [...prev, ...next]);
    } else {
      setPending((prev) => {
        revokeAll(prev);
        return next.slice(0, 1);
      });
    }
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearPending = () => {
    setPending((prev) => {
      revokeAll(prev);
      return [];
    });
  };

  const uploadFilesWithProgress = async (files: File[]) => {
    if (!files.length) return [];
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const startedAt = Date.now();
    let completedBytes = 0;
    const completedNames: string[] = [];
    const urls: string[] = [];

    setUploading(true);
    setUploadProgress({
      fileIndex: 0,
      fileCount: files.length,
      currentFileName: files[0]?.name ?? "",
      bytesLoaded: 0,
      bytesTotal: totalBytes,
      percent: 0,
      completedNames: [],
      startedAt,
    });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setUploadProgress({
          fileIndex: i,
          fileCount: files.length,
          currentFileName: file.name,
          bytesLoaded: completedBytes,
          bytesTotal: totalBytes,
          percent: totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 0,
          completedNames: [...completedNames],
          startedAt,
        });

        const url = await uploadImage(file, (p) => {
          const bytesLoaded = completedBytes + p.loaded;
          const percent =
            totalBytes > 0 ? Math.min(100, Math.round((bytesLoaded / totalBytes) * 100)) : p.percent;
          setUploadProgress({
            fileIndex: i,
            fileCount: files.length,
            currentFileName: file.name,
            bytesLoaded,
            bytesTotal: totalBytes,
            percent,
            completedNames: [...completedNames],
            startedAt,
          });
        });

        urls.push(url);
        completedBytes += file.size;
        completedNames.push(file.name);
        setUploadProgress({
          fileIndex: i,
          fileCount: files.length,
          currentFileName: file.name,
          bytesLoaded: completedBytes,
          bytesTotal: totalBytes,
          percent: totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 100,
          completedNames: [...completedNames],
          startedAt,
        });
      }

      setUploadProgress((prev) => (prev ? { ...prev, percent: 100, bytesLoaded: totalBytes } : null));
      window.setTimeout(() => setUploadProgress(null), 1400);
      return urls;
    } catch (e) {
      setUploadProgress(null);
      throw e;
    } finally {
      setUploading(false);
    }
  };

  const applyUploadedUrls = async (urls: string[], files: File[]) => {
    if (!urls.length) return;
    if (mode === "append" && onAppendMany) {
      const payloads: GalleryUploadPayload[] = await Promise.all(
        urls.map(async (url, i) => {
          const file = files[i];
          const dims = file ? await probeImageFile(file) : await probeImageUrl(url);
          return {
            url,
            width: dims.width,
            height: dims.height,
            aspectRatio: dims.aspectRatio,
            orientation: "auto",
          };
        }),
      );
      onAppendMany(payloads);
    } else if (mode === "append" && onAppend) {
      urls.forEach((url) => onAppend(url));
    } else if (urls[0]) {
      onChange(urls[0]);
      if (urls.length > 1) {
        urls.slice(1).forEach((url) => onAppend?.(url));
      }
    }
  };

  const uploadPending = async () => {
    if (!pending.length) return;
    try {
      const files = pending.map((p) => p.file);
      const urls = await uploadFilesWithProgress(files);
      await applyUploadedUrls(urls, files);
      toast.success(urls.length > 1 ? `${urls.length} images uploaded.` : "Image uploaded.");
      clearPending();
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const uploadSingleFile = async (file: File) => {
    try {
      const urls = await uploadFilesWithProgress([file]);
      await applyUploadedUrls(urls, [file]);
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(formatAuthOrFirestoreError(err));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = readFiles(e.dataTransfer.files);
    if (confirmBeforeUpload) addPendingFiles(files);
    else if (files[0]) void uploadSingleFile(files[0]);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = readFiles(e.target.files);
    if (confirmBeforeUpload) addPendingFiles(files);
    else if (files[0]) void uploadSingleFile(files[0]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <AdminField label={label} hint={hint} tone={isPurple ? "violet" : "orange"}>
      {value && mode === "replace" ? (
        <div className="mb-3 flex flex-wrap items-start gap-3">
          <img
            src={value}
            alt=""
            className={cn(
              "border object-cover shadow-lg",
              previewClass,
              isPurple ? "border-violet-500/50 ring-2 ring-violet-500/25" : "border-white/15",
            )}
          />
          <button
            type="button"
            className="text-sm text-red-400 hover:underline"
            onClick={() => onChange("")}
          >
            Remove current image
          </button>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="mb-4 space-y-3 rounded-xl border border-teal-500/30 bg-teal-500/5 p-4">
          <p className="text-sm font-medium text-teal-200">Preview — confirm to upload</p>
          <div className={cn("grid gap-3", multiple ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1 max-w-xs")}>
            {pending.map((item, idx) => {
              const uploaded = Boolean(uploadProgress && idx < uploadProgress.completedNames.length);
              const active = Boolean(uploading && uploadProgress?.fileIndex === idx);
              return (
              <div
                key={item.id}
                className={cn(
                  "relative overflow-hidden rounded-lg border border-white/15",
                  uploaded && "ring-2 ring-emerald-500/60",
                  active && "ring-2 ring-teal-400",
                )}
              >
                <img src={item.previewUrl} alt="" className="aspect-square w-full object-cover" />
                {uploaded ? (
                  <span className="absolute bottom-8 left-2 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Uploaded
                  </span>
                ) : active ? (
                  <span className="absolute bottom-8 left-2 rounded bg-teal-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Uploading…
                  </span>
                ) : null}
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-red-600"
                  onClick={() => removePending(item.id)}
                  aria-label="Remove preview"
                >
                  <X size={14} />
                </button>
                <p className="truncate px-2 py-1 text-xs text-zinc-400">{item.file.name}</p>
              </div>
            );
            })}
          </div>
          {uploadProgress ? (
            <PortfolioUploadProgress progress={uploadProgress} accent="teal" />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => void uploadPending()}
              className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {uploading ? "Uploading…" : `Confirm upload${pending.length > 1 ? ` (${pending.length})` : ""}`}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={clearPending}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all",
          dragOver
            ? isPurple
              ? "scale-[1.01] border-violet-400 bg-violet-500/20"
              : "border-teal-400 bg-teal-500/15 scale-[1.01]"
            : isPurple
              ? "border-violet-500/45 bg-violet-500/10 hover:border-violet-400 hover:bg-violet-500/15"
              : "border-orange-500/35 bg-orange-500/5 hover:border-orange-400 hover:bg-orange-500/10",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple={multiple}
          className="hidden"
          onChange={onPick}
        />
        {uploading ? (
          <Loader2 className={cn("h-9 w-9 animate-spin", isPurple ? "text-violet-400" : "text-orange-400")} />
        ) : dragOver ? (
          <Upload className={cn("h-9 w-9", isPurple ? "text-violet-300" : "text-teal-400")} />
        ) : (
          <ImagePlus className={cn("h-9 w-9", isPurple ? "text-violet-400" : "text-orange-400")} />
        )}
        <p className="text-base font-medium text-zinc-100">
          {uploading ? "Uploading to storage…" : "Drag & drop images here"}
        </p>
        <p className="text-sm text-zinc-500">
          or click to browse · {multiple ? "multiple files OK" : "one file"} · preview before upload
        </p>
      </div>

      {uploadProgress && !pending.length ? (
        <PortfolioUploadProgress progress={uploadProgress} accent={progressAccent} className="mt-3" />
      ) : null}

      {mode === "replace" ? (
        <input
          className={cn("admin-input mt-3", isPurple && "ring-1 ring-violet-500/30 focus:ring-violet-500/50")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or paste image URL"
        />
      ) : null}
    </AdminField>
  );
}
