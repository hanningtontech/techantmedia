/**
 * Detects stems that should allow multiple selections (SATA-style).
 * Tutors can also set `allowMultipleAnswers` on the question document.
 */

export const SATA_STEM_REGEX =
  /select\s+all\s+that\s+apply|select\s+all\s+answers|choose\s+all\s+that\s+apply|select\s+all\s+options\s+that|which\s+of\s+the\s+following.+(select\s+all|choose\s+all)/i;

export function questionTextSuggestsMultipleAnswers(questionText: string): boolean {
  return SATA_STEM_REGEX.test(questionText.trim());
}
