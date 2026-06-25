import type { AdminFeatureScope } from "@/lib/admin/adminPermissions";
import { ADMIN_SCOPE_OPTIONS } from "@/lib/admin/adminPermissions";
import { cn } from "@/lib/utils";

type Props = {
  value: AdminFeatureScope[];
  onChange: (scopes: AdminFeatureScope[]) => void;
  disabled?: boolean;
};

export function AdminScopeCheckboxes({ value, onChange, disabled }: Props) {
  const toggle = (scope: AdminFeatureScope) => {
    if (disabled) return;
    if (value.includes(scope)) {
      onChange(value.filter((s) => s !== scope));
    } else {
      onChange([...value, scope]);
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ADMIN_SCOPE_OPTIONS.map((opt) => {
        const checked = value.includes(opt.id);
        return (
          <label
            key={opt.id}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
              checked ? "border-teal-500/40 bg-teal-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/20",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-teal-500"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(opt.id)}
            />
            <span>
              <span className="block text-sm font-medium text-zinc-100">{opt.label}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">{opt.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
