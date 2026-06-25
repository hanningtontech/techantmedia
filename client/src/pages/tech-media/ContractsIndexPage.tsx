import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { ContractsListContent } from "@/components/tech-media/photography/contracts/ContractsListContent";
import "@/styles/photo-contracts.css";

export default function ContractsIndexPage() {
  return (
    <TechMediaLayout fullBleedMain>
      <div className="photo-contracts-route">
        <header className="photo-contracts-header border-b border-white/10 bg-[#08080c]/90">
          <div className="flex flex-wrap items-center gap-3 px-3 py-4 sm:px-6">
            <Link
              href="/photography"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Photography
            </Link>
            <h1 className="text-lg font-bold text-white sm:text-xl">Contracts & releases</h1>
          </div>
        </header>
        <ContractsListContent />
      </div>
    </TechMediaLayout>
  );
}
