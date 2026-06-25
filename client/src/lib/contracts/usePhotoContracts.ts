import { useMemo } from "react";
import { useSiteContent } from "@/contexts/SiteContentContext";
import type { PhotoContract, PhotoContractSlug } from "@/lib/contracts/contractTypes";
import { DEFAULT_PHOTO_CONTRACTS } from "@/lib/contracts/defaultContracts";

export function usePhotoContracts(): PhotoContract[] {
  const { content } = useSiteContent();
  return useMemo(() => {
    return content.photoContracts?.length ? content.photoContracts : DEFAULT_PHOTO_CONTRACTS;
  }, [content.photoContracts]);
}

export function usePhotoContract(slug: PhotoContractSlug): PhotoContract | undefined {
  const contracts = usePhotoContracts();
  return useMemo(() => contracts.find((c) => c.slug === slug), [contracts, slug]);
}
