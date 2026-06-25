import { useState } from "react";
import { motion } from "framer-motion";
import { Download, ExternalLink, FileText } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { DevelopmentProjectDialog } from "@/components/tech-media/development/DevelopmentProjectDialog";
import { SeoFaqSection } from "@/components/seo/SeoFaqSection";
import { DevelopmentSkillsSection } from "@/components/tech-media/development/DevelopmentSkillsSection";
import { DEV_FAQ } from "@/lib/seo/siteSeo";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { devCvDownloadHref } from "@/lib/portfolio/devCvDownload";
import { renderRichText } from "@/lib/portfolio/renderRichText";
import type { PortfolioProject } from "@/lib/portfolio/portfolioTypes";

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
  const devSkillEntries = content.devSkillEntries;
  const dev = content.developmentSettings;
  const [selectedProject, setSelectedProject] = useState<PortfolioProject | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openProject = (project: PortfolioProject) => {
    setSelectedProject(project);
    setDialogOpen(true);
  };

  return (
    <TechMediaLayout>
      <section className="border-b border-white/10 bg-gradient-to-b from-teal-500/10 to-transparent">
        <div className="mx-auto max-w-7xl tm-page-x py-8 sm:py-10 md:py-12 lg:py-16">
          <p className="tm-eyebrow text-teal-400">{dev.heroEyebrow}</p>
          <h1 className="tm-heading-hero mt-2 font-bold text-white">{dev.heroTitle}</h1>
          <p className="tm-body-lg mt-3 max-w-2xl text-zinc-400 sm:mt-4">{dev.heroSubtitle}</p>
        </div>
      </section>

      {dev.storyParagraphs.length > 0 && (
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mx-auto max-w-3xl"
            >
              <h2 className="text-xl font-bold text-white sm:text-2xl md:text-3xl">{dev.storyTitle}</h2>
              <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
                {dev.storyParagraphs.map((para, i) => (
                  <p key={i} className="text-[0.9375rem] leading-relaxed text-zinc-300 sm:text-base md:text-lg">
                    {renderRichText(para)}
                  </p>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      <section className="border-b border-white/10 bg-[#0c0c12]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl rounded-2xl border border-teal-500/20 bg-[#12121a] p-5 sm:p-8 md:p-10"
          >
            <h2 className="text-xl font-bold text-white sm:text-2xl md:text-3xl">{dev.cvSectionTitle}</h2>
            {dev.cvDescription ? (
              <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:mt-3 sm:text-base">{dev.cvDescription}</p>
            ) : null}
            {dev.cvDownloadUrl ? (
              <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:items-center sm:gap-3">
                <a
                  href={devCvDownloadHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500/20 px-4 py-3 text-sm font-semibold text-teal-200 ring-1 ring-teal-500/30 transition hover:bg-teal-500/30 sm:w-auto sm:py-2.5"
                >
                  <FileText size={16} aria-hidden />
                  View CV
                </a>
                <a
                  href={devCvDownloadHref(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 sm:w-auto sm:py-2.5"
                >
                  <Download size={16} aria-hidden />
                  Download PDF
                </a>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">CV will be available here once uploaded in portfolio admin.</p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Featured projects</h2>
        <p className="mt-2 text-sm text-zinc-500">Tap a project to view screenshots and details.</p>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:mt-10 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {projects.map((p, i) => (
            <motion.article
              key={p.id}
              role="button"
              tabIndex={0}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              onClick={() => openProject(p)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openProject(p);
                }
              }}
              className="tm-card-hover group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12121a] text-left transition-shadow hover:ring-1 hover:ring-teal-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
              aria-label={`View details for ${p.title}`}
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
                {p.images.length > 1 && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-0.5 text-xs font-medium text-zinc-200">
                    {p.images.length} screenshots
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4 sm:p-6">
                <h3 className="text-base font-bold text-white sm:text-lg">{p.title}</h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed tm-muted">{p.description}</p>
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
                  <div className="mt-4 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
                <p className="mt-4 text-xs font-medium text-teal-400/80 group-hover:text-teal-300">View details →</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {devSkillEntries.length > 0 ? (
        <section className="border-t border-white/10 bg-[#0a0a10]">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
            <h2 className="text-xl font-bold text-white sm:text-2xl md:text-3xl">Core technical skills</h2>
            <p className="mt-2 text-sm text-zinc-400 sm:text-base">
              Stacks and workflows from shipped products — grouped like the video portfolio competencies.
            </p>
            <div className="mt-8">
              <DevelopmentSkillsSection skills={devSkillEntries} />
            </div>
          </div>
        </section>
      ) : null}

      <SeoFaqSection items={DEV_FAQ} />

      <DevelopmentProjectDialog
        project={selectedProject}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedProject(null);
        }}
      />
    </TechMediaLayout>
  );
}
