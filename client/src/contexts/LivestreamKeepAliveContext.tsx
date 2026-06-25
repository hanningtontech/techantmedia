import { createContext, useContext, type ReactNode } from "react";
import { useLivestreamKeepAlive } from "@/lib/livestream/useLivestreamKeepAlive";

type LivestreamKeepAliveContextValue = ReturnType<typeof useLivestreamKeepAlive>;

const LivestreamKeepAliveContext = createContext<LivestreamKeepAliveContextValue | null>(null);

export function LivestreamKeepAliveProvider({ children }: { children: ReactNode }) {
  const value = useLivestreamKeepAlive();
  return <LivestreamKeepAliveContext.Provider value={value}>{children}</LivestreamKeepAliveContext.Provider>;
}

export function useOptionalLivestreamKeepAlive(): LivestreamKeepAliveContextValue | null {
  return useContext(LivestreamKeepAliveContext);
}

export function useLivestreamKeepAliveContext(): LivestreamKeepAliveContextValue {
  const ctx = useOptionalLivestreamKeepAlive();
  if (!ctx) {
    throw new Error("useLivestreamKeepAliveContext must be used within LivestreamKeepAliveProvider");
  }
  return ctx;
}
