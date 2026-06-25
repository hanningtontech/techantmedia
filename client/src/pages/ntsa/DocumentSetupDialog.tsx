import { useCallback, useEffect, useState } from "react";
import { FileSearch, Settings2 } from "lucide-react";
import {
  DOCUMENT_TYPES,
  type DocumentClassification,
  type DocumentTypeId,
  type ExtractionFieldId,
  type ExtractionSessionMeta,
  sanitizeEnabledFields,
} from "@shared/documentExtraction";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type DocumentSetupResult = {
  documentType: DocumentTypeId;
  enabledFields: ExtractionFieldId[];
};

type Props = {
  open: boolean;
  classification: DocumentClassification | null;
  initialMeta: ExtractionSessionMeta | null;
  /** When true, pre-select the detected document type from classification. */
  preferDetectedType?: boolean;
  allowTypeChange?: boolean;
  title?: string;
  description?: string;
  onConfirm: (result: DocumentSetupResult) => void;
  onCancel: () => void;
  confirmLabel?: string;
};

function resolveDialogMeta(
  classification: DocumentClassification | null,
  initialMeta: ExtractionSessionMeta | null,
  preferDetectedType: boolean,
): { documentType: DocumentTypeId; enabledFields: ExtractionFieldId[] } {
  const fallbackType: DocumentTypeId = "ntsa_test_form";
  const detectedType = classification?.type ?? initialMeta?.documentType ?? fallbackType;
  const documentType =
    preferDetectedType && classification ? classification.type : detectedType;

  if (initialMeta?.documentType === documentType && initialMeta.enabledFields.length) {
    return {
      documentType,
      enabledFields: sanitizeEnabledFields(documentType, initialMeta.enabledFields),
    };
  }

  return {
    documentType,
    enabledFields: [...DOCUMENT_TYPES[documentType].defaultEnabledFields],
  };
}

export function DocumentSetupDialog({
  open,
  classification,
  initialMeta,
  preferDetectedType = false,
  allowTypeChange = true,
  title = "Confirm what to extract",
  description = "We detected your document type. Press Enter to continue, or pick another type if we got it wrong.",
  onConfirm,
  onCancel,
  confirmLabel = "Start extraction",
}: Props) {
  const [documentType, setDocumentType] = useState<DocumentTypeId>(() =>
    resolveDialogMeta(classification, initialMeta, preferDetectedType).documentType,
  );
  const [enabledFields, setEnabledFields] = useState<ExtractionFieldId[]>(() =>
    resolveDialogMeta(classification, initialMeta, preferDetectedType).enabledFields,
  );

  useEffect(() => {
    if (!open) return;
    const next = resolveDialogMeta(classification, initialMeta, preferDetectedType);
    setDocumentType(next.documentType);
    setEnabledFields(next.enabledFields);
  }, [open, initialMeta, classification, preferDetectedType]);

  const typeDef = DOCUMENT_TYPES[documentType];
  const selectableFields = typeDef.fields.filter((f) => f.id !== "sourcePage");

  const toggleField = (fieldId: ExtractionFieldId, checked: boolean) => {
    setEnabledFields((prev) => {
      const next = checked ? [...prev, fieldId] : prev.filter((id) => id !== fieldId);
      return sanitizeEnabledFields(documentType, next);
    });
  };

  const handleTypeChange = (type: DocumentTypeId) => {
    setDocumentType(type);
    setEnabledFields([...DOCUMENT_TYPES[type].defaultEnabledFields]);
  };

  const handleConfirm = useCallback(() => {
    const fields = sanitizeEnabledFields(documentType, [
      "sourcePage",
      ...enabledFields.filter((id) => id !== "sourcePage"),
    ]);
    onConfirm({ documentType, enabledFields: fields });
  }, [documentType, enabledFields, onConfirm]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea")) return;
      event.preventDefault();
      handleConfirm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleConfirm]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="flex max-h-[min(90vh,760px)] max-w-lg flex-col overflow-hidden border-white/10 bg-[#12121a] text-white">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Settings2 className="h-5 w-5 text-amber-400" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
        {classification && preferDetectedType && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-amber-200">
              <FileSearch className="h-4 w-4" />
              Detected: {DOCUMENT_TYPES[classification.type].label}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Switched to this document type automatically. Press{" "}
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                Enter
              </kbd>{" "}
              to start, or choose another type below if this is wrong.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Test form {classification.scores.ntsa_test_form} · Receipt{" "}
              {classification.scores.ntsa_receipt} · IDL{" "}
              {classification.scores.ntsa_interim_license}
            </p>
          </div>
        )}

        {classification && !preferDetectedType && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-amber-200">
              <FileSearch className="h-4 w-4" />
              Last detected: {DOCUMENT_TYPES[classification.type].label}
            </p>
          </div>
        )}

        {allowTypeChange && (
          <div className="space-y-2">
            <Label className="text-zinc-300">Document type</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(DOCUMENT_TYPES) as DocumentTypeId[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                    documentType === type
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
                      : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200",
                  )}
                >
                  <span className="font-medium">{DOCUMENT_TYPES[type].label}</span>
                  <span className="mt-1 block text-xs opacity-80">{DOCUMENT_TYPES[type].description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-zinc-300">Fields to extract</Label>
          <div className="space-y-2 rounded-xl border border-white/10 p-3">
            <div className="flex items-start gap-3 rounded-lg bg-white/5 px-2 py-2 opacity-80">
              <Checkbox checked disabled id="field-sourcePage" />
              <div>
                <Label htmlFor="field-sourcePage" className="text-zinc-200">
                  Source Page
                </Label>
                <p className="text-xs text-zinc-500">Always included for traceability</p>
              </div>
            </div>
            {selectableFields.map((field) => (
              <div key={field.id} className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
                <Checkbox
                  id={`field-${field.id}`}
                  checked={enabledFields.includes(field.id)}
                  onCheckedChange={(checked) => toggleField(field.id, checked === true)}
                />
                <div>
                  <Label htmlFor={`field-${field.id}`} className="cursor-pointer text-zinc-200">
                    {field.label}
                  </Label>
                  <p className="text-xs text-zinc-500">{field.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-white/10 pt-4 sm:gap-0">
          <Button type="button" variant="ghost" className="text-zinc-400" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700"
            onClick={handleConfirm}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
