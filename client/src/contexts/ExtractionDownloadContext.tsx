import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  buildExtractionExcelBuffer,
  buildNtsaExcelBuffer,
  downloadExtractionExcelBlob,
  downloadNtsaExcelBlob,
} from "@/lib/ntsa/ntsaExcel";
import { defaultSessionMeta } from "@shared/documentExtraction";
import type { ExtractionSessionMeta } from "@shared/documentExtraction";
import { resolveActiveSessionMeta } from "@/lib/ntsa/extractionSessionMeta";
import {
  clearDirectoryHandle,
  ensureDirectoryPermission,
  formatNumberedFileName,
  loadDirectoryHandle,
  loadDownloadPrefs,
  saveDirectoryHandle,
  saveDownloadPrefs,
  supportsFolderPicker,
  writeExcelToDirectory,
  type ExtractionDownloadPrefs,
} from "@/lib/ntsa/extractionDownloadPrefs";
import type { NtsaSessionRow } from "@shared/ntsaExtraction";
import { ExtractionDownloadSetupDialog } from "@/pages/ntsa/ExtractionDownloadSetupDialog";

export type DownloadSetupResult = {
  baseName: string;
  autoSaveToFolder: boolean;
  directoryHandle: FileSystemDirectoryHandle | null;
  folderLabel: string | null;
};

type PendingDownload = {
  rows: NtsaSessionRow[];
  meta: ExtractionSessionMeta;
  fileNameHint?: string;
  resolve: (ok: boolean) => void;
};

type ContextValue = {
  downloadExcel: (
    rows: NtsaSessionRow[],
    fileNameHint?: string,
    metaOverride?: ExtractionSessionMeta,
  ) => Promise<boolean>;
  openDownloadSettings: () => void;
  prefs: ExtractionDownloadPrefs | null;
};

const ExtractionDownloadContext = createContext<ContextValue | null>(null);

export function useExtractionDownload(): ContextValue {
  const ctx = useContext(ExtractionDownloadContext);
  if (!ctx) {
    throw new Error("useExtractionDownload must be used within ExtractionDownloadProvider");
  }
  return ctx;
}

type ProviderProps = {
  userId: string;
  children: ReactNode;
};

export function ExtractionDownloadProvider({ userId, children }: ProviderProps) {
  const [prefs, setPrefs] = useState<ExtractionDownloadPrefs | null>(() => loadDownloadPrefs(userId));
  const [setupOpen, setSetupOpen] = useState(false);
  const pendingRef = useRef<PendingDownload | null>(null);

  const resolveMeta = useCallback(
    (rows: NtsaSessionRow[]): ExtractionSessionMeta =>
      resolveActiveSessionMeta(userId, rows) ?? defaultSessionMeta("ntsa_test_form"),
    [userId],
  );

  const saveToFolder = useCallback(
    async (
      rows: NtsaSessionRow[],
      meta: ExtractionSessionMeta,
      activePrefs: ExtractionDownloadPrefs,
      handle: FileSystemDirectoryHandle,
      sequence: number,
      fileNameHint?: string,
    ): Promise<string> => {
      const buffer = await buildExtractionExcelBuffer(rows, meta);
      const fileName =
        fileNameHint?.trim() ||
        formatNumberedFileName(activePrefs.baseName, sequence);
      await writeExcelToDirectory(handle, fileName, buffer);
      return fileName;
    },
    [],
  );

  const completeDownload = useCallback(
    async (
      rows: NtsaSessionRow[],
      meta: ExtractionSessionMeta,
      fileNameHint?: string,
      setup?: DownloadSetupResult,
    ): Promise<boolean> => {
      try {
        const buffer = await buildExtractionExcelBuffer(rows, meta);

        if (setup) {
          const nextPrefs: ExtractionDownloadPrefs = {
            baseName: setup.baseName,
            nextSequence: 2,
            autoSaveToFolder: setup.autoSaveToFolder,
            folderLabel: setup.folderLabel,
          };
          const fileName =
            fileNameHint?.trim() || formatNumberedFileName(setup.baseName, 1);

          if (setup.autoSaveToFolder && setup.directoryHandle) {
            const ok = await ensureDirectoryPermission(setup.directoryHandle);
            if (!ok) throw new Error("Folder permission denied");
            await saveDirectoryHandle(userId, setup.directoryHandle);
            await writeExcelToDirectory(setup.directoryHandle, fileName, buffer);
            saveDownloadPrefs(userId, nextPrefs);
            setPrefs(nextPrefs);
            toast.success(`Saved ${fileName} to ${setup.folderLabel ?? "your folder"}`);
            return true;
          }

          saveDownloadPrefs(userId, { ...nextPrefs, autoSaveToFolder: false });
          setPrefs({ ...nextPrefs, autoSaveToFolder: false });
          await downloadExtractionExcelBlob(rows, meta, fileName);
          toast.success(`Downloaded ${fileName}`);
          return true;
        }

        const currentPrefs = loadDownloadPrefs(userId);
        if (currentPrefs?.autoSaveToFolder) {
          const handle = await loadDirectoryHandle(userId);
          if (handle && (await ensureDirectoryPermission(handle))) {
            const fileName = await saveToFolder(
              rows,
              meta,
              currentPrefs,
              handle,
              currentPrefs.nextSequence,
              fileNameHint,
            );
            const updated: ExtractionDownloadPrefs = {
              ...currentPrefs,
              nextSequence: currentPrefs.nextSequence + 1,
            };
            saveDownloadPrefs(userId, updated);
            setPrefs(updated);
            toast.success(`Saved ${fileName} to ${currentPrefs.folderLabel ?? "your folder"}`);
            return true;
          }
        }

        const fallbackName =
          fileNameHint?.trim() ||
          (currentPrefs
            ? formatNumberedFileName(currentPrefs.baseName, currentPrefs.nextSequence)
            : "data-extraction-application-forms.xlsx");

        if (currentPrefs && !fileNameHint) {
          const updated: ExtractionDownloadPrefs = {
            ...currentPrefs,
            nextSequence: currentPrefs.nextSequence + 1,
          };
          saveDownloadPrefs(userId, updated);
          setPrefs(updated);
        }

        await downloadExtractionExcelBlob(rows, meta, fallbackName);
        toast.success(`Downloaded ${fallbackName}`);
        return true;
      } catch (e) {
        console.error(e);
        toast.error("Could not save the Excel file");
        return false;
      }
    },
    [userId, saveToFolder],
  );

  const downloadExcel = useCallback(
    async (
      rows: NtsaSessionRow[],
      fileNameHint?: string,
      metaOverride?: ExtractionSessionMeta,
    ): Promise<boolean> => {
      const meta = metaOverride ?? resolveMeta(rows);
      const currentPrefs = loadDownloadPrefs(userId);

      if (currentPrefs?.autoSaveToFolder) {
        const handle = await loadDirectoryHandle(userId);
        if (handle && (await ensureDirectoryPermission(handle))) {
          return completeDownload(rows, meta, fileNameHint);
        }
      }

      if (!supportsFolderPicker() && !currentPrefs) {
        return completeDownload(rows, meta, fileNameHint);
      }

      if (currentPrefs?.autoSaveToFolder) {
        return new Promise((resolve) => {
          pendingRef.current = { rows, meta, fileNameHint, resolve };
          setSetupOpen(true);
        });
      }

      if (!currentPrefs) {
        return new Promise((resolve) => {
          pendingRef.current = { rows, meta, fileNameHint, resolve };
          setSetupOpen(true);
        });
      }

      return completeDownload(rows, meta, fileNameHint);
    },
    [userId, completeDownload, resolveMeta],
  );

  const openDownloadSettings = useCallback(() => {
    pendingRef.current = null;
    setSetupOpen(true);
  }, []);

  const handleSetupConfirm = useCallback(
    async (result: DownloadSetupResult) => {
      setSetupOpen(false);
      const pending = pendingRef.current;
      pendingRef.current = null;

      if (pending) {
        const ok = await completeDownload(pending.rows, pending.meta, pending.fileNameHint, result);
        pending.resolve(ok);
        return;
      }

      if (result.autoSaveToFolder && result.directoryHandle) {
        const ok = await ensureDirectoryPermission(result.directoryHandle);
        if (!ok) {
          toast.error("Folder permission was not granted");
          return;
        }
        await saveDirectoryHandle(userId, result.directoryHandle);
        const nextPrefs: ExtractionDownloadPrefs = {
          baseName: result.baseName,
          nextSequence: 1,
          autoSaveToFolder: true,
          folderLabel: result.folderLabel,
        };
        saveDownloadPrefs(userId, nextPrefs);
        setPrefs(nextPrefs);
        toast.success(`Downloads will save to ${result.folderLabel ?? "your folder"}`);
      } else {
        await clearDirectoryHandle(userId);
        const nextPrefs: ExtractionDownloadPrefs = {
          baseName: result.baseName,
          nextSequence: 1,
          autoSaveToFolder: false,
          folderLabel: null,
        };
        saveDownloadPrefs(userId, nextPrefs);
        setPrefs(nextPrefs);
        toast.success("Download naming updated");
      }
    },
    [userId, completeDownload],
  );

  const handleSetupClose = useCallback((open: boolean) => {
    if (!open) {
      setSetupOpen(false);
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        pending.resolve(false);
      }
    }
  }, []);

  const value = useMemo(
    () => ({ downloadExcel, openDownloadSettings, prefs }),
    [downloadExcel, openDownloadSettings, prefs],
  );

  return (
    <ExtractionDownloadContext.Provider value={value}>
      {children}
      <ExtractionDownloadSetupDialog
        open={setupOpen}
        onOpenChange={handleSetupClose}
        onConfirm={(result) => void handleSetupConfirm(result)}
        initialBaseName={prefs?.baseName ?? "extraction"}
        initialAutoSave={prefs?.autoSaveToFolder ?? true}
        folderLabel={prefs?.folderLabel}
      />
    </ExtractionDownloadContext.Provider>
  );
}
