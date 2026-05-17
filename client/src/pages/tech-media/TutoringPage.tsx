import { Link } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, Calendar, CheckCircle2, ExternalLink } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { getNclexAppUrl } from "@/const/nclexLiveUrl";
import { TUTORING_SCHEDULE, TUTORING_TOPICS } from "@/lib/tech-media/content";

const nclexAppUrl = getNclexAppUrl();

export default function TutoringPage() {
  return (
    <TechMediaLayout>
      <section className="border-b border-white/10 bg-gradient-to-b from-violet-500/15 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-400">NCLEX preparation</p>
          <h1 className="mt-2 text-4xl font-bold text-white md:text-5xl">Online Tutoring</h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-400">
            Structured, evidence-based NCLEX prep with practice banks, rationales, and tutor-led review—built for RN and PN
            candidates.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/contact?service=Tutoring"
              className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-8 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] hover:bg-violet-400"
            >
              <Calendar size={18} />
              Book a session
            </Link>
            {nclexAppUrl ? (
              <a
                href={nclexAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/5"
              >
                Open practice app
                <ExternalLink size={16} />
              </a>
            ) : (
              <Link
                href="/student/nclex"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/5"
              >
                Student portal
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
              <BookOpen className="text-violet-400" size={24} />
              Methodology
            </h2>
            <ul className="mt-6 space-y-4 text-zinc-400">
              {[
                "Diagnostic baseline quiz to map weak systems and question types.",
                "Weekly live reviews with Socratic teaching—not just answer keys.",
                "Spaced repetition through the practice app between sessions.",
                "Exam-day strategy: timing, prioritization, and anxiety management.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-violet-400" size={18} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Topics covered</h2>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {TUTORING_TOPICS.map((topic) => (
                <li
                  key={topic}
                  className="rounded-lg border border-white/10 bg-[#12121a] px-4 py-3 text-sm text-zinc-300"
                >
                  {topic}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0c0c12]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white">Typical schedule</h2>
          <p className="mt-2 tm-muted">Cohort and 1:1 formats—times shown in East Africa Time (EAT).</p>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-semibold">When</th>
                  <th className="px-6 py-4 font-semibold">Time</th>
                  <th className="px-6 py-4 font-semibold">Format</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {TUTORING_SCHEDULE.map((row) => (
                  <tr key={row.day} className="bg-[#12121a]/50 hover:bg-white/[0.03]">
                    <td className="px-6 py-4 font-medium text-white">{row.day}</td>
                    <td className="px-6 py-4 text-zinc-400">{row.time}</td>
                    <td className="px-6 py-4 text-zinc-400">{row.format}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-8 text-center"
          >
            <p className="text-lg font-semibold text-white">Ready to start?</p>
            <p className="mt-2 text-zinc-400">Tell us your target exam date and track (RN or PN).</p>
            <Link
              href="/contact?service=Tutoring"
              className="mt-6 inline-flex rounded-full bg-violet-500 px-8 py-3 text-sm font-semibold text-white hover:bg-violet-400"
            >
              Inquire about classes
            </Link>
          </motion.div>
        </div>
      </section>
    </TechMediaLayout>
  );
}
