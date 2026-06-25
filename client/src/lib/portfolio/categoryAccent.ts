/** Distinct accent per gallery category — border + title share the same hue. */
export type CategoryAccent = {
  border: string;
  ring: string;
  title: string;
  muted: string;
  surface: string;
  button: string;
  buttonRing: string;
};

const SLUG_ACCENTS: Record<string, CategoryAccent> = {
  wedding: {
    border: "border-rose-400/55",
    ring: "ring-rose-400/20",
    title: "text-rose-300",
    muted: "text-rose-200/70",
    surface: "bg-rose-500/[0.06]",
    button: "bg-rose-500/15 text-rose-200 hover:bg-rose-500/25",
    buttonRing: "ring-rose-400/40",
  },
  graduation: {
    border: "border-violet-400/55",
    ring: "ring-violet-400/20",
    title: "text-violet-300",
    muted: "text-violet-200/70",
    surface: "bg-violet-500/[0.06]",
    button: "bg-violet-500/15 text-violet-200 hover:bg-violet-500/25",
    buttonRing: "ring-violet-400/40",
  },
  studio: {
    border: "border-cyan-400/55",
    ring: "ring-cyan-400/20",
    title: "text-cyan-300",
    muted: "text-cyan-200/70",
    surface: "bg-cyan-500/[0.06]",
    button: "bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25",
    buttonRing: "ring-cyan-400/40",
  },
  traditional: {
    border: "border-amber-400/55",
    ring: "ring-amber-400/20",
    title: "text-amber-300",
    muted: "text-amber-200/70",
    surface: "bg-amber-500/[0.06]",
    button: "bg-amber-500/15 text-amber-200 hover:bg-amber-500/25",
    buttonRing: "ring-amber-400/40",
  },
  engagement: {
    border: "border-fuchsia-400/55",
    ring: "ring-fuchsia-400/20",
    title: "text-fuchsia-300",
    muted: "text-fuchsia-200/70",
    surface: "bg-fuchsia-500/[0.06]",
    button: "bg-fuchsia-500/15 text-fuchsia-200 hover:bg-fuchsia-500/25",
    buttonRing: "ring-fuchsia-400/40",
  },
  corporate: {
    border: "border-sky-400/55",
    ring: "ring-sky-400/20",
    title: "text-sky-300",
    muted: "text-sky-200/70",
    surface: "bg-sky-500/[0.06]",
    button: "bg-sky-500/15 text-sky-200 hover:bg-sky-500/25",
    buttonRing: "ring-sky-400/40",
  },
  events: {
    border: "border-lime-400/55",
    ring: "ring-lime-400/20",
    title: "text-lime-300",
    muted: "text-lime-200/70",
    surface: "bg-lime-500/[0.06]",
    button: "bg-lime-500/15 text-lime-200 hover:bg-lime-500/25",
    buttonRing: "ring-lime-400/40",
  },
  maternity: {
    border: "border-pink-400/55",
    ring: "ring-pink-400/20",
    title: "text-pink-300",
    muted: "text-pink-200/70",
    surface: "bg-pink-500/[0.06]",
    button: "bg-pink-500/15 text-pink-200 hover:bg-pink-500/25",
    buttonRing: "ring-pink-400/40",
  },
  fashion: {
    border: "border-indigo-400/55",
    ring: "ring-indigo-400/20",
    title: "text-indigo-300",
    muted: "text-indigo-200/70",
    surface: "bg-indigo-500/[0.06]",
    button: "bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25",
    buttonRing: "ring-indigo-400/40",
  },
  lifestyle: {
    border: "border-teal-400/55",
    ring: "ring-teal-400/20",
    title: "text-teal-300",
    muted: "text-teal-200/70",
    surface: "bg-teal-500/[0.06]",
    button: "bg-teal-500/15 text-teal-200 hover:bg-teal-500/25",
    buttonRing: "ring-teal-400/40",
  },
  "black-white": {
    border: "border-zinc-300/45",
    ring: "ring-zinc-300/15",
    title: "text-zinc-200",
    muted: "text-zinc-400",
    surface: "bg-white/[0.04]",
    button: "bg-white/10 text-zinc-200 hover:bg-white/15",
    buttonRing: "ring-zinc-400/35",
  },
};

const PALETTE: CategoryAccent[] = [
  SLUG_ACCENTS.wedding!,
  SLUG_ACCENTS.graduation!,
  SLUG_ACCENTS.studio!,
  SLUG_ACCENTS.traditional!,
  SLUG_ACCENTS.engagement!,
  SLUG_ACCENTS.corporate!,
  SLUG_ACCENTS.events!,
  SLUG_ACCENTS.maternity!,
  SLUG_ACCENTS.fashion!,
  SLUG_ACCENTS.lifestyle!,
];

function hashIndex(key: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function getCategoryAccent(slug: string, categoryId: string): CategoryAccent {
  const s = slug.trim().toLowerCase();
  if (SLUG_ACCENTS[s]) return SLUG_ACCENTS[s]!;
  return PALETTE[hashIndex(categoryId || s, PALETTE.length)]!;
}
