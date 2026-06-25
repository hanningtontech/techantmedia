import { Redirect } from "wouter";
import { ExternalLink, FileText, Film, Loader2 } from "lucide-react";
import { XaiPageContainer } from "@/components/xai-portfolio/XaiPageContainer";
import { XaiPortfolioLayout } from "@/components/xai-portfolio/XaiPortfolioLayout";
import { CaseStudyCard } from "@/components/xai-portfolio/CaseStudyCard";
import { XaiLinkButtons } from "@/components/xai-portfolio/XaiLinkButtons";
import { SkillsSection } from "@/components/xai-portfolio/SkillsSection";
import { cvDownloadHref } from "@/lib/xai-portfolio/cvDownload";
import { useXaiPortfolioContent } from "@/hooks/useXaiPortfolioContent";
import { isXaiPortfolioPublicEnabled } from "@/lib/xai-portfolio/xaiPortfolioVisibility";
import { SeoFaqSection } from "@/components/seo/SeoFaqSection";
import { PORTFOLIO_FAQ } from "@/lib/seo/siteSeo";

export default function XaiPortfolioPage() {
  const { content, loading } = useXaiPortfolioContent();

  if (!loading && !isXaiPortfolioPublicEnabled(content)) {
    return <Redirect to="/" />;
  }

  const { labels } = content;
  const studies = [...content.caseStudies].sort((a, b) => a.order - b.order);
  const profileLinks = [...content.links]
    .sort((a, b) => a.order - b.order)
    .map(({ label, href }) => ({ label, href }));

  return (
    <XaiPortfolioLayout>
      <section className="border-b border-white/10 bg-gradient-to-b from-cyan-500/10 via-violet-500/5 to-transparent">
        <XaiPageContainer className="py-10 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">{labels.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl md:text-5xl">{content.professionalTitle}</h1>
          <p className="mt-6 max-w-none text-base leading-relaxed text-zinc-300 sm:text-lg lg:max-w-4xl">{content.introduction}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            {content.cvDownloadUrl ? (
              <>
                <a
                  href={cvDownloadHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-8 py-3.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03] hover:bg-cyan-400"
                  title={content.cvFileName || "hannington_kuria_njuguna_cv.pdf"}
                >
                  <FileText size={18} />
                  {labels.cvButtonLabel}
                  <ExternalLink size={14} className="opacity-70" />
                </a>
                <a
                  href={cvDownloadHref(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-sm font-medium text-zinc-300 transition hover:border-cyan-500/40 hover:text-cyan-200"
                >
                  Download PDF
                </a>
              </>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-3.5 text-sm text-zinc-500">
                <FileText size={18} />
                {labels.cvMissingHint}
              </span>
            )}
            <XaiLinkButtons links={profileLinks} variant="hero" />
          </div>
        </XaiPageContainer>
      </section>

      {loading ? (
        <div className="flex justify-center py-24 text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <section id="case-studies" className="scroll-mt-32 py-10 sm:scroll-mt-24 sm:py-16">
            <XaiPageContainer>
            <div className="mb-10 flex items-center gap-3">
              <Film className="text-violet-400" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-white md:text-3xl">{labels.caseStudiesTitle}</h2>
                <p className="mt-1 text-zinc-400">{labels.caseStudiesDescription}</p>
              </div>
            </div>
            <div className="space-y-8 sm:space-y-12">
              {studies.map((study, index) => (
                <CaseStudyCard key={study.id} study={study} index={index} labels={labels} />
              ))}
            </div>
            </XaiPageContainer>
          </section>

          <section id="skills" className="scroll-mt-32 border-t border-white/10 bg-[#0a0a10] py-10 sm:scroll-mt-24 sm:py-16">
            <XaiPageContainer>
              <h2 className="text-2xl font-bold text-white md:text-3xl">{labels.skillsTitle}</h2>
              <p className="mt-2 text-zinc-400">{labels.skillsDescription}</p>
              <div className="mt-8">
                <SkillsSection skills={content.skills} />
              </div>
            </XaiPageContainer>
          </section>
        </>
      )}
      <SeoFaqSection items={PORTFOLIO_FAQ} className="border-cyan-500/10" />
    </XaiPortfolioLayout>
  );
}
