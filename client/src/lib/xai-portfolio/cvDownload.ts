/** Public CV endpoint (Firebase Hosting rewrites /api/* to Cloud Function). */
export const CV_DOWNLOAD_PATH = "/api/download-cv";

export function cvDownloadHref(download?: boolean): string {
  return download ? `${CV_DOWNLOAD_PATH}?download=1` : CV_DOWNLOAD_PATH;
}
