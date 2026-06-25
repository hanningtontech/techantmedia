import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Upload } from "lucide-react";
import { AdminField } from "@/components/admin/shared/AdminField";
import { AdminPage } from "@/components/admin/shared/AdminPage";
import type { PhotoContract } from "@/lib/contracts/contractTypes";
import { contractHref } from "@/lib/contracts/contractTypes";
import { uploadContractPdf } from "@/lib/contracts/contractPdfUpload";
import {
  subscribeSignedContractSubmissions,
  updateSignedContractStatus,
} from "@/lib/contracts/signedContractFirestore";
import type { SignedContractSubmission } from "@/lib/contracts/signedContractTypes";
import { formatAuthOrFirestoreError } from "@/lib/authErrorMessage";
import { toast } from "sonner";

type Props = {
  contracts: PhotoContract[];
  onChangeContracts: (contracts: PhotoContract[]) => void;
  onSave: () => Promise<void>;
  busy: boolean;
};

export function ContractsAdminSection({ contracts, onChangeContracts, onSave, busy }: Props) {
  const [submissions, setSubmissions] = useState<SignedContractSubmission[]>([]);
  const [pdfBusySlug, setPdfBusySlug] = useState<string | null>(null);
  const pdfInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    return subscribeSignedContractSubmissions(setSubmissions) ?? undefined;
  }, []);

  const updateContract = (slug: PhotoContract["slug"], patch: Partial<PhotoContract>) => {
    onChangeContracts(contracts.map((c) => (c.slug === slug ? { ...c, ...patch } : c)));
  };

  const markReviewed = async (id: string) => {
    try {
      await updateSignedContractStatus(id, "reviewed");
      toast.success("Marked as reviewed.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    }
  };

  const onPdfPick = async (slug: PhotoContract["slug"], file: File | null) => {
    if (!file) return;
    setPdfBusySlug(slug);
    try {
      const { downloadUrl } = await uploadContractPdf(slug, file);
      updateContract(slug, { downloadPdfUrl: downloadUrl });
      toast.success("PDF uploaded. Save contracts to publish.");
    } catch (e) {
      toast.error(formatAuthOrFirestoreError(e));
    } finally {
      setPdfBusySlug(null);
      const input = pdfInputRefs.current[slug];
      if (input) input.value = "";
    }
  };

  return (
    <AdminPage
      title="Contracts & releases"
      description="Edit contract copy (Markdown with fill-in lines using underscores). Upload an official PDF for clients to download, or they can print the on-page version."
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSave()}
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save contracts"}
        </button>
      }
    >
      <div className="space-y-8">
        {contracts.map((c) => (
          <div key={c.slug} className="admin-panel space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">{c.title}</h3>
              <a
                href={contractHref(c.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-orange-400 hover:underline"
              >
                View live <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <AdminField label="Page title">
              <input
                className="admin-input"
                value={c.title}
                onChange={(e) => updateContract(c.slug, { title: e.target.value })}
              />
            </AdminField>
            <AdminField label="Short label (buttons)">
              <input
                className="admin-input"
                value={c.shortLabel}
                onChange={(e) => updateContract(c.slug, { shortLabel: e.target.value })}
              />
            </AdminField>
            <AdminField label="Summary">
              <textarea
                className="admin-input min-h-[4rem]"
                value={c.description}
                onChange={(e) => updateContract(c.slug, { description: e.target.value })}
              />
            </AdminField>
            <AdminField
              label="Downloadable PDF (optional)"
              hint="Clients get this file when they tap Download PDF. Leave empty to use print-to-PDF from the on-page contract."
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={(el) => {
                    pdfInputRefs.current[c.slug] = el;
                  }}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="sr-only"
                  onChange={(e) => void onPdfPick(c.slug, e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  disabled={pdfBusySlug === c.slug}
                  onClick={() => pdfInputRefs.current[c.slug]?.click()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50"
                >
                  {pdfBusySlug === c.slug ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload PDF
                </button>
                {c.downloadPdfUrl?.trim() ? (
                  <>
                    <a
                      href={c.downloadPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-orange-400 hover:underline"
                    >
                      View current PDF
                    </a>
                    <button
                      type="button"
                      onClick={() => updateContract(c.slug, { downloadPdfUrl: "" })}
                      className="text-sm text-zinc-500 hover:text-red-400"
                    >
                      Remove PDF
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-zinc-500">No PDF uploaded</span>
                )}
              </div>
            </AdminField>
            <AdminField
              label="Contract body (Markdown)"
              hint="Use ## headings and underscore lines (________) for fill-in gaps when printing."
            >
              <textarea
                className="admin-input min-h-[280px] font-mono text-sm"
                value={c.markdown}
                onChange={(e) => updateContract(c.slug, { markdown: e.target.value })}
              />
            </AdminField>
          </div>
        ))}

        <div className="admin-panel p-5">
          <h3 className="text-lg font-semibold text-white">Signed uploads from clients</h3>
          <p className="mt-1 text-sm text-zinc-500">PDF or image scans returned after clients sign.</p>
          {submissions.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No signed contracts uploaded yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/10">
              {submissions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100">{s.clientName || s.clientEmail}</p>
                    <p className="text-sm text-zinc-500">
                      {s.contractTitle} · {s.fileName}
                      {s.uploadedAt ? ` · ${new Date(s.uploadedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={s.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5"
                    >
                      Download
                    </a>
                    {s.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => void markReviewed(s.id)}
                        className="rounded-full bg-teal-500/20 px-3 py-1.5 text-xs font-semibold text-teal-300"
                      >
                        Mark reviewed
                      </button>
                    ) : (
                      <span className="text-xs text-teal-400">Reviewed</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
