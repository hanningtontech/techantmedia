export const MPESA_NUMBER = "0759550133";

export type SplashVariant = {
  id: string;
  shellClass: string;
  innerClass: string;
  borderClass: string;
  shadowClass: string;
  blobA: string;
  blobB: string;
  blobC: string;
};

export type DodgeMoment = {
  toast: string;
  headline: string;
  footer: string;
  gif: string;
  gifAlt: string;
};

export const SPLASH_VARIANTS: SplashVariant[] = [
  {
    id: "round",
    shellClass: "rounded-[2.5rem]",
    innerClass: "rounded-[2rem]",
    borderClass: "border-4 border-dashed border-fuchsia-400",
    shadowClass: "shadow-[0_0_60px_rgba(236,72,153,0.45)]",
    blobA: "bg-yellow-400/80",
    blobB: "bg-cyan-400/70",
    blobC: "bg-lime-400/60",
  },
  {
    id: "oval",
    shellClass: "rounded-[50%] px-2",
    innerClass: "rounded-[48%]",
    borderClass: "border-4 border-double border-orange-400",
    shadowClass: "shadow-[0_0_70px_rgba(251,146,60,0.5)]",
    blobA: "bg-pink-400/75",
    blobB: "bg-violet-400/70",
    blobC: "bg-amber-300/70",
  },
  {
    id: "star",
    shellClass: "rounded-2xl",
    innerClass: "rounded-xl",
    borderClass: "border-4 border-dotted border-lime-400",
    shadowClass: "shadow-[0_0_65px_rgba(132,204,22,0.45)]",
    blobA: "bg-sky-400/75",
    blobB: "bg-rose-400/70",
    blobC: "bg-emerald-300/65",
  },
  {
    id: "splash",
    shellClass: "rounded-[3rem_1rem_2.5rem_1.5rem]",
    innerClass: "rounded-[2.5rem_1rem_2rem_1rem]",
    borderClass: "border-4 border-dashed border-purple-400",
    shadowClass: "shadow-[0_0_55px_rgba(168,85,247,0.5)]",
    blobA: "bg-red-400/70",
    blobB: "bg-teal-400/70",
    blobC: "bg-yellow-300/75",
  },
];

export const GRADIENTS = [
  "from-amber-200 via-pink-200 to-sky-300",
  "from-lime-200 via-yellow-200 to-orange-300",
  "from-violet-200 via-fuchsia-200 to-rose-300",
  "from-cyan-200 via-sky-200 to-indigo-300",
  "from-emerald-200 via-lime-200 to-teal-300",
];

export const DODGE_MOMENTS: DodgeMoment[] = [
  {
    toast: "Bro the X is on vacation 🏖️😂",
    headline: "Gotchaaaa🤣🤣🤣🤣 Anyway if you dont want cancel",
    footer: "🏃‍♂️💨 I moonwalked away with your patience",
    gif: "https://media.giphy.com/media/l3q2K5jinAlChoCLa/giphy.gif",
    gifAlt: "Person running away",
  },
  {
    toast: "You chased the X like rent is due 🏠😭",
    headline: "Almost had me! Almost. Soda first 🥤✨",
    footer: "🎯 Missed by 0.001 millimeters of drama",
    gif: "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif",
    gifAlt: "Gotcha moment",
  },
  {
    toast: "That X is faster than Nairobi traffic 🚦🤣",
    headline: "Wueh! Hii button ni athlete 🏅😂",
    footer: "🧃 Cold soda > close button. Science.",
    gif: "https://media.giphy.com/media/g9582DNuQMAxC/giphy.gif",
    gifAlt: "Laughing reaction",
  },
  {
    toast: "Nice try CEO of Closing Popups 👔😏",
    headline: "Cancel is a feeling, not a button today 💅",
    footer: "🎨 Fresh paint coat — still not closing",
    gif: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
    gifAlt: "Dramatic nope",
  },
  {
    toast: "X said 'not today Satan' ⛪😂",
    headline: "You want out? Buy soda in 🥤🔥",
    footer: "🌟 Star-shaped refusal — very artistic",
    gif: "https://media.giphy.com/media/26BRuo6sGiljlGy4M/giphy.gif",
    gifAlt: "Nope nope nope",
  },
  {
    toast: "Hover skills: 10/10. Close skills: loading… ⏳🤣",
    headline: "M-Pesa is right there looking handsome 💚📱",
    footer: "😈 This popup studied dodgeball in school",
    gif: "https://media.giphy.com/media/13CoXDiaCcGyfu/giphy.gif",
    gifAlt: "Dodging",
  },
  {
    toast: "The X teleported like a genie 🧞‍♂️✨",
    headline: "Poof! Still here. Still thirsty. Still soda.",
    footer: "🍋 Lime flavor betrayal — popup edition",
    gif: "https://media.giphy.com/media/5VKbvrjqqEVoA/giphy.gif",
    gifAlt: "Magic poof",
  },
  {
    toast: "You clicked air. Premium air. 💨😂",
    headline: "Gotchaaaa again! Soda budget must rise 📈🥤",
    footer: "🤹 Professional prank juggler on duty",
    gif: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    gifAlt: "Juggling",
  },
];

export function pickSplashVariant(index: number): SplashVariant {
  return SPLASH_VARIANTS[index % SPLASH_VARIANTS.length]!;
}

export function pickGradient(index: number): string {
  return GRADIENTS[index % GRADIENTS.length]!;
}

export function pickDodgeMoment(index: number): DodgeMoment {
  return DODGE_MOMENTS[index % DODGE_MOMENTS.length]!;
}
