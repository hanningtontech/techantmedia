/** Full rate card tab on the photography page. */
export const RATE_CARDS_PAGE_HREF = "/photography?panel=rates";

/** Navigate to the rate card page (use with wouter `navigate`). */
export function goToRateCardsPage(navigate: (to: string) => void): void {
  navigate(RATE_CARDS_PAGE_HREF);
}

/** Photography / videography storefront paths (rate card, packages, gallery). */
export function isPhotographyMediaPath(pathname: string): boolean {
  return (
    pathname === "/photography" ||
    pathname.startsWith("/photography/") ||
    pathname === "/inspos" ||
    pathname.startsWith("/inspos/")
  );
}
