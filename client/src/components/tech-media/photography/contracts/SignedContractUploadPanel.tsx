import { useRef, useState } from "react";
import { Link } from "wouter";
import { Loader2, Upload } from "lucide-react";
import { useFirebaseAuth, isClient } from "@/contexts/FirebaseAuthContext";
import type { PhotoContract } from "@/lib/contracts/contractTypes";
import { createSignedContractSubmission } from "@/lib/contracts/signedContractFirestore";
import { uploadSignedContractFile } from "@/lib/contracts/signedContractUpload";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";

type Props = {
  contract: PhotoContract;
};

export function SignedContractUploadPanel({ contract }: Props) {
  const { user, profile, loading } = useFirebaseAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  const canUpload = isClient(profile) && user;

  const onPick = async (file: File | null) => {
    if (!file || !user) return;
    setBusy(true);
    setPct(0);
    try {
      const { downloadUrl, fileName } = await uploadSignedContractFile(file, setPct);
      await createSignedContractSubmission({
        clientId: user.uid,
        clientEmail: user.email ?? profile?.email ?? "",
        clientName: profile?.name ?? user.displayName ?? "",
        contractSlug: contract.slug,
        contractTitle: contract.title,
        fileName,
        downloadUrl,
      });
      toast.success("Signed contract uploaded. We will review it shortly.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setBusy(false);
      setPct(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (loading) return null;

  return (
    <section className="photo-contract-no-print mx-3 mt-8 rounded-2xl border border-teal-500/25 bg-teal-500/5 p-4 sm:mx-0 sm:mt-10 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Return signed copy</h2>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
        Download and sign this contract, then upload the signed PDF or a clear photo scan. Our team will be notified.
      </p>

      {canUpload ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
            className="sr-only"
            onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-5 py-2.5 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? `Uploading ${pct}%` : "Upload signed contract"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-300">
          <Link href="/photography/account" className="font-semibold text-teal-400 hover:underline">
            Sign in with your client account
          </Link>{" "}
          to upload a signed copy.
        </p>
      )}
    </section>
  );
}
