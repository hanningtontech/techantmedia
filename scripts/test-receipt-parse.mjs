import {
  parseReceiptOcrText,
  digDeeperApplicationNo,
  digDeeperReceiptDate,
  findApplicationNoInColumn,
  isValidReceiptBillRef,
  isValidSyntheticBillReferenceNo,
  mergeReceiptFormRows,
  refineReceiptName,
  isValidReceiptName,
  isValidReceiptIdNumber,
  isValidReceiptApplicationNo,
  isValidReceiptDate,
  findSplitApplicationNo,
  parseHeaderValueRowFields,
  sanitizeOcrYear,
  normalizeApplicationNo,
} from "../shared/ntsaReceiptExtraction.ts";
import {
  applyReceiptSyntheticFallback,
  ensureReceiptHeaderFallbacks,
  generateSyntheticApplicationNo,
  generateSyntheticBillReferenceNo,
  generateSyntheticReceiptDate,
  padBillReferenceToNine,
  pickSyntheticTotalKes,
  SYNTHETIC_APPLICATION_PATTERN,
  SYNTHETIC_BILL_REF_PATTERN,
  RECEIPT_TOTAL_KES_OPTIONS,
} from "../client/src/lib/ntsa/ntsaReceiptSyntheticFallback.ts";
import {
  extractReceiptDocument,
  structuredOutputToJson,
} from "../shared/receiptExtractionEngine.ts";

const samples = [
  {
    name: "ideal header row",
    text: `APPLICATION NO: PDL-YLLH289ML BILL REFERENCE NO: MM4R4Q3 DATE: 24 July 2025
RECEIPT PAID
ID No: 822661092
Name: CORNELIUS MOSAGE KABURU
Total KES 650`,
    expected: "MM4R4Q3",
  },
  {
    name: "multiline bill ref value",
    text: `APPLICATION NO:
PDL-YLLH289ML
BILL REFERENCE NO:
MM4R4Q3
DATE:
24 July 2025`,
    expected: "MM4R4Q3",
  },
  {
    name: "OCR noise O for Q",
    text: `BILL REFERENCE NO: MM4R4O3 APPLICATION NO: PDL-YLLH289ML DATE: 24 July 2025`,
    expected: "MM4R4Q3",
  },
  {
    name: "spaced OCR",
    text: `BILL REFERENCE NO: MM 4R 4Q 3 DATE: 24 July 2025`,
    expected: "MM4R4Q3",
  },
];

let failed = 0;
for (const sample of samples) {
  const row = parseReceiptOcrText(sample.text);
  const ok = row.billReferenceNo === sample.expected;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${sample.name}: got "${row.billReferenceNo}" expected "${sample.expected}"`,
  );
}

const rejects = ["PDL-YLLH289ML", "822661092", "REFERENCE", "650", "JULY2025", "1CATION", "ICATION"];
for (const bad of rejects) {
  const rejected = !isValidReceiptBillRef(bad, { idNumber: "822661092" });
  if (!rejected) failed += 1;
  console.log(`${rejected ? "PASS" : "FAIL"} reject "${bad}"`);
}

const nameSamples = [
  {
    name: "clean three-word name",
    input: "CORNELIUS MOSAGE KABURU",
    expected: "CORNELIUS MOSAGE KABURU",
    valid: true,
  },
  {
    name: "strip email tail",
    input: "CORNELIUS MOSAGE KABURU Email kaburu@gmail.com",
    expected: "CORNELIUS MOSAGE KABURU",
    valid: true,
  },
  {
    name: "trim fourth word",
    input: "CORNELIUS MOSAGE KABURU EXTRA",
    expected: "CORNELIUS MOSAGE KABURU",
    valid: true,
  },
  {
    name: "reject two-word name",
    input: "CORNELIUS MOSAGE",
    expected: "CORNELIUS MOSAGE",
    valid: false,
  },
];

for (const sample of nameSamples) {
  const refined = refineReceiptName(sample.input);
  const valid = isValidReceiptName(refined);
  const ok = refined === sample.expected && valid === sample.valid;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"} name ${sample.name}: got "${refined}" valid=${valid}`,
  );
}

const receiptName = parseReceiptOcrText(`RECEIPT PAID
ID No: 822661092
Name: CORNELIUS MOSAGE KABURU Email kaburucornelius@gmail.com Tel +254742823646`);
const idNoLabelOnly = parseReceiptOcrText(`ID No: 822661092`);
const idNumberLabelIgnored = parseReceiptOcrText(`ID Number: 822661092`);
const nameOk = receiptName.name === "CORNELIUS MOSAGE KABURU";
const idOk = receiptName.idNumber === "822661092";
if (!nameOk) failed += 1;
if (!idOk) failed += 1;
console.log(
  `${nameOk ? "PASS" : "FAIL"} receipt name parse: got "${receiptName.name}"`,
);
console.log(
  `${idOk ? "PASS" : "FAIL"} receipt id below banner: got "${receiptName.idNumber}"`,
);
const idNoLabelOk = idNoLabelOnly.idNumber === "822661092";
if (!idNoLabelOk) failed += 1;
console.log(
  `${idNoLabelOk ? "PASS" : "FAIL"} prefers ID No: label: got "${idNoLabelOnly.idNumber}"`,
);
const ignoresIdNumberLabel = idNumberLabelIgnored.idNumber === "";
if (!ignoresIdNumberLabel) failed += 1;
console.log(
  `${ignoresIdNumberLabel ? "PASS" : "FAIL"} ignores ID Number label on receipts`,
);

const nineDigitOk = isValidReceiptIdNumber("822661092");
if (!nineDigitOk) failed += 1;
console.log(`${nineDigitOk ? "PASS" : "FAIL"} accepts 9-digit ID`);

const synthApp = generateSyntheticApplicationNo();
const synthAppOk =
  SYNTHETIC_APPLICATION_PATTERN.test(synthApp) && isValidReceiptApplicationNo(synthApp);
if (!synthAppOk) failed += 1;
console.log(`${synthAppOk ? "PASS" : "FAIL"} synthetic application "${synthApp}"`);

const synthBill = generateSyntheticBillReferenceNo();
const synthBillOk =
  SYNTHETIC_BILL_REF_PATTERN.test(synthBill) && isValidSyntheticBillReferenceNo(synthBill);
if (!synthBillOk) failed += 1;
console.log(`${synthBillOk ? "PASS" : "FAIL"} synthetic bill ref "${synthBill}"`);

const paddedBill = padBillReferenceToNine("MM4R4");
const paddedOk =
  paddedBill.startsWith("MM4R4") &&
  paddedBill.length === 9 &&
  SYNTHETIC_BILL_REF_PATTERN.test(paddedBill);
if (!paddedOk) failed += 1;
console.log(`${paddedOk ? "PASS" : "FAIL"} pad partial bill ref "${paddedBill}"`);

const synthTotal = pickSyntheticTotalKes();
const totalOk = RECEIPT_TOTAL_KES_OPTIONS.includes(synthTotal);
if (!totalOk) failed += 1;
console.log(`${totalOk ? "PASS" : "FAIL"} synthetic total kes "${synthTotal}"`);

const rejectBadTotal = !parseReceiptOcrText("Total KES 50").totalKes;
if (!rejectBadTotal) failed += 1;
console.log(`${rejectBadTotal ? "PASS" : "FAIL"} reject total KES 50`);

const synthDate = generateSyntheticReceiptDate();
const synthDateOk = isValidReceiptDate(synthDate) && Number(synthDate.match(/\d{4}$/)?.[0]) <= 2026;
if (!synthDateOk) failed += 1;
console.log(`${synthDateOk ? "PASS" : "FAIL"} synthetic date "${synthDate}"`);

const splitOcr = `J ~ PDL-YL|\n§ LH289ML MM4R4Q3 24 July 202!`;
const splitApp = findSplitApplicationNo(splitOcr);
const splitAppOk = splitApp === "PDL-YLLH289ML";
if (!splitAppOk) failed += 1;
console.log(`${splitAppOk ? "PASS" : "FAIL"} split PDL application "${splitApp}"`);

const splitHeaderRow = parseHeaderValueRowFields(splitOcr);
const splitHeaderRowOk =
  splitHeaderRow.applicationNo === "PDL-YLLH289ML" &&
  splitHeaderRow.billReferenceNo === "MM4R4Q3" &&
  splitHeaderRow.date === "24 July 2025";
if (!splitHeaderRowOk) failed += 1;
console.log(
  `${splitHeaderRowOk ? "PASS" : "FAIL"} split header value row "${splitHeaderRow.applicationNo}" / "${splitHeaderRow.billReferenceNo}" / "${splitHeaderRow.date}"`,
);

const yearFixOk = sanitizeOcrYear("202!") === "2025";
if (!yearFixOk) failed += 1;
console.log(`${yearFixOk ? "PASS" : "FAIL"} sanitize OCR year 202!`);

const synth = applyReceiptSyntheticFallback({
  name: "",
  idNumber: "",
  applicationNo: "",
  billReferenceNo: "",
  totalKes: "650",
  date: "",
});
const synthOk =
  synth.usedSyntheticFallback &&
  synth.row.name.split(/\s+/).length === 3 &&
  isValidReceiptIdNumber(synth.row.idNumber) &&
  isValidReceiptApplicationNo(synth.row.applicationNo) &&
  SYNTHETIC_APPLICATION_PATTERN.test(synth.row.applicationNo) &&
  isValidSyntheticBillReferenceNo(synth.row.billReferenceNo) &&
  SYNTHETIC_BILL_REF_PATTERN.test(synth.row.billReferenceNo) &&
  isValidReceiptDate(synth.row.date);
if (!synthOk) failed += 1;
console.log(
  `${synthOk ? "PASS" : "FAIL"} synthetic fallback fills name/id/app/bill/date`,
);

const columnHeader = parseReceiptOcrText("RECEIPT PAID", {
  applicationText: "APPLICATION NO:\nPDL-YLLH289ML",
  billRefText: "MM4R4Q3",
  dateText: "DATE:\n24 July 2025",
});
const columnOk =
  columnHeader.applicationNo === "PDL-YLLH289ML" &&
  columnHeader.billReferenceNo === "MM4R4Q3" &&
  columnHeader.date === "24 July 2025";
if (!columnOk) failed += 1;
console.log(
  `${columnOk ? "PASS" : "FAIL"} header column crops: app="${columnHeader.applicationNo}" bill="${columnHeader.billReferenceNo}" date="${columnHeader.date}"`,
);

const garbledHeader = parseReceiptOcrText(`APPLIC 1CATION NO: PDL-YLLH289ML BILL REFERENCE NO: MM4R4Q3 DATE: 24 July 2025
RECEIPT PAID ID No: 822661092 Name: CORNELIUS MOSAGE KABURU Total KES 650`);
const garbledOk =
  garbledHeader.applicationNo === "PDL-YLLH289ML" &&
  garbledHeader.billReferenceNo === "MM4R4Q3" &&
  garbledHeader.date === "24 July 2025" &&
  garbledHeader.idNumber === "822661092";
if (!garbledOk) failed += 1;
console.log(
  `${garbledOk ? "PASS" : "FAIL"} garbled header OCR: app="${garbledHeader.applicationNo}" bill="${garbledHeader.billReferenceNo}" date="${garbledHeader.date}"`,
);

const splitPdl = findApplicationNoInColumn("APPLICATION NO:\nPDL\nYLLH289ML");
const splitPdlOk = splitPdl === "PDL-YLLH289ML";
if (!splitPdlOk) failed += 1;
console.log(`${splitPdlOk ? "PASS" : "FAIL"} split-line application no: got "${splitPdl}"`);

const orphanSuffix = findApplicationNoInColumn("APPLICATION NO:\nYLLH289ML");
const orphanOk = orphanSuffix === "PDL-YLLH289ML";
if (!orphanOk) failed += 1;
console.log(`${orphanOk ? "PASS" : "FAIL"} orphan PDL suffix: got "${orphanSuffix}"`);

const multilineDate = digDeeperReceiptDate(["DATE:\n24 July 2025"]);
const multilineDateOk = multilineDate === "24 July 2025";
if (!multilineDateOk) failed += 1;
console.log(`${multilineDateOk ? "PASS" : "FAIL"} multiline date: got "${multilineDate}"`);

const mergePreserves = mergeReceiptFormRows([
  { name: "A B C", idNumber: "", applicationNo: "", billReferenceNo: "MM4R4Q3", totalKes: "650", date: "" },
  { name: "", idNumber: "822661092", applicationNo: "PDL-YLLH289ML", billReferenceNo: "", totalKes: "", date: "24 July 2025" },
]);
const mergeOk =
  mergePreserves.applicationNo === "PDL-YLLH289ML" &&
  mergePreserves.date === "24 July 2025" &&
  mergePreserves.billReferenceNo === "MM4R4Q3";
if (!mergeOk) failed += 1;
console.log(
  `${mergeOk ? "PASS" : "FAIL"} merge keeps all header fields: app="${mergePreserves.applicationNo}" date="${mergePreserves.date}"`,
);

const rejectIdAsApp = !parseReceiptOcrText("APPLICATION NO: 822661092", {
  applicationText: "APPLICATION NO:\n822661092",
  customerText: "ID No: 822661092",
}).applicationNo.startsWith("PDL-822");
if (!rejectIdAsApp) failed += 1;
console.log(
  `${rejectIdAsApp ? "PASS" : "FAIL"} reject PDL-{ID} as application no`,
);

const headerValueRow = parseReceiptOcrText("RECEIPT PAID", {
  headerValuesText: "PDL-YLLH289ML MM4R4Q3 24 July 2025",
});
const headerRowOk =
  headerValueRow.applicationNo === "PDL-YLLH289ML" &&
  headerValueRow.billReferenceNo === "MM4R4Q3" &&
  headerValueRow.date === "24 July 2025";
if (!headerRowOk) failed += 1;
console.log(
  `${headerRowOk ? "PASS" : "FAIL"} header value row: app="${headerValueRow.applicationNo}" date="${headerValueRow.date}"`,
);

const headerOnlyMissing = ensureReceiptHeaderFallbacks({
  name: "CORNELIUS MOSAGE KABURU",
  idNumber: "822661092",
  applicationNo: "",
  billReferenceNo: "",
  totalKes: "650",
  date: "24 July 2025",
});
const mergeSynth = mergeReceiptFormRows([
  {
    name: "CORNELIUS MOSAGE KABURU",
    idNumber: "822661092",
    applicationNo: "",
    billReferenceNo: "ZLE28K90G",
    totalKes: "650",
    date: "24 July 2025",
  },
  {
    name: "CORNELIUS MOSAGE KABURU",
    idNumber: "822661092",
    applicationNo: "PDL-AB12CD34E",
    billReferenceNo: "",
    totalKes: "650",
    date: "24 July 2025",
  },
]);
const headerOnlyOk =
  headerOnlyMissing.usedSyntheticFallback &&
  SYNTHETIC_APPLICATION_PATTERN.test(headerOnlyMissing.row.applicationNo) &&
  SYNTHETIC_BILL_REF_PATTERN.test(headerOnlyMissing.row.billReferenceNo);
const mergeSynthOk =
  SYNTHETIC_BILL_REF_PATTERN.test(mergeSynth.billReferenceNo) &&
  mergeSynth.applicationNo === "PDL-AB12CD34E";
if (!headerOnlyOk) failed += 1;
if (!mergeSynthOk) failed += 1;
console.log(
  `${headerOnlyOk ? "PASS" : "FAIL"} ensure header fallbacks: app="${headerOnlyMissing.row.applicationNo}" bill="${headerOnlyMissing.row.billReferenceNo}"`,
);
console.log(
  `${mergeSynthOk ? "PASS" : "FAIL"} merge keeps synthetic bill ref: "${mergeSynth.billReferenceNo}"`,
);

const deeperApp = digDeeperApplicationNo(["APPLICATION NO", "PDL-YLLH289ML"]);
const deeperAppOk = deeperApp === "PDL-YLLH289ML";
if (!deeperAppOk) failed += 1;
console.log(`${deeperAppOk ? "PASS" : "FAIL"} dig deeper application no: got "${deeperApp}"`);

const engineSample = `APPLICATION NO: PDL-YLLH289ML BILL REFERENCE NO: MM4R4Q3 DATE: 24 July 2025
RECEIPT PAID
ID No: 822661092
Name: CORNELIUS MOSAGE KABURU Email test@gmail.com
Total KES 650`;
const structured = extractReceiptDocument({ rawText: engineSample });
const json = structuredOutputToJson(structured);
const engineOk =
  json.Name === "CORNELIUS MOSAGE KABURU" &&
  json.ID_No === "822661092" &&
  (json.Bill_Reference_No === "MM4R4Q3" || json.Bill_Reference === "MM4R4Q3") &&
  json.Application_No === "PDL-YLLH289ML" &&
  json.Amount === "650" &&
  json.Currency === "KES" &&
  structured.overallConfidence >= 0.5;
if (!engineOk) failed += 1;
console.log(
  `${engineOk ? "PASS" : "FAIL"} structured engine JSON confidence=${structured.overallConfidence.toFixed(2)}`,
);

const nationalGlued = normalizeApplicationNo("PDL-YLLH289MLNATIONAL");
const nationalGluedOk =
  nationalGlued === "PDL-YLLH289ML" &&
  isValidReceiptApplicationNo(nationalGlued);
if (!nationalGluedOk) failed += 1;
console.log(
  `${nationalGluedOk ? "PASS" : "FAIL"} strip NATIONAL from application no: got "${nationalGlued}"`,
);

const nationalSpaced = parseReceiptOcrText(
  "APPLICATION NO: PDL-YLLH289ML NATIONAL TRANSPORT BILL REFERENCE NO: MM4R4Q3 DATE: 24 July 2025",
);
const nationalSpacedOk = nationalSpaced.applicationNo === "PDL-YLLH289ML";
if (!nationalSpacedOk) failed += 1;
console.log(
  `${nationalSpacedOk ? "PASS" : "FAIL"} spaced NATIONAL header bleed: app="${nationalSpaced.applicationNo}"`,
);

const nationalColumn = findApplicationNoInColumn("APPLICATION NO:\nPDL-YLLH289MLNATIONAL");
const nationalColumnOk = nationalColumn === "PDL-YLLH289ML";
if (!nationalColumnOk) failed += 1;
console.log(
  `${nationalColumnOk ? "PASS" : "FAIL"} column crop with glued NATIONAL: got "${nationalColumn}"`,
);

process.exit(failed > 0 ? 1 : 0);
