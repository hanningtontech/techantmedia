import { useRef, type MutableRefObject, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePhoneKeyboardInset } from "@/hooks/usePhoneKeyboardInset";
import { useSheetHistoryBack } from "@/hooks/useSheetHistoryBack";
import { cn } from "@/lib/utils";

/**
 * Phone bottom sheet — keyboard-aware, back-button dismiss, swipe handle.
 */
export function PhoneGameBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  historyKey = "phone-game-sheet",
  onBack,
  showBack = false,
  interceptPopRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  historyKey?: string;
  onBack?: () => void;
  showBack?: boolean;
  interceptPopRef?: MutableRefObject<(() => boolean) | null>;
}) {
  const keyboardInset = usePhoneKeyboardInset();
  const dragStartY = useRef(0);
  const handleOpenChange = useSheetHistoryBack(open, onOpenChange, historyKey, interceptPopRef);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        overlayClassName="z-[400]"
        className={cn(
          "z-[400] max-h-[min(92dvh,720px)] gap-0 overflow-hidden rounded-t-2xl border-zinc-800 bg-zinc-950 p-0 text-zinc-100",
          className,
        )}
        style={{
          paddingBottom: `max(1rem, env(safe-area-inset-bottom), ${keyboardInset}px)`,
        }}
      >
        <div
          className="mx-auto flex h-6 w-full cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          aria-hidden
          onTouchStart={(e) => {
            dragStartY.current = e.touches[0]?.clientY ?? 0;
          }}
          onTouchEnd={(e) => {
            const endY = e.changedTouches[0]?.clientY ?? 0;
            if (endY - dragStartY.current > 48) handleOpenChange(false);
          }}
        >
          <div className="h-1 w-10 rounded-full bg-zinc-600" />
        </div>

        <SheetHeader className="shrink-0 space-y-0 border-b border-white/10 px-4 pb-3 pt-0 text-left">
          <div className="flex items-center gap-2">
            {showBack && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <SheetTitle className="min-w-0 flex-1 text-base leading-tight">{title}</SheetTitle>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
