/** Scroll the document to the top (use on route or tab changes). */
export function scrollPageToTop(behavior: ScrollBehavior = "instant") {
  window.scrollTo({ top: 0, left: 0, behavior });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
