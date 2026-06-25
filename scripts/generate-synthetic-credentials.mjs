import * as XLSX from "xlsx";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source =
  process.env.SYNTHETIC_XLSX ||
  "C:/Users/Hannie/Downloads/synthetic_random_credentials_100.xlsx";
const outPath = join(root, "client/src/data/syntheticCredentials.json");

const wb = XLSX.readFile(source);
const sheet = wb.Sheets[wb.SheetNames[0]];
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
const data = [];

for (const row of matrix) {
  if (typeof row[0] === "number" && row[1]) {
    data.push({
      name: String(row[1]).trim(),
      idNumber: String(row[2]).replace(/\D/g, ""),
      testApplicationNumber: String(row[3]).trim().toUpperCase(),
      amount: String(row[4]).replace(/\D/g, "") || "1050",
      date: String(row[5]).trim(),
    });
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data, null, 2));
console.log(`Wrote ${data.length} synthetic credentials to ${outPath}`);
