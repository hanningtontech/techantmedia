import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { PageSeo } from "@/components/seo/PageSeo";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { BlockGamePlayerProvider, useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { GameAuthGate } from "./components/GameAuthGate";
import { GamePlayLayout } from "./components/GamePlayLayout";
import { TargetCelebrationOverlay } from "./components/TargetCelebrationOverlay";

function GamePlayShell() {
  const { targetCelebration, dismissTargetCelebration, resetAfterRound } = useBlockGamePlayer();

  const handleCelebrationReset = () => {
    resetAfterRound();
  };

  return (
    <>
      <GamePlayLayout />
      {targetCelebration && (
        <TargetCelebrationOverlay
          owedAmount={targetCelebration.owedAmount}
          targetBalance={targetCelebration.targetBalance}
          onDismiss={dismissTargetCelebration}
          onReset={handleCelebrationReset}
        />
      )}
    </>
  );
}

function GamePlayRoot() {
  const { user } = useFirebaseAuth();
  if (!user) return null;

  return (
    <BlockGamePlayerProvider
      uid={user.uid}
      userEmail={user.email ?? ""}
      userName={user.displayName ?? user.email ?? "Player"}
    >
      <GamePlayShell />
    </BlockGamePlayerProvider>
  );
}

export default function BlockGamePage() {
  return (
    <TechMediaLayout fullBleedMain hideChrome>
      <PageSeo
        config={{
          title: "Block Game | TechantMedia",
          description: "Play the block reveal game with KES wallet, fair multipliers, and live session charts.",
          path: "/game",
        }}
      />
      <div className="flex min-h-svh w-full flex-col bg-[#06060a] text-zinc-100">
        <GameAuthGate>
          <GamePlayRoot />
        </GameAuthGate>
      </div>
    </TechMediaLayout>
  );
}
