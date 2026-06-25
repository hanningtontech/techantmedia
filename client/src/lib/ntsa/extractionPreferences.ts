import type { DocumentTypeId, ExtractionFieldId } from "@shared/documentExtraction";
import { defaultSessionMeta, sanitizeEnabledFields } from "@shared/documentExtraction";

export type ExtractionTypePrefs = {
  enabledFields: ExtractionFieldId[];
  confirmedAt: string;
};

export type ExtractionPreferences = Partial<Record<DocumentTypeId, ExtractionTypePrefs>>;

function prefsKey(userId: string): string {
  return `extraction_field_prefs_${userId}`;
}

export function loadExtractionPreferences(userId: string): ExtractionPreferences {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (!raw) return {};
    return JSON.parse(raw) as ExtractionPreferences;
  } catch {
    return {};
  }
}

export function saveExtractionPreferences(
  userId: string,
  type: DocumentTypeId,
  enabledFields: ExtractionFieldId[],
): void {
  const current = loadExtractionPreferences(userId);
  const next: ExtractionPreferences = {
    ...current,
    [type]: {
      enabledFields: sanitizeEnabledFields(type, enabledFields),
      confirmedAt: new Date().toISOString(),
    },
  };
  try {
    localStorage.setItem(prefsKey(userId), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function getSavedEnabledFields(
  userId: string,
  type: DocumentTypeId,
): ExtractionFieldId[] | null {
  const prefs = loadExtractionPreferences(userId)[type];
  if (!prefs?.enabledFields?.length) return null;
  return sanitizeEnabledFields(type, prefs.enabledFields);
}

export function hasConfirmedPrefs(userId: string, type: DocumentTypeId): boolean {
  return Boolean(loadExtractionPreferences(userId)[type]?.confirmedAt);
}

export function resolveSessionMetaFromPrefs(
  userId: string,
  type: DocumentTypeId,
  forcePrompt = false,
): { meta: ReturnType<typeof defaultSessionMeta>; needsConfirmation: boolean } {
  const saved = getSavedEnabledFields(userId, type);
  const confirmed = hasConfirmedPrefs(userId, type);

  if (!forcePrompt && saved && confirmed) {
    return {
      meta: { documentType: type, enabledFields: saved },
      needsConfirmation: false,
    };
  }

  return {
    meta: saved
      ? { documentType: type, enabledFields: saved }
      : defaultSessionMeta(type),
    needsConfirmation: true,
  };
}
