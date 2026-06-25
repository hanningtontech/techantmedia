import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { AdminSection } from "@/components/admin/portfolio/AdminSection";
import { AdminShell } from "@/components/admin/portfolio/AdminShell";
import { ClientGalleryAdminSection } from "@/components/admin/portfolio/ClientGalleryAdminSection";
import { ClientUsersAdminSection } from "@/components/admin/portfolio/ClientUsersAdminSection";
import { PhotographyAdminSections } from "@/components/admin/portfolio/PhotographyAdminSections";
import { DevelopmentSkillsAdminSection } from "@/components/admin/portfolio/DevelopmentSkillsAdminSection";
import { VideographyAdminSection } from "@/components/admin/portfolio/VideographyAdminSection";
import { RateCardsAdminSection } from "@/components/admin/portfolio/RateCardsAdminSection";
import { XaiPortfolioAdminSections } from "@/components/admin/portfolio/XaiPortfolioAdminSections";
import { PortfolioImageUpload } from "@/components/admin/portfolio/PortfolioImageUpload";
import { AdminField } from "@/components/admin/shared/AdminField";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import { AdminsSection } from "@/components/admin/sections/settings/AdminsSection";
import { ExtractionRecordsAdminSection } from "@/components/admin/extraction/ExtractionRecordsAdminSection";
import { BlockGameAdminSection } from "@/components/admin/block-game/BlockGameAdminSection";
import { LivestreamAdminSection } from "@/components/admin/livestream/LivestreamAdminSection";
import { ContractsAdminSection } from "@/components/admin/portfolio/ContractsAdminSection";
import { TutoringOverviewSection } from "@/components/admin/sections/tutoring/TutoringOverviewSection";
import { bootstrapSuperAdmin } from "@/lib/admin/adminApi";
import {
  canAccessNavId,
  defaultAdminSection,
  hasAdminScope,
  isProfileSuperAdmin,
  resolveAdminScopes,
} from "@/lib/admin/adminPermissions";
import { isSuperAdminEmail, type AdminNavId } from "@/lib/admin/constants";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import type { GalleryUploadPayload } from "@/lib/portfolio/photoDimensions";
import { probeImageUrl } from "@/lib/portfolio/photoDimensions";
import { devCvDownloadHref } from "@/lib/portfolio/devCvDownload";
import { storyParagraphsToText, textToStoryParagraphs } from "@/lib/portfolio/developmentDefaults";
import { uploadPortfolioCv } from "@/lib/portfolio/portfolioCvUpload";
import { DEFAULT_SITE_CONTENT } from "@/lib/portfolio/siteDefaults";
import {
  mergeSiteContentWithLocalDraft,
  newPortfolioId,
  saveSiteContent,
  subscribeSiteContent,
} from "@/lib/portfolio/portfolioFirestore";
import type {
  PhotoHeroSlide,
  PortfolioProject,
  SiteContent,
  SitePhotoItem,
  SiteServiceCard,
} from "@/lib/portfolio/portfolioTypes";
import { DEFAULT_XAI_PORTFOLIO } from "@/lib/xai-portfolio/xaiPortfolioDefaults";
import { saveXaiPortfolioContent, subscribeXaiPortfolioContent } from "@/lib/xai-portfolio/xaiPortfolioFirestore";
import type { XaiPortfolioContent } from "@/lib/xai-portfolio/xaiPortfolioTypes";
import { toast } from "sonner";
import "@/styles/admin-portfolio.css";


function StringListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <AdminField label={label} tone="teal">
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
    </AdminField>
  );
}

type PortfolioAdminPageProps = {
  initialSection?: AdminNavId;
};

export default function PortfolioAdminPage({ initialSection = "site.brand" }: PortfolioAdminPageProps) {
  const { firebaseReady, loading, user, profile, signInWithGoogle, signInWithEmail } = useFirebaseAuth();
  const [draft, setDraft] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [published, setPublished] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [busy, setBusy] = useState(false);
  const [savingSlideId, setSavingSlideId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [section, setSection] = useState<AdminNavId>(initialSection);
  const [loginEmail, setLoginEmail] = useState("");
  const superAdminLogin = isSuperAdminEmail(loginEmail.trim());
  const siteContentHydrated = useRef(false);
  const [xaiDraft, setXaiDraft] = useState<XaiPortfolioContent>(DEFAULT_XAI_PORTFOLIO);
  const xaiDraftRef = useRef(xaiDraft);
  xaiDraftRef.current = xaiDraft;
  const xaiHydrated = useRef(false);

  useEffect(() => {
    if (!firebaseReady || !user || profile?.role !== "admin") return;
    siteContentHydrated.current = false;
    return (
      subscribeSiteContent((data) => {
        setPublished(data);
        if (!siteContentHydrated.current) {
          siteContentHydrated.current = true;
          setDraft(data);
          return;
        }
        setDraft((prev) => mergeSiteContentWithLocalDraft(data, prev));
      }) ?? undefined
    );
  }, [firebaseReady, user, profile?.role]);

  useEffect(() => {
    if (!firebaseReady || !user || profile?.role !== "admin") return;
    xaiHydrated.current = false;
    return subscribeXaiPortfolioContent((data) => {
      if (!xaiHydrated.current) {
        xaiHydrated.current = true;
        setXaiDraft(data);
      }
    });
  }, [firebaseReady, user, profile?.role]);

  useEffect(() => {
    if (!user?.email || profile?.role === "admin") return;
    if (!isSuperAdminEmail(user.email)) return;
    void bootstrapSuperAdmin()
      .then(() => toast.success("Owner admin access granted."))
      .catch((e) => toast.error(formatAuthOrFirestoreError(e)));
  }, [user?.email, profile?.role]);

  useEffect(() => {
    if (profile?.role !== "admin") return;
    if (!canAccessNavId(section, profile, user?.email)) {
      setSection(defaultAdminSection(profile, user?.email, initialSection));
    }
  }, [profile, user?.email, section, initialSection]);

  const deploy = async () => {
    setBusy(true);
    try {
      const scopes = resolveAdminScopes(profile, user?.email);
      const saveSite =
        isProfileSuperAdmin(profile, user?.email) ||
        hasAdminScope(profile, "development", user?.email) ||
        hasAdminScope(profile, "photography", user?.email);
      const saveXai = isProfileSuperAdmin(profile, user?.email) || scopes.includes("xai");
      if (saveSite) {
        await saveSiteContent(draft);
        setPublished(draft);
      }
      if (saveXai) {
        await saveXaiPortfolioContent(xaiDraftRef.current);
      }
      if (!saveSite && !saveXai) {
        toast.error("You do not have permission to publish content.");
        return;
      }
      const parts = [saveSite ? "storefront" : null, saveXai ? "xAI portfolio" : null].filter(Boolean);
      toast.success(`Deployed: ${parts.join(" and ")}.`);
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
    }
  };

  const persistXai = useCallback(
    async (
      updater: (current: XaiPortfolioContent) => XaiPortfolioContent,
      successMessage = "xAI portfolio updated.",
    ) => {
      const next = updater(xaiDraftRef.current);
      xaiDraftRef.current = next;
      setXaiDraft(next);
      setBusy(true);
      try {
        await saveXaiPortfolioContent(next);
        toast.success(successMessage);
      } catch (e) {
        toast.error(formatAuthOrFirestoreError(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const heroSlideSnapshot = (slide: PhotoHeroSlide) => JSON.stringify(slide);

  const isHeroSlideDirty = (slideId: string) => {
    const current = draft.photoHeroSlides.find((s) => s.id === slideId);
    const live = published.photoHeroSlides.find((s) => s.id === slideId);
    if (!current) return false;
    if (!live) return true;
    return heroSlideSnapshot(current) !== heroSlideSnapshot(live);
  };

  const cancelHeroSlide = (slideId: string) => {
    const live = published.photoHeroSlides.find((s) => s.id === slideId);
    if (!live) {
      setDraft((d) => ({
        ...d,
        photoHeroSlides: d.photoHeroSlides.filter((s) => s.id !== slideId),
      }));
      return;
    }
    setDraft((d) => ({
      ...d,
      photoHeroSlides: d.photoHeroSlides.map((s) => (s.id === slideId ? { ...live } : s)),
    }));
    toast.info("Slide changes discarded.");
  };

  const saveHeroSlide = async (slideId: string) => {
    setSavingSlideId(slideId);
    try {
      await saveSiteContent(draft);
      setPublished(draft);
      toast.success("Slide saved and live on the storefront.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setSavingSlideId(null);
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

  const persistDraft = useCallback(
    async (
      updater: (current: SiteContent) => SiteContent,
      successMessage = "Changes are live on the storefront.",
    ) => {
      const next = updater(draftRef.current);
      draftRef.current = next;
      setDraft(next);
      setBusy(true);
      try {
        await saveSiteContent(next);
        setPublished(next);
        toast.success(successMessage);
      } catch (e) {
        toast.error(formatAuthOrFirestoreError(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const publishPhotoPatch = async (id: string, patch: Partial<SitePhotoItem>) => {
    const removed = patch.src === "";
    let meta = patch;
    if (patch.src?.trim()) {
      const dims = await probeImageUrl(patch.src);
      meta = {
        ...patch,
        width: dims.width,
        height: dims.height,
        aspectRatio: dims.aspectRatio,
        orientation: "auto" as const,
        tall: dims.aspectRatio < 1,
      };
    }
    await persistDraft(
      (d) => ({
        ...d,
        photoGallery: d.photoGallery.map((p) => (p.id === id ? { ...p, ...meta } : p)),
      }),
      removed ? "Photo removed from the gallery." : "Photo is live on the gallery.",
    );
  };

  const publishGalleryPhotos = async (items: GalleryUploadPayload[], categoryId: string) => {
    if (!items.length) return;
    const visibleCategoryId =
      draftRef.current.photoCategories.find((c) => c.id === categoryId && c.visible)?.id ??
      draftRef.current.photoCategories.find((c) => c.visible)?.id ??
      categoryId;
    const baseOrder = draftRef.current.photoGallery.length;
    const newPhotos: SitePhotoItem[] = items.map((item, i) => ({
      id: newPortfolioId(),
      src: item.url,
      alt: "Photo",
      categoryId: visibleCategoryId,
      tall: item.aspectRatio < 1,
      featured: false,
      order: baseOrder + i,
      width: item.width,
      height: item.height,
      aspectRatio: item.aspectRatio,
      orientation: item.orientation ?? "auto",
    }));
    await persistDraft(
      (d) => ({
        ...d,
        photoGallery: [...d.photoGallery, ...newPhotos],
      }),
      items.length > 1
        ? `${items.length} photos are live on the gallery.`
        : "Photo is live on the gallery.",
    );
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
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            Owner ({loginEmail.trim() || "hanningtonkuria5@gmail.com"}) uses Google — no password. Other admins use email +
            password.
          </p>
          <AdminField label="Email">
            <input
              className="admin-input"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLoginEmail(e.target.value);
              }}
              placeholder="hanningtonkuria5@gmail.com"
            />
          </AdminField>
          <button
            type="button"
            className="mt-4 w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            onClick={() => void signInWithGoogle().catch((e) => toast.error(formatAuthOrFirestoreError(e)))}
          >
            Continue with Google
          </button>
          {!superAdminLogin && (
            <>
              <AdminField label="Password">
                <input
                  className="admin-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </AdminField>
              <button
                type="button"
                className="w-full rounded-full border border-white/15 py-3 text-sm font-medium text-zinc-200 hover:bg-white/5"
                onClick={() => void signInWithEmail(email.trim(), password).catch((e) => toast.error(formatAuthOrFirestoreError(e)))}
              >
                Sign in with password
              </button>
            </>
          )}
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

  if (!resolveAdminScopes(profile, user?.email).length) {
    return (
      <div className="admin-portfolio-root flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-white/10 bg-[#12121a] p-8 text-center">
          <h1 className="text-xl font-bold text-white">No admin areas assigned</h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            Ask the site owner to grant you access to Development, Photography, xAI portfolio, Tutoring, or Settings.
          </p>
          <Link href="/" className="mt-6 inline-block text-orange-400 hover:underline">
            Back to site
          </Link>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    if (!canAccessNavId(section, profile, user?.email)) {
      return (
        <AdminPage title="Access restricted" description="You do not have permission to view this section.">
          <p className="text-sm text-zinc-400">Use the sidebar to open an area assigned to your account.</p>
        </AdminPage>
      );
    }
    switch (section) {
      case "site.brand":
        return (
          <AdminPage
            title="Brand & contact"
            description="Logo, contact details, and social links for the whole site."
            width="standard"
          >
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
            <AdminField label="Nav initials (fallback)" fieldSize="short">
              <input
                className="admin-input"
                value={draft.brand.navInitials}
                placeholder="TM"
                onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, navInitials: e.target.value } }))}
              />
            </AdminField>
            <AdminField label="Brand name" fieldSize="medium">
              <input
                className="admin-input"
                value={draft.brand.name}
                onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, name: e.target.value } }))}
              />
            </AdminField>
            <AdminField label="Tagline" fieldSize="long">
              <textarea
                className="admin-input min-h-[80px] resize-y"
                value={draft.brand.tagline}
                onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, tagline: e.target.value } }))}
              />
            </AdminField>
            <PortfolioImageUpload
              label="Home hero image"
              value={draft.brand.heroImage}
              onChange={(heroImage) => setDraft((d) => ({ ...d, brand: { ...d.brand, heroImage } }))}
              hint="Large image on the home page hero."
            />
            <div className="admin-grid-2">
              <AdminField label="Email" fieldSize="medium">
                <input
                  className="admin-input"
                  value={draft.brand.email}
                  onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, email: e.target.value } }))}
                />
              </AdminField>
              <AdminField label="Phone" fieldSize="medium">
                <input
                  className="admin-input"
                  value={draft.brand.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, phone: e.target.value } }))}
                />
              </AdminField>
            </div>
            <AdminField label="YouTube channel URL" fieldSize="full">
              <input
                className="admin-input"
                value={draft.brand.youtube}
                onChange={(e) => setDraft((d) => ({ ...d, brand: { ...d.brand, youtube: e.target.value } }))}
              />
            </AdminField>
            <AdminField label="Social links" fieldSize="full">
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
            </AdminField>
          </AdminSection>
          </AdminPage>
        );

      case "site.home":
        return (
          <AdminPage
            title="Home page cards"
            description="Service cards on the TechantMedia home page."
            width="standard"
            layout="split"
          >
            {draft.serviceCards.map((card, idx) => (
              <AdminSection key={card.id} title={card.title || `Card ${idx + 1}`} accent="teal" defaultOpen={idx === 0}>
                <AdminField label="Title" tone="teal" fieldSize="medium">
                  <input
                    className="admin-input"
                    value={card.title}
                    onChange={(e) => updateServiceCard(card.id, { title: e.target.value })}
                  />
                </AdminField>
                <AdminField label="Description" tone="teal" fieldSize="long">
                  <textarea
                    className="admin-input min-h-[72px] resize-y"
                    value={card.description}
                    onChange={(e) => updateServiceCard(card.id, { description: e.target.value })}
                  />
                </AdminField>
                <AdminField label="Link path" tone="teal" fieldSize="medium">
                  <input
                    className="admin-input"
                    value={card.href}
                    onChange={(e) => updateServiceCard(card.id, { href: e.target.value })}
                  />
                </AdminField>
              </AdminSection>
            ))}
          </AdminPage>
        );

      case "offpages.livestream":
        return <LivestreamAdminSection />;

      case "offpages.blockGame":
        return <BlockGameAdminSection />;

      case "offpages.extraction":
        return (
          <AdminPage
            title="Data extraction"
            description="PIN access, user saved sessions, cleared sessions, and restore requests for /extraction."
            width="standard"
            layout="stack"
          >
            <AdminSection
              title="Extraction page access"
              description="Users must sign in with their account, then enter this PIN. Deploy to apply changes on the live site."
              accent="orange"
            >
              <AdminField label="Access PIN" fieldSize="short">
                <input
                  className="admin-input"
                  type="password"
                  autoComplete="new-password"
                  value={draft.extractionSettings.accessPin}
                  placeholder="2026"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      extractionSettings: { ...d.extractionSettings, accessPin: e.target.value },
                    }))
                  }
                />
              </AdminField>
              <p className="text-sm text-zinc-500">
                Default is <span className="font-mono text-zinc-400">2026</span>. Each user&apos;s session and history
                are stored under their account ID in Firestore.
              </p>
            </AdminSection>
            <AdminSection
              title="User sessions & archives"
              description="Saved spreadsheets, cleared sessions, and restore requests from all extraction users."
              accent="teal"
            >
              <ExtractionRecordsAdminSection />
            </AdminSection>
          </AdminPage>
        );

      case "dev.story": {
        const dev = draft.developmentSettings;
        return (
          <AdminPage
            title="Development page"
            description="Hero, story, and general CV for /development."
            width="editor"
            layout="stack"
            showLayoutGuide={false}
          >
            <AdminSection
              title="Page hero"
              description="Headline at the top of /development."
              accent="teal"
            >
              <div className="admin-grid-2">
              <AdminField label="Eyebrow" tone="teal" fieldSize="short">
                <input
                  className="admin-input"
                  value={dev.heroEyebrow}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      developmentSettings: { ...d.developmentSettings, heroEyebrow: e.target.value },
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Title" tone="teal" fieldSize="medium">
                <input
                  className="admin-input"
                  value={dev.heroTitle}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      developmentSettings: { ...d.developmentSettings, heroTitle: e.target.value },
                    }))
                  }
                />
              </AdminField>
              </div>
              <AdminField label="Subtitle" tone="teal" fieldSize="long">
                <textarea
                  className="admin-input min-h-[72px] resize-y"
                  value={dev.heroSubtitle}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      developmentSettings: { ...d.developmentSettings, heroSubtitle: e.target.value },
                    }))
                  }
                />
              </AdminField>
            </AdminSection>
            <AdminSection
              title="My story"
              description="Shown on the Development page. Separate paragraphs with a blank line."
              accent="teal"
              defaultOpen
            >
              <AdminField label="Section heading" tone="teal" fieldSize="medium">
                <input
                  className="admin-input"
                  value={dev.storyTitle}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      developmentSettings: { ...d.developmentSettings, storyTitle: e.target.value },
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Story" tone="teal" fieldSize="full">
                <textarea
                  className="admin-input min-h-[min(50vh,28rem)] w-full resize-y text-sm leading-relaxed sm:min-h-[32rem]"
                  value={storyParagraphsToText(dev.storyParagraphs)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      developmentSettings: {
                        ...d.developmentSettings,
                        storyParagraphs: textToStoryParagraphs(e.target.value),
                      },
                    }))
                  }
                  placeholder="Write your story here. Use a blank line between paragraphs."
                />
              </AdminField>
            </AdminSection>
            <AdminSection
              title="My General CV"
              description="PDF on /development — View CV and Download PDF (served via secure API)."
              accent="teal"
            >
              <AdminField label="Section heading" tone="teal" fieldSize="medium">
                <input
                  className="admin-input"
                  value={dev.cvSectionTitle}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      developmentSettings: { ...d.developmentSettings, cvSectionTitle: e.target.value },
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Short description" tone="teal" fieldSize="long">
                <textarea
                  className="admin-input min-h-[72px] resize-y"
                  value={dev.cvDescription}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      developmentSettings: { ...d.developmentSettings, cvDescription: e.target.value },
                    }))
                  }
                />
              </AdminField>
              {dev.cvDownloadUrl ? (
                <p className="mb-3 text-sm text-zinc-400">
                  <span className="font-mono text-zinc-300">{dev.cvFileName || "cv.pdf"}</span>
                  {" · "}
                  <a href={devCvDownloadHref()} className="text-teal-400 hover:underline" target="_blank" rel="noreferrer">
                    test open
                  </a>
                  {" · "}
                  <a href={devCvDownloadHref(true)} className="text-teal-400 hover:underline">
                    test download
                  </a>
                  <button
                    type="button"
                    className="ml-3 text-red-400 hover:underline"
                    onClick={() =>
                      void persistDraft(
                        (d) => ({
                          ...d,
                          developmentSettings: {
                            ...d.developmentSettings,
                            cvDownloadUrl: "",
                            cvFileName: "",
                          },
                        }),
                        "CV removed from the Development page.",
                      )
                    }
                  >
                    Remove
                  </button>
                </p>
              ) : null}
              <AdminField label="Upload PDF" tone="teal" fieldSize="full">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-500/20 file:px-4 file:py-2 file:text-teal-200"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadPortfolioCv(file)
                      .then(({ downloadUrl, fileName }) =>
                        persistDraft(
                          (d) => ({
                            ...d,
                            developmentSettings: {
                              ...d.developmentSettings,
                              cvDownloadUrl: downloadUrl,
                              cvFileName: fileName,
                            },
                          }),
                          "CV uploaded — live on /development.",
                        ),
                      )
                      .catch((err) => toast.error(formatAuthOrFirestoreError(err)));
                    e.target.value = "";
                  }}
                />
              </AdminField>
              <p className="text-xs text-zinc-500">
                After upload, click <strong className="text-zinc-400">Deploy</strong> if you edited other fields without saving.
                Upload saves immediately via API.
              </p>
            </AdminSection>
          </AdminPage>
        );
      }

      case "dev.projects":
        return (
          <AdminPage
            title="Featured projects"
            description="Cards on the Development page — click to open detail popup."
            width="wide"
            layout="split"
            showLayoutGuide={false}
          >
            <div className="admin-span-full flex justify-end">
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
                <AdminField label="Title" tone="teal" fieldSize="medium">
                  <input className="admin-input" value={p.title} onChange={(e) => updateProject(p.id, { title: e.target.value })} />
                </AdminField>
                <AdminField label="Description" tone="teal" fieldSize="long">
                  <textarea
                    className="admin-input min-h-[88px] resize-y"
                    value={p.description}
                    onChange={(e) => updateProject(p.id, { description: e.target.value })}
                  />
                </AdminField>
                <PortfolioImageUpload
                  label="Add screenshot"
                  multiple
                  value=""
                  mode="append"
                  onChange={() => {}}
                  onAppend={(url) => updateProject(p.id, { images: [...p.images, url] })}
                  hint="Drag-drop each image."
                />
                <StringListEditor label="Image URLs" items={p.images} onChange={(images) => updateProject(p.id, { images })} />
                <AdminField label="Links">
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
                </AdminField>
                <button
                  type="button"
                  className="text-sm text-red-400 hover:underline"
                  onClick={() =>
                    void persistDraft(
                      (d) => ({ ...d, featuredProjects: d.featuredProjects.filter((x) => x.id !== p.id) }),
                      "Project removed from the storefront.",
                    )
                  }
                >
                  Delete project
                </button>
              </AdminSection>
            ))}
          </AdminPage>
        );

      case "dev.skills":
        return <DevelopmentSkillsAdminSection draft={draft} setDraft={setDraft} />;

      case "photo.video":
        return (
          <VideographyAdminSection draft={draft} setDraft={setDraft} persistDraft={persistDraft} />
        );

      case "photo.rates":
        return (
          <RateCardsAdminSection draft={draft} setDraft={setDraft} persistDraft={persistDraft} />
        );

      case "photo.hero":
      case "photo.categories":
      case "photo.categoryNew":
      case "photo.photos":
      case "photo.inspos":
      case "photo.booking":
        return (
          <PhotographyAdminSections
            section={section}
            draft={draft}
            setDraft={setDraft}
            updatePhoto={updatePhoto}
            persistDraft={persistDraft}
            onPublishGalleryPhotos={(urls, categoryId) => publishGalleryPhotos(urls, categoryId)}
            onPublishPhotoPatch={(id, patch) => publishPhotoPatch(id, patch)}
            onNavigate={setSection}
            isHeroSlideDirty={isHeroSlideDirty}
            onSaveHeroSlide={(id) => void saveHeroSlide(id)}
            onCancelHeroSlide={cancelHeroSlide}
            savingSlideId={savingSlideId}
          />
        );

      case "photo.contracts":
        return (
          <ContractsAdminSection
            contracts={draft.photoContracts}
            onChangeContracts={(photoContracts) => setDraft((d) => ({ ...d, photoContracts }))}
            onSave={() => persistDraft((d) => d, "Contracts saved and live.")}
            busy={busy}
          />
        );

      case "photo.clients":
        return <ClientUsersAdminSection />;

      case "photo.clientGallery":
        return <ClientGalleryAdminSection />;

      case "tutor.overview":
        return <TutoringOverviewSection />;

      case "xai.header":
      case "xai.links":
      case "xai.skills":
      case "xai.caseStudies":
        return (
          <XaiPortfolioAdminSections
            section={section}
            draft={xaiDraft}
            setDraft={setXaiDraft}
            busy={busy}
            persistXai={persistXai}
          />
        );

      case "settings.admins":
        return <AdminsSection />;

      default:
        return null;
    }
  };

  return (
    <AdminShell active={section} onNavigate={setSection} busy={busy} onDeploy={() => void deploy()}>
      {renderSection()}
    </AdminShell>
  );
}
