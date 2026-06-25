import type { FaqItem } from "@/lib/seo/schema";

type Props = {
  title?: string;
  items: FaqItem[];
  className?: string;
  variant?: "dark" | "light";
};

/** Visible quick-answer blocks for AEO — mirrors FAQPage JSON-LD on the same page. */
export function SeoFaqSection({ title = "Quick answers", items, className = "", variant = "dark" }: Props) {
  if (!items.length) return null;

  const isLight = variant === "light";

  return (
    <section
      className={
        isLight
          ? `border-t border-gray-200 bg-gray-50 ${className}`
          : `border-t border-white/10 bg-[#0a0a10] ${className}`
      }
      aria-labelledby="seo-faq-heading"
    >
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <h2
          id="seo-faq-heading"
          className={isLight ? "text-lg font-bold text-gray-900 sm:text-xl" : "text-lg font-bold text-white sm:text-xl"}
        >
          {title}
        </h2>
        <p className={isLight ? "mt-2 text-sm text-gray-600" : "mt-2 text-sm text-zinc-500"}>
          Direct answers for search and AI assistants — factual, concise summaries.
        </p>
        <dl className="mt-6 space-y-6">
          {items.map((item) => (
            <div key={item.question}>
              <dt className={isLight ? "text-sm font-semibold text-gray-900" : "text-sm font-semibold text-zinc-200"}>
                {item.question}
              </dt>
              <dd className={isLight ? "mt-2 text-sm leading-relaxed text-gray-600" : "mt-2 text-sm leading-relaxed text-zinc-400"}>
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
