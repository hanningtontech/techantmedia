/**
 * Keyword extraction, explanation scoring, and bulk question parsing (ported from NCLEX server).
 */

const MEDICAL_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do",
  "does", "did", "will", "would", "could", "should", "may", "might", "must", "can",
  "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
  "what", "which", "who", "when", "where", "why", "how", "all", "each", "every",
  "both", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "same", "so", "than", "too", "very", "as", "by", "from", "up", "about", "into",
  "through", "during", "before", "after", "above", "below", "between", "under", "again",
  "further", "then", "once", "here", "there", "when", "where", "why", "how", "all",
  "because", "as", "if", "unless", "while", "although", "though", "since", "until",
  "patient", "patients", "nurse", "nurses", "provider", "providers", "care", "treatment",
  "should", "must", "need", "needs", "needed", "important", "priority", "first",
  "second", "third", "initial", "immediate", "acute", "chronic", "new", "old",
  "high", "low", "increase", "decrease", "increased", "decreased", "increasing",
  "decreasing", "normal", "abnormal", "good", "bad", "better", "worse", "best", "worst",
]);

export function extractKeywords(text: string, minLength: number = 2): string[] {
  if (!text || text.length === 0) return [];

  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ");

  const keywords = words.filter((word) => {
    return word.length >= minLength && !MEDICAL_STOPWORDS.has(word) && !/^\d+$/.test(word);
  });

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const keyword of keywords) {
    if (!seen.has(keyword)) {
      seen.add(keyword);
      unique.push(keyword);
    }
  }

  return unique;
}

export function extractPhrases(text: string, maxPhraseLength: number = 4): string[] {
  if (!text || text.length === 0) return [];

  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ");
  const phrases: string[] = [];

  for (let length = Math.min(maxPhraseLength, words.length); length >= 2; length--) {
    for (let i = 0; i <= words.length - length; i++) {
      const phrase = words.slice(i, i + length).join(" ");
      const phraseWords = phrase.split(" ");
      const nonStopwords = phraseWords.filter((w) => !MEDICAL_STOPWORDS.has(w));
      if (nonStopwords.length >= Math.ceil(phraseWords.length / 2)) {
        phrases.push(phrase);
      }
    }
  }

  return Array.from(new Set(phrases));
}

export function calculateExplanationScore(
  studentExplanation: string,
  requiredKeywords: string[],
): { score: number; matchedKeywords: string[] } {
  if (!studentExplanation || requiredKeywords.length === 0) {
    return { score: 0, matchedKeywords: [] };
  }

  const studentText = studentExplanation.toLowerCase();
  const matchedKeywords: string[] = [];

  for (const keyword of requiredKeywords) {
    if (studentText.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
      continue;
    }

    const keywordParts = keyword.toLowerCase().split(" ");
    if (keywordParts.length > 1) {
      const allPartsFound = keywordParts.every((part) => studentText.includes(part));
      if (allPartsFound) {
        matchedKeywords.push(keyword);
      }
    }

    if (keyword.length > 4) {
      const stem = keyword.substring(0, keyword.length - 2);
      if (studentText.includes(stem)) {
        matchedKeywords.push(keyword);
      }
    }
  }

  const score = Math.round((matchedKeywords.length / requiredKeywords.length) * 100);

  return { score, matchedKeywords };
}

export function calculateSimilarityScore(studentExplanation: string, correctRationale: string): number {
  if (!studentExplanation || !correctRationale) return 0;

  const studentKeywords = new Set(extractKeywords(studentExplanation));
  const correctKeywords = new Set(extractKeywords(correctRationale));

  if (correctKeywords.size === 0) return 0;

  const intersection = Array.from(studentKeywords).filter((k) => correctKeywords.has(k));
  const unionArray = Array.from(new Set([...Array.from(studentKeywords), ...Array.from(correctKeywords)]));

  const similarity = intersection.length / unionArray.length;
  return Math.round(similarity * 100);
}

export function scoreExplanationFull(
  studentExplanation: string,
  correctRationale: string,
  extractedKeywords?: string[],
): {
  keywordScore: number;
  similarityScore: number;
  finalScore: number;
  matchedKeywords: string[];
} {
  if (!studentExplanation) {
    return {
      keywordScore: 0,
      similarityScore: 0,
      finalScore: 0,
      matchedKeywords: [],
    };
  }

  const keywords = extractedKeywords?.length ? extractedKeywords : extractKeywords(correctRationale);

  const { score: keywordScore, matchedKeywords } = calculateExplanationScore(studentExplanation, keywords);

  const similarityScore = calculateSimilarityScore(studentExplanation, correctRationale);

  const finalScore = Math.round(keywordScore * 0.6 + similarityScore * 0.4);

  return {
    keywordScore,
    similarityScore,
    finalScore,
    matchedKeywords,
  };
}

export function parseQuestionFromText(block: string): {
  questionText: string;
  options: Array<{ id: string; text: string }>;
  correctAnswerId: string;
  rationale: string;
  error?: string;
} | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 6) {
    return null;
  }

  try {
    const questionText = lines[0]!;
    const options: Array<{ id: string; text: string }> = [];
    let correctAnswerId = "";
    let rationale = "";

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      const match = line.match(/^([A-D])\)\s*(.+?)(\s*\*\*CORRECT\*\*)?$/);

      if (match) {
        const id = match[1]!.toLowerCase();
        const optionText = match[2]!.trim();
        const isCorrect = !!match[3];

        options.push({ id, text: optionText });

        if (isCorrect) {
          correctAnswerId = id;
        }
      }
    }

    const rationaleMatch = block.match(/\(Rationale:\s*(.+?)\)/i);
    if (rationaleMatch) {
      rationale = rationaleMatch[1]!.trim();
    }

    if (options.length !== 4) {
      return {
        questionText,
        options,
        correctAnswerId,
        rationale,
        error: "Expected 4 options (A, B, C, D)",
      };
    }

    if (!correctAnswerId) {
      return {
        questionText,
        options,
        correctAnswerId,
        rationale,
        error: "No correct answer marked with **CORRECT**",
      };
    }

    return {
      questionText,
      options,
      correctAnswerId,
      rationale,
    };
  } catch {
    return null;
  }
}

export function parseBulkQuestions(text: string): Array<{
  questionText: string;
  options: Array<{ id: string; text: string }>;
  correctAnswerId: string;
  rationale: string;
  error?: string;
}> {
  const questionBlocks = text.split(/\n\n+|(?=^\d+\.\s)/m);

  return questionBlocks
    .map((block) => parseQuestionFromText(block.trim()))
    .filter((q): q is NonNullable<typeof q> => q !== null);
}
