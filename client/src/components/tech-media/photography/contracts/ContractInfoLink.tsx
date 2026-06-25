import { Link } from "wouter";
import { FileText } from "lucide-react";
import type { PhotoContractSlug } from "@/lib/contracts/contractTypes";
import { contractHref, contractIndexHref } from "@/lib/contracts/contractTypes";
import { cn } from "@/lib/utils";

type Props = {
  slug?: PhotoContractSlug;
  className?: string;
  variant?: "button" | "link";
  label?: string;
};

export function ContractInfoLink({ slug, className, variant = "button", label = "Contract info" }: Props) {
  const href = slug ? contractHref(slug) : contractIndexHref();

  if (variant === "link") {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium text-orange-300 underline-offset-2 hover:text-orange-200 hover:underline",
          className,
        )}
      >
        <FileText className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-100",
        className,
      )}
    >
      <FileText className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
