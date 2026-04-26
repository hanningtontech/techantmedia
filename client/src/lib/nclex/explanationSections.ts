export type ExplanationSection = {
  title: string;
  body: string;
};

const HEADING_RULES: Array<{ re: RegExp; title: string }> = [
  { re: /^Key\s+terms\s+explained\s*:\s*(.*)$/i, title: "Key terms explained" },
  { re: /^Key\s+terms\s*:\s*(.*)$/i, title: "Key terms explained" },
  { re: /^Why\s+the\s+others\s+are\s+not\s+correct\s*:\s*(.*)$/i, title: "Why the others are not correct" },
  { re: /^Why\s+others\s+(?:are\s+)?(?:not\s+)?correct\s*:\s*(.*)$/i, title: "Why the others are not correct" },
];

function pushIfNonEmpty(out: ExplanationSection[], title: string, lines: string[]) {
  const body = lines.join("\n").trim();
  if (!body) return;
  out.push({ title, body });
}

/**
 * Splits one long rationale into neat UI sections.
 * Keeps existing imports compatible: if no headings are present, returns one "Rationale" section.
 */
export function splitExplanationSections(rationale: string): ExplanationSection[] {
  const raw = (rationale ?? "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  const out: ExplanationSection[] = [];
  let currentTitle = "Rationale";
  let currentLines: string[] = [];

  for (const lineRaw of raw.split("\n")) {
    const line = lineRaw.trimEnd();
    const rule = HEADING_RULES.find((r) => r.re.test(line.trim()));
    if (rule) {
      pushIfNonEmpty(out, currentTitle, currentLines);
      currentTitle = rule.title;
      currentLines = [];
      const m = line.trim().match(rule.re);
      const inline = (m?.[1] ?? "").trim();
      if (inline) currentLines.push(inline);
      continue;
    }
    currentLines.push(line);
  }

  pushIfNonEmpty(out, currentTitle, currentLines);
  return out;
}

