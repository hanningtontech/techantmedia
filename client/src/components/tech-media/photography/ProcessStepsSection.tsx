import { motion } from "framer-motion";
import type { ProcessStep } from "@/lib/portfolio/portfolioTypes";

type Props = {
  steps: ProcessStep[];
};

export function ProcessStepsSection({ steps }: Props) {
  if (!steps.length) return null;

  return (
    <section className="border-t border-white/10 bg-gradient-to-b from-transparent to-orange-500/5 pb-20">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">Our process</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={`${step.step}-${step.title}`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-white/10 bg-[#12121a] p-6"
            >
              <span className="text-3xl font-bold text-orange-500/80">{step.step}</span>
              <h3 className="mt-3 font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm tm-muted">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
