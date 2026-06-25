import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AdminField } from "@/components/admin/shared/AdminField";
import { TechnicalMarkdown } from "@/components/xai-portfolio/TechnicalMarkdown";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
};

export function XaiMarkdownField({ label, value, onChange, placeholder, minRows = 6 }: Props) {
  const [preview, setPreview] = useState(false);

  return (
    <AdminField label={label}>
      <p className="mb-2 text-xs text-zinc-500">
        Markdown supported: **bold**, lists, `inline code`, and fenced code blocks.
      </p>
      <textarea
        className="admin-input font-mono-tech min-h-[120px] text-sm"
        style={{ minHeight: `${minRows * 1.5}rem` }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
        onClick={() => setPreview((p) => !p)}
      >
        {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {preview ? "Hide preview" : "Preview"}
      </button>
      {preview && value.trim() ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-4">
          <TechnicalMarkdown content={value} />
        </div>
      ) : null}
    </AdminField>
  );
}
