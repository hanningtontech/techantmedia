import { useEffect } from "react";
import { useLocation } from "wouter";
import { scrollPageToTop } from "@/lib/scrollToTop";

/** Resets scroll position whenever the wouter route changes. */
export function ScrollToTopOnNavigate() {
  const [location] = useLocation();

  useEffect(() => {
    scrollPageToTop("instant");
  }, [location]);

  return null;
}
