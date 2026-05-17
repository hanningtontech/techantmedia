import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  logoUrl?: string;
  initials: string;
  className?: string;
  imgClassName?: string;
  alt?: string;
};

export function BrandMark({ logoUrl, initials, className, imgClassName, alt = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const trimmed = logoUrl?.trim() ?? "";
  const showImage = Boolean(trimmed) && !failed;
  const fallback = initials.trim().slice(0, 3).toUpperCase() || "TM";

  if (showImage) {
    return (
      <img
        src={trimmed}
        alt={alt}
        className={cn("rounded-lg object-cover", imgClassName, className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-teal-400 text-sm font-bold text-black",
        className,
      )}
      aria-hidden={!alt}
    >
      {fallback}
    </span>
  );
}
