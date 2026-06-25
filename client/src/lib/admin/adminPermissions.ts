import { ADMIN_NAV_GROUPS, isSuperAdminEmail, type AdminNavId } from "@/lib/admin/constants";

/** Feature areas the super admin can grant to other admins. */
export type AdminFeatureScope = "development" | "xai" | "photography" | "tutoring" | "settings";

export const ALL_ADMIN_SCOPES: AdminFeatureScope[] = [
  "development",
  "xai",
  "photography",
  "tutoring",
  "settings",
];

export const ADMIN_SCOPE_OPTIONS: {
  id: AdminFeatureScope;
  label: string;
  description: string;
}[] = [
  { id: "development", label: "Development", description: "My story, projects, skills, and dev page copy" },
  { id: "xai", label: "xAI video portfolio", description: "Profile, case studies, CV, and portfolio media" },
  { id: "photography", label: "Photography", description: "Galleries, clients, rates, and booking" },
  { id: "tutoring", label: "Tutoring", description: "NCLEX tutoring content and sessions" },
  { id: "settings", label: "Settings", description: "Reserved for future site settings (owner manages admin accounts)" },
];

const NAV_GROUP_SCOPE: Record<string, AdminFeatureScope | "owner"> = {
  site: "owner",
  offpages: "owner",
  dev: "development",
  xai: "xai",
  photo: "photography",
  tutor: "tutoring",
  settings: "settings",
};

export type AdminAccessProfile = {
  role?: string;
  email?: string | null;
  isSuperAdmin?: boolean;
  adminScopes?: AdminFeatureScope[];
};

export function isProfileSuperAdmin(profile: AdminAccessProfile | null | undefined, email?: string | null): boolean {
  if (profile?.isSuperAdmin === true) return true;
  return isSuperAdminEmail(email ?? profile?.email);
}

export function parseAdminScopes(raw: unknown): AdminFeatureScope[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is AdminFeatureScope => ALL_ADMIN_SCOPES.includes(s as AdminFeatureScope));
}

/** Effective scopes for an admin user (owner always has all). */
export function resolveAdminScopes(profile: AdminAccessProfile | null | undefined, email?: string | null): AdminFeatureScope[] {
  if (profile?.role !== "admin") return [];
  if (isProfileSuperAdmin(profile, email)) return [...ALL_ADMIN_SCOPES];
  const parsed = parseAdminScopes(profile?.adminScopes);
  // Legacy admins created before scopes existed: full access until owner edits them.
  if (parsed.length === 0 && profile?.adminScopes === undefined) return [...ALL_ADMIN_SCOPES];
  return parsed;
}

export function hasAdminScope(
  profile: AdminAccessProfile | null | undefined,
  scope: AdminFeatureScope,
  email?: string | null,
): boolean {
  return resolveAdminScopes(profile, email).includes(scope);
}

export function canAccessNavId(
  navId: AdminNavId,
  profile: AdminAccessProfile | null | undefined,
  email?: string | null,
): boolean {
  if (profile?.role !== "admin") return false;
  if (navId === "settings.admins") return isProfileSuperAdmin(profile, email);
  if (navId.startsWith("site.") || navId.startsWith("offpages.")) return isProfileSuperAdmin(profile, email);
  const group = ADMIN_NAV_GROUPS.find((g) => g.items.some((i) => i.id === navId));
  if (!group) return false;
  const required = NAV_GROUP_SCOPE[group.id];
  if (required === "owner") return isProfileSuperAdmin(profile, email);
  return hasAdminScope(profile, required, email);
}

export function filterAdminNavGroups(profile: AdminAccessProfile | null | undefined, email?: string | null) {
  return ADMIN_NAV_GROUPS.map((group) => {
    const required = NAV_GROUP_SCOPE[group.id];
    if (required === "owner" && !isProfileSuperAdmin(profile, email)) return null;
    if (required !== "owner" && !hasAdminScope(profile, required, email)) return null;
    const items = group.items.filter((item) => canAccessNavId(item.id, profile, email));
    if (!items.length) return null;
    return { ...group, items };
  }).filter((g): g is NonNullable<typeof g> => g !== null);
}

export function defaultAdminSection(
  profile: AdminAccessProfile | null | undefined,
  email?: string | null,
  fallback: AdminNavId = "dev.projects",
): AdminNavId {
  const groups = filterAdminNavGroups(profile, email);
  const first = groups[0]?.items[0]?.id;
  if (first && canAccessNavId(first, profile, email)) return first;
  for (const g of ADMIN_NAV_GROUPS) {
    for (const item of g.items) {
      if (canAccessNavId(item.id, profile, email)) return item.id;
    }
  }
  return fallback;
}

export function scopeLabel(scope: AdminFeatureScope): string {
  return ADMIN_SCOPE_OPTIONS.find((o) => o.id === scope)?.label ?? scope;
}
