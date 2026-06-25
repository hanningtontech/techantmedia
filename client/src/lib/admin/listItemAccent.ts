export type ListItemAccent = "orange" | "teal" | "violet" | "rose" | "sky" | "amber";

const ACCENTS: ListItemAccent[] = ["orange", "teal", "violet", "rose", "sky", "amber"];

export function listItemAccent(index: number): ListItemAccent {
  return ACCENTS[((index % ACCENTS.length) + ACCENTS.length) % ACCENTS.length];
}

/** Card chrome for long admin lists (hero slides, gallery photos, etc.). */
export const LIST_ITEM_ACCENT_CLASS: Record<
  ListItemAccent,
  { wrap: string; header: string; badge: string }
> = {
  orange: {
    wrap: "border-orange-500/25 bg-orange-500/[0.04] ring-orange-500/15",
    header: "text-orange-300",
    badge: "bg-orange-500/20 text-orange-200 ring-orange-500/35",
  },
  teal: {
    wrap: "border-teal-500/25 bg-teal-500/[0.04] ring-teal-500/15",
    header: "text-teal-300",
    badge: "bg-teal-500/20 text-teal-200 ring-teal-500/35",
  },
  violet: {
    wrap: "border-violet-500/25 bg-violet-500/[0.04] ring-violet-500/15",
    header: "text-violet-300",
    badge: "bg-violet-500/20 text-violet-200 ring-violet-500/35",
  },
  rose: {
    wrap: "border-rose-500/25 bg-rose-500/[0.04] ring-rose-500/15",
    header: "text-rose-300",
    badge: "bg-rose-500/20 text-rose-200 ring-rose-500/35",
  },
  sky: {
    wrap: "border-sky-500/25 bg-sky-500/[0.04] ring-sky-500/15",
    header: "text-sky-300",
    badge: "bg-sky-500/20 text-sky-200 ring-sky-500/35",
  },
  amber: {
    wrap: "border-amber-500/25 bg-amber-500/[0.04] ring-amber-500/15",
    header: "text-amber-300",
    badge: "bg-amber-500/20 text-amber-200 ring-amber-500/35",
  },
};
