import { useMemo, useState } from "react";
import { Lock, Trash2, Upload, Plus, Download } from "lucide-react";
import { storage } from "@/lib/storage";
import { ALL_KCS, KC_NAMES, type KCId, type Question, type QuestionType } from "@/lib/quiz-types";

type Tab = "overview" | "students" | "bank" | "upload";

const Admin = () => {
  const [auth, setAuth] = useState(false);
  const [pwd, setPwd] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [bumpKey, setBumpKey] = useState(0); // force refresh after mutations

  if (!auth) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel w-full max-w-sm p-8 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-primary" />
          <h2 className="mb-2 text-xl font-semibold">Admin access</h2>
          <p className="mb-4 text-xs text-muted-foreground">Demo password: admin123</p>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setAuth(pwd === "admin123")}
            placeholder="Password"
            className="mb-3 w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => setAuth(pwd === "admin123")}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 md:px-10" key={bumpKey}>
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-2xl font-bold">Admin Panel</h1>
        <p className="mb-6 text-sm text-muted-foreground">Manage submissions, question bank, and bulk imports.</p>

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

        {tab === "overview" && <Overview />}
        {tab === "students" && <Students onChange={() => setBumpKey((k) => k + 1)} />}
        {tab === "bank" && <Bank onChange={() => setBumpKey((k) => k + 1)} />}
        {tab === "upload" && <UploadCSV onChange={() => setBumpKey((k) => k + 1)} />}
      </div>
    </div>
  );
};

const Overview = () => {
  const subs = storage.getSubmissions();
  const total = subs.length;
  const avg = total ? Math.round(subs.reduce((a, s) => a + s.scorePct, 0) / total) : 0;
  const passRate = total ? Math.round((subs.filter((s) => s.scorePct >= 60).length / total) * 100) : 0;

  // KC heatmap
  const kcAvg = useMemo(() => {
    const acc: Record<string, { correct: number; total: number }> = {};
    ALL_KCS.forEach((k) => (acc[k] = { correct: 0, total: 0 }));
    subs.forEach((s) => {
      Object.entries(s.kcScores).forEach(([kc, v]) => {
        acc[kc].correct += v.correct;
        acc[kc].total += v.total;
      });
    });
    return acc;
  }, [subs]);

  const weakestKC = useMemo(() => {
    let worst: { kc: string; pct: number } | null = null;
    Object.entries(kcAvg).forEach(([kc, v]) => {
      const pct = v.total === 0 ? 100 : (v.correct / v.total) * 100;
      if (!worst || pct < worst.pct) worst = { kc, pct };
    });
    return worst?.kc ?? "—";
  }, [kcAvg]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Submissions" value={total} />
        <Stat label="Avg score" value={`${avg}%`} />
        <Stat label="Pass rate (≥60%)" value={`${passRate}%`} />
        <Stat label="Weakest KC" value={weakestKC} />
      </div>
      <div className="panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">KC Heatmap</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {ALL_KCS.map((kc) => {
            const v = kcAvg[kc];
            const pct = v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100);
            const bg = v.total === 0 ? "bg-muted" : pct >= 75 ? "bg-success/30 border-success/40" : pct >= 40 ? "bg-warning/30 border-warning/40" : "bg-destructive/30 border-destructive/40";
            return (
              <div key={kc} className={`rounded-md border ${bg} p-3`}>
                <div className="font-mono text-xs text-primary">{kc}</div>
                <div className="text-[10px] text-muted-foreground">{KC_NAMES[kc as KCId]}</div>
                <div className="mt-1 font-mono text-lg font-semibold">{v.total === 0 ? "—" : `${pct}%`}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Students = ({ onChange }: { onChange: () => void }) => {
  const [subs, setSubs] = useState(() => storage.getSubmissions());
  const handleDelete = (id: string) => {
    storage.deleteSubmission(id);
    setSubs(storage.getSubmissions());
    onChange();
  };
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-card text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Student</th>
            <th className="px-4 py-3 text-left">Score</th>
            <th className="px-4 py-3 text-left">Time</th>
            <th className="px-4 py-3 text-left">Weakest KC</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {subs.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No submissions yet.</td></tr>
          ) : subs.map((s) => (
            <tr key={s.id} className="border-t border-border hover:bg-muted/20">
              <td className="px-4 py-3 font-mono">{s.studentName} <span className="text-muted-foreground">{s.studentId}</span></td>
              <td className={`px-4 py-3 font-mono font-semibold ${s.scorePct >= 60 ? "text-success" : "text-destructive"}`}>{s.scorePct}%</td>
              <td className="px-4 py-3 font-mono">{Math.floor(s.durationSec / 60)}m {s.durationSec % 60}s</td>
              <td className="px-4 py-3 font-mono text-xs">{s.weakestKC}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.date).toLocaleString()}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => handleDelete(s.id)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Bank = ({ onChange }: { onChange: () => void }) => {
  const [questions, setQuestions] = useState(() => storage.getQuestions());
  const [filter, setFilter] = useState<string>("ALL");
  const [showForm, setShowForm] = useState(false);

  const refresh = () => {
    setQuestions(storage.getQuestions());
    onChange();
  };

  const filtered = filter === "ALL" ? questions : questions.filter((q) => q.kc === filter);
  const isExtra = (id: string) => storage.getExtraQuestions().some((q) => q.id === id);

  const handleDelete = (id: string) => {
    storage.deleteQuestion(id);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter by KC:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs font-mono outline-none"
          >
            <option value="ALL">All</option>
            {ALL_KCS.map((k) => <option key={k} value={k}>{k} — {KC_NAMES[k]}</option>)}
          </select>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3 w-3" /> Add question
        </button>
      </div>

      {showForm && <AddQuestionForm onAdded={() => { setShowForm(false); refresh(); }} />}

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">KC</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Question</th>
              <th className="px-4 py-3 text-left">Correct</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => (
              <tr key={q.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-mono text-xs text-primary">{q.kc}</td>
                <td className="px-4 py-3 text-xs">{q.type}</td>
                <td className="max-w-sm truncate px-4 py-3 text-xs">{q.question}</td>
                <td className="px-4 py-3 text-xs">{String.fromCharCode(65 + q.correct)}</td>
                <td className="px-4 py-3 text-right">
                  {isExtra(q.id) ? (
                    <button onClick={() => handleDelete(q.id)} className="rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">seed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AddQuestionForm = ({ onAdded }: { onAdded: () => void }) => {
  const [kc, setKc] = useState<KCId>("KC-01");
  const [type, setType] = useState<QuestionType>("Reading");
  const [question, setQuestion] = useState("");
  const [code, setCode] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");

  const submit = () => {
    if (!question.trim() || opts.some((o) => !o.trim())) return;
    const q: Question = {
      id: `qx_${Date.now()}`, kc, kcName: KC_NAMES[kc], type,
      question: question.trim(), code: code.trim(),
      options: [opts[0], opts[1], opts[2], opts[3]] as [string,string,string,string],
      correct: correct as 0|1|2|3,
      explanation: explanation.trim() || "—",
      wrongDiagnosis: ["Wrong reasoning", "Wrong reasoning", "Wrong reasoning"],
    };
    storage.addQuestions([q]);
    onAdded();
  };

  return (
    <div className="panel space-y-3 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">KC</span>
          <select value={kc} onChange={(e) => setKc(e.target.value as KCId)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
            {ALL_KCS.map((k) => <option key={k} value={k}>{k} — {KC_NAMES[k]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Question type</span>
          <select value={type} onChange={(e) => setType(e.target.value as QuestionType)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
            {(["Fixing bug","Fill in the blank","Reading","Debugging","Tweaking"] as QuestionType[]).map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Question</span>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Code (optional)</span>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={4} className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs" />
      </label>
      <div className="grid gap-2">
        {opts.map((o, i) => (
          <label key={i} className="flex items-center gap-2">
            <input type="radio" checked={correct === i} onChange={() => setCorrect(i)} />
            <span className="w-6 font-mono text-xs">{String.fromCharCode(65 + i)}</span>
            <input value={o} onChange={(e) => setOpts(opts.map((v, j) => j === i ? e.target.value : v))} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm" />
          </label>
        ))}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Explanation</span>
        <input value={explanation} onChange={(e) => setExplanation(e.target.value)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </label>
      <button onClick={submit} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add question</button>
    </div>
  );
};

const UploadCSV = ({ onChange }: { onChange: () => void }) => {
  const [preview, setPreview] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const parse = (text: string): Question[] => {
    const sep = text.includes("\t") ? "\t" : ",";
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const rows = lines.map((l) => l.split(sep));
    // Skip header if it doesn't start with q* or KC-
    const dataRows = /^(id|ID)/i.test(rows[0]?.[0] || "") ? rows.slice(1) : rows;
    return dataRows.map((r, idx) => {
      const [id, question, kc, type, _da, correctLetter, wA, wB, wC, wD] = r;
      const correctIdx = ({A:0,B:1,C:2,D:3} as Record<string,number>)[(correctLetter||"A").trim().toUpperCase()] ?? 0;
      const wrongs = [wA,wB,wC,wD].filter(Boolean);
      // Build 4 options where the correct slot holds the question's answer text and wrong slots come from wrong distractors
      const opts: string[] = ["","","",""];
      opts[correctIdx] = "Correct answer";
      let wi = 0;
      for (let i = 0; i < 4; i++) if (i !== correctIdx) opts[i] = (wrongs[wi++] || `Distractor ${i+1}`).trim();
      return {
        id: (id || `csv_${Date.now()}_${idx}`).trim(),
        kc: ((kc || "KC-01").trim()) as KCId,
        kcName: KC_NAMES[((kc || "KC-01").trim()) as KCId] || "Imported",
        type: ((type || "Reading").trim()) as QuestionType,
        question: (question || "Untitled").trim(),
        code: "",
        options: opts as [string,string,string,string],
        correct: correctIdx as 0|1|2|3,
        explanation: "Imported from CSV",
        wrongDiagnosis: ["", "", ""] as [string,string,string],
      };
    });
  };

  const onFile = async (file: File) => {
    setError(null); setAdded(null);
    try {
      const text = await file.text();
      const qs = parse(text);
      if (qs.length === 0) throw new Error("No rows found");
      setPreview(qs);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const confirm = () => {
    if (!preview) return;
    storage.addQuestions(preview);
    setAdded(preview.length);
    setPreview(null);
    onChange();
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${drag ? "border-primary bg-primary/5" : "border-border bg-panel"}`}
      >
        <Upload className="mb-3 h-8 w-8 text-primary" />
        <p className="mb-2 text-sm">Drop a .csv or .tsv file here</p>
        <p className="mb-4 text-xs text-muted-foreground">or</p>
        <label className="cursor-pointer rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          Browse files
          <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {added !== null && <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success">Added {added} question{added !== 1 ? "s" : ""} to the bank.</div>}

      {preview && (
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold">Preview ({preview.length} rows)</h4>
            <div className="flex gap-2">
              <button onClick={() => setPreview(null)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-card">Cancel</button>
              <button onClick={confirm} className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Confirm import</button>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            {preview.slice(0, 3).map((q, i) => (
              <div key={i} className="ide-card p-3">
                <div className="font-mono text-primary">{q.kc} · <span className="text-muted-foreground">{q.type}</span></div>
                <div className="mt-1">{q.question}</div>
              </div>
            ))}
            {preview.length > 3 && <div className="text-muted-foreground">+ {preview.length - 3} more…</div>}
          </div>
        </div>
      )}

      <div className="ide-card p-4 text-xs">
        <h4 className="mb-2 flex items-center gap-2 font-semibold"><Download className="h-3.5 w-3.5" /> CSV / TSV format</h4>
        <p className="mb-2 text-muted-foreground">Tab- or comma-separated. One question per row. Header optional.</p>
        <pre className="overflow-x-auto rounded bg-[hsl(var(--terminal-bg))] p-3 font-mono">
{`ID  Question  KC  QuestionType  DistractorAnalysis  CorrectOption  WrongA  WrongB  WrongC  WrongD
q11  What does ... return?  KC-01  Reading  ...  A  Wrong text 1  Wrong text 2  Wrong text 3  `}
        </pre>
        <p className="mt-2 text-muted-foreground">CorrectOption = A/B/C/D. The correct option text becomes "Correct answer" by default — edit individual questions in the Bank tab to refine.</p>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="ide-card p-4">
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-1 font-mono text-2xl font-semibold text-primary">{value}</div>
  </div>
);

export default Admin;
