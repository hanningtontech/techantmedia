import { formatKes } from "./formatKes";

/** Short KES label for tight UI — e.g. 10k, 100k, 1.5m (only for large magnitudes). */
export function formatKesAbbrev(
  amount: number,
  opts?: { signed?: boolean; omitCurrency?: boolean },
): string {
  const abs = Math.abs(amount);
  const sign =
    opts?.signed && amount > 0 ? "+" : amount < 0 ? "−" : "";
  const currency = opts?.omitCurrency ? "" : "Ksh ";

  if (abs < 1000) {
    const base = formatKes(amount, { compact: true });
    if (opts?.omitCurrency) {
      return `${sign}${base.replace(/^−?Ksh\s*/i, "")}`;
    }
    return base;
  }

  let body: string;
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    body = m >= 10 || Number.isInteger(m) ? `${Math.round(m)}m` : `${m.toFixed(1)}m`;
  } else if (abs >= 10_000) {
    body = `${Math.round(abs / 1000)}k`;
  } else {
    const k = abs / 1000;
    body = Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }

  return `${sign}${currency}${body}`;
}
