/** Normalized OCR token with bounding box (pixel coordinates from Tesseract). */
export type OcrToken = {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
};

export type OcrLine = {
  text: string;
  tokens: OcrToken[];
  y0: number;
  y1: number;
};

type TesseractWord = {
  text?: string;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
  confidence?: number;
};

export function tokensFromTesseractWords(words: TesseractWord[] | undefined): OcrToken[] {
  if (!words?.length) return [];
  return words
    .filter((w) => w.text?.trim())
    .map((w) => ({
      text: w.text!.trim(),
      x0: w.bbox?.x0 ?? 0,
      y0: w.bbox?.y0 ?? 0,
      x1: w.bbox?.x1 ?? 0,
      y1: w.bbox?.y1 ?? 0,
      confidence: w.confidence ?? 0,
    }));
}

/** Group tokens into horizontal lines by vertical overlap. */
export function groupTokensIntoLines(tokens: OcrToken[], yTolerance = 14): OcrLine[] {
  if (!tokens.length) return [];
  const sorted = [...tokens].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines: OcrLine[] = [];

  for (const token of sorted) {
    const line = lines.find(
      (l) => Math.abs(l.y0 - token.y0) <= yTolerance || token.y0 <= l.y1 + yTolerance,
    );
    if (line) {
      line.tokens.push(token);
      line.y0 = Math.min(line.y0, token.y0);
      line.y1 = Math.max(line.y1, token.y1);
      line.text = `${line.text} ${token.text}`.trim();
    } else {
      lines.push({
        text: token.text,
        tokens: [token],
        y0: token.y0,
        y1: token.y1,
      });
    }
  }

  for (const line of lines) {
    line.tokens.sort((a, b) => a.x0 - b.x0);
    line.text = line.tokens.map((t) => t.text).join(" ");
  }

  return lines;
}

export function linesToText(lines: OcrLine[]): string {
  return lines.map((l) => l.text).join("\n");
}

/** Find value token(s) to the right of a label on the same line. */
export function valueRightOfLabel(
  lines: OcrLine[],
  labelPattern: RegExp,
  maxGapPx = 120,
): string {
  for (const line of lines) {
    const labelIdx = line.tokens.findIndex((t) => labelPattern.test(t.text));
    if (labelIdx < 0) continue;

    const label = line.tokens[labelIdx]!;
    const after = line.tokens.slice(labelIdx + 1);
    const onSameLine = after
      .filter((t) => t.x0 - label.x1 <= maxGapPx)
      .map((t) => t.text)
      .join(" ")
      .trim();
    if (onSameLine) return onSameLine;

    const below = lines.find(
      (l) => l.y0 > line.y1 && l.y0 - line.y1 < maxGapPx && Math.abs(l.tokens[0]!.x0 - label.x0) < maxGapPx,
    );
    if (below?.text) return below.text;
  }
  return "";
}
