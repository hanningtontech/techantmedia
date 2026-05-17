import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { uploadPortfolioImage } from "@/lib/portfolio/portfolioImages";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  /** When set, appends URL instead of replacing (e.g. project gallery). */
  mode?: "replace" | "append";
  onAppend?: (url: string) => void;
};

export function PortfolioImageUpload({ label, value, onChange, hint, mode = "replace", onAppend }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const url = await uploadPortfolioImage(file);
        if (mode === "append" && onAppend) onAppend(url);
        else onChange(url);
        toast.success("Image uploaded.");
      } catch (e) {
        toast.error(formatAuthOrFirestoreError(e));
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [mode, onAppend, onChange],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) void uploadFile(file);
    else toast.error("Please drop an image file (PNG, JPG, GIF, or WEBP).");
  };

  return (
    <div className="min-w-0 space-y-3">
      {label ? <label className="block text-sm font-medium text-zinc-300">{label}</label> : null}

      {value && mode === "replace" ? (
        <img
          src={value}
          alt=""
          className="h-32 w-32 max-w-full rounded-xl border border-white/10 object-cover"
        />
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
          "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all",
          dragOver
            ? "border-teal-400 bg-teal-500/15 scale-[1.01]"
            : "border-orange-500/35 bg-orange-500/5 hover:border-orange-400 hover:bg-orange-500/10",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        ) : dragOver ? (
          <Upload className="h-8 w-8 text-teal-400" />
        ) : (
          <ImagePlus className="h-8 w-8 text-orange-400" />
        )}
        <p className="text-sm font-medium text-zinc-200">
          {uploading ? "Uploading to B2…" : "Drag & drop an image here"}
        </p>
        <p className="text-xs text-zinc-500">or click to browse · PNG, JPG, GIF, WEBP</p>
      </div>

      {mode === "replace" ? (
        <input
          className="admin-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or paste image URL"
        />
      ) : null}

      {hint ? <p className="admin-hint">{hint}</p> : null}
    </div>
  );
}
