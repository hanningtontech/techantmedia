import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Camera, Code2, GraduationCap } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { useSiteContent } from "@/contexts/SiteContentContext";

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

  return (
    <TechMediaLayout>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.15),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(45,212,191,0.12),_transparent_45%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-400">Creative × Technical × Education</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              <span className="tm-gradient-text">{brand.name}</span>
              <br />
              <span className="text-zinc-100">Your multifaceted creative & technical agency</span>
            </h1>
            <p className="tm-muted mt-6 max-w-2xl text-lg leading-relaxed">{brand.tagline}</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-3.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
              >
                Start a project
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/photography"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-8 py-3.5 text-sm font-semibold text-zinc-100 transition-all hover:border-white/35 hover:bg-white/10"
              >
                View our work
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-orange-500/30 via-transparent to-teal-500/25 blur-2xl" />
            <img
              src={brand.heroImage}
              alt="Creative and technology workspace"
              className="relative w-full rounded-2xl border border-white/15 object-cover shadow-2xl aspect-[4/3]"
              loading="eager"
            />
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Three disciplines. One team.</h2>
          <p className="tm-muted mt-4 text-base sm:text-lg">
            Choose your path—each service has a dedicated experience built for clarity and impact.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
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
                    className={`tm-card-hover group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12121a] p-8 ${s.border}`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
                    <div className="relative">
                      <div className={`mb-6 inline-flex rounded-xl bg-white/5 p-3 ${s.text}`}>
                        <Icon size={28} />
                      </div>
                      <h3 className="text-xl font-bold text-white">{card.title}</h3>
                      <p className="tm-muted mt-3 text-sm leading-relaxed">{card.description}</p>
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
    </TechMediaLayout>
  );
}
