import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Eye, Trash2 } from "lucide-react";
import { AdminAccessGate } from "@/components/AdminAccessGate";
import { getTestedKCsFromScores } from "@/lib/submission-analytics";
import { storage, type Submission } from "@/lib/storage";

const Results = () => {
  return (
    <AdminAccessGate
      title="Submission reports"
      description="Enter your admin access code to view all student quiz submissions."
    >
      <ResultsPanel />
    </AdminAccessGate>
  );
};

const ResultsPanel = () => {
  const [subs, setSubs] = useState<Submission[]>(() => storage.getSubmissions());
  const [open, setOpen] = useState<string | null>(null);

  const submissionCount = subs.length;
  const averageScore = useMemo(
    () => (submissionCount ? Math.round(subs.reduce((sum, submission) => sum + submission.scorePct, 0) / submissionCount) : 0),
    [submissionCount, subs],
  );

  const handleDelete = (id: string) => {
    storage.deleteSubmission(id);
    setSubs(storage.getSubmissions());
    if (open === id) setOpen(null);
  };

  const exportCSV = () => {
    const headers = ["id", "studentName", "quizName", "date", "durationSec", "scorePct", "mcqCorrect", "mcqTotal", "weakestTopic", "missedTopics"];
    const rows = subs.map((submission) => [
      submission.id,
      submission.studentName,
      submission.quizName,
      submission.date,
      submission.durationSec,
      submission.scorePct,
      submission.mcqCorrect,
      submission.mcqTotal,
      submission.weakestKC,
      submission.missedKCs.join(" | "),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "quiz_submissions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">All Submissions</h1>
            <p className="text-sm text-muted-foreground">{submissionCount} total - average score {averageScore}%</p>
          </div>
          <button
            onClick={exportCSV}
            disabled={subs.length === 0}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-4 py-2 text-sm font-medium hover:bg-card disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        {subs.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="mb-4 text-muted-foreground">No submissions yet.</p>
            <Link to="/quiz" className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              Take the quiz
            </Link>
          </div>
        ) : (
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
                {subs.map((submission) => {
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
                          <button onClick={() => setOpen(open === submission.id ? null : submission.id)} className="mr-2 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-card">
                            <Eye className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDelete(submission.id)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                      {open === submission.id && (
                        <tr className="border-t border-border bg-panel/50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="mb-4 grid gap-3 md:grid-cols-3">
                              <DetailStat label="Weakest topic" value={submission.weakestKC} />
                              <DetailStat label="Topics tested" value={testedTopics.length} />
                              <DetailStat label="Missed questions" value={missedAnswers.length} />
                            </div>

                            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                              {testedTopics.map((topic) => {
                                const value = submission.kcScores[topic];
                                const pct = value.total === 0 ? 0 : Math.round((value.correct / value.total) * 100);
                                return (
                                  <div key={topic} className="ide-card p-2 text-xs">
                                    <div className="font-mono text-primary">{topic}</div>
                                    <div className={`mt-1 font-mono ${pct >= 60 ? "text-success" : "text-destructive"}`}>{pct}%</div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="mb-3 rounded-md border border-border bg-panel p-4 text-xs">
                              <div className="mb-2 font-semibold text-foreground">Missed topics</div>
                              {submission.missedKCs.length === 0 ? (
                                <div className="text-success">No topic gaps in this attempt.</div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {submission.missedKCs.map((topic) => (
                                    <span key={topic} className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 font-mono text-destructive">
                                      {topic}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {missedAnswers.length > 0 && (
                              <div className="mb-3 space-y-2">
                                {missedAnswers.map((answer) => (
                                    <div key={answer.qid} className="rounded-md border border-border bg-panel px-4 py-3 text-xs">
                                      <div className="mb-1 flex flex-wrap items-center gap-2">
                                      <span className="badge-kc">{answer.kcName || answer.kc}</span>
                                      <span className="badge-type">{answer.type}</span>
                                    </div>
                                    <div className="mb-2 text-sm">{answer.question}</div>
                                    <div className="font-mono text-muted-foreground">Chosen: {formatChoice(answer.selectedIdx, answer.options)}</div>
                                    <div className="font-mono text-success">Correct: {formatChoice(answer.correctIdx, answer.options)}</div>
                                  </div>
                                ))}
                              </div>
                            )}

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
        )}
      </div>
    </div>
  );
};

const DetailStat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="ide-card p-3 text-xs">
    <div className="text-muted-foreground">{label}</div>
    <div className="mt-1 font-mono text-lg font-semibold text-primary">{value}</div>
  </div>
);

function formatDuration(durationSec: number) {
  return `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
}

function formatChoice(index: number, options: string[]) {
  const option = options[index] ?? "No option stored";
  return `${String.fromCharCode(65 + index)} - ${option}`;
}

export default Results;
