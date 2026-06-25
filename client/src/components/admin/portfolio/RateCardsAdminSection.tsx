import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, CreditCard, Plus, Star, Trash2 } from "lucide-react";
import { AdminField } from "@/components/admin/shared/AdminField";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import {
  FilterChip,
  ListedCheckbox,
  reorderArray,
  sortByOrder,
  SortButtons,
  swapOrder,
} from "@/lib/admin/adminListControls";
import { listItemAccent } from "@/lib/admin/listItemAccent";
import { LIST_ITEM_ACCENT_CLASS } from "@/lib/admin/listItemAccent";
import { newPortfolioId } from "@/lib/portfolio/portfolioFirestore";
import type {
  RateCardCategory,
  RateCardGroup,
  RateCardPackage,
  SiteContent,
} from "@/lib/portfolio/portfolioTypes";
import { RATE_CARD_CATEGORIES, RATE_CARD_CATEGORY_LABELS } from "@/lib/tech-media/rateCardUtils";
import { cn } from "@/lib/utils";

type Props = {
  draft: SiteContent;
  setDraft: Dispatch<SetStateAction<SiteContent>>;
  persistDraft: (
    updater: (current: SiteContent) => SiteContent,
    successMessage?: string,
  ) => Promise<void>;
};

function groupTileSpan(packageCount: number): string {
  if (packageCount >= 6) return "sm:col-span-2 lg:row-span-2";
  if (packageCount >= 3) return "sm:col-span-2";
  return "";
}

function GroupTile({
  group,
  index,
  packageCount,
  expanded,
  onToggle,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
  photoCategories,
}: {
  group: RateCardGroup;
  index: number;
  packageCount: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<RateCardGroup>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  photoCategories: SiteContent["photoCategories"];
}) {
  const accent = listItemAccent(index);
  const styles = LIST_ITEM_ACCENT_CLASS[accent];

  return (
    <div
      className={cn(
        "admin-panel overflow-hidden ring-1",
        styles.wrap,
        groupTileSpan(packageCount),
      )}
    >
      <div className="flex min-h-[88px] flex-col justify-between p-3">
        <div className="flex items-start gap-2">
          <SortButtons onUp={onMoveUp} onDown={onMoveDown} />
          <div className="min-w-0 flex-1">
            <input
              className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-white outline-none"
              value={group.label}
              placeholder="Group label"
              onChange={(e) => onUpdate({ label: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              {RATE_CARD_CATEGORY_LABELS[group.category]} · {packageCount} pkg
              {group.visible === false ? " · hidden" : ""}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md p-1 text-zinc-600 hover:text-zinc-200"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
          <button
            type="button"
            className="shrink-0 rounded-md p-1 text-zinc-600 hover:text-red-400"
            onClick={onDelete}
            aria-label="Delete group"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
          <ListedCheckbox
            checked={group.visible !== false}
            onChange={(visible) => onUpdate({ visible })}
            compact
          />
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", styles.badge)}>
            #{index + 1}
          </span>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-white/10 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <AdminField label="Type" tone="orange" fieldSize="medium">
              <select
                className="admin-input text-sm"
                value={group.category}
                onChange={(e) => onUpdate({ category: e.target.value as RateCardCategory })}
              >
                {RATE_CARD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {RATE_CARD_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Gallery samples link" tone="orange" fieldSize="medium">
              <select
                className="admin-input text-sm"
                value={group.linkedGalleryCategoryId ?? ""}
                onChange={(e) => onUpdate({ linkedGalleryCategoryId: e.target.value })}
              >
                <option value="">None</option>
                {photoCategories
                  .filter((c) => c.visible)
                  .sort((a, b) => a.order - b.order)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
              </select>
            </AdminField>
          </div>
          <AdminField label="Section heading" tone="orange">
            <input
              className="admin-input text-sm"
              value={group.sectionTitle}
              onChange={(e) => onUpdate({ sectionTitle: e.target.value })}
            />
          </AdminField>
          <AdminField label="Default delivery note" tone="orange">
            <input
              className="admin-input text-sm"
              value={group.deliveryNote}
              onChange={(e) => onUpdate({ deliveryNote: e.target.value })}
            />
          </AdminField>
          <AdminField label="Description" tone="orange">
            <textarea
              className="admin-input min-h-[52px] resize-y text-sm"
              value={group.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
            />
          </AdminField>
          <AdminField label="Footnote" tone="orange">
            <textarea
              className="admin-input min-h-[52px] resize-y text-sm"
              value={group.footnote}
              onChange={(e) => onUpdate({ footnote: e.target.value })}
            />
          </AdminField>
        </div>
      ) : null}
    </div>
  );
}

function PackageCard({
  pkg,
  groupLabel,
  expanded,
  onToggle,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  pkg: RateCardPackage;
  groupLabel: string;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<RateCardPackage>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={cn(
        "admin-panel overflow-hidden",
        pkg.highlight && "sm:col-span-2",
        pkg.visible === false && "opacity-60",
      )}
    >
      <div className="flex gap-2 p-2">
        <SortButtons onUp={onMoveUp} onDown={onMoveDown} />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggle}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{pkg.name || "Untitled package"}</p>
              <p className="mt-0.5 truncate text-[11px] text-zinc-500">{groupLabel}</p>
            </div>
            <p className="shrink-0 text-sm font-bold text-orange-400">{pkg.price || "—"}</p>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <ListedCheckbox
              checked={pkg.visible !== false}
              onChange={(visible) => onUpdate({ visible })}
              compact
            />
            {pkg.highlight ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400">
                <Star className="h-3 w-3" aria-hidden />
                Popular
              </span>
            ) : null}
          </div>
        </button>
        <button
          type="button"
          className="shrink-0 self-start rounded-md p-1 text-zinc-500 hover:text-zinc-200"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {expanded ? (
        <div className="space-y-2 border-t border-white/10 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <AdminField label="Name" tone="orange" fieldSize="medium">
              <input
                className="admin-input text-sm"
                value={pkg.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
              />
            </AdminField>
            <AdminField label="Price" tone="orange" fieldSize="medium">
              <input
                className="admin-input text-sm"
                value={pkg.price}
                onChange={(e) => onUpdate({ price: e.target.value })}
              />
            </AdminField>
          </div>
          <AdminField label="Price suffix" tone="orange">
            <input
              className="admin-input text-sm"
              value={pkg.priceSuffix}
              placeholder="per day"
              onChange={(e) => onUpdate({ priceSuffix: e.target.value })}
            />
          </AdminField>
          <AdminField label="Features (one per line)" tone="orange">
            <textarea
              className="admin-input min-h-[72px] resize-y font-mono text-xs"
              value={pkg.features.length ? pkg.features.join("\n") : pkg.detail}
              onChange={(e) =>
                onUpdate({
                  features: e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                  detail: "",
                })
              }
            />
          </AdminField>
          <AdminField label="Includes (one per line)" tone="orange">
            <textarea
              className="admin-input min-h-[56px] resize-y font-mono text-xs"
              value={pkg.includes.join("\n")}
              onChange={(e) =>
                onUpdate({
                  includes: e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
            />
          </AdminField>
          <div className="grid gap-2 sm:grid-cols-2">
            <AdminField label="Delivery note override" tone="orange" fieldSize="medium">
              <input
                className="admin-input text-sm"
                value={pkg.deliveryNote}
                onChange={(e) => onUpdate({ deliveryNote: e.target.value })}
              />
            </AdminField>
            <AdminField label="Button label" tone="orange" fieldSize="medium">
              <input
                className="admin-input text-sm"
                value={pkg.ctaLabel}
                onChange={(e) => onUpdate({ ctaLabel: e.target.value })}
              />
            </AdminField>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={pkg.highlight}
              onChange={(e) => onUpdate({ highlight: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-white/20 accent-orange-500"
            />
            Mark as popular (highlighted card)
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-red-400 hover:underline"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete package
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function RateCardsAdminSection({ draft, setDraft, persistDraft }: Props) {
  const [filterGroupId, setFilterGroupId] = useState<string>("all");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);

  const groups = useMemo(() => sortByOrder(draft.rateCardGroups), [draft.rateCardGroups]);

  const packageRows = useMemo(() => {
    const rows: { group: RateCardGroup; pkg: RateCardPackage; pkgIndex: number }[] = [];
    for (const group of groups) {
      if (filterGroupId !== "all" && group.id !== filterGroupId) continue;
      group.packages.forEach((pkg, pkgIndex) => rows.push({ group, pkg, pkgIndex }));
    }
    return rows;
  }, [groups, filterGroupId]);

  const updateGroups = (next: RateCardGroup[]) => {
    setDraft((d) => ({
      ...d,
      rateCardGroups: sortByOrder(next).map((g, i) => ({ ...g, order: i })),
    }));
  };

  const moveGroup = (id: string, delta: number) => {
    updateGroups(swapOrder(draft.rateCardGroups, id, delta));
  };

  const movePackage = (groupId: string, pkgIndex: number, delta: number) => {
    setDraft((d) => ({
      ...d,
      rateCardGroups: d.rateCardGroups.map((g) =>
        g.id === groupId ? { ...g, packages: reorderArray(g.packages, pkgIndex, delta) } : g,
      ),
    }));
  };

  const addGroup = () => {
    const order = draft.rateCardGroups.length;
    const id = newPortfolioId();
    updateGroups([
      ...draft.rateCardGroups,
      {
        id,
        label: "New rate card",
        category: "other",
        sectionTitle: "",
        description: "",
        footnote: "",
        deliveryNote: "Delivery within 7 - 10 days",
        linkedGalleryCategoryId: "",
        order,
        visible: true,
        packages: [],
      },
    ]);
    setExpandedGroupId(id);
    setFilterGroupId(id);
  };

  const addPackage = (groupId: string) => {
    const id = newPortfolioId();
    setDraft((d) => ({
      ...d,
      rateCardGroups: d.rateCardGroups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              packages: [
                ...g.packages,
                {
                  id,
                  name: "New package",
                  price: "KES —",
                  priceSuffix: "per session",
                  detail: "",
                  features: [],
                  includes: [],
                  deliveryNote: "",
                  highlight: false,
                  popularLabel: "Most Popular",
                  ctaLabel: "Inquire on WhatsApp",
                  visible: true,
                },
              ],
            }
          : g,
      ),
    }));
    setExpandedPackageId(id);
    setFilterGroupId(groupId);
  };

  return (
    <AdminPage
      title="Rate cards"
      description="Manage pricing groups and packages. Uncheck Listed to hide from the public rate card page."
      width="wide"
      layout="stack"
      showLayoutGuide={false}
      actions={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/40"
          onClick={addGroup}
        >
          <Plus className="h-4 w-4" />
          Add group
        </button>
      }
    >
      <section className="admin-span-full admin-panel p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={draft.photographySettings.rateCardsEnabled}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  photographySettings: { ...d.photographySettings, rateCardsEnabled: e.target.checked },
                }))
              }
              className="h-3.5 w-3.5 rounded border-white/20 accent-orange-500"
            />
            Show rate card on storefront
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <AdminField label="Page title" tone="orange" fieldSize="medium">
            <input
              className="admin-input text-sm"
              value={draft.photographySettings.rateCardPageTitle}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  photographySettings: { ...d.photographySettings, rateCardPageTitle: e.target.value },
                }))
              }
            />
          </AdminField>
          <AdminField label="Header tagline" tone="orange" fieldSize="medium">
            <input
              className="admin-input text-sm"
              value={draft.photographySettings.rateCardHeaderTagline}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  photographySettings: { ...d.photographySettings, rateCardHeaderTagline: e.target.value },
                }))
              }
            />
          </AdminField>
        </div>
        <AdminField label="Footer WhatsApp numbers (one per line)" tone="orange" className="mt-3">
          <textarea
            className="admin-input min-h-[52px] resize-y font-mono text-xs"
            value={draft.photographySettings.rateCardWhatsappNumbers.join("\n")}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                photographySettings: {
                  ...d.photographySettings,
                  rateCardWhatsappNumbers: e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                },
              }))
            }
          />
        </AdminField>
      </section>

      <section className="admin-span-full mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Rate card groups</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Larger tiles hold more packages. Expand for section copy.</p>
          </div>
        </div>
        <div className="grid auto-rows-[minmax(88px,auto)] grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((group, idx) => (
            <GroupTile
              key={group.id}
              group={group}
              index={idx}
              packageCount={group.packages.length}
              expanded={expandedGroupId === group.id}
              onToggle={() => setExpandedGroupId((id) => (id === group.id ? null : group.id))}
              onUpdate={(patch) =>
                setDraft((d) => ({
                  ...d,
                  rateCardGroups: d.rateCardGroups.map((g) => (g.id === group.id ? { ...g, ...patch } : g)),
                }))
              }
              onMoveUp={() => moveGroup(group.id, -1)}
              onMoveDown={() => moveGroup(group.id, 1)}
              onDelete={() =>
                void persistDraft(
                  (d) => ({ ...d, rateCardGroups: d.rateCardGroups.filter((g) => g.id !== group.id) }),
                  "Rate group removed.",
                )
              }
              photoCategories={draft.photoCategories}
            />
          ))}
        </div>
      </section>

      <section className="admin-span-full mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">
            Packages
            <span className="ml-2 font-normal text-zinc-500">({packageRows.length})</span>
          </h3>
          {filterGroupId !== "all" ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-300"
              onClick={() => addPackage(filterGroupId)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add to group
            </button>
          ) : null}
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          <FilterChip
            active={filterGroupId === "all"}
            label={`All (${groups.reduce((n, g) => n + g.packages.length, 0)})`}
            onClick={() => setFilterGroupId("all")}
          />
          {groups.map((g) => (
            <FilterChip
              key={g.id}
              active={filterGroupId === g.id}
              label={`${g.label} (${g.packages.length})`}
              muted={g.visible === false}
              onClick={() => setFilterGroupId(g.id)}
            />
          ))}
        </div>

        {packageRows.length === 0 ? (
          <div className="admin-panel flex flex-col items-center justify-center gap-2 py-10 text-zinc-500">
            <CreditCard className="h-7 w-7 opacity-40" />
            <p className="text-sm">No packages in this view.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {packageRows.map(({ group, pkg, pkgIndex }) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                groupLabel={group.label}
                expanded={expandedPackageId === pkg.id}
                onToggle={() => setExpandedPackageId((id) => (id === pkg.id ? null : pkg.id))}
                onUpdate={(patch) =>
                  setDraft((d) => ({
                    ...d,
                    rateCardGroups: d.rateCardGroups.map((g) =>
                      g.id === group.id
                        ? {
                            ...g,
                            packages: g.packages.map((p) => (p.id === pkg.id ? { ...p, ...patch } : p)),
                          }
                        : g,
                    ),
                  }))
                }
                onMoveUp={() => movePackage(group.id, pkgIndex, -1)}
                onMoveDown={() => movePackage(group.id, pkgIndex, 1)}
                onDelete={() =>
                  void persistDraft(
                    (d) => ({
                      ...d,
                      rateCardGroups: d.rateCardGroups.map((g) =>
                        g.id === group.id ? { ...g, packages: g.packages.filter((p) => p.id !== pkg.id) } : g,
                      ),
                    }),
                    "Package removed.",
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </AdminPage>
  );
}
