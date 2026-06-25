import type { ReactNode } from "react";
import { Link } from "wouter";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
};

/** In-app link — all routes are served from techantmedia.com. */
export function PrivateLink({ href, className, children }: Props) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
