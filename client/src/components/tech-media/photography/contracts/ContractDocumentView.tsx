import { Download, ExternalLink, Printer } from "lucide-react";
import type { PhotoContract } from "@/lib/contracts/contractTypes";
import { CONTRACT_LOGO_URL } from "@/lib/contracts/contractMarkdownUtils";
import { ContractMarkdown } from "@/components/tech-media/photography/contracts/ContractMarkdown";
import { SignedContractUploadPanel } from "@/components/tech-media/photography/contracts/SignedContractUploadPanel";
import "@/styles/photo-contracts.css";

type Props = {
  contract: PhotoContract;
};

function printContract() {
  window.print();
}

export function ContractDocumentView({ contract }: Props) {
  const year = new Date().getFullYear();
  const officialPdf = contract.downloadPdfUrl?.trim() ?? "";

  return (
    <article className="photo-contract-page">
      <div className="photo-contract-no-print mb-4 flex flex-wrap gap-2 sm:mb-6">
        {officialPdf ? (
          <a
            href={officialPdf}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/20"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        ) : (
          <button
            type="button"
            onClick={printContract}
            className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/20"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        )}
        <button
          type="button"
          onClick={printContract}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        {officialPdf ? (
          <a
            href={officialPdf}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Open PDF
          </a>
        ) : null}
      </div>

      {officialPdf ? (
        <p className="photo-contract-no-print mb-4 px-0 text-xs text-zinc-500 sm:text-sm">
          Official PDF template is available above. You can also print the on-page version below with fill-in lines.
        </p>
      ) : (
        <p className="photo-contract-no-print mb-4 px-0 text-xs text-zinc-500 sm:text-sm">
          Use Download PDF or Print — choose &quot;Save as PDF&quot; in your browser. Fill-in lines are included for signing.
        </p>
      )}

      <div className="photo-contract-document">
        <header className="photo-contract-brand-header">
          <img
            src={CONTRACT_LOGO_URL}
            alt="TechantMedia"
            className="photo-contract-brand-logo"
            width={120}
            height={120}
          />
          <div className="photo-contract-brand-titles">
            <p className="photo-contract-brand-name">TechantMedia</p>
            <h1 className="photo-contract-doc-title">{contract.title}</h1>
          </div>
        </header>

        <div className="photo-contract-body">
          <ContractMarkdown markdown={contract.markdown} />
        </div>

        <footer className="photo-contract-doc-footer">
          © {year} TechantMedia. All rights reserved.
        </footer>
      </div>

      <SignedContractUploadPanel contract={contract} />
    </article>
  );
}
