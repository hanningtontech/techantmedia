import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import { AdminShell, type AdminNavId } from "@/components/admin/portfolio/AdminShell";
import { PhotographyAdminSections } from "@/components/admin/portfolio/PhotographyAdminSections";
import { PortfolioImageUpload } from "@/components/admin/portfolio/PortfolioImageUpload";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { DEFAULT_SITE_CONTENT } from "@/lib/portfolio/siteDefaults";
import { newPortfolioId, saveSiteContent, subscribeSiteContent } from "@/lib/portfolio/portfolioFirestore";
import type { PortfolioProject, SiteContent, SitePhotoItem, SiteServiceCard } from "@/lib/portfolio/portfolioTypes";
import { toast } from "sonner";
import "@/styles/admin-portfolio.css";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2 admin-prose">
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

function StringListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <Field label={label}>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div className="flex min-w-0 gap-2" key={i}>
            <input
              className="admin-input min-w-0 flex-1"
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-red-400 hover:bg-red-500/20"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-300 hover:bg-teal-500/20"
          onClick={() => onChange([...items, ""])}
        >
          <Plus className="h-4 w-4" /> Add line
        </button>
      </div>
    </Field>
  );
}

export default function PortfolioAdminPage() {
  const { firebaseReady, loading, user, profile, signInWithGoogle, signInWithEmail } = useFirebaseAuth();
  const [draft, setDraft] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [section, setSection] = useState<AdminNavId>("brand");

  useEffect(() => {
    if (!firebaseReady || !user || profile?.role !== "admin") return;
    return subscribeSiteContent((data) => setDraft(data)) ?? undefined;
  }, [firebaseReady, user, profile?.role]);

  const save = async () => {
    setBusy(true);
    try {
      await saveSiteContent(draft);
      toast.success("Saved. Changes are live on the storefront.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
    }
  };

  const publishDefaults = async () => {
    setBusy(true);
    try {
      await saveSiteContent(DEFAULT_SITE_CONTENT);
      setDraft(DEFAULT_SITE_CONTENT);
      toast.success("Reset to default content.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
    }
  };

  const updateProject = (id: string, patch: Partial<PortfolioProject>) => {
    setDraft((d) => ({
      ...d,
      featuredProjects: d.featuredProjects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const updateServiceCard = (id: string, patch: Partial<SiteServiceCard>) => {
    setDraft((d) => ({
      ...d,
      serviceCards: d.serviceCards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const updatePhoto = (id: string, patch: Partial<SitePhotoItem>) => {
    setDraft((d) => ({
      ...d,
      photoGallery: d.photoGallery.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  if (!firebaseReady) {
    return (
      <div className="admin-portfolio-root flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-white/10 bg-[#12121a] p-8 text-center">
          <p className="text-white font-semibold">Admin unavailable</p>
          <p className="mt-2 text-sm text-zinc-400">Add VITE_FIREBASE_* to .env and restart dev.</p>
          <Link href="/" className="mt-6 inline-block text-orange-400 hover:underline">
            Back to site
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-portfolio-root flex min-h-screen items-center justify-center">
        <p className="text-zinc-300">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-portfolio-root flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">TechantMedia</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Admin sign in</h1>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">Sign in with an admin account to edit site content.</p>
          <button
            type="button"
            className="mt-6 w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            onClick={() => void signInWithGoogle().catch((e) => toast.error(formatAuthOrFirestoreError(e)))}
          >
            Sign in with Google
          </button>
          <Field label="Email">
            <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input className="admin-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <button
            type="button"
            className="mt-2 w-full rounded-full border border-white/15 py-3 text-sm font-medium text-zinc-200 hover:bg-white/5"
            onClick={() => void signInWithEmail(email.trim(), password).catch((e) => toast.error(formatAuthOrFirestoreError(e)))}
          >
            Sign in with email
          </button>
          <Link href="/" className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </div>
    );
  }

  if (profile?.role !== "admin") {
    return (
      <div className="admin-portfolio-root flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-white/10 bg-[#12121a] p-8">
          <h1 className="text-xl font-bold text-white">Admin access required</h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            Account <span className="text-zinc-200">{profile?.email ?? user.email}</span> needs{" "}
            <code className="rounded bg-black/40 px-1 text-orange-300">role: admin</code> in Firestore.
          </p>
          <Link href="/" className="mt-6 inline-block text-orange-400 hover:underline">
            Back to site
          </Link>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (section) {
      case "brand":
        return (
          <AdminSection
            title="Brand & contact"
            description="Logo appears in the nav (falls back to initials). Hero image shows on the home page."
            accent="orange"
          >
            <PortfolioImageUpload
              label="Logo / profile photo"
              value={draft.brand.logoUrl}
              onChange={(logoUrl) => setDraft((d) => ({ ...d, brand: { ...d.brand, logoUrl } }))}
              hint="Drag-drop or paste URL. Shown in navigation; if missing, initials are used."
            />
            <Field label="Nav initials (fallback)">
              <input
                className="admin-input max-w-[8rem]"
                value={draft.brand.navInitials}
                placeholder="TM"
                onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, navInitials: e.target.value } }))}
              />
            </Field>
            <Field label="Brand name">
              <input
                className="admin-input"
                value={draft.brand.name}
                onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, name: e.target.value } }))}
              />
            </Field>
            <Field label="Tagline">
              <textarea
                className="admin-input min-h-[80px] resize-y"
                value={draft.brand.tagline}
                onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, tagline: e.target.value } }))}
              />
            </Field>
            <PortfolioImageUpload
              label="Home hero image"
              value={draft.brand.heroImage}
              onChange={(heroImage) => setDraft((d) => ({ ...d, brand: { ...d.brand, heroImage } }))}
              hint="Large image on the home page hero."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <input
                  className="admin-input"
                  value={draft.brand.email}
                  onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, email: e.target.value } }))}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="admin-input"
                  value={draft.brand.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, phone: e.target.value } }))}
                />
              </Field>
            </div>
            <Field label="YouTube channel URL">
              <input
                className="admin-input"
                value={draft.brand.youtube}
                onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, youtube: e.target.value } }))}
              />
            </Field>
            <Field label="Social links">
              <div className="space-y-2">
                {draft.brand.socials.map((link, i) => (
                  <div className="grid min-w-0 gap-2 sm:grid-cols-[7rem_1fr_auto]" key={i}>
                    <input
                      className="admin-input"
                      value={link.label}
                      placeholder="Label"
                      onChange={(e) => {
                        const socials = [...draft.brand.socials];
                        socials[i] = { ...link, label: e.target.value };
                        setDraft((d) => ({ ...d, brand: { ...d.brand, socials } }));
                      }}
                    />
                    <input
                      className="admin-input min-w-0"
                      value={link.href}
                      placeholder="https://"
                      onChange={(e) => {
                        const socials = [...draft.brand.socials];
                        socials[i] = { ...link, href: e.target.value };
                        setDraft((d) => ({ ...d, brand: { ...d.brand, socials } }));
                      }}
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-red-500/30 px-3 text-red-400"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          brand: { ...d.brand, socials: d.brand.socials.filter((_, j) => j !== i) },
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-sm text-teal-400 hover:underline"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      brand: { ...d.brand, socials: [...d.brand.socials, { label: "Instagram", href: "" }] },
                    }))
                  }
                >
                  + Add social link
                </button>
              </div>
            </Field>
          </AdminSection>
        );

      case "home":
        return (
          <>
            {draft.serviceCards.map((card, idx) => (
              <AdminSection key={card.id} title={card.title || `Card ${idx + 1}`} accent="teal" defaultOpen={idx === 0}>
                <Field label="Title">
                  <input
                    className="admin-input"
                    value={card.title}
                    onChange={(e) => updateServiceCard(card.id, { title: e.target.value })}
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    className="admin-input min-h-[72px] resize-y"
                    value={card.description}
                    onChange={(e) => updateServiceCard(card.id, { description: e.target.value })}
                  />
                </Field>
                <Field label="Link path">
                  <input
                    className="admin-input"
                    value={card.href}
                    onChange={(e) => updateServiceCard(card.id, { href: e.target.value })}
                  />
                </Field>
              </AdminSection>
            ))}
          </>
        );

      case "projects":
        return (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/40"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    featuredProjects: [
                      ...d.featuredProjects,
                      {
                        id: newPortfolioId(),
                        title: "New project",
                        description: "",
                        images: [],
                        badges: [{ label: "Completed", tone: "green" }],
                        links: [],
                        order: d.featuredProjects.length,
                      },
                    ],
                  }))
                }
              >
                <Plus className="mr-1 inline h-4 w-4" /> Add project
              </button>
            </div>
            {draft.featuredProjects.map((p, idx) => (
              <AdminSection key={p.id} title={p.title || "Untitled project"} accent="orange" defaultOpen={idx === 0}>
                <Field label="Title">
                  <input className="admin-input" value={p.title} onChange={(e) => updateProject(p.id, { title: e.target.value })} />
                </Field>
                <Field label="Description">
                  <textarea
                    className="admin-input min-h-[88px] resize-y"
                    value={p.description}
                    onChange={(e) => updateProject(p.id, { description: e.target.value })}
                  />
                </Field>
                <PortfolioImageUpload
                  label="Add screenshot"
                  value=""
                  mode="append"
                  onChange={() => {}}
                  onAppend={(url) => updateProject(p.id, { images: [...p.images, url] })}
                  hint="Drag-drop each image."
                />
                <StringListEditor label="Image URLs" items={p.images} onChange={(images) => updateProject(p.id, { images })} />
                <Field label="Links">
                  <div className="space-y-2">
                    {p.links.map((link, li) => (
                      <div key={li} className="grid min-w-0 gap-2 sm:grid-cols-[7rem_1fr_auto]">
                        <input
                          className="admin-input"
                          value={link.label}
                          placeholder="Label"
                          onChange={(e) => {
                            const links = [...p.links];
                            links[li] = { ...link, label: e.target.value };
                            updateProject(p.id, { links });
                          }}
                        />
                        <input
                          className="admin-input min-w-0"
                          value={link.href}
                          placeholder="https://"
                          onChange={(e) => {
                            const links = [...p.links];
                            links[li] = { ...link, href: e.target.value };
                            updateProject(p.id, { links });
                          }}
                        />
                        <button
                          type="button"
                          className="rounded-lg border border-red-500/30 px-3 text-red-400"
                          onClick={() => updateProject(p.id, { links: p.links.filter((_, i) => i !== li) })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-sm text-teal-400 hover:underline"
                      onClick={() => updateProject(p.id, { links: [...p.links, { label: "Live", href: "" }] })}
                    >
                      + Add link
                    </button>
                  </div>
                </Field>
                <button
                  type="button"
                  className="text-sm text-red-400 hover:underline"
                  onClick={() => setDraft((d) => ({ ...d, featuredProjects: d.featuredProjects.filter((x) => x.id !== p.id) }))}
                >
                  Delete project
                </button>
              </AdminSection>
            ))}
          </>
        );

      case "skills":
        return (
          <AdminSection title="Development skills" description="Tags on the Development page." accent="teal">
            <StringListEditor
              label="Skills"
              items={draft.devSkills}
              onChange={(devSkills) => setDraft((d) => ({ ...d, devSkills }))}
            />
          </AdminSection>
        );

      case "photoHero":
      case "photoGallery":
      case "videography":
      case "photoRates":
      case "photoBooking":
        return (
          <PhotographyAdminSections section={section} draft={draft} setDraft={setDraft} updatePhoto={updatePhoto} />
        );

      default:
        return null;
    }
  };

  return (
    <AdminShell active={section} onNavigate={setSection} busy={busy} onSave={() => void save()} onReset={() => void publishDefaults()}>
      {renderSection()}
    </AdminShell>
  );
}
