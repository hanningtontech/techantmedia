import type { ExpertiseColor } from "./portfolioTypes";

export const expertiseCardClass: Record<ExpertiseColor, { card: string; title: string; dot: string }> = {
  orange: {
    card: "bg-gradient-to-br from-orange-50 to-orange-100",
    title: "text-orange-600",
    dot: "bg-orange-600",
  },
  blue: {
    card: "bg-gradient-to-br from-blue-50 to-blue-100",
    title: "text-blue-600",
    dot: "bg-blue-600",
  },
  green: {
    card: "bg-gradient-to-br from-green-50 to-green-100",
    title: "text-green-600",
    dot: "bg-green-600",
  },
};

export const educationCardClass = {
  slate: "bg-gradient-to-br from-slate-50 to-slate-100",
  orange: "bg-gradient-to-br from-orange-50 to-orange-100",
} as const;
