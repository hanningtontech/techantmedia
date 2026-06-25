import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Official-style multicolor Google “G” mark (SVG). */
export function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  label?: string;
};

export function GoogleSignInButton({
  loading = false,
  label = "Continue with Google",
  className,
  disabled,
  ...props
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border border-white/20 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-800 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_-4px_rgba(66,133,244,0.45),0_4px_12px_rgba(234,67,53,0.15)]",
        "transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_12px_32px_-4px_rgba(66,133,244,0.55),0_6px_16px_rgba(251,188,5,0.2)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4285F4]",
        "disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#4285F4]/10 via-[#FBBC05]/10 to-[#EA4335]/10 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
      <span className="relative flex items-center justify-center gap-3">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#4285F4]" />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/5">
            <GoogleLogo className="h-[18px] w-[18px]" />
          </span>
        )}
        <span>{label}</span>
      </span>
    </button>
  );
}
