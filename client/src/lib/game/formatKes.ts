export function formatKes(amount: number, opts?: { compact?: boolean }): string {
  const abs = Math.abs(amount);
  const digits = opts?.compact && abs >= 1000 ? 0 : 2;
  const formatted = abs.toLocaleString("en-KE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (amount > 0) return `Ksh ${formatted}`;
  if (amount < 0) return `−Ksh ${formatted}`;
  return `Ksh ${formatted}`;
}
