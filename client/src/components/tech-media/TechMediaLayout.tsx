import type { ReactNode } from "react";
import "@/styles/tech-media.css";
import { TechMediaNav } from "./TechMediaNav";
import { TechMediaFooter } from "./TechMediaFooter";

export function TechMediaLayout({
  children,
  fullBleedMain = false,
  hideChrome = false,
}: {
  children: ReactNode;
  fullBleedMain?: boolean;
  hideChrome?: boolean;
}) {
  return (
    <div className="tech-media-root flex min-h-screen flex-col">
      {!hideChrome && <TechMediaNav />}
      <main className={fullBleedMain ? "flex-1 w-full overflow-x-hidden" : "flex-1 overflow-x-hidden"}>{children}</main>
      {!hideChrome && <TechMediaFooter />}
    </div>
  );
}
