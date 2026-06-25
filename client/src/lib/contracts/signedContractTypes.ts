import type { PhotoContractSlug } from "@/lib/contracts/contractTypes";

export type SignedContractStatus = "pending" | "reviewed";

export interface SignedContractSubmission {
  id: string;
  clientId: string;
  clientEmail: string;
  clientName: string;
  contractSlug: PhotoContractSlug;
  contractTitle: string;
  fileName: string;
  downloadUrl: string;
  status: SignedContractStatus;
  uploadedAt: string | null;
}
