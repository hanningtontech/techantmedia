import { Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePhoneGameLayout } from "@/hooks/usePhoneGameLayout";
import { PhoneGameBottomSheet } from "./PhoneGameBottomSheet";
import { TargetSetupForm } from "./TargetSetupForm";

export function TargetSetupDialog({
  open,
  onOpenChange,
  currentBalance,
  mode = "set",
  initialTarget,
  onConfirm,
  onSkip,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  mode?: "set" | "adjust";
  initialTarget?: number;
  onConfirm: (targetBalance: number) => void;
  onSkip?: () => void;
  onClear?: () => void;
}) {
  const isPhone = usePhoneGameLayout();
  const isAdjust = mode === "adjust";

  const form = (
    <TargetSetupForm
      currentBalance={currentBalance}
      mode={mode}
      initialTarget={initialTarget}
      onConfirm={(target) => {
        onConfirm(target);
        onOpenChange(false);
      }}
      onSkip={onSkip ? () => { onSkip(); onOpenChange(false); } : undefined}
      onClear={onClear ? () => { onClear(); onOpenChange(false); } : undefined}
      onCancel={() => onOpenChange(false)}
    />
  );

  if (isPhone) {
    return (
      <PhoneGameBottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={isAdjust ? "Adjust target" : "Set target (optional)"}
        description={
          isAdjust
            ? "Update your session target. It stays active across rounds until you hit it, cancel, or change it."
            : "One target for the whole session — keep playing until you reach it."
        }
      >
        {form}
      </PhoneGameBottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-amber-400" />
            {isAdjust ? "Adjust target" : "Set target (optional)"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {isAdjust
              ? "Update your session target. It stays active across rounds until you hit it, cancel, or change it."
              : "One target for the whole session — keep playing until you reach it. You can skip and set later."}
          </DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
