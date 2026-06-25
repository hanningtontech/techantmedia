import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Responsive page width: full width on phones, progressively wider on large displays. */
export const XAI_PAGE_CONTAINER_CLASS =
  "xai-container mx-auto w-full max-w-full px-2.5 sm:px-6 md:px-8 lg:max-w-6xl lg:px-10 xl:max-w-7xl 2xl:max-w-[90rem] 2xl:px-12";

type Props = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
};

export function XaiPageContainer({ children, className, as: Tag = "div" }: Props) {
  const Component = Tag === "section" ? "section" : "div";
  return <Component className={cn(XAI_PAGE_CONTAINER_CLASS, className)}>{children}</Component>;
}
