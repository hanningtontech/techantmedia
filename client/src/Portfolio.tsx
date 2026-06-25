import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Menu,
  X,
  Github,
  Mail,
  Phone,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Settings,
} from "lucide-react";
import { usePortfolioContent } from "@/hooks/usePortfolioContent";
import { PrivateLink } from "@/components/navigation/PrivateLink";
import { renderRichText } from "@/lib/portfolio/renderRichText";
import { educationCardClass, expertiseCardClass } from "@/lib/portfolio/expertiseStyles";
import type { BadgeTone } from "@/lib/portfolio/portfolioTypes";

export default function Portfolio() {
  const { content } = usePortfolioContent();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [imageViewer, setImageViewer] = useState<{
    title: string;
    images: readonly string[];
    index: number;
  } | null>(null);

  const badgeToneClass: Record<BadgeTone, string> = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    purple: "bg-purple-50 text-purple-700 ring-purple-200",
    orange: "bg-orange-50 text-orange-700 ring-orange-200",
  };

  const projects = content.featuredProjects;
  const nextProjects = content.nextProjects;

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    }
  };

  useEffect(() => {
    if (!imageViewer) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (!imageViewer) return;
      if (e.key === "Escape") {
        setImageViewer(null);
        return;
      }

      if (e.key === "ArrowLeft") {
        setImageViewer((s) =>
          s
            ? { ...s, index: (s.index - 1 + s.images.length) % s.images.length }
            : s,
        );
      }

      if (e.key === "ArrowRight") {
        setImageViewer((s) =>
          s ? { ...s, index: (s.index + 1) % s.images.length } : s,
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [imageViewer]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50">
        <div className="container flex items-center justify-between py-4">
          <Link href="/" className="text-2xl font-bold text-orange-600 hover:text-orange-700">
            {content.profile.navInitials}
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <button onClick={() => scrollToSection("about")} className="text-gray-700 hover:text-orange-600 transition-colors">
              About
            </button>
            <button onClick={() => scrollToSection("skills")} className="text-gray-700 hover:text-orange-600 transition-colors">
              Skills
            </button>
            <button onClick={() => scrollToSection("projects")} className="text-gray-700 hover:text-orange-600 transition-colors">
              Projects
            </button>
            <button onClick={() => scrollToSection("experience")} className="text-gray-700 hover:text-orange-600 transition-colors">
              Experience
            </button>
            <button onClick={() => scrollToSection("education")} className="text-gray-700 hover:text-orange-600 transition-colors">
              Education
            </button>
            <PrivateLink
              href="/written-qns"
              className="text-gray-700 hover:text-orange-600 transition-colors font-medium"
            >
              Written QNS
            </PrivateLink>
            <Link
              href="/tutoring"
              className="text-gray-700 hover:text-orange-600 transition-colors font-medium"
            >
              NCLEX tutoring
            </Link>
            <PrivateLink
              href="/tutor/nclex"
              className="text-gray-700 hover:text-orange-600 transition-colors font-medium inline-flex items-center gap-1.5"
            >
              <BookOpen className="h-4 w-4" />
              NCLEX tutor
            </PrivateLink>
            <PrivateLink
              href="/admin"
              className="text-gray-700 hover:text-orange-600 transition-colors font-medium inline-flex items-center gap-1.5"
            >
              <Settings className="h-4 w-4" />
              Admin
            </PrivateLink>
            <button
              onClick={() => scrollToSection("contact")}
              className="bg-orange-600 text-white px-6 py-2 rounded-full hover:bg-orange-700 transition-colors"
            >
              Contact
            </button>
          </div>

          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 py-4 px-4 space-y-3">
            <button onClick={() => scrollToSection("about")} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded">
              About
            </button>
            <button onClick={() => scrollToSection("skills")} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded">
              Skills
            </button>
            <button onClick={() => scrollToSection("projects")} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded">
              Projects
            </button>
            <button onClick={() => scrollToSection("experience")} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded">
              Experience
            </button>
            <button onClick={() => scrollToSection("education")} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded">
              Education
            </button>
            <PrivateLink href="/written-qns" className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded font-medium">
              Written QNS
            </PrivateLink>
            <Link href="/tutoring" className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded font-medium">
              NCLEX tutoring
            </Link>
            <PrivateLink href="/tutor/nclex" className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded font-medium">
              NCLEX tutor
            </PrivateLink>
            <PrivateLink href="/admin" className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded font-medium">
              Admin
            </PrivateLink>
            <button
              onClick={() => scrollToSection("contact")}
              className="block w-full bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors"
            >
              Contact
            </button>
          </div>
        )}
      </nav>

      <section id="hero" className="relative pt-32 pb-20 bg-gradient-to-br from-orange-500 to-orange-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-3xl"></div>
        </div>

        <div className="container relative z-10 flex flex-col items-center justify-center text-center">
          <div className="w-40 h-40 rounded-full bg-orange-500/30 border-4 border-white/30 mx-auto mb-8 flex items-center justify-center overflow-hidden shadow-2xl">
            <img
              src={content.profile.imageUrl}
              alt={`Portrait of ${content.profile.name}`}
              className="w-full h-full object-cover object-[center_20%] bg-orange-600"
              loading="eager"
            />
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">{content.profile.name}</h1>
          <p className="text-2xl md:text-3xl font-light mb-6 text-white/90">{content.profile.tagline}</p>
          <p className="text-lg md:text-xl mb-8 text-white/80 max-w-2xl">{content.profile.subtitle}</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-lg sm:max-w-none">
            <button
              onClick={() => scrollToSection("contact")}
              className="w-full sm:w-auto bg-white text-orange-600 hover:bg-gray-100 px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Get in Touch
            </button>
            <PrivateLink
              href="/written-qns"
              className="w-full sm:w-auto inline-flex justify-center items-center border-2 border-white/90 text-white hover:bg-white/10 px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300"
            >
              Written QNS
            </PrivateLink>
            <Link
              href="/tutoring"
              className="w-full sm:w-auto inline-flex justify-center items-center border-2 border-white/90 text-white hover:bg-white/10 px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300"
            >
              NCLEX tutoring
            </Link>
            <PrivateLink
              href="/tutor/nclex"
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 border-2 border-white/90 text-white hover:bg-white/10 px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300"
            >
              <BookOpen className="h-5 w-5" />
              NCLEX tutor
            </PrivateLink>
          </div>
        </div>
      </section>

      <section id="about" className="py-20 bg-gray-50">
        <div className="container">
          <h2 className="text-4xl font-bold text-gray-800 mb-8 text-center">About Me</h2>
          <div className="max-w-3xl mx-auto">
            {content.about.paragraphs.map((para, i) => (
              <p key={i} className={`text-lg text-gray-700 leading-relaxed ${i > 0 ? "mt-4" : "mb-4"}`}>
                {renderRichText(para)}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section id="skills" className="py-20 bg-white">
        <div className="container">
          <h2 className="text-4xl font-bold text-gray-800 text-center mb-12">My Expertise</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {content.expertise.map((card) => {
              const styles = expertiseCardClass[card.color];
              return (
                <div key={card.id} className={`${styles.card} p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow`}>
                  <h3 className={`text-2xl font-semibold ${styles.title} mb-6`}>{card.title}</h3>
                  <ul className="space-y-3 text-gray-700">
                    {card.items.map((item) => (
                      <li key={item} className="flex items-center">
                        <span className={`w-2 h-2 ${styles.dot} rounded-full mr-3`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="projects" className="py-20 bg-gray-50">
        <div className="container">
          <h2 className="text-4xl font-bold text-gray-800 text-center mb-4">Featured Projects</h2>
          <p className="text-lg text-gray-600 text-center mb-10 max-w-3xl mx-auto">
            Completed work (with screenshots) plus a short list of what I’m building next.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-within:shadow-xl"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button
                    type="button"
                    onClick={() =>
                      setImageViewer({ title: p.title, images: p.images, index: 0 })
                    }
                    className="block w-full h-52 cursor-zoom-in"
                    aria-label={`Open ${p.title} images`}
                  >
                    <img
                      src={p.images[0]}
                      alt={`${p.title} screenshot`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </button>
                  <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                    {p.badges.map((b) => (
                      <span
                        key={`${p.title}-${b.label}`}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeToneClass[b.tone]}`}
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900">{p.title}</h3>

                  {p.images.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {p.images.map((src, idx) => (
                        <button
                          key={`${p.title}-thumb-${src}`}
                          type="button"
                          onClick={() =>
                            setImageViewer({ title: p.title, images: p.images, index: idx })
                          }
                          className="shrink-0 rounded-lg overflow-hidden border border-gray-200 hover:border-orange-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                          aria-label={`View ${p.title} screenshot ${idx + 1}`}
                        >
                          <img
                            src={src}
                            alt={`${p.title} screenshot ${idx + 1}`}
                            className="w-16 h-10 object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-gray-600 mt-2 leading-relaxed">{p.description}</p>

                  {p.links.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      {p.links.map((l) => (
                        <a
                          key={`${p.title}-${l.href}`}
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                        >
                          <ExternalLink size={16} />
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-gray-900">Next Projects</h3>
              <p className="text-gray-600 mt-2 max-w-3xl mx-auto">
                Strong ideas I’m planning next—kept short on purpose so the portfolio stays focused on shipped work.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {nextProjects.map((idea) => (
                <div
                  key={idea.id}
                  className="group bg-white rounded-2xl border border-gray-200 shadow-sm p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex flex-wrap gap-2 mb-4">
                    {idea.badges.map((b) => (
                      <span
                        key={`${idea.title}-${b.label}`}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeToneClass[b.tone]}`}
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">{idea.title}</h4>
                  <p className="text-gray-600 mt-2 leading-relaxed">{idea.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="process" className="py-20 bg-white">
        <div className="container">
          <h2 className="text-4xl font-bold text-gray-800 text-center mb-8">My Development Process</h2>
          <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto text-center mb-10">
            {renderRichText(content.process.intro)}
          </p>
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-8 rounded-xl">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">{content.process.heading}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.process.items.map((item) => (
                <div key={item} className="flex items-center">
                  <span className="w-3 h-3 bg-orange-600 rounded-full mr-4" />
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="experience" className="py-20 bg-gray-50">
        <div className="container">
          <h2 className="text-4xl font-bold text-gray-800 text-center mb-4">Experience</h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-3xl mx-auto">{content.experience.intro}</p>
          <div className="max-w-4xl mx-auto space-y-6">
            {content.experience.items.map((job) => (
              <div key={job.id} className="bg-white p-8 rounded-xl shadow-md border border-gray-100">
                <div className="flex items-start justify-between gap-6 flex-col sm:flex-row">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900">{job.title}</h3>
                    <p className="text-gray-600 mt-1">{job.subtitle}</p>
                  </div>
                  <div className="text-gray-500 text-sm">{job.period}</div>
                </div>
                <ul className="mt-6 space-y-3 text-gray-700">
                  {job.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start">
                      <ChevronRight size={20} className={`${job.accentColor === "blue" ? "text-blue-600" : "text-orange-600"} mr-2 flex-shrink-0 mt-0.5`} />
                      <span>{renderRichText(bullet)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="education" className="py-20 bg-white">
        <div className="container">
          <h2 className="text-4xl font-bold text-gray-800 text-center mb-4">Education</h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-3xl mx-auto">{content.education.intro}</p>
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.education.items.map((item) => (
              <div key={item.id} className={`${educationCardClass[item.variant]} p-8 rounded-xl shadow-md`}>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-700">{renderRichText(item.description)}</p>
                <ul className="mt-5 space-y-2 text-gray-700">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-3 ${item.variant === "orange" ? "bg-orange-600" : "bg-slate-600"}`} />
                      {renderRichText(bullet)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-20 bg-gray-50">
        <div className="container">
          <h2 className="text-4xl font-bold text-gray-800 text-center mb-4">{content.contact.heading}</h2>
          <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto text-center mb-12">{content.contact.intro}</p>
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow flex items-center">
              <Mail className="text-orange-600 mr-4 flex-shrink-0" size={28} />
              <div>
                <p className="text-gray-600 text-sm">Email</p>
                <a href={`mailto:${content.contact.email}`} className="text-xl text-orange-600 hover:underline font-semibold">{content.contact.email}</a>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow flex items-center">
              <Phone className="text-orange-600 mr-4 flex-shrink-0" size={28} />
              <div>
                <p className="text-gray-600 text-sm">Phone</p>
                <a href={`tel:${content.contact.phone}`} className="text-xl text-orange-600 hover:underline font-semibold">{content.contact.phone}</a>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow flex items-center">
              <Github className="text-orange-600 mr-4 flex-shrink-0" size={28} />
              <div>
                <p className="text-gray-600 text-sm">GitHub</p>
                <a href={content.contact.githubUrl} target="_blank" rel="noopener noreferrer" className="text-xl text-orange-600 hover:underline font-semibold">{content.contact.githubLabel}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {imageViewer && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setImageViewer(null);
          }}
        >
          <div className="relative w-full max-w-5xl">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="text-white">
                <div className="text-sm text-white/80">Viewing {imageViewer.title}</div>
                <div className="text-lg font-semibold">
                  {imageViewer.index + 1} / {imageViewer.images.length}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setImageViewer(null)}
                className="inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white w-10 h-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label="Close image viewer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              {imageViewer.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setImageViewer((s) =>
                        s
                          ? { ...s, index: (s.index - 1 + s.images.length) % s.images.length }
                          : s,
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 text-white w-10 h-10 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                    aria-label="Previous image"
                  >
                    <ChevronRight size={18} className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setImageViewer((s) =>
                        s ? { ...s, index: (s.index + 1) % s.images.length } : s,
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 text-white w-10 h-10 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                    aria-label="Next image"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}

              <img
                src={imageViewer.images[imageViewer.index]}
                alt={`${imageViewer.title} screenshot ${imageViewer.index + 1}`}
                className="w-full max-h-[78vh] object-contain rounded-xl bg-black border border-white/10 shadow-xl"
                loading="eager"
              />
            </div>

            {imageViewer.images.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {imageViewer.images.map((src, idx) => (
                  <button
                    key={`${imageViewer.title}-viewer-thumb-${src}`}
                    type="button"
                    onClick={() => setImageViewer((s) => (s ? { ...s, index: idx } : s))}
                    className={`shrink-0 rounded-lg overflow-hidden border transition-colors ${
                      idx === imageViewer.index
                        ? "border-orange-400 ring-2 ring-orange-500/30"
                        : "border-white/20 hover:border-white/30"
                    }`}
                    aria-label={`View ${imageViewer.title} screenshot ${idx + 1}`}
                  >
                    <img src={src} alt="" className="w-16 h-10 object-cover bg-black" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="bg-gray-900 text-white py-8">
        <div className="container text-center">
          <p className="text-gray-400">{content.footer.copyright}</p>
          <p className="text-gray-500 text-sm mt-2">{content.footer.tagline}</p>
        </div>
      </footer>
    </div>
  );
}
