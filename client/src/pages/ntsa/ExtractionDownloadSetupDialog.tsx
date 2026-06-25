import { useEffect, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumberedFileName, supportsFolderPicker } from "@/lib/ntsa/extractionDownloadPrefs";
import type { DownloadSetupResult } from "@/contexts/ExtractionDownloadContext";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: DownloadSetupResult) => void;
  initialBaseName: string;
  initialAutoSave: boolean;
  folderLabel: string | null;
};

export function ExtractionDownloadSetupDialog({
  open,
  onOpenChange,
  onConfirm,
  initialBaseName,
  initialAutoSave,
  folderLabel,
}: Props) {
  const [baseName, setBaseName] = useState(initialBaseName);
  const [autoSave, setAutoSave] = useState(initialAutoSave);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [pickedFolderLabel, setPickedFolderLabel] = useState<string | null>(folderLabel);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBaseName(initialBaseName);
    setAutoSave(initialAutoSave);
    setDirectoryHandle(null);
    setPickedFolderLabel(folderLabel);
  }, [open, initialBaseName, initialAutoSave, folderLabel]);

  const canPickFolder = supportsFolderPicker();

  const pickFolder = async () => {
    if (!canPickFolder) return;
    setPicking(true);
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      setDirectoryHandle(handle);
      setPickedFolderLabel(handle.name);
    } catch {
      /* user cancelled */
    } finally {
      setPicking(false);
    }
  };

  const handleConfirm = () => {
    const trimmed = baseName.trim() || "extraction";
    onConfirm({
      baseName: trimmed,
      autoSaveToFolder: autoSave && !!directoryHandle,
      directoryHandle: autoSave ? directoryHandle : null,
      folderLabel: pickedFolderLabel,
    });
  };

  const previewName = formatNumberedFileName(baseName.trim() || "extraction", 1);
  const previewNext = formatNumberedFileName(baseName.trim() || "extraction", 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg border-white/10 bg-[#12121a] text-white">
        <DialogHeader>
          <DialogTitle>Where should Excel files be saved?</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Choose a folder and a base name. The first file can be{" "}
            <span className="text-zinc-300">{previewName}</span>, then{" "}
            <span className="text-zinc-300">{previewNext}</span>, and so on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="download-base-name" className="text-zinc-300">
              File name base
            </Label>
            <Input
              id="download-base-name"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              className="mt-1.5 border-white/10 bg-[#0c0c12] text-white"
              placeholder="extraction"
            />
          </div>

          {canPickFolder ? (
            <div className="space-y-2">
              <Label className="text-zinc-300">Save folder</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start border-white/15 text-left text-zinc-300 hover:bg-white/5"
                onClick={() => void pickFolder()}
                disabled={picking}
              >
                {picking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="mr-2 h-4 w-4 shrink-0" />
                )}
                {pickedFolderLabel ? pickedFolderLabel : "Choose folder…"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              Your browser does not support picking a folder. Files will download to your default
              downloads location.
            </p>
          )}

          {canPickFolder && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-[#0c0c12] p-3">
              <Checkbox
                checked={autoSave}
                onCheckedChange={(v) => setAutoSave(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-zinc-300">
                Automatically save future Excel files to this folder with numbered names (
                {previewName}, {previewNext}, …)
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-white/15 text-zinc-300"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700"
            onClick={handleConfirm}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
