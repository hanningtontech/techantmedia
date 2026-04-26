import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExplanationBlocks } from "@/components/nclex/ExplanationBlocks";
import { QuestionCard } from "@/components/nclex/QuestionCard";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import {
  getCorrectAnswerIds,
  getQuizTemplateById,
  listPreviewQuestionsForQuizTemplate,
  toStudentQuestion,
} from "@/lib/firestore/nclex";
import type { Question, QuizTemplate } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { ArrowLeft, Download, FileImage, FileText, ListPlus, Printer, Upload } from "lucide-react";

function categoryQuery(cat: string | null | undefined): string {
  const c = cat?.trim();
  if (!c) return "";
  return `?category=${encodeURIComponent(c)}`;
}

export default function AdminTemplateAnswerKeyPreview() {
  const { templateId } = useParams() as { templateId: string };
  const [, navigate] = useLocation();
  const { loading, profile } = useFirebaseAuth();
  const [template, setTemplate] = useState<QuizTemplate | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [phase, setPhase] = useState<"boot" | "ready" | "missing">("boot");
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    if (!templateId || !profile || profile.role !== "admin") return;
    let cancelled = false;
    void (async () => {
      try {
        const t = await getQuizTemplateById(templateId);
        if (cancelled) return;
        if (!t?.isActive) {
          setTemplate(null);
          setPhase("missing");
          return;
        }
        setTemplate(t);
        const qs = await listPreviewQuestionsForQuizTemplate(t, { isAdmin: true, tutorUid: profile.uid });
        if (cancelled) return;
        setQuestions(qs);
        setPhase("ready");
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Load failed");
          setPhase("missing");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, profile]);

  if (loading || phase === "boot") {
    return (
      <div className="container py-16 text-muted-foreground">
        <p>Loading preview…</p>
      </div>
    );
  }

  if (!profile || profile.role !== "admin") {
    return (
      <div className="container py-16">
        <p className="text-muted-foreground">Admin only.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/tutor/nclex")}>
          Dashboard
        </Button>
      </div>
    );
  }

  if (phase === "missing" || !template) {
    return (
      <div className="container max-w-lg py-16">
        <Card>
          <CardHeader>
            <CardTitle>Quiz not found</CardTitle>
            <CardDescription>The template may be inactive or deleted.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/tutor/nclex/student-preview")}>
              Back to catalog
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const catQ = categoryQuery(template.filterCategory);
  const catLabel = template.filterCategory?.trim() || "All categories";

  const previewId = "answer-key-preview-export";

  const exportWord = async () => {
    if (!template) return;
    try {
      const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");

      const children: any[] = [];
      children.push(
        new Paragraph({
          text: template.title,
          heading: HeadingLevel.TITLE,
        }),
      );
      if (template.description?.trim()) {
        children.push(new Paragraph({ text: template.description.trim() }));
      }
      children.push(new Paragraph({ text: `Category: ${catLabel}` }));
      children.push(new Paragraph({ text: `Questions: ${questions.length}` }));
      children.push(new Paragraph({ text: "" }));

      questions.forEach((q, i) => {
        const correctIds = new Set(getCorrectAnswerIds(q));
        children.push(
          new Paragraph({
            text: `Question ${i + 1}`,
            heading: HeadingLevel.HEADING_2,
          }),
        );
        if (q.questionText?.trim()) {
          children.push(new Paragraph({ text: q.questionText.trim() }));
        }
        children.push(new Paragraph({ text: "" }));
        (q.options ?? []).forEach((o) => {
          const id = String(o.id ?? "").toLowerCase().trim();
          const isCorrect = correctIds.has(id);
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${String(o.id ?? "").toUpperCase()}. `, bold: true }),
                new TextRun({ text: String(o.text ?? "") }),
                ...(isCorrect
                  ? [new TextRun({ text: "  (Correct)", bold: true })]
                  : []),
              ],
            }),
          );
        });
        if (q.rationale?.trim()) {
          children.push(new Paragraph({ text: "" }));
          children.push(new Paragraph({ text: "Answer key rationale", heading: HeadingLevel.HEADING_3 }));
          children.push(new Paragraph({ text: q.rationale.trim() }));
        }
        children.push(new Paragraph({ text: "" }));
      });

      const doc = new Document({
        sections: [{ children }],
      });

      const blob = await Packer.toBlob(doc);
      const safeTitle = (template.title || "Answer key").replace(/[\\/:*?\"<>|]/g, "-").slice(0, 80);
      const filename = `${safeTitle}.docx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded Word document.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const exportPrintPdf = () => {
    // Use browser print dialog; user can select “Save to PDF”.
    setSaveOpen(false);
    window.print();
  };

  const prepForCapture = async () => {
    // Close any Radix portals/popovers before capture/print.
    setSaveOpen(false);
    (document.activeElement as HTMLElement | null)?.blur?.();
    // Wait a tick so the DOM updates before screenshotting.
    await new Promise<void>((r) => setTimeout(() => r(), 50));
  };

  const exportSnapshotPng = async () => {
    try {
      await prepForCapture();
      const el = document.getElementById(previewId);
      if (!el) throw new Error("Preview not found");
      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: Math.min(2, window.devicePixelRatio || 1),
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const safeTitle = (template.title || "Answer key").replace(/[\\/:*?\"<>|]/g, "-").slice(0, 80);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${safeTitle}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Downloaded PNG snapshot.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Snapshot export failed");
    }
  };

  const exportSnapshotPdf = async () => {
    try {
      await prepForCapture();
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;

      const root = document.getElementById(previewId);
      if (!root) throw new Error("Preview not found");
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(".export-question"));
      if (nodes.length === 0) throw new Error("No questions found");

      for (let idx = 0; idx < nodes.length; idx++) {
        const node = nodes[idx];
        const canvas = await html2canvas(node, {
          backgroundColor: "#ffffff",
          scale: Math.min(2, window.devicePixelRatio || 1),
          useCORS: true,
        });
        const imgData = canvas.toDataURL("image/png");
        const imgW = canvas.width;
        const imgH = canvas.height;

        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const scale = Math.min(maxW / imgW, maxH / imgH);
        const renderW = imgW * scale;
        const renderH = imgH * scale;

        if (idx > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", margin + (maxW - renderW) / 2, margin, renderW, renderH);
      }

      const safeTitle = (template.title || "Answer key").replace(/[\\/:*?\"<>|]/g, "-").slice(0, 80);
      pdf.save(`${safeTitle}.pdf`);
      toast.success("Downloaded PDF snapshot.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    }
  };

  return (
    <div className="nclex-app min-h-screen bg-gradient-to-b from-slate-50/80 to-white pb-16">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex/student-preview")}>
            <ArrowLeft className="h-4 w-4" />
            Quiz catalog
          </Button>
        </div>

        <Card className="border-[var(--nclex-border)]">
          <CardHeader>
            <CardTitle className="text-xl">{template.title}</CardTitle>
            <CardDescription>
              {template.description ? <span className="mb-2 block text-slate-700">{template.description}</span> : null}
              <span className="block text-sm text-slate-800">
                Showing <span className="font-semibold tabular-nums">{questions.length}</span> question
                {questions.length === 1 ? "" : "s"} (same pool and cap as a student attempt). Correct options are
                pre-selected and highlighted as on the results page.
              </span>
              <span className="mt-2 block text-xs font-medium text-slate-700">
                Bank category: <span className="text-slate-900">{catLabel}</span>
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 border-t pt-4">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/tutor/nclex/questions${catQ}`}>
                <ListPlus className="mr-2 h-4 w-4" />
                Add question
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/tutor/nclex/bulk-import${catQ}${catQ ? "&" : "?"}templateId=${encodeURIComponent(template.id)}`}>
                <Upload className="mr-2 h-4 w-4" />
                Bulk additional
              </Link>
            </Button>
            <DropdownMenu open={saveOpen} onOpenChange={setSaveOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Save as
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">Export</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportPrintPdf()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print / Save to PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportSnapshotPng()}>
                  <FileImage className="mr-2 h-4 w-4" />
                  Export snapshot (PNG)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportSnapshotPdf()}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export snapshot (PDF)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void exportWord()}>
                  <FileText className="mr-2 h-4 w-4" />
                  Save as Word (.docx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>

        {questions.length === 0 ? (
          <p className="text-sm text-amber-800">
            No questions match this template&apos;s category filter. Add items in the question bank for{" "}
            <span className="font-medium">{catLabel}</span>.
          </p>
        ) : null}

        {/* Print/export target */}
        <div
          id={previewId}
          className="space-y-8"
        >
          {questions.map((q, i) => {
            const sq = toStudentQuestion(q);
            const correct = getCorrectAnswerIds(q);
            return (
              <div key={q.id} className="export-question space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
                    {i + 1}
                  </span>
                  <span>Question {i + 1}</span>
                </div>
                <QuestionCard
                  className="nclex-card"
                  question={sq}
                  value={correct}
                  onChange={() => {}}
                  allowMultiple={sq.allowMultipleAnswers}
                  readOnly
                  showCorrect
                  correctIds={correct}
                  compact
                />
                {q.rationale ? <ExplanationBlocks rationale={q.rationale} /> : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Print styles: hide nav/actions and keep white background */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .nclex-header-bar, header, nav, button, a[href], .no-print { display: none !important; }
          /* Hide Radix popovers/portals (e.g. Save as dropdown) */
          [data-radix-popper-content-wrapper], .radix-portal { display: none !important; }
          #${previewId} { padding: 0 !important; margin: 0 !important; }
          /* One question per page and avoid tearing cards */
          .export-question {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            break-after: page !important;
            page-break-after: always !important;
          }
          .export-question:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
