import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBlockGamePlayer } from "@/contexts/BlockGamePlayerContext";
import { FREE_STARTING_BALANCE_KES } from "@/lib/game/constants";
import { formatKes } from "@/lib/game/formatKes";
import { usePhoneGameLayout } from "@/hooks/usePhoneGameLayout";
import { scrollInputIntoView } from "@/hooks/usePhoneKeyboardInset";
import { PhoneGameBottomSheet } from "./PhoneGameBottomSheet";

export function FundRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { requestFund } = useBlockGamePlayer();
  const isPhone = usePhoneGameLayout();
  const [amount, setAmount] = useState("100");

  const handleSubmit = () => {
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n < 50) {
      toast.error("Enter at least Ksh 50.");
      return;
    }
    requestFund(n);
    toast.success(`Fund request for ${formatKes(n)} sent to admin for approval.`);
    onOpenChange(false);
  };

  const form = (
    <>
      <div className="space-y-2 py-2">
        <Label htmlFor="fund-amount" className="text-zinc-400">
          Amount (KES)
        </Label>
        <Input
          id="fund-amount"
          type="number"
          inputMode="numeric"
          min={50}
          step={50}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onFocus={(e) => scrollInputIntoView(e.currentTarget)}
          className="border-white/10 bg-black/40"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="border-white/15" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" className="bg-violet-600 hover:bg-violet-500" onClick={handleSubmit}>
          Submit request
        </Button>
      </div>
    </>
  );

  if (isPhone) {
    return (
      <PhoneGameBottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Request account funds"
        historyKey="block-game-funds"
      >
        <p className="mb-3 text-sm leading-snug text-zinc-500">
          New accounts start with {formatKes(FREE_STARTING_BALANCE_KES)}. Top-ups require admin approval.
        </p>
        {form}
      </PhoneGameBottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request account funds</DialogTitle>
          <DialogDescription className="text-zinc-400">
            New accounts start with {formatKes(FREE_STARTING_BALANCE_KES)}. Top-ups require admin approval.
          </DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
