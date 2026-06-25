import { Link } from "wouter";
import { ChevronRight, FileText } from "lucide-react";
import { contractHref } from "@/lib/contracts/contractTypes";
import { usePhotoContracts } from "@/lib/contracts/usePhotoContracts";

type Props = {
  embedded?: boolean;
};

export function ContractsListContent({ embedded = false }: Props) {
  const contracts = usePhotoContracts();

  return (
    <section
      className={
        embedded
          ? "photo-contracts-list mx-auto max-w-3xl px-3 py-8 sm:px-6"
          : "photo-contracts-list mx-auto max-w-3xl px-3 py-8 sm:px-6 sm:py-12"
      }
    >
      <p className="text-xs text-zinc-400 leading-relaxed sm:text-sm">
        Review, download, and return signed copies for photography, videography, and model releases. Client account
        holders can upload signed documents from each contract page.
      </p>
      <ul className="mt-8 space-y-4">
        {contracts.map((c) => (
          <li key={c.slug}>
            <Link
              href={contractHref(c.slug)}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#12121a] p-5 transition hover:border-orange-500/40 hover:bg-orange-500/5"
            >
              <span className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-white group-hover:text-orange-100">{c.title}</span>
                  <span className="mt-1 block text-sm text-zinc-500">{c.description}</span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500 group-hover:text-orange-300" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
