import { Link, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { ContractDocumentView } from "@/components/tech-media/photography/contracts/ContractDocumentView";
import { contractIndexHref } from "@/lib/contracts/contractTypes";
import type { PhotoContractSlug } from "@/lib/contracts/contractTypes";
import { PHOTO_CONTRACT_SLUGS } from "@/lib/contracts/contractTypes";
import { usePhotoContract } from "@/lib/contracts/usePhotoContracts";
import "@/styles/photo-contracts.css";

export default function ContractSlugPage() {
  const [, params] = useRoute("/photography/contracts/:slug");
  const slug = (params?.slug ?? "") as PhotoContractSlug;
  const contract = usePhotoContract(PHOTO_CONTRACT_SLUGS.includes(slug) ? slug : "photography-videography");

  if (!contract) {
    return (
      <TechMediaLayout fullBleedMain>
        <p className="p-10 text-center text-zinc-400">Contract not found.</p>
      </TechMediaLayout>
    );
  }

  return (
    <TechMediaLayout fullBleedMain>
      <div className="photo-contracts-route">
        <header className="photo-contracts-header photo-contract-no-print border-b border-white/10 bg-[#08080c]/90">
          <div className="flex flex-wrap items-center gap-3 px-3 py-4 sm:px-6">
            <Link
              href={contractIndexHref()}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              All contracts
            </Link>
            <h1 className="text-base font-bold text-white sm:text-lg">{contract.title}</h1>
          </div>
        </header>
        <main className="photo-contracts-main">
          <p className="photo-contracts-intro photo-contract-no-print px-3 pb-3 text-xs text-zinc-500 sm:px-6 sm:text-sm">
            {contract.description}
          </p>
          <ContractDocumentView contract={contract} />
        </main>
      </div>
    </TechMediaLayout>
  );
}
