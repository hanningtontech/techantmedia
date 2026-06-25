import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExtractionSessionMeta } from "@shared/documentExtraction";
import { DOCUMENT_TYPES, historyFolderSlug, historySaveBaseName } from "@shared/documentExtraction";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionMeta: ExtractionSessionMeta;
  onConfirm: (baseName: string) => void;
};

export function SaveHistoryDialog({ open, onOpenChange, sessionMeta, onConfirm }: Props) {
  const [baseName, setBaseName] = useState("extraction");
  const folderSlug = historyFolderSlug(sessionMeta.documentType);
  const docLabel = DOCUMENT_TYPES[sessionMeta.documentType].label;
  const previewPath = `${historySaveBaseName(sessionMeta.documentType, baseName.trim() || "extraction")}/1`;

  useEffect(() => {
    if (open) setBaseName("extraction");
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-white/10 bg-[#12121a] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Save to history</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            Saved under <span className="font-medium text-zinc-300">{docLabel}</span> in folder{" "}
            <span className="font-mono text-zinc-300">{folderSlug}/</span>. Your selected columns
            are stored with this spreadsheet.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <Label htmlFor="history-base-name" className="text-zinc-300">
            Name inside folder
          </Label>
          <Input
            id="history-base-name"
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            className="mt-1.5 border-white/10 bg-[#0c0c12] text-white"
            placeholder="extraction"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Will save as <span className="font-mono text-zinc-400">{previewPath}</span>
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-600 hover:bg-amber-700"
            onClick={() => onConfirm(baseName.trim() || "extraction")}
          >
            Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
