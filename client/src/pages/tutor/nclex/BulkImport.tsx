import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import { useNclexAdminExamType } from "@/hooks/useNclexAdminExamType";
import {
  bulkImportQuestions,
  getQuizTemplateById,
  listPreviewQuestionsForQuizTemplate,
  updateQuizTemplate,
} from "@/lib/firestore/nclex";
import type { NclexExamType } from "@/lib/firestore/nclexTypes";
import {
  NclexBlueprintSelects,
  labelsFromBlueprintSelection,
  type NclexBlueprintSelection,
} from "@/components/nclex/NclexBlueprintSelects";
import { uploadQuizStemImage } from "@/lib/firestore/quizStemImages";
import { parseNclexAdminBulkPaste } from "@/lib/nclex/bulkImportParser";
import { parseBulkQuestions } from "@/lib/nclex/keywordExtractor";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const FORMAT_HELP = `Bulk additional (create or add questions)

Paste your block (or upload a .docx) starting with optional headers, then each question separated by a long underscore line (or by "Question 2", "Question 3", …).

Category: Physiological Integrity
Topic: Cardiovascular + Priority & Clinical Judgment
________________________________________
Question 1
…stem text…
(Optional) Image URL: https://example.com/figure.png
A) First option   (or "A. First option" from Word)
B) Second option
C) Third option
D) Fourth option  (E) is also supported when present
Correct Answer: B
Rationale:
Multi-line rationale text is OK.
You can include extra sub-sections inside the rationale, e.g.
Key terms explained:
...

Why the others are not correct:
(Optional; stored for admins only — students never see this.)
A. …
B. …

You can also attach images in order: use “Stem images (optional)” below — the first file pairs with Question 1, etc. A pasted Image URL line wins over a file for that same question.

If the preview count is higher than your real bank, you likely pasted the same questions twice or merged a rationale into the next question. Identical duplicate blocks are collapsed to one unique item.

Legacy format (still supported): stem on first line, A)–D) lines, mark correct with **CORRECT**, and (Rationale: …) on one line.`;

const ADDITIVE_HELP = `Bulk additional (this quiz + category)

What you can paste:
- Start directly at "Question 1" (NO Category: line needed)
- A)–D) options (E supported)
- "Correct Answer: B"
- "Rationale:" (multi-line OK)
- Optional sub-sections like "Key terms explained:" inside the rationale

What happens:
- Questions are saved into the existing category
- Titles continue numbering from the last question (Q25, Q26, …)
- The quiz question limit increases (e.g. 24 → 48)`;

export default function BulkImport() {
  const [loc, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const { adminExamType } = useNclexAdminExamType();
  const [importBlueprint, setImportBlueprint] = useState<NclexBlueprintSelection>({ catId: "", topicId: "", subId: "" });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [docxBusy, setDocxBusy] = useState(false);
  const [stemImageFiles, setStemImageFiles] = useState<File[]>([]);
  const seededCategoryHeader = useRef(false);
  const [templateHint, setTemplateHint] = useState<{
    templateId: string;
    templateTitle: string;
    filterCategory: string | null;
    currentCount: number;
    currentLimit: number | null;
  } | null>(null);

  const urlCategory = useMemo(() => {
    // wouter's `location` is not guaranteed to include the querystring in all environments.
    // Read from `window.location.search` when available.
    const qs =
      typeof window !== "undefined"
        ? window.location.search || ""
        : loc.includes("?")
          ? loc.slice(loc.indexOf("?"))
          : "";
    return new URLSearchParams(qs).get("category")?.trim() ?? "";
  }, [loc]);

  const urlTemplateId = useMemo(() => {
    const qs =
      typeof window !== "undefined"
        ? window.location.search || ""
        : loc.includes("?")
          ? loc.slice(loc.indexOf("?"))
          : "";
    return new URLSearchParams(qs).get("templateId")?.trim() ?? "";
  }, [loc]);

  const additiveMode = Boolean(urlTemplateId);

  const assumedCategory = useMemo(() => {
    const c = urlCategory?.trim();
    if (c) return c;
    const t = templateHint?.filterCategory?.trim();
    return t ? t : "";
  }, [urlCategory, templateHint?.filterCategory]);

  useEffect(() => {
    if (!urlTemplateId || !profile || !isTutorOrAdmin(profile)) {
      setTemplateHint(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const t = await getQuizTemplateById(urlTemplateId);
        if (cancelled || !t) return;
        const qs = await listPreviewQuestionsForQuizTemplate(t, {
          isAdmin: profile.role === "admin",
          tutorUid: profile.uid,
          studentTrack: adminExamType ?? null,
        });
        if (cancelled) return;
        setTemplateHint({
          templateId: t.id,
          templateTitle: t.title,
          filterCategory: (t as any)?.filterCategory ?? null,
          currentCount: qs.length,
          currentLimit: t.questionLimit != null && t.questionLimit > 0 ? t.questionLimit : null,
        });
      } catch {
        if (!cancelled) setTemplateHint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlTemplateId, profile, adminExamType]);

  useEffect(() => {
    // When importing "into an existing quiz category" (templateId present), don't force a Category header into the box.
    // We'll assume the category from the URL for parsing/import if it's missing.
    if (!urlCategory || urlTemplateId || seededCategoryHeader.current) return;
    setText((prev) => {
      if (prev.trim()) {
        seededCategoryHeader.current = true;
        return prev;
      }
      seededCategoryHeader.current = true;
      return `Category: ${urlCategory}\nTopic: \n________________________________________\n\n`;
    });
  }, [urlCategory]);

  const effectiveText = useMemo(() => {
    const t = text;
    if (!assumedCategory) {
      if (!additiveMode) return t;
      // Add-to-quiz flow: if the template has no category filter, treat it as "General"
      // and avoid showing "missing Category" warnings.
      return `Category: General\nTopic: \n________________________________________\n\n${t}`;
    }
    // If the paste already includes a Category header, keep it.
    if (/^\s*Category\s*:/im.test(t)) return t;
    // If we're coming from a quiz/category, assume the category implicitly.
    if (additiveMode) {
      return `Category: ${assumedCategory}\nTopic: \n________________________________________\n\n${t}`;
    }
    return t;
  }, [text, assumedCategory, additiveMode]);

  const preview = useMemo(() => {
    const structured = parseNclexAdminBulkPaste(effectiveText);
    if (structured.questions.length > 0) {
      return { mode: "structured" as const, structured };
    }
    const legacy = parseBulkQuestions(effectiveText).filter((p) => !p.error && p.rationale);
    return { mode: "legacy" as const, structured, legacyCount: legacy.length };
  }, [effectiveText]);

  const stemImageHint = useMemo(() => {
    const nFiles = stemImageFiles.length;
    if (preview.mode === "structured") {
      const fromText = preview.structured.questions.filter((q) => q.stemImageUrl).length;
      if (!fromText && !nFiles) return "";
      return `${fromText} stem image URL(s) in paste · ${nFiles} image file(s) selected (URL in text overrides file for that question).`;
    }
    if (!nFiles) return "";
    return `${nFiles} image file(s) will attach to questions 1–${nFiles} in order (legacy import).`;
  }, [preview, stemImageFiles]);

  const shownWarnings = useMemo(() => {
    const ws = preview.mode === "structured" ? preview.structured.warnings : [];
    if (!additiveMode) return ws;
    // In add-to-quiz flow we auto-apply category, so these warnings are just confusing.
    return ws.filter((w) => !/No\s+"?Category:"?\s+line\s+found/i.test(w));
  }, [preview, additiveMode]);

  const onImport = async () => {
    if (!profile || !isTutorOrAdmin(profile)) return;

    let category = "General";
    let topic = "";
    let inputs: Array<{
      title: string;
      questionText: string;
      options: { id: string; text: string }[];
      correctAnswerId: string;
      rationale: string;
      whyOthersIncorrect?: string;
      stemImageUrl?: string;
      category: string;
      topic?: string;
      isActive: boolean;
    }> = [];

    // Ensure additive imports always know the current template pool count/limit for numbering + cap updates,
    // even if the header hint failed to load.
    const runtimeTemplate = additiveMode && urlTemplateId ? await getQuizTemplateById(urlTemplateId) : null;

    const runtimeCount =
      runtimeTemplate && urlTemplateId
        ? (
            await listPreviewQuestionsForQuizTemplate(
              { filterCategory: runtimeTemplate.filterCategory ?? null, questionLimit: runtimeTemplate.questionLimit ?? 0 },
              {
                isAdmin: profile.role === "admin",
                tutorUid: profile.uid,
                studentTrack: adminExamType ?? null,
              },
            )
          ).length
        : templateHint?.currentCount ?? 0;

    const startNum =
      additiveMode && urlTemplateId
        ? Math.max(1, runtimeCount + 1)
        : templateHint
          ? Math.max(1, templateHint.currentCount + 1)
          : 1;

    if (preview.mode === "structured" && preview.structured.questions.length > 0) {
      const s = preview.structured;
      category = s.category || assumedCategory || "General";
      topic = s.topic;
      inputs = s.questions.map((p, i) => ({
        title: additiveMode && urlTemplateId ? `Q${startNum + i}` : templateHint ? `Q${startNum + i}` : "",
        questionText: p.questionText,
        options: p.options,
        correctAnswerId: p.correctAnswerId,
        rationale: p.rationale,
        ...(p.whyOthersIncorrect?.trim() ? { whyOthersIncorrect: p.whyOthersIncorrect.trim() } : {}),
        category,
        topic: topic || undefined,
        isActive: true,
      }));
    } else {
      const legacy = parseBulkQuestions(effectiveText).filter((p) => !p.error && p.rationale);
      if (!legacy.length) {
        toast.error("No valid questions found. Check Category / Topic / Correct Answer / Rationale format.");
        return;
      }
      inputs = legacy.map((p, i) => ({
        title: additiveMode && urlTemplateId ? `Q${startNum + i}` : templateHint ? `Q${startNum + i}` : `Imported ${i + 1}`,
        questionText: p.questionText,
        options: p.options,
        correctAnswerId: p.correctAnswerId,
        rationale: p.rationale || "",
        category: assumedCategory || "imported",
        isActive: true,
      }));
    }

    setBusy(true);
    try {
      const uploadedUrls: string[] = [];
      for (const f of stemImageFiles) {
        uploadedUrls.push(await uploadQuizStemImage(f));
      }
      if (stemImageFiles.length > inputs.length) {
        toast.info(
          `${stemImageFiles.length - inputs.length} extra image file(s) were ignored (fewer questions than files).`,
        );
      }

      const merged = inputs.map((row, i) => {
        const fromPaste =
          preview.mode === "structured" ? preview.structured.questions[i]?.stemImageUrl?.trim() : "";
        const fromFile = uploadedUrls[i]?.trim() ?? "";
        const u = (fromPaste || fromFile).trim();
        return u ? { ...row, stemImageUrl: u } : row;
      });

      const bpLabels = labelsFromBlueprintSelection(importBlueprint);
      const examForRows: NclexExamType | null =
        adminExamType === "rn" || adminExamType === "pn" ? adminExamType : null;
      const withBlueprint = merged.map((row) => ({
        ...row,
        ...(examForRows ? { examType: examForRows } : {}),
        ...(bpLabels.nclexCategory?.trim() ? { nclexCategory: bpLabels.nclexCategory.trim() } : {}),
        ...(bpLabels.nclexTopic?.trim() ? { nclexTopic: bpLabels.nclexTopic.trim() } : {}),
        ...(bpLabels.nclexSubtopic?.trim() ? { nclexSubtopic: bpLabels.nclexSubtopic.trim() } : {}),
      }));

      const ids = await bulkImportQuestions(withBlueprint, profile.uid);
      const dup = preview.mode === "structured" ? preview.structured.duplicateBlocksRemoved ?? 0 : 0;
      toast.success(
        `Imported ${ids.length} unique question(s) into Firestore (category: ${category}).${dup ? ` (${dup} duplicate block(s) were skipped.)` : ""}`,
      );
      if (additiveMode && urlTemplateId && ids.length > 0) {
        const t = runtimeTemplate ?? (await getQuizTemplateById(urlTemplateId));
        if (t) {
          const baseLimit = t.questionLimit != null && t.questionLimit > 0 ? t.questionLimit : runtimeCount;
          const nextLimit = baseLimit + ids.length;
          await updateQuizTemplate(t.id, { questionLimit: nextLimit });
          setTemplateHint((prev) => {
            const cur = prev ?? {
              templateId: t.id,
              templateTitle: t.title,
              filterCategory: t.filterCategory ?? null,
              currentCount: runtimeCount,
              currentLimit: t.questionLimit > 0 ? t.questionLimit : null,
            };
            return { ...cur, currentLimit: nextLimit, currentCount: runtimeCount + ids.length };
          });
          toast.success(`Updated quiz limit to ${nextLimit} questions (added ${ids.length}).`);
        }
      }
      if (preview.mode === "structured" && preview.structured.warnings.length) {
        toast.info(preview.structured.warnings.slice(0, 5).join(" · "));
      }
      setText("");
      setStemImageFiles([]);
      if (additiveMode && urlTemplateId) {
        // Return to the quiz preview so the admin sees the combined pool immediately.
        navigate(`/tutor/nclex/student-preview/${encodeURIComponent(urlTemplateId)}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return <div className="container py-12 text-muted-foreground">Checking access…</div>;
  }

  const readyCount =
    preview.mode === "structured" ? preview.structured.questions.length : preview.legacyCount;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-3xl space-y-6 py-8">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Bulk additional</CardTitle>
            <CardDescription>
              {additiveMode
                ? "Add questions to an existing published quiz (additional questions)."
                : "Create new questions from a bulk additional paste (category + options + keyed answer + rationale)."}
            </CardDescription>
            {additiveMode ? (
              <p className="pt-2 text-sm text-slate-700">
                Additive mode
                {assumedCategory ? (
                  <>
                    {" "}
                    for category <span className="font-semibold">{assumedCategory}</span>
                  </>
                ) : null}
                {templateHint ? (
                  <>
                    {" "}
                    · quiz <span className="font-semibold">{templateHint.templateTitle}</span> · currently showing{" "}
                    <span className="font-semibold tabular-nums">{templateHint.currentCount}</span>
                    {templateHint.currentLimit != null ? (
                      <>
                        {" "}
                        · limit <span className="font-semibold tabular-nums">{templateHint.currentLimit}</span>
                      </>
                    ) : null}
                    . New questions will be titled starting at{" "}
                    <span className="font-mono">Q{templateHint.currentCount + 1}</span>.
                  </>
                ) : (
                  <>. New questions will be added and the quiz limit will increase.</>
                )}
              </p>
            ) : null}
            {urlCategory && !templateHint ? (
              <p className="pt-2 text-sm text-blue-900">
                Opened with category <span className="font-semibold">{urlCategory}</span> — the import box was seeded with
                a matching <span className="font-mono text-xs">Category:</span> header when it was empty. Legacy imports
                use this category if the paste does not set one.
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
              <p className="text-sm font-medium text-slate-900">NCLEX blueprint tags (saved on each imported question)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Uses your tutor dashboard exam track (RN/PN) when set. Category/topic/subtopic here are stored on every
                row in this import so you can filter test banks and tutoring extracts later.
              </p>
              <div className="mt-3">
                <NclexBlueprintSelects value={importBlueprint} onChange={setImportBlueprint} />
              </div>
            </div>
            <pre className="max-h-48 overflow-auto rounded-md border bg-white p-3 text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">
              {additiveMode ? ADDITIVE_HELP : FORMAT_HELP}
            </pre>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Import from Word: choose a <span className="font-medium">.docx</span> and we’ll extract it into the text box
                  (text only — use image files or <span className="font-mono text-xs">Image URL:</span> lines for figures).
                </div>
                <input
                  type="file"
                  accept=".docx"
                  disabled={busy || docxBusy}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0] ?? null;
                    if (!f) return;
                    setDocxBusy(true);
                    void (async () => {
                      try {
                        const { extractRawText } = await import("mammoth/mammoth.browser");
                        const arrayBuffer = await f.arrayBuffer();
                        const res = await extractRawText({ arrayBuffer });
                        setText(res.value ?? "");
                        toast.success(`Loaded "${f.name}" into the import box.`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not read .docx");
                      } finally {
                        setDocxBusy(false);
                        e.currentTarget.value = "";
                      }
                    })();
                  }}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Stem images (optional): select one or more PNG/JPG/WebP/GIF files — paired in <span className="font-medium">sorted file-name order</span>{" "}
                  with Question 1, 2, …
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
                  multiple
                  disabled={busy || docxBusy}
                  onChange={(e) => {
                    const list = Array.from(e.currentTarget.files ?? []);
                    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
                    setStemImageFiles(list);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </div>
            <Textarea rows={18} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-sm" />
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <span className="font-medium">Preview: </span>
              {readyCount > 0 ? (
                <>
                  {preview.mode === "structured" ? (
                    <>
                      {(preview.structured.duplicateBlocksRemoved ?? 0) > 0 ? (
                        <span>
                          {preview.structured.rawParsedCount ?? readyCount} blocks parsed →{" "}
                          <strong>{readyCount} unique</strong> (removed {preview.structured.duplicateBlocksRemoved}{" "}
                          exact duplicate{preview.structured.duplicateBlocksRemoved !== 1 ? "s" : ""}) · Category &quot;
                          {preview.structured.category}&quot;
                          {preview.structured.topic ? ` · Topic "${preview.structured.topic}"` : ""}
                        </span>
                      ) : (
                        <span>
                          {readyCount} question(s) ready · Category &quot;{preview.structured.category}&quot;
                          {preview.structured.topic ? ` · Topic "${preview.structured.topic}"` : ""}
                        </span>
                      )}
                    </>
                  ) : (
                    <>{readyCount} question(s) (legacy **CORRECT** format) · category &quot;imported&quot;</>
                  )}
                </>
              ) : (
                <>No valid blocks yet — paste content above.</>
              )}
              {stemImageHint ? (
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-medium">Images: </span>
                  {stemImageHint}
                </p>
              ) : null}
              {preview.mode === "structured" && shownWarnings.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
                  {shownWarnings.slice(0, 8).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Button onClick={() => void onImport()} disabled={busy || readyCount === 0} className="bg-orange-600 hover:bg-orange-700">
              Import to Firestore
            </Button>
            <p className="text-sm text-muted-foreground">
              {additiveMode ? (
                <>This is additive: your quiz’s question limit will increase to include the new items.</>
              ) : (
                <>
                  After import, you can edit questions in the{" "}
                  <Link href="/tutor/nclex/questions" className="font-medium text-orange-700 underline">
                    question bank
                  </Link>
                  .
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
