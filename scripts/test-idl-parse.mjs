import { parseIdlOcrText, isValidIdlNo, isValidIdlName, isValidIdlIdNumber, isValidIdlDate, refineIdlName, correctIdlIdNumber, isStrictIdlIdNumber, finalizeIdlFormRow } from "../shared/ntsaIdlExtraction.ts";
import { classifyDocumentFromOcr } from "../shared/documentExtraction.ts";
import { extractIdlDocument } from "../shared/idlExtractionEngine.ts";

const sample = `REPUBLIC OF KENYA
NATIONAL TRANSPORT AND SAFETY AUTHORITY
IDL No: IDL-LLZTQBYME
INTERIM DRIVING LICENSE
Full Name: DADEUS NYANTIKA OGATO
ID Number: 25546082
To drive class: A2, B2
From Date: 01 November 2025
Expiry Date: 01 May 2026`;

const row = parseIdlOcrText(sample);
const expected = {
  name: "DADEUS NYANTIKA OGATO",
  idNumber: "25546082",
  idlNo: "IDL-LLZTQBYME",
  date: "01 November 2025",
};

let failed = 0;
for (const [key, value] of Object.entries(expected)) {
  const ok = row[key] === value;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${key}: got "${row[key]}" expected "${value}"`);
}

const classification = classifyDocumentFromOcr(sample);
const classOk = classification.type === "ntsa_interim_license";
if (!classOk) failed += 1;
console.log(
  `${classOk ? "PASS" : "FAIL"} classify: ${classification.type} (scores: ${JSON.stringify(classification.scores)})`,
);

const ocrName = refineIdlName("DADEUS NYANTIKA 0GATO");
if (ocrName !== "DADEUS NYANTIKA OGATO") {
  failed += 1;
  console.log(`FAIL ocr name fix: got "${ocrName}" expected "DADEUS NYANTIKA OGATO"`);
} else {
  console.log("PASS ocr name fix: 0GATO -> OGATO");
}

const ocrId = parseIdlOcrText("1D Number 25546082\nTo drive class A2,B2").idNumber;
if (ocrId !== "25546082") {
  failed += 1;
  console.log(`FAIL 1D Number parse: got "${ocrId}"`);
} else {
  console.log("PASS 1D Number parse");
}

const corrected7 = correctIdlIdNumber("2554608");
if (!isStrictIdlIdNumber(corrected7)) {
  failed += 1;
  console.log(`FAIL 7-digit ID correction: got "${corrected7}"`);
} else {
  console.log("PASS 7-digit ID correction");
}

const engine = extractIdlDocument({ rawText: sample });
if (engine.Name.value !== expected.name || engine.ID_Number.value !== expected.idNumber) {
  failed += 1;
  console.log("FAIL extraction engine primary fields");
} else {
  console.log("PASS extraction engine primary fields");
}

const finalized = finalizeIdlFormRow({ name: "DADEUS NYANTIKA 0GATO", idNumber: "25546082", idlNo: "IDL-LLZTQBYME", date: "01 Nov 2025" });
if (finalized.name !== "DADEUS NYANTIKA OGATO" || finalized.date !== "01 November 2025") {
  failed += 1;
  console.log(`FAIL finalize row: ${JSON.stringify(finalized)}`);
} else {
  console.log("PASS finalize row corrections");
}

const validators = [
  [isValidIdlName(row.name), "valid name"],
  [isValidIdlIdNumber(row.idNumber), "valid id"],
  [isValidIdlNo(row.idlNo), "valid idl no"],
  [isValidIdlDate(row.date), "valid date"],
];
for (const [ok, label] of validators) {
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

process.exit(failed > 0 ? 1 : 0);
