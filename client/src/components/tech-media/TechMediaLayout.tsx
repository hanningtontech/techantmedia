import type { ReactNode } from "react";
import "@/styles/tech-media.css";
import { TechMediaNav } from "./TechMediaNav";
import { TechMediaFooter } from "./TechMediaFooter";

export function TechMediaLayout({
  children,
  fullBleedMain = false,
}: {
  children: ReactNode;
  fullBleedMain?: boolean;
}) {
  return (
    <div className="tech-media-root flex min-h-screen flex-col">
      <TechMediaNav />
      <main className={fullBleedMain ? "flex-1 w-full overflow-x-hidden" : "flex-1"}>{children}</main>
      <TechMediaFooter />
    </div>
  );
}
