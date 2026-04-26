/** Map Firebase Auth / Firestore client errors to short, actionable text. */
export function formatAuthOrFirestoreError(err: unknown): string {
  if (!err || typeof err !== "object") return "Something went wrong. Try again.";
  const e = err as { code?: string; message?: string };
  const code = e.code ?? "";
  const msg = typeof e.message === "string" ? e.message : "";

  const byCode: Record<string, string> = {
    "auth/invalid-email": "That email address is not valid.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found for that email. Use Sign up first.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "That email is already registered. Try Sign in.",
    "auth/weak-password": "Password is too weak. Use at least 6 characters.",
    "auth/operation-not-allowed": "This sign-in method is disabled in Firebase. Enable Email/Password or Google under Authentication → Sign-in method.",
    "auth/unauthorized-domain": "This site’s domain is not allowed. In Firebase Console → Authentication → Settings → Authorized domains, add localhost (and your live domain, e.g. hanningtonkutria-portfolio.web.app).",
    "auth/popup-blocked": "The browser blocked the sign-in popup. Allow popups for this site or try again.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "permission-denied": "Firestore blocked the request. Check Firestore rules and that Authentication is enabled for this project.",
  };

  if (code && byCode[code]) return byCode[code];
  if (code) return `${code.replace("auth/", "").replaceAll("-", " ")}${msg ? `: ${msg}` : ""}`;
  return msg || "Something went wrong. Try again.";
}
