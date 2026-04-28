import { Fragment, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileDown, LogOut, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { AdminAccessGate } from "@/components/AdminAccessGate";
import { QuestionEditorDialog } from "@/components/QuestionEditorDialog";
import {
  fetchAllQuestions, fetchSubmissions, deleteSubmission as deleteSubDb,
  insertQuestions, deleteQuestion as deleteQuestionDb, deleteQuizByName,
  type DBSubmission,
} from "@/lib/quiz-db";
import { downloadSampleCsv } from "@/lib/csv-template";
import { parseQuestionCsv } from "@/lib/csv-import";
import type { Question } from "@/lib/quiz-types";
import { toast } from "sonner";

type Tab = "overview" | "students" | "bank" | "upload";

const Admin = () => (
  <AdminAccessGate
    title="Admin dashboard"
    description="Enter your access code to manage modules and view submissions."
  >
    {({ lock }) => <AdminDashboard onLock={lock} />}
  </AdminAccessGate>
);

const AdminDashboard = ({ onLock }: { onLock: () => void }) => {
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mb-1 text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage modules, questions, and student submissions.</p>
          </div>
          <button onClick={onLock} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted/40">
            <LogOut className="h-4 w-4" /> Lock
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
          {(["overview", "students", "bank", "upload"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "bank" ? "Question Bank" : t === "upload" ? "Upload CSV" : t}
              {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        {tab === "overview" && <Overview refreshKey={refreshKey} />}
        {tab === "students" && <Students refreshKey={refreshKey} onChange={refresh} />}
        {tab === "bank" && <Bank refreshKey={refreshKey} onChange={refresh} />}
        {tab === "upload" && <UploadCSV onChange={refresh} />}
      </div>
    </div>
  );
};

const Overview = ({ refreshKey }: { refreshKey: number }) => {
  const [subs, setSubs] = useState<DBSubmission[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSubmissions(), fetchAllQuestions()]).then(([s, q]) => {
      setSubs(s); setQuestions(q); setLoading(false);
    });
  }, [refreshKey]);

  const total = subs.length;
  const avg = total ? Math.round(subs.reduce((s, x) => s + x.scorePct, 0) / total) : 0;
  const passRate = total ? Math.round((subs.filter((s) => s.scorePct >= 60).length / total) * 100) : 0;
  const moduleCount = new Set(questions.map((q) => q.quizName)).size;

  const kcAvg = useMemo(() => {
    const acc: Record<string, { correct: number; total: number }> = {};
    subs.forEach((s) => {
      Object.entries(s.kcScores).forEach(([k, v]) => {
        if (v.total === 0) return;
        if (!acc[k]) acc[k] = { correct: 0, total: 0 };
        acc[k].correct += v.correct;
        acc[k].total += v.total;
      });
    });
    return acc;
  }, [subs]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Submissions" value={total} />
        <Stat label="Avg score" value={`${avg}%`} />
        <Stat label="Pass rate ≥60%" value={`${passRate}%`} />
        <Stat label="Modules" value={moduleCount} />
      </div>

      <div className="panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Topic performance</h3>
        {Object.keys(kcAvg).length === 0 ? (
          <div className="text-xs text-muted-foreground">No submissions yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(kcAvg).map(([kc, v]) => {
              const pct = v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100);
              const bg = pct >= 75 ? "bg-success/15 border-success/30" : pct >= 40 ? "bg-warning/15 border-warning/30" : "bg-destructive/15 border-destructive/30";
              return (
                <div key={kc} className={`rounded-md border ${bg} p-3`}>
                  <div className="text-xs font-medium text-foreground">{kc}</div>
                  <div className="mt-1 text-lg font-semibold">{pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const Students = ({ refreshKey, onChange }: { refreshKey: number; onChange: () => void }) => {
  const [subs, setSubs] = useState<DBSubmission[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchSubmissions().then((s) => { setSubs(s); setLoading(false); });
  }, [refreshKey]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this submission?")) return;
    const { error } = await deleteSubDb(id);
    if (error) { toast.error("Failed to delete"); return; }
    if (openId === id) setOpenId(null);
    onChange();
  };

  const exportCSV = () => {
    const headers = ["student", "module", "date", "duration_sec", "score_pct", "mcq_correct", "mcq_total", "weakest_topic"];
    const rows = subs.map((s) => [s.studentName, s.quizName, s.date, s.durationSec, s.scorePct, s.mcqCorrect, s.mcqTotal, s.weakestKC]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "submissions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={exportCSV} disabled={subs.length === 0} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/40 disabled:opacity-50">
          <Download className="h-3 w-3" /> Export CSV
        </button>
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Module</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Missed</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No submissions yet.</td></tr>
            ) : subs.map((s) => {
              const isOpen = openId === s.id;
              const missedAnswers = s.answers.filter((a) => !a.correct);
              return (
                <Fragment key={s.id}>
                  <tr className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.studentName}</div>
                      <div className="text-xs text-muted-foreground">{Math.floor(s.durationSec/60)}m {s.durationSec%60}s</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{s.quizName}</td>
                    <td className={`px-4 py-3 font-semibold ${s.scorePct >= 60 ? "text-success" : "text-destructive"}`}>{s.scorePct}%</td>
                    <td className="px-4 py-3 text-xs">{s.missedKCs.length === 0 ? <span className="text-success">None</span> : s.missedKCs.join(", ")}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.date).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setOpenId(isOpen ? null : s.id)} className="mr-2 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted/40">
                        <Eye className="h-3 w-3" />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-border bg-muted/20">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="mb-3 text-sm font-semibold">Missed questions ({missedAnswers.length})</div>
                        {missedAnswers.length === 0 ? (
                          <div className="text-sm text-success">All correct!</div>
                        ) : (
                          <div className="space-y-2">
                            {missedAnswers.map((a) => (
                              <div key={a.qid} className="rounded-md border border-border bg-card p-3 text-xs">
                                <div className="mb-1 font-medium">{a.question}</div>
                                <div className="text-muted-foreground">Chose: {a.options[a.selectedIdx]}</div>
                                <div className="text-success">Correct: {a.options[a.correctIdx]}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {s.aiReport && (
                          <div className="mt-4 rounded-md border border-border bg-card p-4 text-xs whitespace-pre-wrap">
                            {s.aiReport}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Bank = ({ refreshKey, onChange }: { refreshKey: number; onChange: () => void }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAllQuestions().then((q) => { setQuestions(q); setLoading(false); });
  }, [refreshKey]);

  const moduleNames = useMemo(() => Array.from(new Set(questions.map((q) => q.quizName || "General"))).sort(), [questions]);
  const filtered = filter === "ALL" ? questions : questions.filter((q) => q.quizName === filter);

  const handleDeleteQ = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    const { error } = await deleteQuestionDb(id);
    if (error) { toast.error("Delete failed"); return; }
    onChange();
  };

  const handleDeleteModule = async (name: string) => {
    if (!confirm(`Delete ALL questions for module "${name}"?`)) return;
    const { error } = await deleteQuizByName(name);
    if (error) { toast.error("Delete failed"); return; }
    toast.success(`Deleted module "${name}"`);
    onChange();
  };

  const openAddDialog = () => {
    setEditingQuestion(null);
    setEditorOpen(true);
  };

  const openEditDialog = (question: Question) => {
    setEditingQuestion(question);
    setEditorOpen(true);
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter by module:</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1 text-xs outline-none">
            <option value="ALL">All</option>
            {moduleNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {filter !== "ALL" && (
            <button onClick={() => handleDeleteModule(filter)} className="inline-flex items-center gap-1 rounded border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3 w-3" /> Delete module
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">{filtered.length} question{filtered.length === 1 ? "" : "s"}</div>
          <button
            onClick={openAddDialog}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add question
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Module</th>
              <th className="px-4 py-3 text-left">Topic</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Question</th>
              <th className="px-4 py-3 text-left">Answer</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No questions in the database yet. Add one here or use the Upload CSV tab.</td></tr>
            ) : filtered.map((q) => (
              <tr key={q.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 text-xs">{q.quizName}</td>
                <td className="px-4 py-3 text-xs">{q.kcName}</td>
                <td className="px-4 py-3 text-xs">{q.type}</td>
                <td className="px-4 py-3 text-xs max-w-md truncate">{q.question}</td>
                <td className="px-4 py-3 text-xs text-success">{String.fromCharCode(65 + q.correct)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEditDialog(q)}
                    className="mr-2 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted/40"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDeleteQ(q.id)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <QuestionEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={onChange}
        question={editingQuestion}
        seedModule={filter === "ALL" ? undefined : filter}
      />
    </div>
  );
};

const UploadCSV = ({ onChange }: { onChange: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseQuestionCsv>["rows"]>([]);

  const handleFile = async (f: File) => {
    setFile(f);
    setErrors([]);
    setPreviewCount(null);
    const text = await f.text();
    const result = parseQuestionCsv(text, f.name.replace(/\.[^.]+$/, ""));
    setErrors(result.errors);
    setPreview(result.rows);
    setPreviewCount(result.rows.length);
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;
    setParsing(true);
    const { error } = await insertQuestions(preview);
    setParsing(false);
    if (error) { toast.error(`Upload failed: ${error.message}`); return; }
    toast.success(`Uploaded ${preview.length} questions`);
    setFile(null); setPreview([]); setPreviewCount(null);
    onChange();
  };

  return (
    <div className="space-y-6">
      <div className="panel p-6">
        <h3 className="mb-2 text-base font-semibold">Sample CSV template</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Download the template, fill in your questions, then upload it below. Each row is one MCQ question.
          The <code className="rounded bg-muted px-1">quiz_name</code> column becomes a module on the home page.
        </p>
        <button onClick={downloadSampleCsv} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <FileDown className="h-4 w-4" /> Download sample CSV
        </button>
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <div className="mb-2 font-medium">Required columns:</div>
          <code className="text-muted-foreground">quiz_name, kc, kc_name, type, question, code, option_a, option_b, option_c, option_d, correct_idx, explanation, wrong_a, wrong_b, wrong_c</code>
          <div className="mt-2 text-muted-foreground">
            <strong>correct_idx:</strong> 0=A, 1=B, 2=C, 3=D (or use letters A/B/C/D directly)
          </div>
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="mb-3 text-base font-semibold">Upload CSV</h3>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/20 px-6 py-10 text-sm hover:bg-muted/40">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span>{file ? file.name : "Click to choose a CSV file"}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>

        {errors.length > 0 && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <div className="mb-2 font-semibold text-destructive">Errors:</div>
            <ul className="list-disc pl-5 text-xs text-destructive">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {previewCount !== null && errors.length === 0 && (
          <div className="mt-4 rounded-md border border-success/40 bg-success/10 p-4 text-sm">
            Parsed <strong>{previewCount}</strong> question{previewCount === 1 ? "" : "s"}. Click below to upload to the database.
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={preview.length === 0 || parsing || errors.length > 0}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" /> {parsing ? "Uploading…" : `Upload ${preview.length} question${preview.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="ide-card p-4">
    <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-2xl font-semibold text-primary">{value}</div>
  </div>
);

export default Admin;
