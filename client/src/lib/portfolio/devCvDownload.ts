/** Public developer CV on `/development` (Hosting rewrites `/api/*` to Cloud Function). */
export const DEV_CV_DOWNLOAD_PATH = "/api/download-dev-cv";

export function devCvDownloadHref(download?: boolean): string {
  return download ? `${DEV_CV_DOWNLOAD_PATH}?download=1` : DEV_CV_DOWNLOAD_PATH;
}
