import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { cn } from "@/lib/utils";

function firstName(displayName: string | null | undefined): string {
  if (!displayName?.trim()) return "";
  return displayName.trim().split(/\s+/)[0] ?? "";
}

/** Small italic greeting shown above the game board. */
export function GameSalutation({ className }: { className?: string }) {
  const { user, profile } = useFirebaseAuth();
  const name = firstName(profile?.name ?? user?.displayName);
  if (!name) return null;

  return (
    <p className={cn("text-[10px] italic leading-snug text-zinc-500", className)}>
      Best of luck, {name}.
    </p>
  );
}
