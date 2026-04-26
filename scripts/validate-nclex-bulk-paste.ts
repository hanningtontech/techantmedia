/**
 * Validates a bulk paste file using the same parser as the app’s Bulk import page.
 *
 * Usage:
 *   pnpm exec tsx scripts/validate-nclex-bulk-paste.ts path/to/paste.txt
 *   pnpm exec tsx scripts/validate-nclex-bulk-paste.ts --stdin < path/to/paste.txt
 */

import fs from "node:fs";
import path from "node:path";

import { parseNclexAdminBulkPaste } from "../client/src/lib/nclex/bulkImportParser";

function readAll(): string {
  const argv = process.argv.slice(2);
  if (argv[0] === "--stdin") {
    return fs.readFileSync(0, "utf8");
  }
  const file = argv[0];
  if (!file) {
    console.error(
      "Usage: pnpm exec tsx scripts/validate-nclex-bulk-paste.ts <file.txt>\n" +
        "   or: pnpm exec tsx scripts/validate-nclex-bulk-paste.ts --stdin < file.txt",
    );
    process.exit(2);
  }
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  return fs.readFileSync(abs, "utf8");
}

const text = readAll();
const parsed = parseNclexAdminBulkPaste(text);

console.log(`Category: ${parsed.category || "(empty)"}`);
console.log(`Topic: ${parsed.topic || "(empty)"}`);
console.log(`Questions parsed: ${parsed.questions.length}`);
if (parsed.duplicateBlocksRemoved) {
  console.log(`Duplicate blocks removed: ${parsed.duplicateBlocksRemoved}`);
}

if (parsed.warnings.length) {
  console.log("\nWarnings / skipped blocks:");
  for (const w of parsed.warnings) console.log(`  - ${w}`);
}

if (!parsed.questions.length) {
  console.error("\nNo valid questions — fix format (see scripts/nclex-bulk-paste-agent-system-prompt.txt).");
  process.exit(1);
}

console.log("\nFirst item preview:");
const q = parsed.questions[0]!;
console.log(`  correct: ${q.correctAnswerId}`);
console.log(`  options: ${q.options.map((o) => `${o.id}:${o.text.slice(0, 40)}…`).join(" | ")}`);
console.log(`  rationale chars: ${q.rationale.length}`);
if (q.whyOthersIncorrect) console.log(`  whyOthersIncorrect chars: ${q.whyOthersIncorrect.length}`);
else console.log(`  whyOthersIncorrect: (none)`);

console.log("\nOK — ready to paste into /tutor/nclex/bulk-import");
process.exit(0);
