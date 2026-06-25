import type { DocumentTypeId, ExtractionFormRow, ExtractionSessionMeta } from "@shared/documentExtraction";
import { classifyDocumentFromOcr } from "@shared/documentExtraction";
import { recognizeIdlWithText } from "@/lib/ntsa/ntsaIdlOcr";
import { recognizeNtsaFormWithText } from "@/lib/ntsa/ntsaOcr";
import { recognizeNtsaReceiptWithText } from "@/lib/ntsa/ntsaReceiptOcr";

export type DocumentExtractResult = {
  row: ExtractionFormRow;
  documentType: DocumentTypeId;
  ocrText: string;
  validFieldCount: number;
  typeMismatch: boolean;
  detectedType: DocumentTypeId;
  warnings: string[];
};

function receiptToExtractionRow(row: {
  name: string;
  idNumber: string;
  applicationNo: string;
  billReferenceNo: string;
  totalKes: string;
  date: string;
}): ExtractionFormRow {
  return {
    name: row.name,
    idNumber: row.idNumber,
    date: row.date,
    testApplicationNumber: "",
    amount: row.totalKes,
    applicationNo: row.applicationNo,
    billReferenceNo: row.billReferenceNo,
    totalKes: row.totalKes,
    documentType: "ntsa_receipt",
  };
}

function formToExtractionRow(row: {
  name: string;
  idNumber: string;
  testApplicationNumber: string;
  amount: string;
  date: string;
}): ExtractionFormRow {
  return {
    ...row,
    documentType: "ntsa_test_form",
  };
}

function idlToExtractionRow(row: {
  name: string;
  idNumber: string;
  idlNo: string;
  date: string;
}): ExtractionFormRow {
  return {
    name: row.name,
    idNumber: row.idNumber,
    date: row.date,
    idlNo: row.idlNo,
    testApplicationNumber: "",
    amount: "",
    documentType: "ntsa_interim_license",
  };
}

const TYPE_MISMATCH_THRESHOLD = 30;

export async function extractDocumentFromImage(input: {
  blob: Blob;
  mimeType: string;
  fileName: string;
  documentType: DocumentTypeId;
}): Promise<DocumentExtractResult> {
  void input.mimeType;
  void input.fileName;

  const warnings: string[] = [];

  if (input.documentType === "ntsa_interim_license") {
    const result = await recognizeIdlWithText(input.blob);
    const detected = classifyDocumentFromOcr(result.ocrText);
    const typeMismatch =
      detected.type !== "ntsa_interim_license" &&
      detected.scores.ntsa_interim_license <
        Math.max(detected.scores.ntsa_test_form, detected.scores.ntsa_receipt) +
          TYPE_MISMATCH_THRESHOLD;

    if (result.missingFields.includes("idlNo")) {
      warnings.push(
        "IDL No missing — check the code below National Transport and Safety Authority (IDL-…)",
      );
    }
    if (result.missingFields.includes("idNumber")) {
      warnings.push("ID Number missing — check the field labelled ID Number:");
    }
    if (result.missingFields.includes("name")) {
      warnings.push("Name missing — check Full Name on the license");
    }
    if (result.missingFields.includes("date")) {
      warnings.push("From Date missing — check the From Date field on the license");
    }
    if (result.usedSyntheticFallback) {
      warnings.push("Some fields were filled from the synthetic fallback pool — review before export");
    }
    if (result.needsReview) {
      warnings.push(
        `Low extraction confidence (${Math.round(result.overallConfidence * 100)}%) — review recommended`,
      );
    }
    if (result.deepRetryUsed && result.missingFields.length && !result.usedSyntheticFallback) {
      warnings.push("Deep OCR retry ran but some fields are still missing");
    }
    if (typeMismatch) {
      warnings.push("This page may not be an interim driving license");
    }

    return {
      row: idlToExtractionRow(result.row),
      documentType: "ntsa_interim_license",
      ocrText: result.ocrText,
      validFieldCount: result.validFieldCount,
      typeMismatch,
      detectedType: detected.type,
      warnings,
    };
  }

  if (input.documentType === "ntsa_receipt") {
    const result = await recognizeNtsaReceiptWithText(input.blob);
    const detected = classifyDocumentFromOcr(result.ocrText);
    const typeMismatch =
      detected.type !== "ntsa_receipt" &&
      detected.scores.ntsa_test_form - detected.scores.ntsa_receipt >= TYPE_MISMATCH_THRESHOLD;

    if (result.usedSyntheticFallback) {
      warnings.push("Some fields were filled from the synthetic fallback pool");
    }
    if (result.needsReview) {
      warnings.push(
        `Low extraction confidence (${Math.round(result.overallConfidence * 100)}%) — review recommended`,
      );
    }
    if (result.missingFields.includes("idNumber")) {
      warnings.push(
        "ID No: missing — check the left field labelled ID No: below the RECEIPT PAID banner",
      );
    }
    if (result.missingFields.includes("billReferenceNo")) {
      warnings.push(
        "Bill Reference No missing — check the center header field between Application No and Date",
      );
    }
    if (result.missingFields.includes("applicationNo")) {
      warnings.push(
        "Application No missing — check the top-left PDL-… code under APPLICATION NO:",
      );
    }
    if (result.missingFields.includes("date")) {
      warnings.push(
        "Date missing — check the top-right field under DATE: (handwriting or glare may block OCR)",
      );
    }
    const otherMissing = result.missingFields.filter(
      (f) => f !== "billReferenceNo" && f !== "idNumber",
    );
    if (otherMissing.length) {
      warnings.push(`Could not read: ${otherMissing.join(", ")}`);
    }
    if (result.deepRetryUsed && result.missingFields.length && !result.usedSyntheticFallback) {
      warnings.push("Deep OCR retry ran but some fields are still missing");
    }
    if (typeMismatch) {
      warnings.push("This page looks like a test application form, not a receipt");
    }

    return {
      row: receiptToExtractionRow(result.row),
      documentType: "ntsa_receipt",
      ocrText: result.ocrText,
      validFieldCount: result.validFieldCount,
      typeMismatch,
      detectedType: detected.type,
      warnings,
    };
  }

  const result = await recognizeNtsaFormWithText(input.blob);
  const detected = classifyDocumentFromOcr(result.ocrText);
  const typeMismatch =
    detected.type !== "ntsa_test_form" &&
    detected.scores.ntsa_receipt - detected.scores.ntsa_test_form >= TYPE_MISMATCH_THRESHOLD;

  if (result.usedSyntheticFallback) {
    warnings.push("Some fields were filled from the synthetic fallback pool");
  }
  if (typeMismatch) {
    warnings.push("This page looks like a payment receipt, not a test application form");
  }

  return {
    row: formToExtractionRow(result.row),
    documentType: "ntsa_test_form",
    ocrText: result.ocrText,
    validFieldCount: result.validFieldCount,
    typeMismatch,
    detectedType: detected.type,
    warnings,
  };
}

export function applyEnabledFieldsToRow(
  row: ExtractionFormRow,
  meta: ExtractionSessionMeta,
): ExtractionFormRow {
  const enabled = new Set(meta.enabledFields);
  const next: ExtractionFormRow = {
    ...row,
    documentType: meta.documentType,
  };

  if (!enabled.has("name")) next.name = "";
  if (!enabled.has("idNumber")) next.idNumber = "";
  if (!enabled.has("date")) next.date = "";

  if (meta.documentType === "ntsa_test_form") {
    if (!enabled.has("testApplicationNumber")) next.testApplicationNumber = "";
    if (!enabled.has("amount")) next.amount = "";
  } else if (meta.documentType === "ntsa_receipt") {
    if (!enabled.has("applicationNo")) next.applicationNo = "";
    if (!enabled.has("billReferenceNo")) next.billReferenceNo = "";
    if (!enabled.has("totalKes")) {
      next.totalKes = "";
      next.amount = "";
    }
  } else if (meta.documentType === "ntsa_interim_license") {
    if (!enabled.has("idlNo")) next.idlNo = "";
  }

  return next;
}
