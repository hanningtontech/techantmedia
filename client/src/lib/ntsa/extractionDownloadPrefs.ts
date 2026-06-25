export type ExtractionDownloadPrefs = {
  baseName: string;
  nextSequence: number;
  autoSaveToFolder: boolean;
  folderLabel: string | null;
};

const PREFS_KEY_PREFIX = "ntsa_download_prefs_";
const HANDLE_DB = "ntsa-extraction-downloads";
const HANDLE_STORE = "directory-handles";

function prefsKey(userId: string): string {
  return `${PREFS_KEY_PREFIX}${userId}`;
}

export function loadDownloadPrefs(userId: string): ExtractionDownloadPrefs | null {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExtractionDownloadPrefs;
    if (!parsed || typeof parsed.baseName !== "string") return null;
    return {
      baseName: parsed.baseName,
      nextSequence: typeof parsed.nextSequence === "number" ? parsed.nextSequence : 1,
      autoSaveToFolder: parsed.autoSaveToFolder === true,
      folderLabel: typeof parsed.folderLabel === "string" ? parsed.folderLabel : null,
    };
  } catch {
    return null;
  }
}

export function saveDownloadPrefs(userId: string, prefs: ExtractionDownloadPrefs): void {
  try {
    localStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function formatNumberedFileName(baseName: string, sequence: number): string {
  const cleaned = baseName.trim().replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, " ") || "extraction";
  return `${cleaned} ${sequence}.xlsx`;
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(HANDLE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(
  userId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    tx.objectStore(HANDLE_STORE).put(handle, userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDirectoryHandle(userId: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const req = tx.objectStore(HANDLE_STORE).get(userId);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

export async function clearDirectoryHandle(userId: string): Promise<void> {
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      tx.objectStore(HANDLE_STORE).delete(userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

export function supportsFolderPicker(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function ensureDirectoryPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

export async function writeExcelToDirectory(
  handle: FileSystemDirectoryHandle,
  fileName: string,
  buffer: ArrayBuffer,
): Promise<void> {
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(buffer);
  await writable.close();
}
