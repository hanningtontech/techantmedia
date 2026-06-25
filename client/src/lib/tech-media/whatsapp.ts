/** Strip to digits for wa.me (e.g. +254 759… → 254759550133). */
export function normalizeWhatsAppNumber(input: string): string {
  return input.replace(/\D/g, "");
}

export function buildWhatsAppUrl(number: string, message: string): string {
  const digits = normalizeWhatsAppNumber(number);
  if (!digits) return "";
  const text = encodeURIComponent(message.trim());
  return `https://wa.me/${digits}${text ? `?text=${text}` : ""}`;
}

export function buildBookingMessage(opts: {
  brandName: string;
  service: string;
  name?: string;
  preferredDate?: string;
  notes?: string;
}): string {
  const lines = [
    `Hi ${opts.brandName}, I'd like to book a session.`,
    `Service: ${opts.service}`,
  ];
  if (opts.name?.trim()) lines.push(`Name: ${opts.name.trim()}`);
  if (opts.preferredDate?.trim()) lines.push(`Preferred date: ${opts.preferredDate.trim()}`);
  if (opts.notes?.trim()) lines.push(`Notes: ${opts.notes.trim()}`);
  return lines.join("\n");
}

export function buildInspoWhatsAppMessage(opts: {
  brandName: string;
  shareUrl: string;
  photoCount: number;
  clientName?: string;
}): string {
  const lines = [
    `Hi ${opts.brandName}, I've picked some inspiration photos for my session.`,
    `Inspos (${opts.photoCount} images): ${opts.shareUrl}`,
  ];
  if (opts.clientName?.trim()) lines.push(`Name: ${opts.clientName.trim()}`);
  lines.push("Please let me know availability and packages. Thank you!");
  return lines.join("\n");
}

export function buildInquiryMessage(opts: {
  brandName: string;
  packageName: string;
  groupLabel: string;
  price: string;
}): string {
  return [
    `Hi ${opts.brandName}, I'm interested in your ${opts.groupLabel} package.`,
    `Package: ${opts.packageName} (${opts.price})`,
    "Please share availability and any custom options.",
  ].join("\n");
}
