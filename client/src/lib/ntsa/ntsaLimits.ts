export const MAX_EXTRACTION_FORMS = 100;
export const MAX_UPLOAD_MB = 100;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function validateUploadBatch(args: {
  files: File[];
  currentFormCount: number;
  pendingFormCount: number;
}): { ok: true } | { ok: false; message: string } {
  const totalBytes = args.files.reduce((sum, file) => sum + file.size, 0);

  if (totalBytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `This upload is ${formatMegabytes(totalBytes)} MB. Each drag-and-drop or file selection is limited to ${MAX_UPLOAD_MB} MB. Split your PDF or images into smaller batches and try again.`,
    };
  }

  const totalAfter = args.currentFormCount + args.pendingFormCount;
  if (totalAfter > MAX_EXTRACTION_FORMS) {
    const slotsLeft = Math.max(0, MAX_EXTRACTION_FORMS - args.currentFormCount);
    return {
      ok: false,
      message:
        slotsLeft === 0
          ? `You already have ${args.currentFormCount} forms in this session, which is the maximum of 100. Download your Excel or clear the session before uploading more.`
          : `You have ${args.currentFormCount} form${args.currentFormCount === 1 ? "" : "s"} in this session and tried to add ${args.pendingFormCount} more, but the limit is 100 forms per session. You can add at most ${slotsLeft} more form${slotsLeft === 1 ? "" : "s"} right now.`,
    };
  }

  return { ok: true };
}
