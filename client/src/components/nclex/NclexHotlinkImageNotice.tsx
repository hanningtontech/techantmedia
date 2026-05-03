import { cn } from "@/lib/utils";

type Props = {
  href: string;
  /** Stem figures use slightly roomier copy layout. */
  context?: "stem" | "inline";
  className?: string;
};

export function NclexHotlinkImageNotice({ href, context = "inline", className }: Props) {
  const pad = context === "stem" ? "p-4 sm:p-5" : "p-3";
  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200/90 bg-amber-50/90 text-sm text-amber-950",
        pad,
        className,
      )}
    >
      <p className="font-medium text-amber-900">This image cannot be shown here</p>
      <p className="mt-1.5 text-balance leading-relaxed text-amber-900/90">
        Pixabay’s CDN blocks embedding on other sites, so the browser receives 403 instead of the image file.
      </p>
      <p className="mt-3">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-800 underline underline-offset-2 hover:text-blue-950"
        >
          Open on Pixabay (new tab)
        </a>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-amber-900/85">
        To show it in a quiz: download the file, then use <strong>Upload stem image</strong> in the question editor, or use Firebase Storage or Wikimedia Commons.
      </p>
    </div>
  );
}
