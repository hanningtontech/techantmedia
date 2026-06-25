import type { ProcessingItem } from "@/pages/ntsa/ProcessingQueuePanel";

const DB_NAME = "ntsa-extraction-pending";
const DB_VERSION = 1;
const BATCH_STORE = "batches";
const BLOB_STORE = "blobs";
const UPLOAD_STORE = "uploads";

export type PendingJobMeta = {
  id: string;
  label: string;
  fileName: string;
  mimeType: string;
};

export type PendingBatch = {
  batchId: string;
  userId: string;
  updatedAt: string;
  queue: ProcessingItem[];
  jobs: PendingJobMeta[];
};

export type PendingExtractionJob = PendingJobMeta & {
  blob: Blob;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BATCH_STORE)) db.createObjectStore(BATCH_STORE);
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
      if (!db.objectStoreNames.contains(UPLOAD_STORE)) db.createObjectStore(UPLOAD_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function batchKey(userId: string): string {
  return userId;
}

function blobKey(userId: string, jobId: string): string {
  return `${userId}:${jobId}`;
}

function uploadKey(userId: string, batchId: string, index: number): string {
  return `${userId}:${batchId}:upload:${index}`;
}

async function idbPut(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet<T>(store: string, key: string): Promise<T | null> {
  const db = await openDb();
  const value = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

async function idbDeletePrefix(store: string, prefix: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const req = os.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const key = String(cursor.key);
      if (key.startsWith(prefix)) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Keep original uploads so a batch can be rebuilt after interruption. */
export async function persistUploadFiles(userId: string, batchId: string, files: File[]): Promise<void> {
  await Promise.all(
    files.map((file, index) => idbPut(UPLOAD_STORE, uploadKey(userId, batchId, index), file)),
  );
}

export async function loadUploadFiles(userId: string, batchId: string): Promise<File[]> {
  const files: File[] = [];
  for (let index = 0; index < 200; index += 1) {
    const file = await idbGet<File>(UPLOAD_STORE, uploadKey(userId, batchId, index));
    if (!file) break;
    files.push(file);
  }
  return files;
}

export async function persistJobBlob(userId: string, jobId: string, blob: Blob): Promise<void> {
  await idbPut(BLOB_STORE, blobKey(userId, jobId), blob);
}

export async function loadJobBlob(userId: string, jobId: string): Promise<Blob | null> {
  return idbGet<Blob>(BLOB_STORE, blobKey(userId, jobId));
}

export async function savePendingBatch(batch: PendingBatch): Promise<void> {
  await idbPut(BATCH_STORE, batchKey(batch.userId), {
    ...batch,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadPendingBatch(userId: string): Promise<PendingBatch | null> {
  return idbGet<PendingBatch>(BATCH_STORE, batchKey(userId));
}

export async function updatePendingQueue(userId: string, queue: ProcessingItem[]): Promise<void> {
  const batch = await loadPendingBatch(userId);
  if (!batch) return;
  await savePendingBatch({ ...batch, queue });
}

export async function clearPendingBatch(userId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([BATCH_STORE, BLOB_STORE, UPLOAD_STORE], "readwrite");
    tx.objectStore(BATCH_STORE).delete(batchKey(userId));

    for (const store of [BLOB_STORE, UPLOAD_STORE]) {
      const os = tx.objectStore(store);
      const req = os.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(`${userId}:`)) cursor.delete();
        cursor.continue();
      };
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function countResumableJobs(queue: ProcessingItem[]): number {
  return queue.filter((item) => item.status === "pending" || item.status === "error").length;
}

/** Jobs not yet finished — used for the “interrupted extraction” banner only. */
export function countPendingJobs(queue: ProcessingItem[]): number {
  return queue.filter((item) => item.status === "pending" || item.status === "uploading").length;
}

const ACTIVE_QUEUE_STATUSES = new Set<ProcessingItem["status"]>([
  "uploading",
  "pending",
  "processing",
]);

export function isQueueBusy(queue: ProcessingItem[]): boolean {
  return queue.some((item) => ACTIVE_QUEUE_STATUSES.has(item.status));
}

export function isQueueIdle(queue: ProcessingItem[]): boolean {
  return queue.length > 0 && !isQueueBusy(queue);
}

export function queueHasExtractionErrors(queue: ProcessingItem[]): boolean {
  return queue.some((item) => item.status === "error");
}

export function cancelActiveQueueItems(queue: ProcessingItem[]): ProcessingItem[] {
  return queue.map((item) =>
    item.status === "uploading" || item.status === "pending" || item.status === "processing"
      ? { ...item, status: "error" as const, error: "Cancelled" }
      : item,
  );
}

export function countActiveQueueItems(queue: ProcessingItem[]): number {
  return queue.filter(
    (item) => item.status === "uploading" || item.status === "pending" || item.status === "processing",
  ).length;
}

export function isBatchComplete(queue: ProcessingItem[]): boolean {
  return queue.length > 0 && queue.every(
    (item) => item.status === "done" || item.status === "duplicate",
  );
}

export async function loadResumableJobs(userId: string): Promise<PendingExtractionJob[]> {
  const batch = await loadPendingBatch(userId);
  if (!batch) return [];

  const jobs: PendingExtractionJob[] = [];
  for (const item of batch.queue) {
    if (item.status !== "pending" && item.status !== "error") continue;
    const meta = batch.jobs.find((job) => job.id === item.id);
    if (!meta) continue;
    const blob = await loadJobBlob(userId, item.id);
    if (!blob) continue;
    jobs.push({ ...meta, blob });
  }
  return jobs;
}
