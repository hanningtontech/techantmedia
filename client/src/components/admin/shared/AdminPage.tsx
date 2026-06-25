import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminLayoutGuide } from "./AdminLayoutGuide";

export type AdminPageWidth = "compact" | "standard" | "wide" | "editor";
/** `split` = two columns at 1500px+ for top-level section cards */
export type AdminPageLayout = "stack" | "split";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Centered column width — default compact forms */
  width?: AdminPageWidth;
  layout?: AdminPageLayout;
  showLayoutGuide?: boolean;
  children: ReactNode;
};

const widthClass: Record<AdminPageWidth, string> = {
  compact: "admin-content-constrained--compact",
  standard: "admin-content-constrained",
  wide: "admin-content-constrained--wide",
  editor: "admin-content-constrained--editor",
};

export function AdminPage({
  title,
  description,
  actions,
  width = "compact",
  layout = "stack",
  showLayoutGuide = true,
  children,
}: Props) {
  return (
    <div className="admin-page">
      <div className={cn("admin-content-constrained", widthClass[width])}>
        <header className="admin-page-header flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="admin-page-title">{title}</h2>
            {description ? <p className="admin-page-desc">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </header>

        {showLayoutGuide ? <AdminLayoutGuide /> : null}

        <div className={cn(layout === "split" ? "admin-layout-split" : "admin-stack")}>{children}</div>
      </div>
    </div>
  );
}
