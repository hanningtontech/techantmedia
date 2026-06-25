import { Settings2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePhoneGameLayout } from "@/hooks/usePhoneGameLayout";
import { FundRequestDialog } from "./FundRequestDialog";
import { GridSettingsContent } from "./GridSettingsContent";
import { PhoneGameBottomSheet } from "./PhoneGameBottomSheet";
import { PlayerSessionPhonePanel } from "./PlayerSessionPhonePanel";

type SettingsView = "main" | "session";

function SettingsBody({
  onRequestFunds,
  onOpenPhoneSession,
}: {
  onRequestFunds: () => void;
  onOpenPhoneSession: () => void;
}) {
  return <GridSettingsContent onRequestFunds={onRequestFunds} onOpenPhoneSession={onOpenPhoneSession} />;
}

/** Settings — bottom sheet on phone, dialog on desktop. */
export function GridAppearanceSettingsButton() {
  const [open, setOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>("main");
  const settingsViewRef = useRef<SettingsView>("main");
  const sessionHistoryPushedRef = useRef(false);
  const interceptPopRef = useRef<(() => boolean) | null>(null);
  const isPhone = usePhoneGameLayout();

  settingsViewRef.current = settingsView;

  const resetSettingsView = useCallback(() => {
    setSettingsView("main");
    sessionHistoryPushedRef.current = false;
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        const hadSessionHistory = sessionHistoryPushedRef.current;
        resetSettingsView();
        if (hadSessionHistory) window.history.back();
      }
      setOpen(next);
    },
    [resetSettingsView],
  );

  const openFunds = () => {
    setOpen(false);
    resetSettingsView();
    window.setTimeout(() => setFundOpen(true), 200);
  };

  const openPhoneSession = useCallback(() => {
    setSettingsView("session");
  }, []);

  const backToMainSettings = useCallback(() => {
    if (sessionHistoryPushedRef.current) {
      sessionHistoryPushedRef.current = false;
      window.history.back();
      return;
    }
    setSettingsView("main");
  }, []);

  useEffect(() => {
    if (!open || settingsView !== "session" || sessionHistoryPushedRef.current) return;
    window.history.pushState({ blockGameSettingsSession: true }, "");
    sessionHistoryPushedRef.current = true;
  }, [open, settingsView]);

  useEffect(() => {
    interceptPopRef.current = () => {
      if (settingsViewRef.current === "session" && sessionHistoryPushedRef.current) {
        sessionHistoryPushedRef.current = false;
        setSettingsView("main");
        return true;
      }
      return false;
    };
    return () => {
      interceptPopRef.current = null;
    };
  }, []);

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 text-zinc-400 hover:text-zinc-100"
        onClick={() => setOpen(true)}
        aria-label="Settings"
        title="Settings"
      >
        <Settings2 className="h-4 w-4" />
      </Button>

      {isPhone ? (
        <PhoneGameBottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          title={settingsView === "main" ? "Settings" : "Session history"}
          historyKey="block-game-settings"
          showBack={settingsView === "session"}
          onBack={backToMainSettings}
          interceptPopRef={interceptPopRef}
          className={settingsView === "session" ? "max-h-[min(94dvh,760px)]" : undefined}
        >
          {settingsView === "main" ? (
            <SettingsBody onRequestFunds={openFunds} onOpenPhoneSession={openPhoneSession} />
          ) : (
            <PlayerSessionPhonePanel />
          )}
        </PhoneGameBottomSheet>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-h-[min(90dvh,640px)] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription className="text-zinc-500">Grid, target, wallet, and session</DialogDescription>
            </DialogHeader>
            <SettingsBody onRequestFunds={openFunds} onOpenPhoneSession={() => {}} />
          </DialogContent>
        </Dialog>
      )}

      <FundRequestDialog open={fundOpen} onOpenChange={setFundOpen} />
    </>
  );
}
