import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onSaveFirst?: () => void;
  hasRows: boolean;
  alreadySavedLabel?: string | null;
};

export function ClearSessionDialog({
  open,
  onOpenChange,
  onConfirm,
  onSaveFirst,
  hasRows,
  alreadySavedLabel,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-white/10 bg-[#12121a] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Clear session?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            {alreadySavedLabel ? (
              <>
                This session is already saved to history as{" "}
                <span className="font-medium text-amber-300">{alreadySavedLabel}</span>. Clearing will only
                remove it from your working spreadsheet — it will not be archived again as a cleared session.
              </>
            ) : (
              <>
                Are you sure you need to clear the session? All extracted rows will be removed and will be
                archived for admin recovery unless you save them to history first.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">
            Cancel
          </AlertDialogCancel>
          {!alreadySavedLabel && hasRows && onSaveFirst && (
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={onSaveFirst}
            >
              Save to history first
            </AlertDialogAction>
          )}
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>
            Clear session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
