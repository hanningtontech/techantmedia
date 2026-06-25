import { collection, onSnapshot, orderBy, query, where, type Unsubscribe } from "firebase/firestore";
import { apiFetch } from "@/lib/api/authenticatedFetch";
import { tryGetFirebaseAuth, tryGetFirestoreDb } from "@/lib/firebase";
import type { PhotoContractSlug } from "@/lib/contracts/contractTypes";
import type { SignedContractSubmission, SignedContractStatus } from "@/lib/contracts/signedContractTypes";

const COL = "signedContractSubmissions";

function parseSubmission(id: string, raw: Record<string, unknown>): SignedContractSubmission {
  const uploadedAt = raw.uploadedAt;
  let uploadedAtStr: string | null = null;
  if (uploadedAt && typeof uploadedAt === "object" && "toDate" in uploadedAt) {
    try {
      uploadedAtStr = (uploadedAt as { toDate: () => Date }).toDate().toISOString();
    } catch {
      uploadedAtStr = null;
    }
  } else if (typeof uploadedAt === "string") {
    uploadedAtStr = uploadedAt;
  }
  return {
    id,
    clientId: String(raw.clientId ?? ""),
    clientEmail: String(raw.clientEmail ?? ""),
    clientName: String(raw.clientName ?? ""),
    contractSlug: (String(raw.contractSlug ?? "") as PhotoContractSlug) || "photography-videography",
    contractTitle: String(raw.contractTitle ?? ""),
    fileName: String(raw.fileName ?? "signed-contract.pdf"),
    downloadUrl: String(raw.downloadUrl ?? ""),
    status: raw.status === "reviewed" ? "reviewed" : "pending",
    uploadedAt: uploadedAtStr,
  };
}

export async function createSignedContractSubmission(args: {
  clientId: string;
  clientEmail: string;
  clientName: string;
  contractSlug: PhotoContractSlug;
  contractTitle: string;
  fileName: string;
  downloadUrl: string;
}): Promise<string> {
  const auth = tryGetFirebaseAuth();
  if (!auth?.currentUser) throw new Error("Not signed in");
  const res = await apiFetch("/api/signed-contracts", {
    method: "POST",
    body: JSON.stringify(args),
  });
  const data = (await res.json()) as { id?: string };
  return data.id ?? "";
}

export function subscribeSignedContractSubmissions(
  onData: (rows: SignedContractSubmission[]) => void,
  opts?: { clientId?: string },
): Unsubscribe | null {
  const db = tryGetFirestoreDb();
  if (!db) {
    onData([]);
    return null;
  }
  const q = opts?.clientId
    ? query(collection(db, COL), where("clientId", "==", opts.clientId), orderBy("uploadedAt", "desc"))
    : query(collection(db, COL), orderBy("uploadedAt", "desc"));
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => parseSubmission(d.id, d.data() as Record<string, unknown>)));
  });
}

export async function updateSignedContractStatus(id: string, status: SignedContractStatus): Promise<void> {
  await apiFetch(`/api/signed-contracts/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
