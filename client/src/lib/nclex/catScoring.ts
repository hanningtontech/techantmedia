/**
 * Post-hoc CAT-style ability estimate from a fixed item sequence.
 * Uses a simple 1PL-style sequential update with stable pseudo-difficulties per question id
 * (not calibrated IRT parameters — suitable for UX scoring when items are not adaptively chosen).
 */

export type CatAttemptItem = {
  questionId: string;
  isCorrect: boolean;
};

/** Stable difficulty b in roughly [-1.2, 1.2] from question id. */
export function stableItemDifficulty(questionId: string): number {
  let h = 0;
  for (let i = 0; i < questionId.length; i++) {
    h = (h * 31 + questionId.charCodeAt(i)) | 0;
  }
  const u = ((h >>> 0) % 10000) / 10000;
  return u * 2.4 - 1.2;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Runs a short ability track similar to online ability estimation in CAT,
 * then maps ability to a 0–100 report score.
 */
export function computeCatScoreFromAttempt(items: CatAttemptItem[]): {
  theta: number;
  standardError: number;
  score0to100: number;
} {
  if (!items.length) {
    return { theta: 0, standardError: 99, score0to100: 0 };
  }

  let theta = 0;
  const learningRate = 0.45;
  for (const { questionId, isCorrect } of items) {
    const b = stableItemDifficulty(questionId);
    const p = sigmoid(theta - b);
    theta += learningRate * ((isCorrect ? 1 : 0) - p);
  }

  // Crude standard error from Fisher-ish information at final theta.
  let info = 0.001;
  for (const { questionId } of items) {
    const b = stableItemDifficulty(questionId);
    const p = sigmoid(theta - b);
    info += p * (1 - p);
  }
  const se = 1 / Math.sqrt(info);

  const score0to100 = Math.max(0, Math.min(100, Math.round(50 + 14 * theta - 4 * se)));
  return { theta: Math.round(theta * 1000) / 1000, standardError: Math.round(se * 1000) / 1000, score0to100 };
}
