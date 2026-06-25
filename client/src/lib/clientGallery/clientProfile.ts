export const CLIENT_SIGNUP_PENDING_KEY = "clientSignupPending";

export type ClientSignupPending = {
  username: string;
  phoneNumber: string;
  displayName?: string;
};

export function setClientSignupPending(data: ClientSignupPending): void {
  sessionStorage.setItem(CLIENT_SIGNUP_PENDING_KEY, JSON.stringify(data));
}

export function readClientSignupPending(): ClientSignupPending | null {
  try {
    const raw = sessionStorage.getItem(CLIENT_SIGNUP_PENDING_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as ClientSignupPending;
    if (!o.username?.trim() || !o.phoneNumber?.trim()) return null;
    return o;
  } catch {
    return null;
  }
}

export function clearClientSignupPending(): void {
  sessionStorage.removeItem(CLIENT_SIGNUP_PENDING_KEY);
}
