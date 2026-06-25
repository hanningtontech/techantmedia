import { CaseStudyVideoGrid } from "@/components/xai-portfolio/CaseStudyVideoGrid";
import { BeforeAfterSlider } from "@/components/xai-portfolio/BeforeAfterSlider";
import { XaiLinkButtons } from "@/components/xai-portfolio/XaiLinkButtons";
import { TechnicalMarkdown } from "@/components/xai-portfolio/TechnicalMarkdown";
import { VfxLightboxGallery } from "@/components/xai-portfolio/VfxLightboxGallery";
import type { XaiCaseStudy, XaiPortfolioLabels } from "@/lib/xai-portfolio/xaiPortfolioTypes";

/** Case studies 1 & 3 (rotoscoping, color) get prominent before/after styling. */
export function isFeaturedVisualCaseStudy(order: number): boolean {
  return order === 0 || order === 2;
}

/** All case studies use the same VFX gallery chrome when images are present. */
export function hasBreakdownGallery(study: XaiCaseStudy): boolean {
  return study.breakdownImages.length > 0;
}

type Props = {
  study: XaiCaseStudy;
  index: number;
  labels: XaiPortfolioLabels;
};

function InsightBlock({ title, body, problemId }: { title: string; body: string; problemId?: string }) {
  if (!body.trim()) return null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-mono-tech text-xs font-semibold uppercase tracking-wider text-cyan-400/90">{title}</h4>
        {problemId ? (
          <span className="font-mono-tech rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">{problemId}</span>
        ) : null}
      </div>
      <TechnicalMarkdown content={body} className="mt-2" />
    </div>
  );
}

export function CaseStudyCard({ study, index, labels }: Props) {
  const featured = isFeaturedVisualCaseStudy(study.order);
  const galleryActive = hasBreakdownGallery(study);
  const pairs = [...study.beforeAfterPairs].sort((a, b) => a.order - b.order);
  const problemId = `CS-${String(index + 1).padStart(2, "0")}`;

  return (
    <article
      id={`case-${study.id}`}
      className="scroll-mt-28 rounded-2xl border border-white/10 bg-[#0e0e14] p-3 sm:scroll-mt-24 sm:p-6 lg:p-8 xl:p-10"
    >
      <p className="font-mono-tech text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {labels.caseStudyIndexPrefix} {index + 1}
        <span className="ml-2 text-zinc-600">· {problemId}</span>
      </p>
      <h3 className="mt-2 text-2xl font-bold text-white md:text-3xl">{study.title}</h3>
      {study.role ? <p className="mt-1 font-mono-tech text-sm text-violet-300">{study.role}</p> : null}
      {study.overview ? <p className="mt-4 text-lg text-zinc-400">{study.overview}</p> : null}

      <div className="mt-8">
        <CaseStudyVideoGrid study={study} placeholder={labels.videoPlaceholder} />
        <XaiLinkButtons links={study.links ?? []} />
      </div>

      {pairs.length > 0 ? (
        <div className="mt-10">
          <h4 className="mb-4 text-lg font-semibold text-white">{labels.beforeAfterTitle}</h4>
          <p className="mb-4 text-sm text-zinc-500">Drag the slider to compare raw footage vs. final grade / composite.</p>
          <div className="w-full sm:-mx-6 sm:px-5 lg:-mx-8 lg:px-5 xl:-mx-10 xl:px-5">
            <div
              className={
                pairs.length === 1
                  ? "mx-auto grid w-full grid-cols-1 justify-items-center gap-6"
                  : "mx-auto grid w-full grid-cols-1 justify-items-center gap-6 md:grid-cols-2"
              }
            >
              {pairs.map((pair) => (
                <BeforeAfterSlider
                  key={pair.id}
                  beforeUrl={pair.beforeUrl}
                  afterUrl={pair.afterUrl}
                  label={pair.label || undefined}
                  featured={featured}
                  className="w-full"
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {galleryActive ? (
        <div className="mt-10">
          <h4 className="mb-2 text-lg font-semibold text-white">{labels.breakdownGalleryTitle}</h4>
          <p className="mb-4 font-mono-tech text-xs text-zinc-500">
            Alpha mattes · tracking data · Fusion node trees — click to expand · scroll to zoom
          </p>
          <VfxLightboxGallery images={study.breakdownImages} title={study.title} featured />
        </div>
      ) : null}

      <div className="mt-10 grid gap-6 sm:gap-8 lg:grid-cols-2 xl:gap-10">
        <InsightBlock title={labels.problemLabel} body={study.problemIdentification} problemId={`${problemId}-P`} />
        <InsightBlock title={labels.solutionLabel} body={study.solutionProcess} problemId={`${problemId}-S`} />
        <InsightBlock title={labels.techniquesLabel} body={study.techniquesApplied} problemId={`${problemId}-T`} />
        <InsightBlock title={labels.aiRelevanceLabel} body={study.dataAnnotationRelevance} problemId={`${problemId}-A`} />
      </div>

      {study.toolsUsed.length > 0 ? (
        <div className="mt-8">
          <h4 className="font-mono-tech text-xs font-semibold uppercase tracking-wider text-cyan-400/90">{labels.toolsLabel}</h4>
          <ul className="mt-3 flex flex-wrap gap-2">
            {study.toolsUsed.map((tool) => (
              <li
                key={tool}
                className="font-mono-tech rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200"
              >
                {tool}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {study.resultsImpact ? (
        <div className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h4 className="font-mono-tech text-xs font-semibold uppercase tracking-wider text-emerald-400">{labels.resultsLabel}</h4>
          <TechnicalMarkdown content={study.resultsImpact} className="mt-2" />
        </div>
      ) : null}
    </article>
  );
}
