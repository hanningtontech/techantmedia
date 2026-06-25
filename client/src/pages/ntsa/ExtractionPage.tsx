import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Download,
  History,
  Loader2,
  LogOut,
  Play,
  Settings2,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { TechMediaLayout } from "@/components/tech-media/TechMediaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSeo } from "@/components/seo/PageSeo";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useSiteContent } from "@/contexts/SiteContentContext";
import { extractionGreeting } from "@/lib/ntsa/extractionSalutation";
import { DEFAULT_EXTRACTION_SETTINGS } from "@/lib/portfolio/extractionDefaults";
import type { DocumentClassification, ExtractionSessionMeta } from "@shared/documentExtraction";
import { defaultSessionMeta } from "@shared/documentExtraction";
import type { ExtractionFieldId, ExtractionSessionRow } from "@shared/documentExtraction";
import { setRowFieldValue } from "@shared/documentExtraction";
import { classifyDocumentFromImage, terminatePreviewOcrWorker } from "@/lib/ntsa/documentClassifier";
import { applyEnabledFieldsToRow, extractDocumentFromImage } from "@/lib/ntsa/documentExtract";
import {
  playExtractionDoneSound,
  playExtractionErrorSound,
  UNSAVED_EXTRACTION_REMINDER_MS,
} from "@/lib/ntsa/extractionDoneSound";
import {
  resolveSessionMetaFromPrefs,
  saveExtractionPreferences,
} from "@/lib/ntsa/extractionPreferences";
import {
  clearSessionMeta,
  loadSessionMeta,
  resolveActiveSessionMeta,
  saveSessionMeta,
} from "@/lib/ntsa/extractionSessionMeta";
import {
  clearAutoDraft,
  clearRestoredSessionFlag,
  clearSessionWorkspaceMarkers,
  createExtractionRecord,
  getExtractionUserState,
  markSessionSavedToHistory,
  saveAutoDraft,
  subscribeExtractionUserState,
} from "@/lib/ntsa/ntsaExtractionFirestore";
import {
  fingerprintSessionRows,
  isSessionAlreadySaved,
} from "@/lib/ntsa/ntsaSessionFingerprint";
import { terminateNtsaOcrWorker } from "@/lib/ntsa/ntsaOcr";
import { ExtractionDownloadProvider, useExtractionDownload } from "@/contexts/ExtractionDownloadContext";
import { pdfFileToImages } from "@/lib/ntsa/pdfToImages";
import {
  MAX_EXTRACTION_FORMS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  formatMegabytes,
  validateUploadBatch,
} from "@/lib/ntsa/ntsaLimits";
import { appendNtsaRow, clearNtsaRows, loadNtsaRows, saveNtsaRows } from "@/lib/ntsa/ntsaSession";
import type { ExtractionPendingMeta } from "@/lib/ntsa/ntsaExtractionTypes";
import {
  clearPendingBatch,
  countActiveQueueItems,
  countResumableJobs,
  countPendingJobs,
  cancelActiveQueueItems,
  isBatchComplete,
  isQueueBusy,
  isQueueIdle,
  queueHasExtractionErrors,
  loadPendingBatch,
  loadJobBlob,
  loadResumableJobs,
  loadUploadFiles,
  persistJobBlob,
  persistUploadFiles,
  savePendingBatch,
  updatePendingQueue,
  type PendingJobMeta,
} from "@/lib/ntsa/ntsaPendingJobs";
import { cn } from "@/lib/utils";
import { saveSessionToHistory, type ExtractionHistoryEntry } from "@/lib/ntsa/ntsaHistory";
import { CombineSpreadsheetsPanel } from "@/pages/ntsa/CombineSpreadsheetsPanel";
import { ClearSessionDialog } from "@/pages/ntsa/ClearSessionDialog";
import { CancelExtractionDialog } from "@/pages/ntsa/CancelExtractionDialog";
import { ExtractionAuthGate } from "@/pages/ntsa/ExtractionAuthGate";
import { ExtractionDraftsTab } from "@/pages/ntsa/ExtractionDraftsTab";
import { ExtractionHistoryTab } from "@/pages/ntsa/ExtractionHistoryTab";
import { QaAuditPanel } from "@/pages/ntsa/QaAuditPanel";
import { ProcessingQueuePanel, type ProcessingItem } from "@/pages/ntsa/ProcessingQueuePanel";
import { RestoreSessionHelp } from "@/pages/ntsa/RestoreSessionDialog";
import { SaveHistoryDialog } from "@/pages/ntsa/SaveHistoryDialog";
import { DocumentSetupDialog, type DocumentSetupResult } from "@/pages/ntsa/DocumentSetupDialog";
import { SessionSpreadsheetPanel } from "@/pages/ntsa/SessionSpreadsheetPanel";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

function unlockKey(userId: string): string {
  return `extraction_page_unlocked_${userId}`;
}

function readUnlocked(userId: string): boolean {
  try {
    return sessionStorage.getItem(unlockKey(userId)) === "1";
  } catch {
    return false;
  }
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

function SessionDownloadButton({ rows }: { rows: ExtractionSessionRow[] }) {
  const { downloadExcel } = useExtractionDownload();

  const handleDownload = async () => {
    if (!rows.length) {
      toast.error("No data to download yet");
      return;
    }
    const ok = await downloadExcel(rows);
    if (!ok) return;
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="border-white/15 text-white hover:bg-white/5"
      onClick={() => void handleDownload()}
    >
      <Download className="mr-2 h-4 w-4" />
      Download Excel
    </Button>
  );
}

export default function ExtractionPage() {
  const [, navigate] = useLocation();
  const { user, profile, loading: authLoading, signOut } = useFirebaseAuth();
  const userId = user?.uid ?? "";
  const { content } = useSiteContent();
  const accessPin =
    content.extractionSettings?.accessPin?.trim() || DEFAULT_EXTRACTION_SETTINGS.accessPin;
  const inputRef = useRef<HTMLInputElement>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [rows, setRows] = useState<ExtractionSessionRow[]>([]);
  const [sessionMeta, setSessionMeta] = useState<ExtractionSessionMeta>(
    defaultSessionMeta("ntsa_test_form"),
  );
  const sessionMetaRef = useRef<ExtractionSessionMeta>(defaultSessionMeta("ntsa_test_form"));
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupClassification, setSetupClassification] = useState<DocumentClassification | null>(null);
  const [setupInitialMeta, setSetupInitialMeta] = useState<ExtractionSessionMeta | null>(null);
  const [setupPreferDetectedType, setSetupPreferDetectedType] = useState(false);
  const [setupAllowTypeChange, setSetupAllowTypeChange] = useState(true);
  const pendingExtractionRef = useRef<{
    batchId: string;
    jobs: Array<{
      id: string;
      label: string;
      blob: Blob;
      mimeType: string;
      fileName: string;
    }>;
    startQueue: ProcessingItem[];
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [queue, setQueue] = useState<ProcessingItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const lastRestoredAtRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<"extract" | "qa" | "history" | "drafts" | "combine">("extract");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [pendingHistoryEntry, setPendingHistoryEntry] = useState<ExtractionHistoryEntry | null>(null);
  const [draftsRefreshKey, setDraftsRefreshKey] = useState(0);
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(null);
  const [savedSessionFingerprint, setSavedSessionFingerprint] = useState<string | null>(null);
  const [savedHistoryLabel, setSavedHistoryLabel] = useState<string | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [resumableCount, setResumableCount] = useState(0);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extractionCancelledRef = useRef(false);
  const extractionCancelUiAppliedRef = useRef(false);
  const queueRef = useRef<ProcessingItem[]>([]);
  queueRef.current = queue;

  const buildPendingMeta = useCallback(
    (batchId: string, items: ProcessingItem[]): ExtractionPendingMeta => ({
      batchId,
      resumableCount: countResumableJobs(items),
      totalJobs: items.length,
      updatedAt: new Date().toISOString(),
    }),
    [],
  );

  const applySessionMeta = useCallback((meta: ExtractionSessionMeta) => {
    sessionMetaRef.current = meta;
    setSessionMeta(meta);
    if (userId) saveSessionMeta(userId, meta);
  }, [userId]);

  const syncDraftAndPending = useCallback(
    async (nextRows: ExtractionSessionRow[], items: ProcessingItem[], batchId?: string) => {
      if (!userId) return;
      const meta = batchId ? buildPendingMeta(batchId, items) : null;
      if (!nextRows.length && !meta?.resumableCount) {
        await clearAutoDraft(userId);
        return;
      }
      await saveAutoDraft(userId, nextRows, meta);
      setDraftsRefreshKey((k) => k + 1);
    },
    [userId, buildPendingMeta],
  );

  const refreshResumableState = useCallback(async () => {
    if (!userId) return;
    const pending = await loadPendingBatch(userId);
    if (!pending) {
      setResumableCount(0);
      return;
    }
    const pendingCount = countPendingJobs(pending.queue);
    if (!pendingCount) {
      await clearPendingBatch(userId);
      setResumableCount(0);
      return;
    }
    setQueue(pending.queue);
    setResumableCount(pendingCount);
  }, [userId]);

  const sessionAlreadySaved = isSessionAlreadySaved(rows, savedSessionFingerprint);
  const extractionBusy = isQueueBusy(queue);
  const showCancelExtraction = extractionBusy || processing;
  const sessionExtractionComplete = rows.length > 0 && !extractionBusy && !processing;
  const sessionBlocksUpload =
    rows.length > 0 && !extractionBusy && !sessionAlreadySaved;
  const isUploadingFiles = queue.some((item) => item.status === "uploading");
  /** Blocks file input / drag-drop only — save/download stay enabled once the queue is idle. */
  const uploadBlocked = extractionBusy || sessionBlocksUpload;
  const activeQueueCount = countActiveQueueItems(queue);

  const finalizeCancelledExtraction = useCallback(
    async (cancelledQueue: ProcessingItem[]) => {
      if (!userId) return;
      extractionCancelUiAppliedRef.current = true;
      setQueue([]);
      setProcessing(false);
      setProcessingStartedAt(null);
      setResumableCount(0);
      pendingExtractionRef.current = null;
      setSetupDialogOpen(false);
      setSetupClassification(null);
      setSetupInitialMeta(null);
      setSetupPreferDetectedType(false);
      await clearPendingBatch(userId);
      await syncDraftAndPending(loadNtsaRows(userId), cancelledQueue);
      playExtractionErrorSound();
      toast.message("Extraction cancelled — extracted forms are still in your spreadsheet.");
    },
    [userId, syncDraftAndPending],
  );

  const handleCancelExtractionConfirmed = () => {
    setCancelDialogOpen(false);
    extractionCancelledRef.current = true;
    const sourceQueue =
      pendingExtractionRef.current?.startQueue ??
      (queueRef.current.length ? queueRef.current : queue);
    void finalizeCancelledExtraction(cancelActiveQueueItems(sourceQueue));
  };

  const updateRows = useCallback(
    (next: ExtractionSessionRow[]) => {
      if (!userId) return;
      saveNtsaRows(userId, next);
      setRows(next);
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    setUnlocked(readUnlocked(userId));
    setWorkspaceReady(false);
    let cancelled = false;

    void (async () => {
      const local = loadNtsaRows(userId);
      const ws = await getExtractionUserState(userId);
      if (cancelled) return;
      setSavedSessionFingerprint(ws.savedSessionFingerprint);
      setSavedHistoryLabel(ws.savedHistoryLabel);
      if (local.length > 0) {
        setRows(local);
      } else if (ws.autoDraft?.rows.length) {
        setRows(ws.autoDraft.rows);
        saveNtsaRows(userId, ws.autoDraft.rows);
        toast.message("Restored your auto-draft from the cloud");
      }
      const restoredRows = local.length > 0 ? local : ws.autoDraft?.rows ?? [];
      const meta =
        loadSessionMeta(userId) ??
        resolveActiveSessionMeta(userId, restoredRows) ??
        defaultSessionMeta("ntsa_test_form");
      applySessionMeta(meta);
      setWorkspaceReady(true);
      await refreshResumableState();
    })();

    const unsub = subscribeExtractionUserState(userId, (state) => {
      setSavedSessionFingerprint(state.savedSessionFingerprint);
      setSavedHistoryLabel(state.savedHistoryLabel);
      const restored = state.restoredSession;
      if (!restored?.rows?.length) return;
      if (lastRestoredAtRef.current === restored.restoredAt) return;
      lastRestoredAtRef.current = restored.restoredAt;
      saveNtsaRows(userId, restored.rows);
      setRows(restored.rows);
      void clearRestoredSessionFlag(userId);
      toast.success(`Session "${restored.label}" has been restored to your spreadsheet`);
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [userId, refreshResumableState, applySessionMeta]);

  useEffect(() => {
    if (!userId || !workspaceReady) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        const pending = await loadPendingBatch(userId);
        const meta = pending ? buildPendingMeta(pending.batchId, pending.queue) : null;
        if (!rows.length && !meta?.resumableCount) {
          await clearAutoDraft(userId);
          return;
        }
        await saveAutoDraft(userId, rows, meta);
        setDraftsRefreshKey((k) => k + 1);
      })();
    }, extractionBusy ? 800 : 2000);
    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [userId, rows, workspaceReady, extractionBusy, buildPendingMeta]);

  useEffect(() => {
    return () => {
      void terminateNtsaOcrWorker();
      void terminatePreviewOcrWorker();
    };
  }, []);

  /** Remind user every 7 minutes while extracted rows are not saved to history. */
  useEffect(() => {
    if (!sessionBlocksUpload) return;
    const timer = window.setInterval(() => {
      playExtractionDoneSound();
    }, UNSAVED_EXTRACTION_REMINDER_MS);
    return () => window.clearInterval(timer);
  }, [sessionBlocksUpload]);

  const clearActiveSession = useCallback(
    async (options?: { archiveCleared?: boolean }) => {
      if (!userId) return;
      const shouldArchive = options?.archiveCleared ?? !sessionAlreadySaved;
      if (rows.length && shouldArchive) {
        try {
          await createExtractionRecord({
            userId,
            userEmail: profile?.email ?? null,
            userName: profile?.name ?? null,
            type: "cleared",
            rows,
            sessionMeta,
          });
        } catch {
          toast.error("Could not archive cleared session for admin recovery");
        }
      }
      clearNtsaRows(userId);
      clearSessionMeta(userId);
      setRows([]);
      setQueue([]);
      setProcessingStartedAt(null);
      setResumableCount(0);
      applySessionMeta(defaultSessionMeta("ntsa_test_form"));
      await clearPendingBatch(userId);
      await clearSessionWorkspaceMarkers(userId);
      setSavedSessionFingerprint(null);
      setSavedHistoryLabel(null);
      setDraftsRefreshKey((k) => k + 1);
    },
    [userId, rows, sessionAlreadySaved, profile?.email, profile?.name, applySessionMeta, sessionMeta],
  );

  const beginExtractionWithSetup = async (
    batchId: string,
    jobs: Array<{
      id: string;
      label: string;
      blob: Blob;
      mimeType: string;
      fileName: string;
    }>,
    startQueue: ProcessingItem[],
  ) => {
    try {
      const classification = await classifyDocumentFromImage(jobs[0]!.blob);
      const { meta, needsConfirmation } = resolveSessionMetaFromPrefs(userId, classification.type);
      const storedMeta = loadSessionMeta(userId);
      const typeChanged = storedMeta != null && storedMeta.documentType !== classification.type;
      const mustConfirm = needsConfirmation || typeChanged;

      if (mustConfirm) {
        pendingExtractionRef.current = { batchId, jobs, startQueue };
        setSetupClassification(classification);
        setSetupInitialMeta(meta);
        setSetupPreferDetectedType(true);
        setSetupAllowTypeChange(true);
        setSetupDialogOpen(true);
        setProcessing(false);
        playExtractionErrorSound();
        return;
      }

      applySessionMeta(meta);
      extractionCancelledRef.current = false;
      extractionCancelUiAppliedRef.current = false;
      setProcessing(true);
      await runExtractionJobs(batchId, jobs, startQueue);
    } catch {
      setProcessing(false);
      setProcessingStartedAt(null);
      playExtractionErrorSound();
      toast.error("Could not analyse the first document. Try uploading again.");
    }
  };

  const handleDocumentSetupConfirm = (result: DocumentSetupResult) => {
    saveExtractionPreferences(userId, result.documentType, result.enabledFields);
    const meta: ExtractionSessionMeta = {
      documentType: result.documentType,
      enabledFields: result.enabledFields,
    };
    applySessionMeta(meta);
    setSetupDialogOpen(false);
    setSetupClassification(null);
    setSetupInitialMeta(null);
    setSetupPreferDetectedType(false);

    const pending = pendingExtractionRef.current;
    pendingExtractionRef.current = null;
    if (pending) {
      extractionCancelledRef.current = false;
      extractionCancelUiAppliedRef.current = false;
      setProcessing(true);
      void runExtractionJobs(pending.batchId, pending.jobs, pending.startQueue).catch(() => {
        playExtractionErrorSound();
        toast.error("Extraction stopped unexpectedly. You can continue or save what was extracted.");
      });
      return;
    }

    toast.success("Extraction fields updated");
  };

  const handleDocumentSetupCancel = () => {
    const hadPendingUpload = Boolean(pendingExtractionRef.current);
    setSetupDialogOpen(false);
    setSetupClassification(null);
    setSetupInitialMeta(null);
    setSetupPreferDetectedType(false);
    pendingExtractionRef.current = null;
    if (hadPendingUpload) {
      setProcessing(false);
      setProcessingStartedAt(null);
      playExtractionErrorSound();
      toast.message("Upload cancelled — choose files again when ready.");
    }
  };

  const openFieldSettings = () => {
    setSetupClassification(null);
    setSetupInitialMeta(sessionMeta);
    setSetupPreferDetectedType(false);
    setSetupAllowTypeChange(rows.length === 0);
    setSetupDialogOpen(true);
  };

  const processFiles = async (files: FileList | File[]) => {
    if (extractionBusy) {
      toast.message("Please wait — extraction is still running.");
      return;
    }
    if (sessionBlocksUpload) {
      toast.error("Save to history or clear the session using the buttons below, then upload again.", {
        duration: 7000,
      });
      return;
    }
    if (!userId) return;

    const currentRows = loadNtsaRows(userId);
    if (currentRows.length > 0) {
      if (isSessionAlreadySaved(currentRows, savedSessionFingerprint)) {
        clearNtsaRows(userId);
        setRows([]);
        await clearSessionWorkspaceMarkers(userId);
        setSavedSessionFingerprint(null);
        setSavedHistoryLabel(null);
        toast.message("Saved session cleared — starting your new upload.");
      } else {
        toast.error("Save your session to history or clear it before uploading more forms.", {
          duration: 8000,
        });
        return;
      }
    }

    const list = Array.from(files);
    if (!list.length) return;

    const supported: File[] = [];
    for (const file of list) {
      if (isPdf(file) || isImage(file)) supported.push(file);
      else toast.error(`"${file.name}" is not supported. Use JPG, PNG, WebP, GIF, or PDF.`);
    }
    if (!supported.length) return;

    const totalBytes = supported.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_UPLOAD_BYTES) {
      toast.error(
        `This upload is ${formatMegabytes(totalBytes)} MB. Each drag-and-drop or file selection is limited to ${MAX_UPLOAD_MB} MB.`,
        { duration: 8000 },
      );
      return;
    }

    const batchId = Date.now();
    extractionCancelledRef.current = false;
    extractionCancelUiAppliedRef.current = false;
    setProcessing(true);
    setProcessingStartedAt(batchId);
    setQueue(
      supported.map((file, i) => ({
        id: `${batchId}-file-${i}`,
        label: file.name,
        status: "uploading" as const,
        error: isPdf(file) ? "Reading PDF pages…" : "Preparing image…",
      })),
    );

    await persistUploadFiles(userId, batchId, supported);

    const currentFormCount = loadNtsaRows(userId).length;
    const jobs: Array<{
      id: string;
      label: string;
      blob: Blob;
      mimeType: string;
      fileName: string;
    }> = [];
    const jobMetas: PendingJobMeta[] = [];

    try {
      for (let fileIndex = 0; fileIndex < supported.length; fileIndex += 1) {
        if (extractionCancelledRef.current) {
          await finalizeCancelledExtraction(
            cancelActiveQueueItems(
              jobs.map((job) => ({ id: job.id, label: job.label, status: "error" as const, error: "Cancelled" })),
            ),
          );
          return;
        }

        const file = supported[fileIndex]!;
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === fileIndex
              ? {
                  ...item,
                  status: "uploading" as const,
                  error: isPdf(file) ? "Reading PDF pages…" : "Preparing image…",
                }
              : item,
          ),
        );

        if (isPdf(file)) {
          const pages = await pdfFileToImages(file);
          for (const page of pages) {
            const jobId = `${batchId}-job-${jobs.length}`;
            const label = `${file.name} (page ${page.pageNumber})`;
            jobs.push({
              id: jobId,
              label,
              blob: page.blob,
              mimeType: page.mimeType,
              fileName: page.fileName,
            });
            jobMetas.push({
              id: jobId,
              label,
              fileName: page.fileName,
              mimeType: page.mimeType,
            });
            await persistJobBlob(userId, jobId, page.blob);
          }
        } else {
          const jobId = `${batchId}-job-${jobs.length}`;
          jobs.push({
            id: jobId,
            label: file.name,
            blob: file,
            mimeType: file.type || "image/jpeg",
            fileName: file.name,
          });
          jobMetas.push({
            id: jobId,
            label: file.name,
            fileName: file.name,
            mimeType: file.type || "image/jpeg",
          });
          await persistJobBlob(userId, jobId, file);
        }

        const partialQueue: ProcessingItem[] = jobs.map((job) => ({
          id: job.id,
          label: job.label,
          status: "pending",
        }));
        setQueue(partialQueue);
        await savePendingBatch({
          batchId,
          userId,
          updatedAt: new Date().toISOString(),
          queue: partialQueue,
          jobs: jobMetas,
        });
      }
    } catch {
      setProcessing(false);
      setProcessingStartedAt(null);
      setQueue([]);
      playExtractionErrorSound();
      toast.error("Could not read one of your PDF files. Check that the file is not corrupted and try again.");
      return;
    }

    if (!jobs.length) {
      setProcessing(false);
      setProcessingStartedAt(null);
      setQueue([]);
      playExtractionErrorSound();
      toast.error("No form pages were found in your upload.");
      return;
    }

    const validation = validateUploadBatch({
      files: supported,
      currentFormCount,
      pendingFormCount: jobs.length,
    });
    if (!validation.ok) {
      setProcessing(false);
      setProcessingStartedAt(null);
      setQueue([]);
      await clearPendingBatch(userId);
      playExtractionErrorSound();
      toast.error(validation.message, { duration: 8000 });
      return;
    }

    const initialQueue: ProcessingItem[] = jobs.map((job) => ({
      id: job.id,
      label: job.label,
      status: "pending" as const,
    }));
    setQueue(initialQueue);
    await savePendingBatch({
      batchId,
      userId,
      updatedAt: new Date().toISOString(),
      queue: initialQueue,
      jobs: jobMetas,
    });

    if (extractionCancelledRef.current) return;

    await beginExtractionWithSetup(String(batchId), jobs, initialQueue);
  };

  const runExtractionJobs = async (
    batchId: string,
    jobs: Array<{
      id: string;
      label: string;
      blob: Blob;
      mimeType: string;
      fileName: string;
    }>,
    startQueue: ProcessingItem[],
  ) => {
    if (!userId) {
      setProcessing(false);
      setProcessingStartedAt(null);
      return;
    }

    let added = 0;
    let duplicates = 0;
    let batchWarnings: string[] = [];
    let currentQueue = startQueue;
    const jobById = new Map(jobs.map((job) => [job.id, job]));

    const flushQueue = async (queue: ProcessingItem[]) => {
      await updatePendingQueue(userId, queue);
    };

    try {
    for (let i = 0; i < currentQueue.length; i += 1) {
      if (extractionCancelledRef.current) {
        break;
      }

      const queueItem = currentQueue[i]!;
      if (queueItem.status === "done" || queueItem.status === "duplicate") continue;

      const job = jobById.get(queueItem.id);
      if (!job) continue;

      if (loadNtsaRows(userId).length >= MAX_EXTRACTION_FORMS) {
        const message = `Session limit reached (100 forms). This file was not processed.`;
        currentQueue = currentQueue.map((item, idx) =>
          idx >= i ? { ...item, status: "error" as const, error: message } : item,
        );
        setQueue(currentQueue);
        void flushQueue(currentQueue);
        toast.error(message);
        break;
      }

      currentQueue = currentQueue.map((item, idx) =>
        idx === i ? { ...item, status: "processing" as const } : item,
      );
      setQueue(currentQueue);
      void flushQueue(currentQueue);

      try {
        const meta = sessionMetaRef.current;
        const extracted = await extractDocumentFromImage({
          ...job,
          documentType: meta.documentType,
        });

        if (extractionCancelledRef.current) {
          break;
        }

        if (extracted.typeMismatch) {
          const detectedLabel =
            extracted.detectedType === "ntsa_receipt"
              ? "a payment receipt"
              : extracted.detectedType === "ntsa_interim_license"
                ? "an interim driving license"
                : "a test application form";
          const message = `Wrong document type — looks like ${detectedLabel}`;
          currentQueue = currentQueue.map((item, idx) =>
            idx === i ? { ...item, status: "error" as const, error: message } : item,
          );
          toast.error(`${job.label}: ${message}`, { duration: 8000 });
          setQueue(currentQueue);
          void flushQueue(currentQueue);
          continue;
        }

        const row = applyEnabledFieldsToRow(extracted.row, meta);
        const result = appendNtsaRow(userId, row);
        setRows(result.rows);

        if (extracted.warnings.length) {
          batchWarnings.push(`${job.label}: ${extracted.warnings.join("; ")}`);
        }

        if (!result.added) {
          duplicates += 1;
          currentQueue = currentQueue.map((item, idx) =>
            idx === i ? { ...item, status: "duplicate" as const, error: "Already existing" } : item,
          );
        } else {
          added += 1;
          currentQueue = currentQueue.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "done" as const,
                  error: extracted.validFieldCount < 4 ? "Some fields need review" : undefined,
                }
              : item,
          );
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Extraction failed";
        currentQueue = currentQueue.map((item, idx) =>
          idx === i ? { ...item, status: "error" as const, error: message } : item,
        );
        toast.error(`${job.label}: ${message}`);
      }

      if (extractionCancelledRef.current) {
        break;
      }

      setQueue(currentQueue);
      void flushQueue(currentQueue);
      void syncDraftAndPending(loadNtsaRows(userId), currentQueue, batchId);
    }

    if (extractionCancelledRef.current) {
      if (!extractionCancelUiAppliedRef.current) {
        currentQueue = cancelActiveQueueItems(currentQueue);
        await flushQueue(currentQueue);
        await clearPendingBatch(userId);
        setResumableCount(0);
        await syncDraftAndPending(loadNtsaRows(userId), currentQueue);
        playExtractionErrorSound();
        toast.message("Extraction cancelled — extracted forms are still in your spreadsheet.");
        setQueue([]);
      }
    } else {
      await flushQueue(currentQueue);
      await syncDraftAndPending(loadNtsaRows(userId), currentQueue, batchId);

      if (added > 0) {
        toast.success(`Added ${added} new form${added === 1 ? "" : "s"} to the spreadsheet`);
      }
      if (duplicates > 0) {
        toast.message(
          `${duplicates} duplicate form${duplicates === 1 ? "" : "s"} skipped — same name and ID number already in your list.`,
          { duration: 7000 },
        );
      }
      if (batchWarnings.length) {
        toast.message(
          `${batchWarnings.length} form${batchWarnings.length === 1 ? "" : "s"} need review — check the queue for details.`,
          { duration: 7000 },
        );
      }

      const batchIdle = isQueueIdle(currentQueue);
      if (batchIdle) {
        await clearPendingBatch(userId);
        setResumableCount(0);
        if (isBatchComplete(currentQueue)) {
          await saveAutoDraft(userId, loadNtsaRows(userId), null);
          setDraftsRefreshKey((k) => k + 1);
        }
        if (queueHasExtractionErrors(currentQueue)) {
          playExtractionErrorSound();
        } else {
          playExtractionDoneSound();
        }
        setQueue([]);
      }
    }
    } catch {
      if (!extractionCancelledRef.current) {
        playExtractionErrorSound();
        toast.error("Extraction stopped unexpectedly. Save or download your results, then try again.");
      }
    } finally {
      setProcessing(false);
      setProcessingStartedAt(null);
      extractionCancelledRef.current = false;
      extractionCancelUiAppliedRef.current = false;
    }
  };

  const continueInterruptedExtraction = async () => {
    if (extractionBusy || !userId) return;

    const batch = await loadPendingBatch(userId);
    if (!batch) {
      setResumableCount(0);
      toast.message("No interrupted upload found on this device.");
      return;
    }

    const resumableJobs = await loadResumableJobs(userId);
    if (!resumableJobs.length) {
      const files = await loadUploadFiles(userId, batch.batchId);
      if (files.length) {
        toast.message("Re-reading your saved upload files…");
        await processFiles(files);
        return;
      }
      toast.error("Uploaded files are no longer available in this browser. Please upload again.");
      setResumableCount(0);
      return;
    }

    const allJobs = (
      await Promise.all(
        batch.jobs.map(async (meta) => {
          const blob = await loadJobBlob(userId, meta.id);
          if (!blob) return null;
          return { ...meta, blob };
        }),
      )
    ).filter((job): job is NonNullable<typeof job> => job !== null);

    if (!allJobs.length) {
      toast.error("Could not load saved form images from this browser.");
      return;
    }

    setProcessing(true);
    setProcessingStartedAt(Date.now());
    setQueue(batch.queue);
    setActiveTab("extract");
    extractionCancelledRef.current = false;
    toast.message(`Continuing extraction — ${countResumableJobs(batch.queue)} form(s) remaining`);

    await runExtractionJobs(batch.batchId, allJobs, batch.queue);
    await refreshResumableState();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadBlocked) return;
    const files = e.target.files;
    if (files?.length) void processFiles(files);
    e.target.value = "";
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploadBlocked) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!uploadBlocked) e.dataTransfer.dropEffect = "copy";
    else e.dataTransfer.dropEffect = "none";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (uploadBlocked) return;
    const files = e.dataTransfer.files;
    if (files?.length) void processFiles(files);
  };

  const handleClearConfirmed = async () => {
    if (!userId) return;
    const wasSaved = sessionAlreadySaved;
    await clearActiveSession({ archiveCleared: !wasSaved });
    setClearDialogOpen(false);
    toast.message(
      wasSaved
        ? "Working session cleared — your copy remains in history"
        : "Session cleared — use Help · Restore session if you need it back",
    );
  };

  const handleSaveToHistory = async (baseName: string) => {
    if (!userId || !rows.length) {
      toast.error("No data to save yet");
      return;
    }
    try {
      const rowsToSave = rows.map((row) => ({
        ...row,
        documentType: row.documentType ?? sessionMeta.documentType,
      }));
      const entry = await saveSessionToHistory(userId, rowsToSave, baseName, {
        email: profile?.email ?? null,
        name: profile?.name ?? null,
      }, sessionMeta);
      const fingerprint = fingerprintSessionRows(rows);
      await markSessionSavedToHistory(userId, fingerprint, entry.label);
      setSavedSessionFingerprint(fingerprint);
      setSavedHistoryLabel(entry.label);
      setPendingHistoryEntry(entry);
      setSaveDialogOpen(false);
      setHistoryRefreshKey((k) => k + 1);
      setActiveTab("history");
      toast.success(`Saved as ${entry.label}`);
    } catch (e) {
      console.error("Save to history failed", e);
      const message =
        e instanceof Error && e.message.includes("Firestore")
          ? "Cloud save is unavailable. Download Excel to keep a copy."
          : "Could not save to history. Try again or download Excel.";
      toast.error(message);
    }
  };

  const openSaveFromClear = () => {
    setClearDialogOpen(false);
    setSaveDialogOpen(true);
  };

  const handleRemoveRow = (index: number) => {
    const next = rows
      .filter((_, i) => i !== index)
      .map((row, rowIndex) => ({ ...row, sourcePage: rowIndex + 1 }));
    updateRows(next);
  };

  const handleUpdateCell = (index: number, fieldId: ExtractionFieldId, value: string) => {
    const next = rows.map((row, i) =>
      i === index ? setRowFieldValue(row, fieldId, value) : row,
    );
    updateRows(next);
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (pin.trim() === accessPin) {
      try {
        sessionStorage.setItem(unlockKey(userId), "1");
      } catch {
        /* ignore */
      }
      setPinError(null);
      setUnlocked(true);
      return;
    }
    setPinError("Incorrect PIN.");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center text-amber-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <>
        <PageSeo
          config={{
            title: "Data Extraction Application Forms",
            description: "Sign in to use the data extraction tool.",
            path: "/extraction",
            noindex: true,
          }}
        />
        <ExtractionAuthGate />
      </>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#08080c] flex flex-col items-center justify-center p-6">
        <PageSeo
          config={{
            title: "Data Extraction Application Forms",
            description: "Enter the access PIN to use the data extraction tool.",
            path: "/extraction",
            noindex: true,
          }}
        />
        <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-[#12121a] p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-white text-center mb-2">Data extraction</h1>
          <p className="text-sm text-amber-300/90 text-center mb-1">{extractionGreeting(profile.name)}</p>
          <p className="text-sm text-zinc-400 text-center mb-6">Enter the access PIN to continue.</p>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <Label htmlFor="extraction-pin" className="text-zinc-300">
                PIN
              </Label>
              <Input
                id="extraction-pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setPinError(null);
                }}
                className="mt-1.5 border-white/10 bg-[#0c0c12] text-white"
                placeholder="••••"
              />
              {pinError && <p className="text-sm text-red-400 mt-2">{pinError}</p>}
            </div>
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">
              Unlock
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            className="w-full mt-4 gap-2 text-zinc-400 hover:text-white"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ExtractionDownloadProvider userId={userId}>
    <TechMediaLayout>
      <PageSeo
        config={{
          title: "Data Extraction Application Forms",
          description: "Upload application forms and export extracted data to Excel.",
          path: "/extraction",
          noindex: true,
        }}
      />

      <section className="border-b border-white/10 bg-gradient-to-b from-amber-500/10 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 sm:text-sm">
                Data extraction
              </p>
              <p className="mt-2 text-lg font-medium text-amber-200/90">{extractionGreeting(profile.name)}</p>
              <h1 className="mt-1 text-3xl font-bold leading-tight text-white sm:text-4xl">
                Data Extraction Application Forms
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <RestoreSessionHelp userId={userId} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/15 text-zinc-300 hover:bg-white/5"
                onClick={() => void signOut()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-8 flex gap-2 border-b border-white/10 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab("extract")}
            className={cn(
              "rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "extract"
                ? "bg-amber-500/15 text-amber-300"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            Extract data
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("drafts")}
            className={cn(
              "rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "drafts"
                ? "bg-sky-500/15 text-sky-300"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            Drafts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "history"
                ? "bg-violet-500/15 text-violet-300"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("combine")}
            className={cn(
              "rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "combine"
                ? "bg-indigo-500/15 text-indigo-300"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            Combine
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("qa")}
            className={cn(
              "rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "qa"
                ? "bg-teal-500/15 text-teal-300"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            QA audit
          </button>
        </div>

        {activeTab === "history" ? (
          <ExtractionHistoryTab
            userId={userId}
            refreshKey={historyRefreshKey}
            pendingEntry={pendingHistoryEntry}
            onHistoryChange={() => {
              setPendingHistoryEntry(null);
              setHistoryRefreshKey((k) => k + 1);
            }}
          />
        ) : activeTab === "drafts" ? (
          <ExtractionDraftsTab
            userId={userId}
            refreshKey={draftsRefreshKey}
            resumableCount={resumableCount}
            onContinueExtraction={() => void continueInterruptedExtraction()}
            onRestoreToSession={(restoredRows) => {
              setRows(restoredRows);
              setActiveTab("extract");
            }}
            onDraftsChange={() => setDraftsRefreshKey((k) => k + 1)}
          />
        ) : activeTab === "qa" ? (
          <QaAuditPanel />
        ) : activeTab === "combine" ? (
          <CombineSpreadsheetsPanel
            onLoadToSession={(combinedRows) => {
              saveNtsaRows(userId, combinedRows);
              setRows(combinedRows);
              setActiveTab("extract");
            }}
          />
        ) : (
        <div className="space-y-8">
          {resumableCount > 0 && !extractionBusy && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-sky-200">Extraction was interrupted</p>
                <p className="mt-0.5 text-xs text-sky-200/70">
                  {resumableCount} uploaded form{resumableCount === 1 ? "" : "s"} still waiting — your files are
                  saved in this browser.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="bg-sky-600 hover:bg-sky-700"
                onClick={() => void continueInterruptedExtraction()}
              >
                <Play className="mr-2 h-4 w-4" />
                Continue extraction
              </Button>
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <div className="space-y-6">
            <div
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
              aria-busy={uploadBlocked}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-dashed p-8 text-center transition-all duration-300",
                uploadBlocked && "opacity-90",
                isDragging && !uploadBlocked
                  ? "border-orange-400 bg-gradient-to-br from-orange-500/25 via-amber-500/15 to-[#12121a] shadow-[0_0_40px_rgba(251,146,60,0.35)] scale-[1.01]"
                  : "border-amber-500/30 bg-[#12121a] hover:border-amber-500/50",
              )}
            >
              {extractionBusy && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#12121a]/80 backdrop-blur-[1px] px-6">
                  <div className="text-center">
                    <div
                      className={cn(
                        "flex items-center justify-center gap-2",
                        isUploadingFiles ? "text-sky-300" : "text-amber-300",
                      )}
                    >
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-medium">
                        {isUploadingFiles ? "Uploading — reading your files…" : "Extracting form data…"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">See the queue on the right for details.</p>
                  </div>
                </div>
              )}
              {sessionBlocksUpload && !extractionBusy && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#12121a]/80 backdrop-blur-[1px] px-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-amber-300">Session complete — choose an action</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Use <span className="text-zinc-300">Save to history</span>,{" "}
                      <span className="text-zinc-300">Download Excel</span>, or{" "}
                      <span className="text-zinc-300">Clear session</span> below, then upload again.
                    </p>
                  </div>
                </div>
              )}
              {isDragging && !uploadBlocked && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-orange-500/10 backdrop-blur-[1px]">
                  <p className="animate-pulse text-2xl font-black uppercase tracking-wide text-orange-300 drop-shadow-[0_0_12px_rgba(251,146,60,0.8)] sm:text-3xl">
                    Drop it like it&apos;s hot
                  </p>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={onFileChange}
                disabled={uploadBlocked}
              />
              <div
                className={cn(
                  "mx-auto flex h-14 w-14 items-center justify-center rounded-full transition-colors",
                  isDragging ? "bg-orange-500/25 text-orange-300" : "bg-amber-500/15 text-amber-400",
                )}
              >
                <Upload className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">Upload forms</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Drag and drop images or PDFs here, or choose files from your device.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Max {MAX_UPLOAD_MB} MB per upload · {rows.length}/{MAX_EXTRACTION_FORMS} forms in session
              </p>
              <Button
                type="button"
                className="mt-6 bg-amber-600 hover:bg-amber-700"
                disabled={uploadBlocked || rows.length >= MAX_EXTRACTION_FORMS}
                onClick={() => !uploadBlocked && inputRef.current?.click()}
              >
                {extractionBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploadingFiles ? "Uploading…" : "Processing…"}
                  </>
                ) : sessionBlocksUpload ? (
                  "Save or clear session first"
                ) : rows.length >= MAX_EXTRACTION_FORMS ? (
                  "Session full (100 forms)"
                ) : (
                  "Choose files"
                )}
              </Button>
            </div>

            <div className="flex flex-wrap gap-3">
              {showCancelExtraction && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  <Square className="mr-2 h-4 w-4 fill-current" />
                  Cancel extraction
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="border-white/15 text-zinc-300 hover:bg-white/5 hover:text-white"
                onClick={openFieldSettings}
                disabled={extractionBusy}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Change fields
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/15 text-white hover:bg-white/5"
                onClick={() => setSaveDialogOpen(true)}
                disabled={!rows.length || extractionBusy}
              >
                <History className="mr-2 h-4 w-4" />
                Save to history
              </Button>
              {sessionExtractionComplete && <SessionDownloadButton rows={rows} />}
              <Button
                type="button"
                variant="outline"
                className="border-white/15 text-zinc-400 hover:bg-white/5 hover:text-white"
                onClick={() => setClearDialogOpen(true)}
                disabled={(!rows.length && !queue.length) || extractionBusy}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear session
              </Button>
            </div>
            </div>

            {extractionBusy ? (
            <ProcessingQueuePanel
              queue={queue}
              processing={processing}
              startedAt={processingStartedAt}
            />
            ) : (
            <div className="flex h-full min-h-[280px] flex-col rounded-2xl border border-white/10 bg-[#0c0c12] p-5">
              <h3 className="text-sm font-semibold text-white">Extraction complete</h3>
              <p className="mt-3 flex flex-1 items-center justify-center text-sm text-emerald-400/90">
                {rows.length > 0
                  ? `${rows.length} form${rows.length === 1 ? "" : "s"} ready — save or download below.`
                  : "Upload forms to start extracting."}
              </p>
            </div>
            )}
          </div>

          {rows.length > 0 && (
            <div
              className={cn(
                "rounded-xl border px-4 py-3 text-sm",
                sessionAlreadySaved
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200",
              )}
            >
              {sessionAlreadySaved && savedHistoryLabel ? (
                <>
                  Saved to history as <span className="font-medium">{savedHistoryLabel}</span>. You can upload
                  again to start a new session, or clear the working spreadsheet.
                </>
              ) : (
                <>
                  {rows.length} form{rows.length === 1 ? "" : "s"} ready. Use{" "}
                  <span className="font-medium">Save to history</span>,{" "}
                  <span className="font-medium">Download Excel</span>, or{" "}
                  <span className="font-medium">Clear session</span> above — then you can upload again.
                </>
              )}
            </div>
          )}

          <SessionSpreadsheetPanel
            rows={rows}
            meta={sessionMeta}
            onRemoveRow={handleRemoveRow}
            onUpdateCell={handleUpdateCell}
          />

          <DocumentSetupDialog
            open={setupDialogOpen}
            classification={setupClassification}
            initialMeta={setupInitialMeta ?? sessionMeta}
            preferDetectedType={setupPreferDetectedType}
            allowTypeChange={setupAllowTypeChange}
            title={pendingExtractionRef.current ? "Confirm what to extract" : "Change extraction fields"}
            description={
              pendingExtractionRef.current
                ? "We detected your document type and switched to it automatically. Press Enter to start extraction, or pick another type if we got it wrong."
                : "Update which columns appear in your spreadsheet and Excel export."
            }
            confirmLabel={pendingExtractionRef.current ? "Start extraction" : "Save fields"}
            onConfirm={handleDocumentSetupConfirm}
            onCancel={handleDocumentSetupCancel}
          />

          <SaveHistoryDialog
            open={saveDialogOpen}
            onOpenChange={setSaveDialogOpen}
            sessionMeta={sessionMeta}
            onConfirm={handleSaveToHistory}
          />

          <ClearSessionDialog
            open={clearDialogOpen}
            onOpenChange={setClearDialogOpen}
            onConfirm={() => void handleClearConfirmed()}
            onSaveFirst={rows.length && !sessionAlreadySaved ? openSaveFromClear : undefined}
            hasRows={rows.length > 0}
            alreadySavedLabel={sessionAlreadySaved ? savedHistoryLabel : null}
          />
        </div>
        )}
      </section>

      <CancelExtractionDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleCancelExtractionConfirmed}
        pendingCount={activeQueueCount}
        extractedCount={rows.length}
      />
    </TechMediaLayout>
    </ExtractionDownloadProvider>
  );
}
