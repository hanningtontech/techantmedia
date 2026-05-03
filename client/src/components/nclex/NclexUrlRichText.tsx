import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { NclexHotlinkImageNotice } from "@/components/nclex/NclexHotlinkImageNotice";
import {
  isPixabayCdnHotlinkBlocked,
  isProbablyImageUrl,
  NCLEX_URL_SPLIT_RE,
  normalizeHttpUrlForMedia,
} from "@/lib/nclex/nclexQuestionMedia";

type Props = {
  text: string;
  className?: string;
  /** Use `eager` on long read-only pages so below-the-fold images still request (lazy can stick on some layouts). */
  imageLoading?: "eager" | "lazy";
};

/** Renders plain text with http(s) links; image URLs render as figures. */
export function NclexUrlRichText({ text, className, imageLoading = "lazy" }: Props) {
  if (!text) return null;
  const parts = text.split(NCLEX_URL_SPLIT_RE);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!/^https?:\/\//i.test(part)) {
          return <Fragment key={i}>{part}</Fragment>;
        }
        const raw = part.trim();
        const href = normalizeHttpUrlForMedia(raw);
        if (isProbablyImageUrl(href)) {
          if (isPixabayCdnHotlinkBlocked(href)) {
            return (
              <span key={i} className="my-2 block w-full max-w-full">
                <NclexHotlinkImageNotice href={href} context="inline" />
              </span>
            );
          }
          return (
            <span key={i} className="my-2 block w-full">
              <span className="inline-block max-w-full overflow-hidden rounded-lg border border-[var(--nclex-border)] bg-white/90">
                <img
                  src={href}
                  alt=""
                  className="mx-auto max-h-[min(420px,70vh)] w-full max-w-full object-contain"
                  loading={imageLoading}
                  decoding="async"
                />
              </span>
            </span>
          );
        }
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            {raw}
          </a>
        );
      })}
    </span>
  );
}

/** Answer choice: all-image URL → thumbnail; otherwise URL-rich text. */
export function NclexOptionRichText({ text, className, imageLoading = "lazy" }: Props) {
  const rawLine = text.trim();
  const t = normalizeHttpUrlForMedia(rawLine);
  if (/^https?:\/\/\S+$/i.test(rawLine) && isProbablyImageUrl(t)) {
    if (isPixabayCdnHotlinkBlocked(t)) {
      return (
        <span className={cn("block max-w-full", className)}>
          <NclexHotlinkImageNotice href={t} context="inline" />
        </span>
      );
    }
    return (
      <span className={cn("block", className)}>
        <img
          src={t}
          alt=""
          className="max-h-52 max-w-full rounded-md border border-[var(--nclex-border)] object-contain"
          loading={imageLoading}
          decoding="async"
        />
      </span>
    );
  }
  return <NclexUrlRichText text={text} className={className} imageLoading={imageLoading} />;
}
