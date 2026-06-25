import type { ReactNode } from "react";
import { FileSpreadsheet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExtractionSessionMeta, ExtractionSessionRow } from "@shared/documentExtraction";
import { SpreadsheetTableView } from "@/pages/ntsa/SpreadsheetTableView";

export type SpreadsheetPreviewItem = {
  label: string;
  rows: ExtractionSessionRow[];
  meta?: ExtractionSessionMeta | null;
};

type Props = {
  item: SpreadsheetPreviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions?: ReactNode;
};

export function SpreadsheetPreviewDialog({ item, open, onOpenChange, actions }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[80vh] max-h-[80vh] w-[80vw] max-w-[80vw] flex-col gap-0 overflow-hidden border-white/10 bg-[#0c0c12] p-0 text-white sm:max-w-[80vw]"
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-white">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-amber-400" />
                <span className="truncate">{item?.label ?? "Spreadsheet"}</span>
              </DialogTitle>
              <DialogDescription className="mt-1 text-zinc-400">
                {item
                  ? `${item.rows.length} record${item.rows.length === 1 ? "" : "s"} · 50 rows per page`
                  : "Preview"}
              </DialogDescription>
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
          {item ? (
            <SpreadsheetTableView
              rows={item.rows}
              meta={item.meta}
              title={item.label}
              compact
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
