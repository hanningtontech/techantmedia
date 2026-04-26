import { Spinner } from "@/components/ui/spinner";

/** Shown while lazy-loaded NCLEX routes fetch their JS chunk. */
export function NclexRouteFallback() {
  return (
    <div className="nclex-app nclex-shell flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <Spinner className="h-10 w-10 text-[var(--nclex-primary)]" />
      <p className="max-w-sm text-center text-sm font-medium text-slate-700">Loading module…</p>
      <p className="max-w-xs text-center text-xs text-slate-500">First visit may take a moment on slower connections.</p>
    </div>
  );
}
