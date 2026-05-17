import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import { PortfolioImageUpload } from "@/components/admin/portfolio/PortfolioImageUpload";
import { newPortfolioId } from "@/lib/portfolio/portfolioFirestore";
import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/portfolio/photographyDefaults";
import type { HeroAnimation, SiteContent, SitePhotoItem } from "@/lib/portfolio/portfolioTypes";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2 admin-prose">
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

type Props = {
  section: string;
  draft: SiteContent;
  setDraft: React.Dispatch<React.SetStateAction<SiteContent>>;
  updatePhoto: (id: string, patch: Partial<SitePhotoItem>) => void;
};

const HERO_ANIMATIONS: HeroAnimation[] = ["fade", "slide", "kenburns"];

export function PhotographyAdminSections({ section, draft, setDraft, updatePhoto }: Props) {
  const firstVisibleCategory =
    draft.photoCategories.find((c) => c.visible)?.id ?? draft.photoCategories[0]?.id ?? UNCATEGORIZED_CATEGORY_ID;
  const firstVideoCategory = draft.videoCategories[0]?.id ?? "vid-events";

  const photoCountByCategory = (catId: string) =>
    draft.photoGallery.filter((p) => p.categoryId === catId).length;

  switch (section) {
    case "photoHero":
      return (
        <>
          <AdminSection
            title="Hero text"
            description="Shown over the full-screen slideshow on the photography page."
            accent="orange"
          >
            <Field label="Title">
              <input
                className="admin-input"
                value={draft.photographySettings.heroTitle}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    photographySettings: { ...d.photographySettings, heroTitle: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Subtitle">
              <textarea
                className="admin-input min-h-[72px] resize-y"
                value={draft.photographySettings.heroSubtitle}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    photographySettings: { ...d.photographySettings, heroSubtitle: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Default slide animation">
              <select
                className="admin-input"
                value={draft.photographySettings.globalHeroAnimation}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    photographySettings: {
                      ...d.photographySettings,
                      globalHeroAnimation: e.target.value as HeroAnimation,
                    },
                  }))
                }
              >
                {HERO_ANIMATIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
          </AdminSection>

          <motion.div className="flex justify-end">
            <button
              type="button"
              className="rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/40"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  photoHeroSlides: [
                    ...d.photoHeroSlides,
                    {
                      id: newPortfolioId(),
                      src: "",
                      alt: "Hero slide",
                      order: d.photoHeroSlides.length,
                      animation: d.photographySettings.globalHeroAnimation,
                    },
                  ],
                }))
              }
            >
              <Plus className="mr-1 inline h-4 w-4" /> Add slide
            </button>
          </motion.div>

          {draft.photoHeroSlides.map((slide, idx) => (
            <AdminSection key={slide.id} title={slide.alt || `Slide ${idx + 1}`} accent="orange" defaultOpen={idx === 0}>
              <PortfolioImageUpload
                label="Image"
                value={slide.src}
                onChange={(src) =>
                  setDraft((d) => ({
                    ...d,
                    photoHeroSlides: d.photoHeroSlides.map((s) => (s.id === slide.id ? { ...s, src } : s)),
                  }))
                }
                hint="Full-width hero — use high resolution (1920px+ wide)."
              />
              <Field label="Alt text">
                <input
                  className="admin-input"
                  value={slide.alt}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      photoHeroSlides: d.photoHeroSlides.map((s) =>
                        s.id === slide.id ? { ...s, alt: e.target.value } : s,
                      ),
                    }))
                  }
                />
              </Field>
              <Field label="Caption (optional)">
                <input
                  className="admin-input"
                  value={slide.caption ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      photoHeroSlides: d.photoHeroSlides.map((s) =>
                        s.id === slide.id ? { ...s, caption: e.target.value } : s,
                      ),
                    }))
                  }
                />
              </Field>
              <Field label="Animation">
                <select
                  className="admin-input"
                  value={slide.animation}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      photoHeroSlides: d.photoHeroSlides.map((s) =>
                        s.id === slide.id ? { ...s, animation: e.target.value as HeroAnimation } : s,
                      ),
                    }))
                  }
                >
                  {HERO_ANIMATIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                className="text-sm text-red-400 hover:underline"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    photoHeroSlides: d.photoHeroSlides.filter((s) => s.id !== slide.id),
                  }))
                }
              >
                Delete slide
              </button>
            </AdminSection>
          ))}
        </>
      );

    case "photoGallery":
      return (
        <>
          <AdminSection title="Categories" description="Sections on the gallery. Hidden categories won't show on the site." accent="teal">
            <motion.div className="flex justify-end mb-3">
              <button
                type="button"
                className="text-sm text-teal-400 hover:underline"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    photoCategories: [
                      ...d.photoCategories,
                      {
                        id: newPortfolioId(),
                        slug: `category-${d.photoCategories.length}`,
                        label: "New category",
                        order: d.photoCategories.length,
                        visible: true,
                      },
                    ],
                  }))
                }
              >
                + Add category
              </button>
            </motion.div>
            {draft.photoCategories.map((cat, idx) => (
              <div key={cat.id} className="mb-4 rounded-xl border border-white/10 p-4 space-y-3">
                <p className="text-xs text-zinc-500">{photoCountByCategory(cat.id)} photos</p>
                <Field label="Label">
                  <input
                    className="admin-input"
                    value={cat.label}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        photoCategories: d.photoCategories.map((c) =>
                          c.id === cat.id ? { ...c, label: e.target.value } : c,
                        ),
                      }))
                    }
                  />
                </Field>
                <Field label="Slug (URL anchor)">
                  <input
                    className="admin-input"
                    value={cat.slug}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        photoCategories: d.photoCategories.map((c) =>
                          c.id === cat.id ? { ...c, slug: e.target.value } : c,
                        ),
                      }))
                    }
                  />
                </Field>
                <Field label="Description (optional)">
                  <input
                    className="admin-input"
                    value={cat.description ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        photoCategories: d.photoCategories.map((c) =>
                          c.id === cat.id ? { ...c, description: e.target.value } : c,
                        ),
                      }))
                    }
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={cat.visible}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        photoCategories: d.photoCategories.map((c) =>
                          c.id === cat.id ? { ...c, visible: e.target.checked } : c,
                        ),
                      }))
                    }
                    className="rounded border-white/20"
                  />
                  Visible on site
                </label>
                {cat.id !== UNCATEGORIZED_CATEGORY_ID && (
                  <button
                    type="button"
                    className="text-sm text-red-400 hover:underline"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        photoCategories: d.photoCategories.filter((c) => c.id !== cat.id),
                        photoGallery: d.photoGallery.map((p) =>
                          p.categoryId === cat.id ? { ...p, categoryId: firstVisibleCategory } : p,
                        ),
                      }))
                    }
                  >
                    Delete category
                  </button>
                )}
              </div>
            ))}
          </AdminSection>

          <motion.div className="flex justify-end">
            <button
              type="button"
              className="rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/40"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  photoGallery: [
                    ...d.photoGallery,
                    {
                      id: newPortfolioId(),
                      src: "",
                      alt: "Photo",
                      categoryId: firstVisibleCategory,
                      tall: false,
                      featured: false,
                      order: d.photoGallery.length,
                    },
                  ],
                }))
              }
            >
              <Plus className="mr-1 inline h-4 w-4" /> Add photo
            </button>
          </motion.div>

          {draft.photoGallery.map((photo, idx) => {
            const catLabel = draft.photoCategories.find((c) => c.id === photo.categoryId)?.label ?? "Unknown";
            return (
              <AdminSection
                key={photo.id}
                title={`${photo.alt || `Photo ${idx + 1}`} · ${catLabel}`}
                accent="orange"
                defaultOpen={idx === 0}
              >
                <PortfolioImageUpload
                  label="Image"
                  value={photo.src}
                  onChange={(src) => updatePhoto(photo.id, { src })}
                  hint="Drag-drop or paste URL."
                />
                <Field label="Category">
                  <select
                    className="admin-input"
                    value={photo.categoryId}
                    onChange={(e) => updatePhoto(photo.id, { categoryId: e.target.value })}
                  >
                    {draft.photoCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Alt text">
                  <input
                    className="admin-input"
                    value={photo.alt}
                    onChange={(e) => updatePhoto(photo.id, { alt: e.target.value })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={photo.tall}
                    onChange={(e) => updatePhoto(photo.id, { tall: e.target.checked })}
                    className="rounded border-white/20"
                  />
                  Tall masonry tile
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={photo.featured}
                    onChange={(e) => updatePhoto(photo.id, { featured: e.target.checked })}
                    className="rounded border-white/20"
                  />
                  Featured
                </label>
                <button
                  type="button"
                  className="text-sm text-red-400 hover:underline"
                  onClick={() =>
                    setDraft((d) => ({ ...d, photoGallery: d.photoGallery.filter((x) => x.id !== photo.id) }))
                  }
                >
                  Delete photo
                </button>
              </AdminSection>
            );
          })}
        </>
      );

    case "videography":
      return (
        <>
          <AdminSection title="Video categories" accent="teal">
            <button
              type="button"
              className="mb-3 text-sm text-teal-400 hover:underline"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  videoCategories: [
                    ...d.videoCategories,
                    {
                      id: newPortfolioId(),
                      slug: `video-cat-${d.videoCategories.length}`,
                      label: "New category",
                      order: d.videoCategories.length,
                      visible: true,
                    },
                  ],
                }))
              }
            >
              + Add video category
            </button>
            {draft.videoCategories.map((cat) => (
              <div key={cat.id} className="mb-3 rounded-xl border border-white/10 p-4 space-y-2">
                <input
                  className="admin-input"
                  value={cat.label}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      videoCategories: d.videoCategories.map((c) =>
                        c.id === cat.id ? { ...c, label: e.target.value } : c,
                      ),
                    }))
                  }
                />
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={cat.visible}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        videoCategories: d.videoCategories.map((c) =>
                          c.id === cat.id ? { ...c, visible: e.target.checked } : c,
                        ),
                      }))
                    }
                    className="rounded border-white/20"
                  />
                  Visible
                </label>
                <button
                  type="button"
                  className="text-sm text-red-400 hover:underline"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      videoCategories: d.videoCategories.filter((c) => c.id !== cat.id),
                      videoGallery: d.videoGallery.map((v) =>
                        v.categoryId === cat.id ? { ...v, categoryId: firstVideoCategory } : v,
                      ),
                    }))
                  }
                >
                  Delete
                </button>
              </div>
            ))}
          </AdminSection>

          <motion.div className="flex justify-end">
            <button
              type="button"
              className="rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/40"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  videoGallery: [
                    ...d.videoGallery,
                    {
                      id: newPortfolioId(),
                      title: "New video",
                      description: "",
                      embedId: "",
                      categoryId: firstVideoCategory,
                      featured: false,
                      order: d.videoGallery.length,
                    },
                  ],
                }))
              }
            >
              <Plus className="mr-1 inline h-4 w-4" /> Add video
            </button>
          </motion.div>

          {draft.videoGallery.map((video, idx) => (
            <AdminSection key={video.id} title={video.title || `Video ${idx + 1}`} accent="orange" defaultOpen={idx === 0}>
              <Field label="Title">
                <input
                  className="admin-input"
                  value={video.title}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      videoGallery: d.videoGallery.map((v) =>
                        v.id === video.id ? { ...v, title: e.target.value } : v,
                      ),
                    }))
                  }
                />
              </Field>
              <Field label="YouTube ID or URL">
                <input
                  className="admin-input"
                  value={video.embedId}
                  placeholder="dQw4w9WgXcQ or full YouTube URL"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      videoGallery: d.videoGallery.map((v) =>
                        v.id === video.id ? { ...v, embedId: e.target.value } : v,
                      ),
                    }))
                  }
                />
              </Field>
              <Field label="Description">
                <textarea
                  className="admin-input min-h-[72px] resize-y"
                  value={video.description}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      videoGallery: d.videoGallery.map((v) =>
                        v.id === video.id ? { ...v, description: e.target.value } : v,
                      ),
                    }))
                  }
                />
              </Field>
              <Field label="Category">
                <select
                  className="admin-input"
                  value={video.categoryId}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      videoGallery: d.videoGallery.map((v) =>
                        v.id === video.id ? { ...v, categoryId: e.target.value } : v,
                      ),
                    }))
                  }
                >
                  {draft.videoCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={video.featured}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      videoGallery: d.videoGallery.map((v) =>
                        v.id === video.id ? { ...v, featured: e.target.checked } : v,
                      ),
                    }))
                  }
                  className="rounded border-white/20"
                />
                Featured (wide card)
              </label>
              <button
                type="button"
                className="text-sm text-red-400 hover:underline"
                onClick={() =>
                  setDraft((d) => ({ ...d, videoGallery: d.videoGallery.filter((v) => v.id !== video.id) }))
                }
              >
                Delete video
              </button>
            </AdminSection>
          ))}
        </>
      );

    case "photoRates":
      return (
        <>
          <motion.div className="flex justify-end">
            <button
              type="button"
              className="rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/40"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  rateCardGroups: [
                    ...d.rateCardGroups,
                    {
                      id: newPortfolioId(),
                      label: "New group",
                      order: d.rateCardGroups.length,
                      packages: [],
                    },
                  ],
                }))
              }
            >
              <Plus className="mr-1 inline h-4 w-4" /> Add rate group
            </button>
          </motion.div>
          {draft.rateCardGroups.map((group) => (
            <AdminSection key={group.id} title={group.label} accent="orange">
              <Field label="Tab label">
                <input
                  className="admin-input"
                  value={group.label}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      rateCardGroups: d.rateCardGroups.map((g) =>
                        g.id === group.id ? { ...g, label: e.target.value } : g,
                      ),
                    }))
                  }
                />
              </Field>
              <button
                type="button"
                className="mb-4 text-sm text-teal-400 hover:underline"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    rateCardGroups: d.rateCardGroups.map((g) =>
                      g.id === group.id
                        ? {
                            ...g,
                            packages: [
                              ...g.packages,
                              {
                                id: newPortfolioId(),
                                name: "New package",
                                price: "KES —",
                                detail: "",
                                highlight: false,
                              },
                            ],
                          }
                        : g,
                    ),
                  }))
                }
              >
                + Add package
              </button>
              {group.packages.map((pkg) => (
                <div key={pkg.id} className="mb-4 rounded-xl border border-white/10 p-4 space-y-2">
                  <Field label="Package name">
                    <input
                      className="admin-input"
                      value={pkg.name}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          rateCardGroups: d.rateCardGroups.map((g) =>
                            g.id === group.id
                              ? {
                                  ...g,
                                  packages: g.packages.map((p) =>
                                    p.id === pkg.id ? { ...p, name: e.target.value } : p,
                                  ),
                                }
                              : g,
                          ),
                        }))
                      }
                    />
                  </Field>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Price">
                      <input
                        className="admin-input"
                        value={pkg.price}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            rateCardGroups: d.rateCardGroups.map((g) =>
                              g.id === group.id
                                ? {
                                    ...g,
                                    packages: g.packages.map((p) =>
                                      p.id === pkg.id ? { ...p, price: e.target.value } : p,
                                    ),
                                  }
                                : g,
                            ),
                          }))
                        }
                      />
                    </Field>
                    <label className="flex items-end gap-2 pb-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={pkg.highlight}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            rateCardGroups: d.rateCardGroups.map((g) =>
                              g.id === group.id
                                ? {
                                    ...g,
                                    packages: g.packages.map((p) =>
                                      p.id === pkg.id ? { ...p, highlight: e.target.checked } : p,
                                    ),
                                  }
                                : g,
                            ),
                          }))
                        }
                        className="rounded border-white/20"
                      />
                      Highlight package
                    </label>
                  </div>
                  <Field label="Details">
                    <input
                      className="admin-input"
                      value={pkg.detail}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          rateCardGroups: d.rateCardGroups.map((g) =>
                            g.id === group.id
                              ? {
                                  ...g,
                                  packages: g.packages.map((p) =>
                                    p.id === pkg.id ? { ...p, detail: e.target.value } : p,
                                  ),
                                }
                              : g,
                          ),
                        }))
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    className="text-sm text-red-400 hover:underline"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        rateCardGroups: d.rateCardGroups.map((g) =>
                          g.id === group.id
                            ? { ...g, packages: g.packages.filter((p) => p.id !== pkg.id) }
                            : g,
                        ),
                      }))
                    }
                  >
                    Remove package
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-sm text-red-400 hover:underline"
                onClick={() =>
                  setDraft((d) => ({ ...d, rateCardGroups: d.rateCardGroups.filter((g) => g.id !== group.id) }))
                }
              >
                Delete rate group
              </button>
            </AdminSection>
          ))}
        </>
      );

    case "photoBooking":
      return (
        <>
          <AdminSection title="WhatsApp booking" description="Book button on the photography page." accent="orange">
            <label className="flex items-center gap-2 text-sm text-zinc-300 mb-4">
              <input
                type="checkbox"
                checked={draft.photographySettings.whatsappBookingEnabled}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    photographySettings: { ...d.photographySettings, whatsappBookingEnabled: e.target.checked },
                  }))
                }
                className="rounded border-white/20"
              />
              Show booking section
            </label>
            <Field label="WhatsApp number (digits only, e.g. 254759550133)">
              <input
                className="admin-input"
                value={draft.photographySettings.whatsappNumber}
                placeholder="254759550133"
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    photographySettings: { ...d.photographySettings, whatsappNumber: e.target.value },
                  }))
                }
              />
            </Field>
            <p className="text-xs text-zinc-500">Falls back to brand phone if empty.</p>
            <Field label="Booking intro text">
              <textarea
                className="admin-input min-h-[72px] resize-y"
                value={draft.photographySettings.bookingIntro}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    photographySettings: { ...d.photographySettings, bookingIntro: e.target.value },
                  }))
                }
              />
            </Field>
          </AdminSection>

          <AdminSection title="Our process" description="Steps shown at the bottom of the photography page." accent="teal">
            <button
              type="button"
              className="mb-3 text-sm text-teal-400 hover:underline"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  processSteps: [
                    ...d.processSteps,
                    { step: String(d.processSteps.length + 1).padStart(2, "0"), title: "New step", text: "" },
                  ],
                }))
              }
            >
              + Add step
            </button>
            {draft.processSteps.map((step, i) => (
              <motion.div key={`${step.step}-${i}`} className="mb-4 rounded-xl border border-white/10 p-4 space-y-2">
                <Field label="Step number">
                  <input
                    className="admin-input max-w-[6rem]"
                    value={step.step}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        processSteps: d.processSteps.map((s, j) => (j === i ? { ...s, step: e.target.value } : s)),
                      }))
                    }
                  />
                </Field>
                <Field label="Title">
                  <input
                    className="admin-input"
                    value={step.title}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        processSteps: d.processSteps.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)),
                      }))
                    }
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    className="admin-input min-h-[64px] resize-y"
                    value={step.text}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        processSteps: d.processSteps.map((s, j) => (j === i ? { ...s, text: e.target.value } : s)),
                      }))
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="text-sm text-red-400 hover:underline"
                  onClick={() =>
                    setDraft((d) => ({ ...d, processSteps: d.processSteps.filter((_, j) => j !== i) }))
                  }
                >
                  Remove step
                </button>
              </motion.div>
            ))}
          </AdminSection>
        </>
      );

    default:
      return null;
  }
}
