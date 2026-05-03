import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirebaseAuth, isTutorOrAdmin } from "@/contexts/FirebaseAuthContext";
import {
  createQuestion,
  deleteQuestion,
  getCorrectAnswerIds,
  getQuestionAdminOnly,
  getQuestionById,
  listQuestions,
  searchQuestions,
  updateQuestion,
} from "@/lib/firestore/nclex";
import { uploadQuizStemImage } from "@/lib/firestore/quizStemImages";
import {
  extractFirstImageUrlFromText,
  isPixabayCdnHotlinkBlocked,
  normalizeHttpUrlForMedia,
} from "@/lib/nclex/nclexQuestionMedia";
import type { Question } from "@/lib/firestore/nclexTypes";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plus } from "lucide-react";

const defaultOptions = [
  { id: "a", text: "" },
  { id: "b", text: "" },
  { id: "c", text: "" },
  { id: "d", text: "" },
];

function canEditOrDelete(q: Question, uid: string, isAdmin: boolean): boolean {
  return isAdmin || q.createdBy === uid;
}

function parseSataLetters(s: string): string[] {
  return Array.from(
    new Set(
      s
        .toLowerCase()
        .split(/[\s,]+/)
        .map((x) => x.trim())
        .filter((x) => /^[a-d]$/.test(x)),
    ),
  ).sort();
}

export default function QuestionManagement() {
  const [loc, navigate] = useLocation();
  const { profile, loading } = useFirebaseAuth();
  const [items, setItems] = useState<Question[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const createSectionRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("Practice item");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(defaultOptions);
  const [correct, setCorrect] = useState("a");
  const [rationale, setRationale] = useState("");
  /** Admin-only; stored in Firestore subdoc students cannot read. */
  const [adminWhyOthers, setAdminWhyOthers] = useState("");
  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [stemImageUrl, setStemImageUrl] = useState("");
  const [imageAttachBusy, setImageAttachBusy] = useState(false);
  const [sataCorrectLetters, setSataCorrectLetters] = useState("");
  const [allowMultipleToggle, setAllowMultipleToggle] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editOptions, setEditOptions] = useState(defaultOptions);
  const [editCorrect, setEditCorrect] = useState("a");
  const [editRationale, setEditRationale] = useState("");
  const [editWhyOthers, setEditWhyOthers] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editStemImageUrl, setEditStemImageUrl] = useState("");
  const [editSataCorrectLetters, setEditSataCorrectLetters] = useState("");
  const [editAllowMultipleToggle, setEditAllowMultipleToggle] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);

  const isAdmin = profile?.role === "admin";

  const categoryChoices = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      const c = (it.category || "General").trim() || "General";
      s.add(c);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const displayedItems = useMemo(() => {
    if (!categoryFilter.trim()) return items;
    const f = categoryFilter.trim().toLowerCase();
    return items.filter((it) => (it.category || "General").trim().toLowerCase() === f);
  }, [items, categoryFilter]);

  const reload = async () => {
    if (!profile || !isTutorOrAdmin(profile)) return;
    const list = await listQuestions(profile.role === "admin" ? undefined : profile.uid);
    setItems(list);
  };

  /** Deep link from quiz preview: ?category=… filters library and prefills new question category. */
  useEffect(() => {
    if (!profile || loading || !isTutorOrAdmin(profile)) return;
    const qs = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
    const sp = new URLSearchParams(qs);
    if (sp.get("edit")) return;
    const cat = sp.get("category")?.trim();
    if (!cat) return;
    setCategoryFilter(cat.toLowerCase());
    setCategory(cat);
  }, [loc, profile, loading]);

  useEffect(() => {
    if (!profile || loading || !isTutorOrAdmin(profile)) return;
    const qs = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
    const sp = new URLSearchParams(qs);
    const edit = sp.get("edit");
    if (!edit) return;
    void (async () => {
      try {
        const q = await getQuestionById(edit);
        if (!q) {
          toast.error("Question not found.");
          return;
        }
        setEditId(q.id);
        setEditTitle(q.title ?? "");
        setEditQuestionText(q.questionText ?? "");
        setEditOptions(q.options?.length ? q.options : defaultOptions);
        setEditCorrect(getCorrectAnswerIds(q)[0] ?? q.correctAnswerId ?? "a");
        setEditRationale(q.rationale ?? "");
        setEditWhyOthers("");
        if (isAdmin) {
          try {
            const ao = await getQuestionAdminOnly(edit);
            setEditWhyOthers(ao?.whyOthersIncorrect ?? "");
          } catch {
            setEditWhyOthers("");
          }
        }
        setEditCategory(q.category ?? "");
        setEditTopic(q.topic ?? "");
        setEditStemImageUrl(q.stemImageUrl ?? "");
        setEditSataCorrectLetters((q.correctAnswerIds ?? []).join(","));
        setEditAllowMultipleToggle(Boolean(q.allowMultipleAnswers));
        setEditIsActive(Boolean(q.isActive));
        setEditOpen(true);
      } catch {
        toast.error("Could not open edit view.");
      } finally {
        // clean the query param so refresh doesn't re-open
        navigate("/tutor/nclex/questions");
      }
    })();
  }, [profile, loading, loc, navigate, isAdmin]);

  useEffect(() => {
    if (!loading && profile && isTutorOrAdmin(profile)) {
      void reload().catch(() => toast.error("Failed to load questions"));
    }
  }, [loading, profile]);

  const onSearch = async () => {
    if (!profile || !isTutorOrAdmin(profile)) return;
    setBusy(true);
    try {
      const res = q.trim() ? await searchQuestions(q) : await listQuestions(profile.role === "admin" ? undefined : profile.uid);
      setItems(profile.role === "admin" ? res : res.filter((x) => x.createdBy === profile.uid));
    } catch {
      toast.error("Search failed");
    } finally {
      setBusy(false);
    }
  };

  const buildCreatePayload = () => {
    const parsed = parseSataLetters(sataCorrectLetters);
    const correctAnswerIds = parsed.length >= 2 ? parsed : undefined;
    const allowMultipleAnswers = allowMultipleToggle || parsed.length >= 2;
    const primaryCorrect = parsed.length >= 1 ? parsed[0]! : correct;
    return {
      title: title.trim() || "Untitled",
      questionText: questionText.trim(),
      options,
      correctAnswerId: primaryCorrect,
      correctAnswerIds,
      allowMultipleAnswers,
      rationale: rationale.trim(),
      category: category.trim(),
      topic: topic.trim() || undefined,
      isActive: true,
      ...(stemImageUrl.trim() ? { stemImageUrl: stemImageUrl.trim() } : {}),
      ...(isAdmin && adminWhyOthers.trim() ? { whyOthersIncorrect: adminWhyOthers.trim() } : {}),
    };
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !isTutorOrAdmin(profile)) return;
    if (!questionText.trim() || !rationale.trim()) {
      toast.error("Question text and rationale are required");
      return;
    }
    const payload = buildCreatePayload();
    setBusy(true);
    try {
      await createQuestion(payload, profile.uid);
      toast.success("Question created");
      setQuestionText("");
      setStemImageUrl("");
      setRationale("");
      setAdminWhyOthers("");
      setSataCorrectLetters("");
      setAllowMultipleToggle(false);
      setOptions(defaultOptions.map((o) => ({ ...o, text: "" })));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    setBusy(true);
    try {
      await deleteQuestion(id);
      toast.success("Deleted");
      await reload();
    } catch {
      toast.error("Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (it: Question) => {
    const ids = getCorrectAnswerIds(it);
    setEditId(it.id);
    setEditTitle(it.title || "Untitled");
    setEditQuestionText(it.questionText);
    setEditOptions(
      defaultOptions.map((d) => {
        const found = it.options.find((o) => o.id.toLowerCase() === d.id);
        return { id: d.id, text: found?.text ?? "" };
      }),
    );
    setEditCorrect(ids[0] ?? it.correctAnswerId?.toLowerCase() ?? "a");
    setEditRationale(it.rationale);
    setEditWhyOthers("");
    if (isAdmin) {
      void getQuestionAdminOnly(it.id).then((ao) => setEditWhyOthers(ao?.whyOthersIncorrect ?? ""));
    }
    setEditCategory(it.category ?? "");
    setEditTopic(it.topic ?? "");
    setEditStemImageUrl(it.stemImageUrl ?? "");
    setEditAllowMultipleToggle(Boolean(it.allowMultipleAnswers));
    setEditSataCorrectLetters(ids.length >= 2 ? ids.join(", ") : "");
    setEditIsActive(it.isActive !== false);
    setEditOpen(true);
  };

  const onSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editId || !profile) return;
    if (!editQuestionText.trim() || !editRationale.trim()) {
      toast.error("Question text and rationale are required");
      return;
    }
    const parsed = parseSataLetters(editSataCorrectLetters);
    const allowMultipleAnswers = editAllowMultipleToggle || parsed.length >= 2;
    const primaryCorrect = parsed.length >= 1 ? parsed[0]! : editCorrect;

    setBusy(true);
    try {
      await updateQuestion(editId, {
        title: editTitle.trim() || "Untitled",
        questionText: editQuestionText.trim(),
        options: editOptions,
        correctAnswerId: primaryCorrect,
        correctAnswerIds: parsed.length >= 2 ? parsed : null,
        allowMultipleAnswers,
        rationale: editRationale.trim(),
        category: editCategory.trim(),
        topic: editTopic.trim() || undefined,
        isActive: editIsActive,
        stemImageUrl: editStemImageUrl.trim() || null,
        ...(isAdmin ? { whyOthersIncorrect: editWhyOthers.trim() || null } : {}),
      });
      toast.success("Question updated");
      setEditOpen(false);
      setEditId(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const addAnotherInSet = (it: Question) => {
    setCategory((it.category || "").trim());
    setTopic((it.topic || "").trim());
    setTitle("Practice item");
    setQuestionText("");
    setStemImageUrl("");
    setRationale("");
    setSataCorrectLetters("");
    setAllowMultipleToggle(false);
    setCorrect("a");
    setOptions(defaultOptions.map((o) => ({ ...o, text: "" })));
    createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.info("Category and topic copied — add your new stem below.");
  };

  if (loading || !profile || !isTutorOrAdmin(profile)) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/tutor/nclex")}>
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </div>

        {isAdmin ? (
          <Card className="border-blue-200 bg-blue-50/60">
            <CardHeader>
              <CardTitle className="text-lg">Admin · question bank</CardTitle>
              <CardDescription>
                You can edit or delete any item (including bulk imports). Use the category filter to work through one
                test or topic at a time, then use &quot;Add in this set&quot; to append more questions with the same
                category and topic metadata.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card ref={createSectionRef}>
          <CardHeader>
            <CardTitle>New question</CardTitle>
            <CardDescription>Four options (ids a–d). Pick the correct key or list multiple letters for SATA.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 max-w-3xl">
              <div className="grid gap-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Stem</Label>
                <Textarea rows={4} value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Stem image (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Shown below the stem on student quizzes. Paste an HTTPS URL or upload a PNG/JPG/WebP/GIF.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={stemImageUrl}
                    onChange={(e) => setStemImageUrl(e.target.value)}
                    placeholder="https://…"
                    className="min-w-[200px] flex-1 font-mono text-sm"
                  />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
                    disabled={busy || imageAttachBusy}
                    className="max-w-[220px] cursor-pointer text-sm file:mr-2"
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0] ?? null;
                      e.currentTarget.value = "";
                      if (!f) return;
                      setImageAttachBusy(true);
                      void uploadQuizStemImage(f)
                        .then((url) => {
                          setStemImageUrl(url);
                          toast.success("Stem image uploaded.");
                        })
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Upload failed"))
                        .finally(() => setImageAttachBusy(false));
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {options.map((opt, idx) => (
                  <div key={opt.id} className="grid gap-1">
                    <Label>Option {opt.id.toUpperCase()}</Label>
                    <Input
                      value={opt.text}
                      onChange={(e) => {
                        const next = [...options];
                        next[idx] = { ...opt, text: e.target.value };
                        setOptions(next);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label>Correct option</Label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={correct}
                    onChange={(e) => setCorrect(e.target.value)}
                  >
                    {["a", "b", "c", "d"].map((id) => (
                      <option key={id} value={id}>
                        {id.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label>Category</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Physiological Integrity" />
                </div>
              </div>
              <div className="grid gap-1">
                <Label>Topic (optional)</Label>
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Cardiovascular" />
              </div>
              <div className="grid gap-2">
                <Label>Rationale</Label>
                <Textarea rows={4} value={rationale} onChange={(e) => setRationale(e.target.value)} />
              </div>
              {isAdmin ? (
                <div className="grid gap-2 rounded-md border border-violet-200 bg-violet-50/60 p-3">
                  <Label>Why the other options are not correct (admin-only)</Label>
                  <p className="text-xs text-muted-foreground">
                    Shown only to admins when reviewing student attempts. Students never see this text.
                  </p>
                  <Textarea
                    rows={5}
                    value={adminWhyOthers}
                    onChange={(e) => setAdminWhyOthers(e.target.value)}
                    placeholder="Optional. e.g. bullet lines for A–D distractors."
                    className="font-mono text-sm"
                  />
                </div>
              ) : null}
              <div className="grid gap-2 rounded-md border border-dashed border-orange-200 bg-orange-50/50 p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Select all that apply:</strong> list every correct letter below, or use the single correct
                  dropdown only.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="sata-toggle"
                    type="checkbox"
                    checked={allowMultipleToggle}
                    onChange={(e) => setAllowMultipleToggle(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="sata-toggle" className="font-normal">
                    Allow multiple selections (SATA) even with one keyed answer
                  </Label>
                </div>
                <div className="grid gap-1">
                  <Label>All correct options (optional, e.g. a, c, d)</Label>
                  <Input
                    value={sataCorrectLetters}
                    onChange={(e) => setSataCorrectLetters(e.target.value)}
                    placeholder="Leave blank for single-answer using dropdown"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-fit bg-orange-600 hover:bg-orange-700">
                Save question
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Library</CardTitle>
            <CardDescription>Search title, stem, category, or topic. Admins see the full bank; tutors see their own items.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 max-w-3xl">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="min-w-[200px] flex-1" />
              <Button type="button" variant="secondary" onClick={() => void onSearch()} disabled={busy}>
                Search
              </Button>
              <Button type="button" variant="outline" onClick={() => void reload()} disabled={busy}>
                Reset
              </Button>
            </div>
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-sm text-muted-foreground">Filter by category</Label>
                <select
                  className="h-10 min-w-[200px] rounded-md border border-input bg-background px-3 text-sm"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All categories</option>
                  {categoryChoices.map((c) => (
                    <option key={c} value={c.trim().toLowerCase()}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <ul className="divide-y rounded-lg border bg-white">
              {displayedItems.map((it) => {
                const ids = getCorrectAnswerIds(it);
                const can = profile ? canEditOrDelete(it, profile.uid, isAdmin) : false;
                const thumb =
                  it.stemImageUrl?.trim() || extractFirstImageUrlFromText(it.questionText) || null;
                const thumbNorm = thumb ? normalizeHttpUrlForMedia(thumb) : "";
                const thumbPixabay = thumbNorm && isPixabayCdnHotlinkBlocked(thumbNorm);
                return (
                  <li key={it.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    {thumb ? (
                      <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-1 text-center sm:mt-0 sm:h-20 sm:w-32">
                        {thumbPixabay ? (
                          <a
                            href={thumbNorm}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-medium leading-tight text-blue-800 underline sm:text-xs"
                          >
                            Pixabay (blocked embed) — open
                          </a>
                        ) : (
                          <img
                            src={thumbNorm}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium">{it.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{it.questionText}</p>
                      <p className="text-xs text-muted-foreground">
                        Category: {it.category || "—"}
                        {it.topic ? ` · Topic: ${it.topic}` : ""}
                        {ids.length ? ` · Answer key: ${ids.map((x) => x.toUpperCase()).join(", ")}` : ""}
                        {!it.isActive ? " · Inactive" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {can ? (
                        <>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(it)} disabled={busy}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button size="sm" variant="secondary" className="gap-1" onClick={() => addAnotherInSet(it)} disabled={busy}>
                            <Plus className="h-3.5 w-3.5" />
                            Add in this set
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void onDelete(it.id)} disabled={busy}>
                            Delete
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Owned by another tutor</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {displayedItems.length === 0 ? <p className="text-sm text-muted-foreground">No questions match.</p> : null}
          </CardContent>
        </Card>

        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEditOpen(false);
              setEditId(null);
            }
          }}
        >
          <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit question</DialogTitle>
              <DialogDescription>Update stem, answer key, rationale, or category. Keywords refresh from rationale when you save.</DialogDescription>
            </DialogHeader>
            <form onSubmit={onSaveEdit} className="grid gap-4">
              <div className="grid gap-2">
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Stem</Label>
                <Textarea rows={4} value={editQuestionText} onChange={(e) => setEditQuestionText(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Stem image (optional)</Label>
                <p className="text-xs text-muted-foreground">Clear the URL and save to remove the image from this question.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={editStemImageUrl}
                    onChange={(e) => setEditStemImageUrl(e.target.value)}
                    placeholder="https://…"
                    className="min-w-[200px] flex-1 font-mono text-sm"
                  />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
                    disabled={busy || imageAttachBusy}
                    className="max-w-[220px] cursor-pointer text-sm file:mr-2"
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0] ?? null;
                      e.currentTarget.value = "";
                      if (!f) return;
                      setImageAttachBusy(true);
                      void uploadQuizStemImage(f)
                        .then((url) => {
                          setEditStemImageUrl(url);
                          toast.success("Stem image uploaded.");
                        })
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Upload failed"))
                        .finally(() => setImageAttachBusy(false));
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {editOptions.map((opt, idx) => (
                  <div key={opt.id} className="grid gap-1">
                    <Label>Option {opt.id.toUpperCase()}</Label>
                    <Input
                      value={opt.text}
                      onChange={(e) => {
                        const next = [...editOptions];
                        next[idx] = { ...opt, text: e.target.value };
                        setEditOptions(next);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label>Correct option</Label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={editCorrect}
                    onChange={(e) => setEditCorrect(e.target.value)}
                  >
                    {["a", "b", "c", "d"].map((id) => (
                      <option key={id} value={id}>
                        {id.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label>Category</Label>
                  <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-1">
                <Label>Topic (optional)</Label>
                <Input value={editTopic} onChange={(e) => setEditTopic(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Rationale</Label>
                <Textarea rows={4} value={editRationale} onChange={(e) => setEditRationale(e.target.value)} />
              </div>
              {isAdmin ? (
                <div className="grid gap-2 rounded-md border border-violet-200 bg-violet-50/60 p-3">
                  <Label>Why the other options are not correct (admin-only)</Label>
                  <p className="text-xs text-muted-foreground">Leave blank and save to remove this block from Firestore.</p>
                  <Textarea
                    rows={5}
                    value={editWhyOthers}
                    onChange={(e) => setEditWhyOthers(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              ) : null}
              <div className="grid gap-2 rounded-md border border-dashed border-orange-200 bg-orange-50/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="edit-sata-toggle"
                    type="checkbox"
                    checked={editAllowMultipleToggle}
                    onChange={(e) => setEditAllowMultipleToggle(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="edit-sata-toggle" className="font-normal">
                    Allow multiple selections (SATA)
                  </Label>
                </div>
                <div className="grid gap-1">
                  <Label>All correct options (e.g. a, c, d)</Label>
                  <Input
                    value={editSataCorrectLetters}
                    onChange={(e) => setEditSataCorrectLetters(e.target.value)}
                    className="font-mono text-sm"
                    placeholder="Leave blank for single correct from dropdown"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="edit-active"
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="edit-active" className="font-normal">
                  Active (shown in student quizzes)
                </Label>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => (setEditOpen(false), setEditId(null))}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className="bg-orange-600 hover:bg-orange-700">
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
