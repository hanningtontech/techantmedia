export function getTimeSalutation(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function firstNameFromDisplayName(name: string | null | undefined): string {
  if (!name?.trim()) return "there";
  return name.trim().split(/\s+/)[0] ?? "there";
}

export function extractionGreeting(name: string | null | undefined, date = new Date()): string {
  return `${getTimeSalutation(date)}, ${firstNameFromDisplayName(name)}`;
}
