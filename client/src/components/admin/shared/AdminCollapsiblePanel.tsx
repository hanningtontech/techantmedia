import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { ListItemAccent } from "@/lib/admin/listItemAccent";
import { LIST_ITEM_ACCENT_CLASS } from "@/lib/admin/listItemAccent";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: string;
  accent?: ListItemAccent;
  children: ReactNode;
};

export function AdminCollapsiblePanel({
  title,
  subtitle,
  defaultOpen = false,
  badge,
  accent,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const accentStyles = accent ? LIST_ITEM_ACCENT_CLASS[accent] : null;

  return (
    <div
      className={cn(
        "admin-panel overflow-hidden",
        accentStyles && ["border ring-1", accentStyles.wrap],
      )}
    >
      <button type="button" className="admin-panel-header" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="min-w-0 text-left">
          <span className={cn("block truncate", accentStyles?.header)}>{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs font-normal text-zinc-500">{subtitle}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                accentStyles?.badge ?? "bg-orange-500/20 text-orange-300 ring-orange-500/35",
              )}
            >
              {badge}
            </span>
          ) : null}
          <ChevronDown className={cn("h-5 w-5 text-zinc-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open ? <div className="admin-panel-body">{children}</div> : null}
    </div>
  );
}
