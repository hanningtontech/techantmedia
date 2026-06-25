import type { ProcessStep } from "@/lib/portfolio/portfolioTypes";

type Props = {
  steps: ProcessStep[];
};

export function ProcessStepsSection({ steps }: Props) {
  if (!steps.length) return null;

  return (
    <section className="border-t border-white/10 bg-gradient-to-b from-transparent to-orange-500/5 pb-20">
      <div className="mx-auto max-w-7xl tm-page-x tm-section-y">
        <h2 className="tm-heading-section font-bold text-white">Our process</h2>
        <div className="mt-8 grid gap-5 sm:mt-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {steps.map((step) => (
            <div
              key={`${step.step}-${step.title}`}
              className="rounded-2xl border border-white/10 bg-[#12121a] p-5 sm:p-6"
            >
              <span className="text-2xl font-bold text-orange-500/80 sm:text-3xl">{step.step}</span>
              <h3 className="mt-2 text-base font-semibold text-white sm:mt-3 sm:text-lg">{step.title}</h3>
              <p className="tm-body tm-muted mt-2">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
