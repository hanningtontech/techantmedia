import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Camera, Code2, GraduationCap } from "lucide-react";
import { SeoFaqSection } from "@/components/seo/SeoFaqSection";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { useXaiPortfolioPublicEnabled } from "@/hooks/useXaiPortfolioPublicEnabled";
import { HOME_FAQ } from "@/lib/seo/siteSeo";

const ICONS = { camera: Camera, code: Code2, graduation: GraduationCap } as const;

const accentStyles = {
  orange: {
    border: "hover:border-orange-500/50",
    gradient: "from-orange-500/20 to-transparent",
    text: "text-orange-400",
  },
  teal: {
    border: "hover:border-teal-400/50",
    gradient: "from-teal-500/20 to-transparent",
    text: "text-teal-400",
  },
  violet: {
    border: "hover:border-violet-400/50",
    gradient: "from-violet-500/20 to-transparent",
    text: "text-violet-400",
  },
};

export default function HomePage() {
  const { content } = useSiteContent();
  const { brand, serviceCards } = content;
  const xaiPortfolioEnabled = useXaiPortfolioPublicEnabled();

  return (
    <TechMediaLayout>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.15),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(45,212,191,0.12),_transparent_45%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 tm-page-x py-12 sm:gap-10 md:grid-cols-2 md:gap-8 md:py-16 lg:gap-16 lg:py-24 xl:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="tm-eyebrow text-teal-400">Creative × Technical × Education</p>
            <h1 className="tm-heading-hero mt-3 font-bold text-white sm:mt-4">
              <span className="tm-gradient-text">{brand.name}</span>
              <br />
              <span className="text-zinc-100">Your multifaceted creative & technical agency</span>
            </h1>
            <p className="tm-body-lg mt-4 max-w-2xl text-zinc-300 sm:mt-6">
              <strong className="font-semibold text-zinc-100">TechantMedia</strong> is a Kenya-based creative and
              technology studio led by Hannington Kuria Njuguna — {brand.tagline.toLowerCase()}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 sm:mt-10 sm:gap-4">
              <Link
                href="/contact"
                className="inline-flex min-h-[var(--tm-touch-min)] items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03] sm:px-8 sm:py-3.5"
              >
                Start a project
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/photography"
                className="inline-flex min-h-[var(--tm-touch-min)] items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-zinc-100 transition-all hover:border-white/35 hover:bg-white/10 sm:px-8 sm:py-3.5"
              >
                View our work
              </Link>
              {xaiPortfolioEnabled ? (
                <Link
                  href="/portfolio"
                  className="inline-flex min-h-[var(--tm-touch-min)] items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-6 py-3 text-sm font-semibold text-cyan-200 transition-all hover:border-cyan-400/50 hover:bg-cyan-500/15 sm:px-8 sm:py-3.5"
                >
                  Video portfolio
                  <ArrowRight size={18} />
                </Link>
              ) : null}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="tm-home-hero-portrait-wrap"
          >
            <img
              src={brand.heroImage}
              alt="Creative and technology workspace"
              className="tm-home-hero-portrait"
              loading="eager"
            />
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl tm-page-x tm-section-y">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="tm-heading-section font-bold text-white">Three disciplines. One team.</h2>
          <p className="tm-body-lg tm-muted mt-3 sm:mt-4">
            Choose your path—each service has a dedicated experience built for clarity and impact.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:mt-12 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {serviceCards.map((card, i) => {
            const Icon = ICONS[card.icon as keyof typeof ICONS];
            const s = accentStyles[card.accent];
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={card.href}>
                  <article
                    className={`tm-card-hover group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12121a] p-6 sm:p-7 md:p-8 ${s.border}`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
                    <div className="relative">
                      <div className={`mb-4 inline-flex rounded-xl bg-white/5 p-2.5 sm:mb-6 sm:p-3 ${s.text}`}>
                        <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                      </div>
                      <h3 className="text-lg font-bold text-white sm:text-xl">{card.title}</h3>
                      <p className="tm-body tm-muted mt-2 leading-relaxed sm:mt-3">{card.description}</p>
                      <span className={`mt-8 inline-flex items-center gap-2 text-sm font-semibold ${s.text}`}>
                        Explore
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </article>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <SeoFaqSection items={HOME_FAQ} />
    </TechMediaLayout>
  );
}
