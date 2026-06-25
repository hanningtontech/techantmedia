import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createInspoBoard,
  type InspoPhoto,
  inspoShareUrl,
} from "@/lib/portfolio/inspoBoards";

const STORAGE_KEY = "hannington-inspo-v1";

type InspoCtx = {
  photos: InspoPhoto[];
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (photo: InspoPhoto) => void;
  remove: (id: string) => void;
  clear: () => void;
  publishShare: (opts?: { clientName?: string; note?: string }) => Promise<string>;
};

const InspoContext = createContext<InspoCtx | null>(null);

function loadStored(): InspoPhoto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InspoPhoto[];
    return Array.isArray(parsed) ? parsed.filter((p) => p?.src) : [];
  } catch {
    return [];
  }
}

export function InspoProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<InspoPhoto[]>(loadStored);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  }, [photos]);

  const isSelected = useCallback((id: string) => photos.some((p) => p.id === id), [photos]);

  const toggle = useCallback((photo: InspoPhoto) => {
    setPhotos((prev) => {
      const exists = prev.some((p) => p.id === photo.id);
      if (exists) return prev.filter((p) => p.id !== photo.id);
      return [...prev, photo];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => setPhotos([]), []);

  const publishShare = useCallback(
    async (opts?: { clientName?: string; note?: string }) => {
      const id = await createInspoBoard({
        photos,
        clientName: opts?.clientName,
        note: opts?.note,
      });
      return inspoShareUrl(id);
    },
    [photos],
  );

  const value = useMemo(
    () => ({
      photos,
      count: photos.length,
      isSelected,
      toggle,
      remove,
      clear,
      publishShare,
    }),
    [photos, isSelected, toggle, remove, clear, publishShare],
  );

  return <InspoContext.Provider value={value}>{children}</InspoContext.Provider>;
}

export function useInspo() {
  const ctx = useContext(InspoContext);
  if (!ctx) throw new Error("useInspo must be used within InspoProvider");
  return ctx;
}

export function useInspoOptional() {
  return useContext(InspoContext);
}
