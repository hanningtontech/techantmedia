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
  pendingCount: number;
  extractedCount: number;
};

export function CancelExtractionDialog({
  open,
  onOpenChange,
  onConfirm,
  pendingCount,
  extractedCount,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-white/10 bg-[#12121a] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel extraction?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-zinc-400">
            <span className="block">
              Remaining forms will not be processed
              {pendingCount > 0 ? (
                <>
                  {" "}
                  (<span className="text-amber-300">{pendingCount}</span> still waiting)
                </>
              ) : (
                ""
              )}
              . The file currently being read may finish before the queue stops.
            </span>
            {extractedCount > 0 ? (
              <span className="block">
                Forms already extracted ({extractedCount}) will stay in your spreadsheet — you can save or
                download them.
              </span>
            ) : (
              <span className="block">No forms have been extracted yet in this batch.</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">
            Keep extracting
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            Cancel extraction
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
