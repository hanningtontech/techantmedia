/**
 * Parses tutor/admin bulk question pastes (Category + Topic header, underscore separators,
 * "Question N", A–D options, "Correct Answer: X", "Rationale:" blocks).
 */

import type { QuestionOption } from "@/lib/firestore/nclexTypes";

export type ParsedBulkQuestion = {
  questionText: string;
  options: QuestionOption[];
  correctAnswerId: string;
  rationale: string;
  /** Optional block after rationale; stored admin-only in Firestore. */
  whyOthersIncorrect?: string;
  error?: string;
};

export type ParsedBulkFile = {
  category: string;
  topic: string;
  questions: ParsedBulkQuestion[];
  /** Human-readable parse issues (skipped blocks, missing header, etc.). */
  warnings: string[];
  /** Valid blocks found before removing duplicate stems (same paste pasted twice, etc.). */
  rawParsedCount?: number;
  /** Blocks dropped as duplicates of an earlier block (identical stem + choices). */
  duplicateBlocksRemoved?: number;
};

const UNDERSCORE_LINE = /^_{8,}\s*$/;
const QUESTION_HEADER = /^Question\s+\d+\s*$/i;
// Supports "A)" (legacy), "A." (Word/docs), and "A:" (some exports).
const OPTION_LINE = /^([A-H])[\)\.\:]\s*(.*)$/i;
const CORRECT_LINE = /^Correct\s+Answer:\s*([A-H])\s*$/i;
const RATIONALE_START = /^Rationale:\s*(.*)$/i;
const WHY_OTHERS_START = /^Why\s+the\s+others\s+are\s+not\s+correct:\s*(.*)$/i;
const CATEGORY_LINE = /^Category:\s*(.+)$/i;
const TOPIC_LINE = /^Topic:\s*(.+)$/i;

function trimLines(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .map((l) => l.trim());
}

/** Strips leading Category / Topic / underscore lines; returns remaining body. */
export function stripCategoryTopicHeader(text: string): { category: string; topic: string; body: string } {
  const lines = text.split(/\r?\n/);
  let category = "";
  let topic = "";
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i]!;
    const t = raw.trim();
    if (!t) {
      i++;
      continue;
    }
    if (UNDERSCORE_LINE.test(t)) {
      i++;
      continue;
    }
    const cm = t.match(CATEGORY_LINE);
    if (cm) {
      category = cm[1]!.trim();
      i++;
      continue;
    }
    const tm = t.match(TOPIC_LINE);
    if (tm) {
      topic = tm[1]!.trim();
      i++;
      continue;
    }
    break;
  }
  const body = lines
    .slice(i)
    .join("\n")
    .replace(/^\s*_{8,}\s*(\r?\n|$)/m, "")
    .trim();
  return { category, topic, body };
}

function splitQuestionBlocks(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  const byUnderscore = trimmed
    .split(/\r?\n\s*_{8,}\s*\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (byUnderscore.length > 1) return byUnderscore;

  const byQuestionHeader = trimmed
    .split(/\r?\n(?=Question\s+\d+\s*$)/im)
    .map((s) => s.trim())
    .filter(Boolean);

  return byQuestionHeader.length > 0 ? byQuestionHeader : [trimmed];
}

/** Same stem + same four option lines → treat as duplicate (re-pasted section). */
function dedupeKey(q: ParsedBulkQuestion): string {
  const stem = q.questionText.trim().replace(/\s+/g, " ").slice(0, 400).toLowerCase();
  const opts = [...q.options]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((o) => `${o.id}:${o.text.trim().toLowerCase()}`)
    .join("|");
  return `${stem}::${opts}`;
}

function dedupeParsedQuestions(questions: ParsedBulkQuestion[]): {
  unique: ParsedBulkQuestion[];
  removed: number;
} {
  const seen = new Set<string>();
  const unique: ParsedBulkQuestion[] = [];
  let removed = 0;
  for (const q of questions) {
    const k = dedupeKey(q);
    if (seen.has(k)) {
      removed++;
      continue;
    }
    seen.add(k);
    unique.push(q);
  }
  return { unique, removed };
}

/**
 * Parse one question block (may start with "Question N").
 */
export function parseStructuredQuestionBlock(block: string, blockIndex: number): ParsedBulkQuestion {
  const lines = trimLines(block).filter((l) => l.length > 0 && !UNDERSCORE_LINE.test(l));
  if (lines.length < 6) {
    return {
      questionText: "",
      options: [],
      correctAnswerId: "",
      rationale: "",
      error: `Block ${blockIndex}: too few lines`,
    };
  }

  let i = 0;
  if (QUESTION_HEADER.test(lines[i]!)) {
    i++;
  }

  const firstOpt = lines.findIndex((l, idx) => idx >= i && OPTION_LINE.test(l));
  if (firstOpt === -1) {
    return {
      questionText: "",
      options: [],
      correctAnswerId: "",
      rationale: "",
      error: `Block ${blockIndex}: no answer choices found (expected lines like "A) ..." or "A. ...")`,
    };
  }

  const stemLines = lines.slice(i, firstOpt);
  const questionText = stemLines.join("\n").trim();
  if (!questionText) {
    return {
      questionText: "",
      options: [],
      correctAnswerId: "",
      rationale: "",
      error: `Block ${blockIndex}: missing question stem`,
    };
  }

  const options: QuestionOption[] = [];
  let correctAnswerId = "";
  let rationale = "";
  let whyOthersIncorrect = "";

  // Parse option lines contiguously right after the stem. This avoids accidentally
  // treating per-option rationales ("A. ...") as answer choices.
  let j = firstOpt;
  while (j < lines.length) {
    const optM = lines[j]!.match(OPTION_LINE);
    if (!optM) break;
    options.push({ id: optM[1]!.toLowerCase(), text: (optM[2] ?? "").trim() });
    j++;
  }

  for (; j < lines.length; j++) {
    const line = lines[j]!;
    const caM = line.match(CORRECT_LINE);
    if (caM) {
      correctAnswerId = caM[1]!.toLowerCase();
      continue;
    }
    const ratM = line.match(RATIONALE_START);
    if (ratM) {
      const inline = (ratM[1] ?? "").trim();
      const after = lines.slice(j + 1);
      let whyIdx = -1;
      for (let k = 0; k < after.length; k++) {
        if (WHY_OTHERS_START.test(after[k]!)) {
          whyIdx = k;
          break;
        }
      }
      if (whyIdx === -1) {
        rationale = [inline, after.join("\n")].filter(Boolean).join("\n").trim();
      } else {
        rationale = [inline, ...after.slice(0, whyIdx)].filter((x) => String(x).trim()).join("\n").trim();
        const whyLine = after[whyIdx]!;
        const whyInline = (whyLine.match(WHY_OTHERS_START)?.[1] ?? "").trim();
        const whyRest = after.slice(whyIdx + 1).join("\n").trim();
        whyOthersIncorrect = [whyInline, whyRest].filter(Boolean).join("\n").trim();
      }
      break;
    }
  }

  const ids = options.map((o) => o.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    return {
      questionText,
      options,
      correctAnswerId,
      rationale,
      error: `Block ${blockIndex}: duplicate option labels detected`,
    };
  }
  if (!uniqueIds.has("a") || !uniqueIds.has("b")) {
    return {
      questionText,
      options,
      correctAnswerId,
      rationale,
      error: `Block ${blockIndex}: options must start at A and include at least A and B`,
    };
  }
  // Ensure options are a contiguous run A..(A+n) (supports A–D, A–E, etc.)
  const sorted = Array.from(uniqueIds).sort();
  const start = "a".charCodeAt(0);
  for (let k = 0; k < sorted.length; k++) {
    if (sorted[k]!.charCodeAt(0) !== start + k) {
      return {
        questionText,
        options,
        correctAnswerId,
        rationale,
        error: `Block ${blockIndex}: option labels must be contiguous (A, B, C, ...)`,
      };
    }
  }

  if (!correctAnswerId) {
    return {
      questionText,
      options,
      correctAnswerId: "",
      rationale,
      error: `Block ${blockIndex}: missing "Correct Answer: A" line`,
    };
  }

  if (!uniqueIds.has(correctAnswerId)) {
    return {
      questionText,
      options,
      correctAnswerId,
      rationale,
      error: `Block ${blockIndex}: correct answer "${correctAnswerId.toUpperCase()}" is not one of the options`,
    };
  }

  if (!rationale) {
    return {
      questionText,
      options,
      correctAnswerId,
      rationale: "",
      error: `Block ${blockIndex}: missing or empty "Rationale:" section`,
    };
  }

  return {
    questionText,
    options,
    correctAnswerId,
    rationale,
    ...(whyOthersIncorrect ? { whyOthersIncorrect } : {}),
  };
}

/**
 * Full-file parse: Category + Topic (optional) at top, questions separated by underscore lines
 * or by "Question N" headers.
 */
export function parseNclexAdminBulkPaste(text: string): ParsedBulkFile {
  const warnings: string[] = [];
  const raw = text.trim();
  if (!raw) {
    return { category: "", topic: "", questions: [], warnings: ["Paste is empty"], rawParsedCount: 0, duplicateBlocksRemoved: 0 };
  }

  const { category, topic, body } = stripCategoryTopicHeader(raw);
  if (!category) warnings.push('No "Category:" line found — questions will use category "General".');

  const blocks = splitQuestionBlocks(body);
  if (!blocks.length) {
    return {
      category: category || "General",
      topic,
      questions: [],
      warnings: [...warnings, "No question blocks found"],
      rawParsedCount: 0,
      duplicateBlocksRemoved: 0,
    };
  }

  const questions: ParsedBulkQuestion[] = [];
  for (let b = 0; b < blocks.length; b++) {
    const parsed = parseStructuredQuestionBlock(blocks[b]!, b + 1);
    if (parsed.error || !parsed.rationale) {
      warnings.push(parsed.error ?? `Block ${b + 1}: invalid`);
      continue;
    }
    questions.push(parsed);
  }

  const rawParsedCount = questions.length;
  const { unique, removed } = dedupeParsedQuestions(questions);
  if (removed > 0) {
    warnings.unshift(
      `${removed} duplicate block(s) removed (identical question + answer choices to an earlier block). The paste had ${rawParsedCount} parsable sections — often from copying the same questions twice, or a merged/corrupted block that still parsed.`,
    );
  }

  return {
    category: category || "General",
    topic,
    questions: unique,
    warnings,
    rawParsedCount,
    duplicateBlocksRemoved: removed,
  };
}
