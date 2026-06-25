import { useState } from "react";
import { Plus } from "lucide-react";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import { HeroSlideEditor } from "@/components/admin/portfolio/HeroSlideEditor";
import { PortfolioImageUpload } from "@/components/admin/portfolio/PortfolioImageUpload";
import { listItemAccent } from "@/lib/admin/listItemAccent";
import { AdminCollapsiblePanel } from "@/components/admin/shared/AdminCollapsiblePanel";
import { AdminField } from "@/components/admin/shared/AdminField";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import type { AdminNavId } from "@/lib/admin/constants";
import { newPortfolioId } from "@/lib/portfolio/portfolioFirestore";
import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/portfolio/photographyDefaults";
import type {
  HeroAnimation,
  PhotoCategory,
  PhotoOrientation,
  SiteContent,
  SitePhotoItem,
} from "@/lib/portfolio/portfolioTypes";
import { InsposAdminPanel } from "@/components/admin/portfolio/InsposAdminPanel";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2 admin-prose">
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

type Props = {
  section: AdminNavId;
  draft: SiteContent;
  setDraft: React.Dispatch<React.SetStateAction<SiteContent>>;
  updatePhoto: (id: string, patch: Partial<SitePhotoItem>) => void;
  persistDraft: (
    updater: (current: SiteContent) => SiteContent,
    successMessage?: string,
  ) => Promise<void>;
  onPublishGalleryPhotos?: (
    items: import("@/lib/portfolio/photoDimensions").GalleryUploadPayload[],
    categoryId: string,
  ) => Promise<void>;
  onPublishPhotoPatch?: (id: string, patch: Partial<SitePhotoItem>) => Promise<void>;
  onNavigate?: (id: AdminNavId) => void;
  isHeroSlideDirty?: (slideId: string) => boolean;
  onSaveHeroSlide?: (slideId: string) => void;
  onCancelHeroSlide?: (slideId: string) => void;
  savingSlideId?: string | null;
};

const HERO_ANIMATIONS: HeroAnimation[] = ["filmDissolve", "slide", "kenburns"];

export function PhotographyAdminSections({
  section,
  draft,
  setDraft,
  updatePhoto,
  persistDraft,
  onPublishGalleryPhotos,
  onPublishPhotoPatch,
  onNavigate,
  isHeroSlideDirty,
  onSaveHeroSlide,
  onCancelHeroSlide,
  savingSlideId,
}: Props) {
  const [newCategory, setNewCategory] = useState<Partial<PhotoCategory>>({
    label: "",
    slug: "",
    description: "",
    visible: true,
  });
  const [photoFilterCategory, setPhotoFilterCategory] = useState<string>("all");
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const firstVisibleCategory =
    draft.photoCategories.find((c) => c.visible)?.id ?? draft.photoCategories[0]?.id ?? UNCATEGORIZED_CATEGORY_ID;

  const photoCountByCategory = (catId: string) =>
    draft.photoGallery.filter((p) => p.categoryId === catId).length;

  switch (section) {
    case "photo.hero":
      return (
        <AdminPage
          title="Hero slideshow"
          description="Centered layout — LQ and HQ sit side by side on wide screens. Save each slide before deploying everything."
          width="wide"
        >
          <div className="admin-span-full">
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
                    {a === "filmDissolve" ? "Film dissolve" : a}
                  </option>
                ))}
              </select>
            </Field>
          </AdminSection>

          <div className="mt-10 border-t border-white/10 pt-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Hero slides</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Each slide needs a purple LQ preview and an orange HQ image.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/40"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    photoHeroSlides: [
                      ...d.photoHeroSlides,
                      {
                        id: newPortfolioId(),
                        src: "",
                        srcLq: "",
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
            </div>

            <div className="grid grid-cols-1 gap-8">
              {draft.photoHeroSlides.map((slide, idx) => (
                <HeroSlideEditor
                  key={slide.id}
                  slide={slide}
                  index={idx}
                  accent={listItemAccent(idx)}
                  dirty={isHeroSlideDirty?.(slide.id) ?? false}
                  saving={savingSlideId === slide.id}
                  defaultOpen={idx === 0}
                  onChange={(patch) =>
                    setDraft((d) => ({
                      ...d,
                      photoHeroSlides: d.photoHeroSlides.map((s) =>
                        s.id === slide.id ? { ...s, ...patch } : s,
                      ),
                    }))
                  }
                  onSave={() => onSaveHeroSlide?.(slide.id)}
                  onCancel={() => onCancelHeroSlide?.(slide.id)}
                  onDelete={() =>
                    void persistDraft(
                      (d) => ({
                        ...d,
                        photoHeroSlides: d.photoHeroSlides.filter((s) => s.id !== slide.id),
                      }),
                      "Slide removed from the hero.",
                    )
                  }
                  onPersistSlidePatch={(patch) =>
                    void persistDraft(
                      (d) => ({
                        ...d,
                        photoHeroSlides: d.photoHeroSlides.map((s) =>
                          s.id === slide.id ? { ...s, ...patch } : s,
                        ),
                      }),
                      "Slide updated on the storefront.",
                    )
                  }
                />
              ))}
            </div>
          </div>
          </div>
        </AdminPage>
      );

    case "photo.categories":
      return (
        <AdminPage
          title="Categories"
          description="Edit existing categories in a compact grid. Add new ones from the sidebar."
          width="wide"
          layout="split"
          actions={
            <button
              type="button"
              className="rounded-full bg-teal-500/20 px-4 py-2 text-sm font-semibold text-teal-300 ring-1 ring-teal-500/40"
              onClick={() => onNavigate?.("photo.categoryNew")}
            >
              + Add category
            </button>
          }
        >
          <div className="admin-span-full admin-grid-2">
            {draft.photoCategories
              .filter((c) => c.id !== UNCATEGORIZED_CATEGORY_ID)
              .map((cat, idx) => (
                <AdminCollapsiblePanel
                  key={cat.id}
                  title={cat.label}
                  subtitle={`Slug: ${cat.slug} · ${photoCountByCategory(cat.id)} photos`}
                  badge={cat.visible ? "Visible" : "Hidden"}
                  accent={listItemAccent(idx)}
                >
                  <AdminField label="Label" tone="teal">
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
                  </AdminField>
                  <AdminField label="Slug (URL anchor)">
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
                  </AdminField>
                  <AdminField label="Description (optional)">
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
                  </AdminField>
                  <label className="mb-3 flex items-center gap-2 text-base text-zinc-200">
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
                      className="h-4 w-4 rounded border-white/20"
                    />
                    Visible on site
                  </label>
                  <button
                    type="button"
                    className="text-sm text-red-400 hover:underline"
                    onClick={() =>
                      void persistDraft(
                        (d) => ({
                          ...d,
                          photoCategories: d.photoCategories.filter((c) => c.id !== cat.id),
                          photoGallery: d.photoGallery.map((p) =>
                            p.categoryId === cat.id ? { ...p, categoryId: firstVisibleCategory } : p,
                          ),
                        }),
                        "Category removed from the storefront.",
                      )
                    }
                  >
                    Delete category
                  </button>
                </AdminCollapsiblePanel>
              ))}
          </div>
        </AdminPage>
      );

    case "photo.categoryNew":
      return (
        <AdminPage
          title="Add category"
          description="Create a new gallery category, then add photos under Gallery photos."
          width="standard"
        >
          <div className="admin-grid-2">
            <div className="admin-panel p-6 admin-span-2 lg:col-span-1">
              <AdminField label="Category name">
                <input
                  className="admin-input"
                  value={newCategory.label ?? ""}
                  onChange={(e) => setNewCategory((c) => ({ ...c, label: e.target.value }))}
                  placeholder="e.g. Wedding"
                />
              </AdminField>
              <AdminField label="Slug">
                <input
                  className="admin-input"
                  value={newCategory.slug ?? ""}
                  onChange={(e) => setNewCategory((c) => ({ ...c, slug: e.target.value }))}
                  placeholder="wedding"
                />
              </AdminField>
              <AdminField label="Description (optional)">
                <textarea
                  className="admin-input"
                  value={newCategory.description ?? ""}
                  onChange={(e) => setNewCategory((c) => ({ ...c, description: e.target.value }))}
                />
              </AdminField>
              <label className="mb-4 flex items-center gap-2 text-base text-zinc-200">
                <input
                  type="checkbox"
                  checked={newCategory.visible !== false}
                  onChange={(e) => setNewCategory((c) => ({ ...c, visible: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/20"
                />
                Visible on site
              </label>
              <button
                type="button"
                className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-black hover:brightness-110"
                onClick={() => {
                  const label = (newCategory.label ?? "").trim();
                  if (!label) return;
                  const slug =
                    (newCategory.slug ?? "").trim() ||
                    label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                  setDraft((d) => ({
                    ...d,
                    photoCategories: [
                      ...d.photoCategories,
                      {
                        id: newPortfolioId(),
                        slug,
                        label,
                        description: newCategory.description?.trim() || undefined,
                        order: d.photoCategories.length,
                        visible: newCategory.visible !== false,
                      },
                    ],
                  }));
                  setNewCategory({ label: "", slug: "", description: "", visible: true });
                  onNavigate?.("photo.categories");
                }}
              >
                Save category
              </button>
            </div>
          </div>
        </AdminPage>
      );

    case "photo.photos": {
      const targetCategory = bulkCategoryId || firstVisibleCategory;
      const filteredPhotos =
        photoFilterCategory === "all"
          ? draft.photoGallery
          : draft.photoGallery.filter((p) => p.categoryId === photoFilterCategory);

      return (
        <AdminPage
          title="Gallery photos"
          description="Bulk upload publishes photos to the live gallery immediately. Use Deploy for other edits, or upload per-photo below."
          width="wide"
          actions={
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
                      categoryId: targetCategory,
                      tall: false,
                      featured: false,
                      order: d.photoGallery.length,
                    },
                  ],
                }))
              }
            >
              <Plus className="mr-1 inline h-4 w-4" /> Add empty slot
            </button>
          }
        >
          <div className="admin-span-full">
          <div className="admin-panel mb-6 p-5">
            <div className="admin-grid-2">
              <AdminField label="Bulk upload to category" tone="teal">
                <select
                  className="admin-input"
                  value={targetCategory}
                  onChange={(e) => setBulkCategoryId(e.target.value)}
                >
                  {draft.photoCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </AdminField>
              <div className="flex items-end">
                <PortfolioImageUpload
                  label=""
                  value=""
                  multiple
                  mode="append"
                  onChange={() => {}}
                  onAppendMany={(items) => void onPublishGalleryPhotos?.(items, targetCategory)}
                  hint="Select multiple images, preview, then confirm — they go live on the gallery when upload finishes."
                />
              </div>
            </div>
          </div>

          <AdminField label="Filter by category">
            <select
              className="admin-input max-w-md"
              value={photoFilterCategory}
              onChange={(e) => setPhotoFilterCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {draft.photoCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({photoCountByCategory(c.id)})
                </option>
              ))}
            </select>
          </AdminField>

          <div className="admin-grid-2 mt-6">
            {filteredPhotos.map((photo, idx) => {
              const catLabel = draft.photoCategories.find((c) => c.id === photo.categoryId)?.label ?? "Unknown";
              return (
                <AdminCollapsiblePanel
                  key={photo.id}
                  title={photo.alt || "Untitled"}
                  subtitle={catLabel}
                  accent={listItemAccent(idx)}
                >
                  <PortfolioImageUpload
                    label="Image"
                    value={photo.src}
                    onChange={(src) => void onPublishPhotoPatch?.(photo.id, { src })}
                  />
                  <AdminField label="Category">
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
                  </AdminField>
                  <AdminField label="Alt text">
                    <input
                      className="admin-input"
                      value={photo.alt}
                      onChange={(e) => updatePhoto(photo.id, { alt: e.target.value })}
                    />
                  </AdminField>
                  <AdminField label="Orientation (layout)">
                    <select
                      className="admin-input"
                      value={photo.orientation ?? "auto"}
                      onChange={(e) =>
                        void onPublishPhotoPatch?.(photo.id, {
                          orientation: e.target.value as PhotoOrientation,
                          tall: e.target.value === "portrait",
                        })
                      }
                    >
                      <option value="auto">Auto (from image)</option>
                      <option value="landscape">Landscape</option>
                      <option value="portrait">Portrait</option>
                      <option value="square">Square</option>
                    </select>
                    {photo.width && photo.height ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Detected {photo.width}×{photo.height}
                        {photo.aspectRatio ? ` · ratio ${photo.aspectRatio.toFixed(2)}` : null}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-zinc-500">Upload or re-save to detect dimensions.</p>
                    )}
                  </AdminField>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        void onPublishPhotoPatch?.(photo.id, { featured: !photo.featured })
                      }
                      className={
                        photo.featured
                          ? "rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black hover:brightness-110"
                          : "rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-orange-500/50 hover:text-orange-200"
                      }
                    >
                      {photo.featured ? "★ Featured" : "Mark as featured"}
                    </button>
                    {photo.featured ? (
                      <span className="text-xs text-orange-300/90">Shows first in this category on the live gallery.</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-sm text-red-400 hover:underline"
                    onClick={() =>
                      void persistDraft(
                        (d) => ({ ...d, photoGallery: d.photoGallery.filter((x) => x.id !== photo.id) }),
                        "Photo removed from the gallery.",
                      )
                    }
                  >
                    Delete photo
                  </button>
                </AdminCollapsiblePanel>
              );
            })}
          </div>
          </div>
        </AdminPage>
      );
    }

    case "photo.inspos":
      return <InsposAdminPanel />;

    case "photo.booking":
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
              <div key={`${step.step}-${i}`} className="mb-4 rounded-xl border border-white/10 p-4 space-y-2">
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
                    void persistDraft(
                      (d) => ({ ...d, processSteps: d.processSteps.filter((_, j) => j !== i) }),
                      "Process step removed from the storefront.",
                    )
                  }
                >
                  Remove step
                </button>
              </div>
            ))}
          </AdminSection>
        </>
      );

    default:
      return null;
  }
}
