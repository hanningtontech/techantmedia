import { Link } from "wouter";
import { Heart, MessageCircle, X } from "lucide-react";
import { useInspoOptional } from "@/contexts/InspoContext";
import { cn } from "@/lib/utils";

type Props = {
  whatsappNumber?: string;
  brandName?: string;
  onShareWhatsApp?: () => void;
  className?: string;
};

export function InspoSelectionBar({ whatsappNumber, brandName, onShareWhatsApp, className }: Props) {
  const inspo = useInspoOptional();
  if (!inspo || inspo.count === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-50 flex w-[min(100%,24rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-orange-500/40 bg-[#12121a]/95 px-3 py-2 shadow-xl backdrop-blur-md sm:w-auto sm:max-w-none sm:px-4",
        className,
      )}
    >
      <Heart className="h-4 w-4 shrink-0 fill-orange-500 text-orange-500" />
      <span className="text-sm font-medium text-white">
        {inspo.count} in <span className="text-orange-300">Inspos</span>
      </span>
      <Link
        href="/inspos"
        className="rounded-full bg-orange-500/25 px-3 py-1 text-xs font-semibold text-orange-200 ring-1 ring-orange-500/50 hover:bg-orange-500/35"
      >
        View
      </Link>
      {onShareWhatsApp && whatsappNumber ? (
        <button
          type="button"
          onClick={onShareWhatsApp}
          className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-3 py-1 text-xs font-semibold text-white hover:brightness-110"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => inspo.clear()}
        className="ml-auto rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
        aria-label="Clear inspos"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
