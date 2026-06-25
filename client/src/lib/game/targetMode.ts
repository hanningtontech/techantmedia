/** Contact shown on target-hit sticky note. */
export const TARGET_OWES_PHONE = "0759550133";

export function minTargetBalance(currentBalance: number): number {
  return Math.max(1, Math.ceil(currentBalance * 2));
}

export function isValidTargetBalance(currentBalance: number, target: number): boolean {
  return Number.isFinite(target) && target >= minTargetBalance(currentBalance);
}

export function targetProfitAmount(target: number, baseline: number): number {
  return Math.max(0, Math.round(target - baseline));
}
