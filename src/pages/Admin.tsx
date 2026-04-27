import { Fragment, useMemo, useState } from "react";
import { Download, Eye, LogOut, Plus, Trash2, Upload } from "lucide-react";
import { AdminAccessGate } from "@/components/AdminAccessGate";
import { getTestedKCsFromScores } from "@/lib/submission-analytics";
import { storage, type SubmissionAnswer } from "@/lib/storage";
import { ALL_KCS, QUESTION_TYPES, getTopicDisplayName, type KCId, type Question, type QuestionType } from "@/lib/quiz-types";
import { exportQuestionsToCsv, parseQuestionCsv } from "@/lib/question-import";

type Tab = "overview" | "students" | "bank" | "upload";

const Admin = () => {
  return (
    <AdminAccessGate
      title="Admin dashboard"
      description="Enter your private access code to manage submissions and question banks."
    >
      {({ lock }) => <AdminDashboard onLock={lock} />}
    </AdminAccessGate>
  );
};

const AdminDashboard = ({ onLock }: { onLock: () => void }) => {
  const [tab, setTab] = useState<Tab>("overview");
  const [bumpKey, setBumpKey] = useState(0);

  return (
    <div className="min-h-screen px-6 py-8 md:px-10" key={bumpKey}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mb-2 text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage submissions, question bank, and bulk imports.</p>
          </div>
          <button
            onClick={onLock}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted/30"
          >
            <LogOut className="h-4 w-4" /> Lock dashboard
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
          {(["overview", "students", "bank", "upload"] as Tab[]).map((tabName) => (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className={`relative px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === tabName ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tabName === "bank" ? "Question Bank" : tabName === "upload" ? "Upload CSV" : tabName}
              {tab === tabName && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        {tab === "overview" && <Overview />}
        {tab === "students" && <Students onChange={() => setBumpKey((value) => value + 1)} />}
        {tab === "bank" && <Bank onChange={() => setBumpKey((value) => value + 1)} />}
        {tab === "upload" && <UploadCSV onChange={() => setBumpKey((value) => value + 1)} />}
      </div>
    </div>
  );
};

const Overview = () => {
  const subs = storage.getSubmissions();
  const total = subs.length;
  const avg = total ? Math.round(subs.reduce((sum, submission) => sum + submission.scorePct, 0) / total) : 0;
  const passRate = total ? Math.round((subs.filter((submission) => submission.scorePct >= 60).length / total) * 100) : 0;
  const studentsWithMisses = subs.filter((submission) => submission.missedKCs.length > 0).length;

  const kcAvg = useMemo(() => {
    const acc: Record<string, { correct: number; total: number }> = {};
    subs.forEach((submission) => {
      Object.entries(submission.kcScores).forEach(([kc, value]) => {
        if (value.total === 0) return;
        if (!acc[kc]) acc[kc] = { correct: 0, total: 0 };
        acc[kc].correct += value.correct;
        acc[kc].total += value.total;
      });
    });
    return acc;
  }, [subs]);

  const testedKcKeys = useMemo(() => Object.keys(kcAvg).sort(), [kcAvg]);

  const weakestTopic = useMemo(() => {
    let worst: { kc: string; pct: number } | null = null;
    testedKcKeys.forEach((kc) => {
      const value = kcAvg[kc];
      const pct = value.total === 0 ? 100 : (value.correct / value.total) * 100;
      if (!worst || pct < worst.pct) worst = { kc, pct };
    });
    return worst?.kc ?? "--";
  }, [kcAvg, testedKcKeys]);

  const missedTopicSummary = useMemo(() => {
    const acc: Record<string, number> = {};
    subs.forEach((submission) => {
      submission.missedKCs.forEach((topic) => {
        acc[topic] = (acc[topic] || 0) + 1;
      });
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [subs]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Submissions" value={total} />
        <Stat label="Avg score" value={`${avg}%`} />
        <Stat label="Pass rate (>=60%)" value={`${passRate}%`} />
        <Stat label="Weakest topic" value={weakestTopic} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Stat label="Students needing revision" value={studentsWithMisses} />
        <Stat label="Distinct quizzes taken" value={new Set(subs.map((submission) => submission.quizName)).size} />
      </div>

      <div className="panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Topic performance heatmap</h3>
        {testedKcKeys.length === 0 ? (
          <div className="text-xs text-muted-foreground">No submissions yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {testedKcKeys.map((kc) => {
              const value = kcAvg[kc];
              const pct = value.total === 0 ? 0 : Math.round((value.correct / value.total) * 100);
              const bg = pct >= 75 ? "bg-success/30 border-success/40" : pct >= 40 ? "bg-warning/30 border-warning/40" : "bg-destructive/30 border-destructive/40";
              return (
                <div key={kc} className={`rounded-md border ${bg} p-3`}>
                  <div className="font-mono text-xs text-primary">{kc}</div>
                  <div className="mt-1 font-mono text-lg font-semibold">{`${pct}%`}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Most Missed Topics</h3>
        {missedTopicSummary.length === 0 ? (
          <div className="text-xs text-muted-foreground">No missed topic data yet.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {missedTopicSummary.slice(0, 6).map(([topic, count]) => (
              <div key={topic} className="rounded-md border border-border bg-card p-4">
                <div className="font-mono text-xs text-primary">{topic}</div>
                <div className="mt-2 text-sm font-semibold">{count} attempt{count === 1 ? "" : "s"} missed this topic</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Students = ({ onChange }: { onChange: () => void }) => {
  const [subs, setSubs] = useState(() => storage.getSubmissions());
  const [openId, setOpenId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    storage.deleteSubmission(id);
    setSubs(storage.getSubmissions());
    if (openId === id) setOpenId(null);
    onChange();
  };

  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-card text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Student</th>
            <th className="px-4 py-3 text-left">Quiz</th>
            <th className="px-4 py-3 text-left">Score</th>
            <th className="px-4 py-3 text-left">Missed topics</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {subs.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No submissions yet.</td></tr>
          ) : subs.map((submission) => {
            const isOpen = openId === submission.id;
            const testedTopics = getTestedKCsFromScores(submission.kcScores);
            const missedAnswers = submission.answers.filter((answer) => !answer.correct);

            return (
              <Fragment key={submission.id}>
                <tr className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-mono">{submission.studentName}</div>
                    <div className="text-xs text-muted-foreground">{formatDuration(submission.durationSec)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{submission.quizName}</td>
                  <td className={`px-4 py-3 font-mono font-semibold ${submission.scorePct >= 60 ? "text-success" : "text-destructive"}`}>
                    {submission.scorePct}%
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {submission.missedKCs.length === 0 ? <span className="text-success">None</span> : submission.missedKCs.join(", ")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(submission.date).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setOpenId(isOpen ? null : submission.id)}
                      className="mr-2 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-card"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(submission.id)}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-t border-border bg-panel/50">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="mb-4 grid gap-3 md:grid-cols-4">
                        <DetailStat label="Weakest topic" value={submission.weakestKC} />
                        <DetailStat label="Topics tested" value={testedTopics.length} />
                        <DetailStat label="Missed questions" value={missedAnswers.length} />
                        <DetailStat label="Score" value={`${submission.mcqCorrect}/${submission.mcqTotal}`} />
                      </div>

                      <div className="mb-4 rounded-md border border-border bg-panel p-4">
                        <div className="mb-3 text-sm font-semibold">Topic-wise analysis</div>
                        {testedTopics.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No topic performance recorded for this attempt.</div>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-4">
                            {testedTopics.map((topic) => {
                              const score = submission.kcScores[topic];
                              const pct = score.total === 0 ? 0 : Math.round((score.correct / score.total) * 100);
                              return (
                                <div key={topic} className="ide-card p-3 text-xs">
                                  <div className="font-mono text-primary">{topic}</div>
                                  <div className={`mt-2 font-mono ${pct >= 60 ? "text-success" : "text-destructive"}`}>
                                    {score.correct}/{score.total} ({pct}%)
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="mb-4 rounded-md border border-border bg-panel p-4">
                        <div className="mb-3 text-sm font-semibold">Missed topics in this attempt</div>
                        {submission.missedKCs.length === 0 ? (
                          <div className="text-sm text-success">No topic gaps in this attempt.</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {submission.missedKCs.map((topic) => (
                              <span key={topic} className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-mono text-destructive">
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mb-4 space-y-2">
                        <div className="text-sm font-semibold">Questions missed by the student</div>
                        {missedAnswers.length === 0 ? (
                          <div className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
                            This student answered every question correctly.
                          </div>
                        ) : (
                          missedAnswers.map((answer) => (
                            <MissedAnswerCard key={answer.qid} answer={answer} />
                          ))
                        )}
                      </div>

                      <div className="rounded-md border border-border bg-panel p-4 text-xs whitespace-pre-wrap leading-relaxed">
                        {submission.aiReport || <span className="text-muted-foreground">No AI report stored.</span>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
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

  const filtered = filter === "ALL" ? questions : questions.filter((question) => question.kc === filter);
  const isExtra = (id: string) => storage.getExtraQuestions().some((question) => question.id === id);

  const handleDelete = (id: string) => {
    storage.deleteQuestion(id);
    refresh();
  };

  const topicOptions = useMemo(() => {
    const map = new Map<string, string>();
    questions.forEach((question) => {
      map.set(question.kc, getTopicDisplayName(question.kc, question.kcName));
    });
    ALL_KCS.forEach((kc) => {
      if (!map.has(kc)) map.set(kc, getTopicDisplayName(kc));
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id: id as KCId, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [questions]);

  const handleExport = () => {
    const csv = exportQuestionsToCsv(questions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `grit-pool-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter by topic:</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs font-mono outline-none"
          >
            <option value="ALL">All</option>
            {topicOptions.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/30"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
          <button
            onClick={() => setShowForm((value) => !value)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3 w-3" /> Add question
          </button>
        </div>
      </div>

      {showForm && <AddQuestionForm topicOptions={topicOptions} onAdded={() => { setShowForm(false); refresh(); }} />}

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Quiz</th>
              <th className="px-4 py-3 text-left">Topic</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Priority</th>
              <th className="px-4 py-3 text-left">Question</th>
              <th className="px-4 py-3 text-left">Stored answer</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((question) => (
              <tr key={question.id} className="border-t border-border hover:bg-muted/20">
                <td className="max-w-[11rem] truncate px-4 py-3 text-xs">{question.quizName}</td>
                <td className="px-4 py-3 text-xs text-primary">{getTopicDisplayName(question.kc, question.kcName)}</td>
                <td className="px-4 py-3 text-xs">{question.type}</td>
                <td className="max-w-[11rem] truncate px-4 py-3 font-mono text-[11px]">{question.priority || "--"}</td>
                <td className="max-w-sm truncate px-4 py-3 text-xs">{question.question}</td>
                <td className="max-w-xs truncate px-4 py-3 text-xs">
                  {String.fromCharCode(65 + question.correct)} - {question.options[question.correct]}
                </td>
                <td className="px-4 py-3 text-right">
                  {isExtra(question.id) ? (
                    <button onClick={() => handleDelete(question.id)} className="rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
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

const AddQuestionForm = ({
  onAdded,
  topicOptions,
}: {
  onAdded: () => void;
  topicOptions: Array<{ id: KCId; label: string }>;
}) => {
  const [quizName, setQuizName] = useState("Custom Quiz");
  const [kc, setKc] = useState<KCId>("KC-01");
  const [type, setType] = useState<QuestionType>("Multiple-choice (MCQ)");
  const [priority, setPriority] = useState("");
  const [question, setQuestion] = useState("");
  const [code, setCode] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const selectedTopicLabel = topicOptions.find((option) => option.id === kc)?.label ?? getTopicDisplayName(kc);

  const submit = () => {
    if (!question.trim() || opts.some((option) => !option.trim())) return;

    const q: Question = {
      id: `qx_${Date.now()}`,
      quizName: quizName.trim() || "Custom Quiz",
      priority: priority.trim(),
      kc,
      kcName: selectedTopicLabel,
      type,
      question: question.trim(),
      code: code.trim(),
      options: [opts[0], opts[1], opts[2], opts[3]] as [string, string, string, string],
      correct: correct as 0 | 1 | 2 | 3,
      explanation: explanation.trim() || "--",
      wrongDiagnosis: ["Wrong reasoning", "Wrong reasoning", "Wrong reasoning"],
    };
    storage.addQuestions([q]);
    onAdded();
  };

  return (
    <div className="panel space-y-3 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Quiz name</span>
          <input value={quizName} onChange={(event) => setQuizName(event.target.value)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Topic</span>
          <select value={kc} onChange={(event) => setKc(event.target.value as KCId)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
            {topicOptions.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Question type</span>
          <select value={type} onChange={(event) => setType(event.target.value as QuestionType)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
            {QUESTION_TYPES.map((questionType) => <option key={questionType}>{questionType}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Priority (optional)</span>
          <input
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            placeholder={`${selectedTopicLabel.replace(/\s+/g, "-")}_${type}`}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Question</span>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Code (optional)</span>
        <textarea value={code} onChange={(event) => setCode(event.target.value)} rows={4} className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs" />
      </label>
      <div className="grid gap-2">
        {opts.map((option, index) => (
          <label key={index} className="flex items-center gap-2">
            <input type="radio" checked={correct === index} onChange={() => setCorrect(index)} />
            <span className="w-6 font-mono text-xs">{String.fromCharCode(65 + index)}</span>
            <input
              value={option}
              onChange={(event) => setOpts(opts.map((value, optionIndex) => optionIndex === index ? event.target.value : value))}
              placeholder={`Option ${String.fromCharCode(65 + index)}`}
              className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm"
            />
          </label>
        ))}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Explanation</span>
        <input value={explanation} onChange={(event) => setExplanation(event.target.value)} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
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

  const onFile = async (file: File) => {
    setError(null);
    setAdded(null);
    try {
      const text = await file.text();
      const questions = parseQuestionCsv(text, file.name);
      if (questions.length === 0) throw new Error("No rows found");
      setPreview(questions);
    } catch (err) {
      setError((err as Error).message);
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
        onDragOver={(event) => { event.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(false);
          const file = event.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${drag ? "border-primary bg-primary/5" : "border-border bg-panel"}`}
      >
        <Upload className="mb-3 h-8 w-8 text-primary" />
        <p className="mb-2 text-sm">Drop a .csv or .tsv file here</p>
        <p className="mb-4 text-xs text-muted-foreground">or</p>
        <label className="cursor-pointer rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          Browse files
          <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} />
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
            {preview.slice(0, 3).map((question, index) => (
              <div key={index} className="ide-card p-3">
                <div className="font-mono text-primary">{question.quizName} - {getTopicDisplayName(question.kc, question.kcName)} - <span className="text-muted-foreground">{question.type}</span></div>
                <div className="mt-1 text-[11px] text-muted-foreground">Priority: {question.priority || "--"}</div>
                <div className="mt-1">{question.question}</div>
              </div>
            ))}
            {preview.length > 3 && <div className="text-muted-foreground">+ {preview.length - 3} more...</div>}
          </div>
        </div>
      )}

      <div className="ide-card p-4 text-xs">
        <h4 className="mb-2 flex items-center gap-2 font-semibold"><Download className="h-3.5 w-3.5" /> CSV / TSV format</h4>
        <p className="mb-2 text-muted-foreground">Tab- or comma-separated. Supports the simple quiz format and the diagnose-sheet format, including an optional last column named Priority.</p>
        <pre className="overflow-x-auto rounded bg-[hsl(var(--terminal-bg))] p-3 font-mono">
{`quiz_name,topic_id,topic_name,type,question,code,option_a,option_b,option_c,option_d,correct,explanation,wrong_a,wrong_b,wrong_c,priority
Subscription Cost Quiz,topic-01,Default parameters,Debugging,Why is the default ignored?,def calculatePrice(...),Fix A,Fix B,Fix C,Fix D,B,Explain why,...,...,...,Default-parameters_Debugging`}
        </pre>
        <p className="mt-2 text-muted-foreground">When Priority is filled for a topic, the quiz picker will prefer that row for the selected quiz.</p>
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

const DetailStat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="ide-card p-3 text-xs">
    <div className="text-muted-foreground">{label}</div>
    <div className="mt-1 font-mono text-lg font-semibold text-primary">{value}</div>
  </div>
);

const MissedAnswerCard = ({ answer }: { answer: SubmissionAnswer }) => (
  <div className="rounded-md border border-border bg-panel px-4 py-3 text-xs">
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="badge-kc">{answer.kcName || answer.kc}</span>
      <span className="badge-type">{answer.type}</span>
    </div>
    <div className="mb-2 text-sm">{answer.question}</div>
    <div className="font-mono text-muted-foreground">Chosen: {formatChoice(answer.selectedIdx, answer.options)}</div>
    <div className="font-mono text-success">Correct: {formatChoice(answer.correctIdx, answer.options)}</div>
  </div>
);

function formatChoice(index: number, options: string[]) {
  const option = options[index] ?? "No option stored";
  return `${String.fromCharCode(65 + index)} - ${option}`;
}

function formatDuration(durationSec: number) {
  return `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
}

export default Admin;
