import { doc, getDoc } from "firebase/firestore";
import { tryGetFirestoreDb } from "@/lib/firebase";

/** TechantMedia Firebase Auth UIDs that must appear in block-game player admin data. */
export const KNOWN_BLOCK_GAME_PLAYER_UIDS = [
  "LbPKs5K2bugTnyLmbzRdn28ti103",
  "j4JnX8GqkJgNRlXV3L9Bu3BZGfE2",
  "iQeyooKvyJa9t5v3JKq6DIOo4K22",
  "E8y8QtZakFOWSpe53ZVPejgJTDy1",
] as const;

export interface TechantMediaUserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAtMs: number;
}

export function displayNameFromUserDoc(data: Record<string, unknown>): string {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const username = typeof data.username === "string" ? data.username.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  if (name) return name;
  if (username) return username;
  if (email) {
    const local = email.split("@")[0]?.trim();
    return local || email;
  }
  return "";
}

function createdAtMsFromUserDoc(data: Record<string, unknown>): number {
  const created = data.createdAt;
  if (created && typeof created === "object" && "toMillis" in created) {
    return (created as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function parseTechantMediaUserDoc(
  uid: string,
  data: Record<string, unknown>,
): TechantMediaUserProfile {
  const email = typeof data.email === "string" ? data.email.trim() : "";
  return {
    uid,
    email,
    displayName: displayNameFromUserDoc(data),
    createdAtMs: createdAtMsFromUserDoc(data),
  };
}

/** Load the shared TechantMedia `users/{uid}` profile (same account as site sign-in). */
export async function fetchTechantMediaUserProfile(
  uid: string,
): Promise<TechantMediaUserProfile | null> {
  const db = tryGetFirestoreDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return parseTechantMediaUserDoc(uid, snap.data());
}
