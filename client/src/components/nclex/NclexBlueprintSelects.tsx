import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { NCLEX_CONTENT_CATALOG } from "@/lib/nclex/nclexCatalogHierarchy";

export type NclexBlueprintSelection = {
  catId: string;
  topicId: string;
  subId: string;
};

type Props = {
  value: NclexBlueprintSelection;
  onChange: (next: NclexBlueprintSelection) => void;
  disabled?: boolean;
  idPrefix?: string;
};

/**
 * Full NCLEX blueprint: category → topic → subtopic (labels stored in Firestore separately).
 */
export function NclexBlueprintSelects({ value, onChange, disabled, idPrefix = "bp" }: Props) {
  const category = useMemo(() => NCLEX_CONTENT_CATALOG.find((c) => c.id === value.catId) ?? null, [value.catId]);
  const topic = useMemo(() => category?.topics.find((t) => t.id === value.topicId) ?? null, [category, value.topicId]);

  return (
    <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-cat`}>NCLEX category</Label>
        <select
          id={`${idPrefix}-cat`}
          disabled={disabled}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value.catId}
          onChange={(e) => onChange({ catId: e.target.value, topicId: "", subId: "" })}
        >
          <option value="">— Optional —</option>
          {NCLEX_CONTENT_CATALOG.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-topic`}>Topic</Label>
        <select
          id={`${idPrefix}-topic`}
          disabled={disabled || !category}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value.topicId}
          onChange={(e) => onChange({ ...value, topicId: e.target.value, subId: "" })}
        >
          <option value="">—</option>
          {(category?.topics ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-sub`}>Subtopic</Label>
        <select
          id={`${idPrefix}-sub`}
          disabled={disabled || !topic}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value.subId}
          onChange={(e) => onChange({ ...value, subId: e.target.value })}
        >
          <option value="">—</option>
          {(topic?.subtopics ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function labelsFromBlueprintSelection(sel: NclexBlueprintSelection): {
  nclexCategory: string;
  nclexTopic: string;
  nclexSubtopic: string;
} {
  const cat = NCLEX_CONTENT_CATALOG.find((c) => c.id === sel.catId);
  const top = cat?.topics.find((t) => t.id === sel.topicId);
  const sub = top?.subtopics.find((s) => s.id === sel.subId);
  return {
    nclexCategory: cat?.label ?? "",
    nclexTopic: top?.label ?? "",
    nclexSubtopic: sub?.label ?? "",
  };
}

export function matchBlueprintIdsFromLabels(
  catLabel?: string,
  topicLabel?: string,
  subLabel?: string,
): NclexBlueprintSelection {
  const cL = (catLabel ?? "").trim();
  const tL = (topicLabel ?? "").trim();
  const sL = (subLabel ?? "").trim();
  if (!cL) return { catId: "", topicId: "", subId: "" };
  const cat = NCLEX_CONTENT_CATALOG.find((c) => c.label === cL);
  if (!cat) return { catId: "", topicId: "", subId: "" };
  if (!tL) return { catId: cat.id, topicId: "", subId: "" };
  const top = cat.topics.find((t) => t.label === tL);
  if (!top) return { catId: cat.id, topicId: "", subId: "" };
  const sub = sL ? top.subtopics.find((s) => s.label === sL) : null;
  return { catId: cat.id, topicId: top.id, subId: sub?.id ?? "" };
}
