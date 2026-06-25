import { Link } from "wouter";
import { Images } from "lucide-react";
import { useFirebaseAuth, isClient } from "@/contexts/FirebaseAuthContext";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "banner" | "compact";
  className?: string;
};

export function ClientAccountPromo({ variant = "banner", className }: Props) {
  const { user, profile } = useFirebaseAuth();
  const clientSignedIn = !!user && isClient(profile);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/25 bg-orange-500/10 px-4 py-3",
          className,
        )}
      >
        <p className="text-sm text-zinc-200">
          {clientSignedIn
            ? "Your private session gallery is ready."
            : "Shot with us? Create a free account to view your photos in My Gallery."}
        </p>
        <Link
          href={clientSignedIn ? "/photography/my-gallery" : "/photography/account"}
          className="shrink-0 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
        >
          {clientSignedIn ? "My Gallery" : "Create account"}
        </Link>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "border-b border-white/10 bg-gradient-to-r from-orange-500/10 via-transparent to-transparent",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
            <Images className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Your session photos</h2>
            <p className="mt-0.5 max-w-xl text-sm text-zinc-400">
              {clientSignedIn
                ? "Open My Gallery for previews and downloads after your photographer releases them."
                : "Create a free client account to access My Gallery — preview your shots and download after payment is confirmed."}
            </p>
          </div>
        </div>
        <Link
          href={clientSignedIn ? "/photography/my-gallery" : "/photography/account"}
          className="inline-flex shrink-0 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black hover:brightness-110"
        >
          {clientSignedIn ? "Open My Gallery" : "Create account"}
        </Link>
      </div>
    </section>
  );
}
