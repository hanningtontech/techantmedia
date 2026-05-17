import { Link } from "wouter";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { useSiteContent } from "@/contexts/SiteContentContext";

const badgeClass: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  slate: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  amber: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  blue: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  purple: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  orange: "bg-orange-500/15 text-orange-400 ring-orange-500/30",
};

export default function DevelopmentPage() {
  const { content } = useSiteContent();
  const projects = content.featuredProjects;
  const devSkills = content.devSkills;

  return (
    <TechMediaLayout>
      <section className="border-b border-white/10 bg-gradient-to-b from-teal-500/10 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-400">Engineering</p>
          <h1 className="mt-2 text-4xl font-bold text-white md:text-5xl">Full-Stack Development</h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-400">
            Web apps, admin dashboards, payments, and APIs—shipped with clean UX and reliable infrastructure.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-white">Featured projects</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p, i) => (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="tm-card-hover group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12121a]"
            >
              <div className="relative h-48 overflow-hidden bg-[#1a1a26]">
                {p.images[0] ? (
                  <img
                    src={p.images[0]}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-600">No preview</div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-lg font-bold text-white">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed tm-muted">{p.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.badges.map((b) => (
                    <span
                      key={b.label}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${badgeClass[b.tone] ?? badgeClass.slate}`}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
                {p.links.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.links.map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/20 px-3 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/30"
                      >
                        {l.label}
                        <ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0c0c12]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white">Core technical skills</h2>
          <p className="mt-2 tm-muted">Stacks we use daily on client and internal products.</p>
          <ul className="mt-8 flex flex-wrap gap-3">
            {devSkills.map((skill) => (
              <li
                key={skill}
                className="rounded-full border border-teal-500/25 bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-200 transition-transform hover:scale-105"
              >
                {skill}
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-zinc-600">
            Need to update project copy?{" "}
            <Link href="/admin" className="text-teal-400 underline-offset-2 hover:underline">
              Portfolio admin
            </Link>
          </p>
        </div>
      </section>
    </TechMediaLayout>
  );
}
