import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Eye, Download } from "lucide-react";
import { storage, type Submission } from "@/lib/storage";
import { KC_NAMES } from "@/lib/quiz-types";

const Results = () => {
  const [subs, setSubs] = useState<Submission[]>(() => storage.getSubmissions());
  const [open, setOpen] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    storage.deleteSubmission(id);
    setSubs(storage.getSubmissions());
  };

  const exportCSV = () => {
    const headers = ["id","name","studentId","date","durationSec","scorePct","mcqCorrect","mcqTotal","cc1","cc2","weakestKC"];
    const rows = subs.map((s) => [
      s.id, s.studentName, s.studentId, s.date, s.durationSec, s.scorePct,
      s.mcqCorrect, s.mcqTotal, s.cc1Passed ? "pass" : "fail", s.cc2Passed ? "pass" : "fail", s.weakestKC,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "quiz_submissions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">All Submissions</h1>
            <p className="text-sm text-muted-foreground">{subs.length} total</p>
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
                  <th className="px-4 py-3 text-left">Score</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Weakest KC</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <>
                    <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono">{s.studentName} <span className="text-muted-foreground">{s.studentId}</span></td>
                      <td className={`px-4 py-3 font-mono font-semibold ${s.scorePct >= 60 ? "text-success" : "text-destructive"}`}>{s.scorePct}%</td>
                      <td className="px-4 py-3 font-mono">{Math.floor(s.durationSec / 60)}m {s.durationSec % 60}s</td>
                      <td className="px-4 py-3 font-mono text-xs">{s.weakestKC}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.date).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setOpen(open === s.id ? null : s.id)} className="mr-2 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-card">
                          <Eye className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                    {open === s.id && (
                      <tr key={s.id + "-detail"} className="border-t border-border bg-panel/50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                            {Object.entries(s.kcScores).map(([kc, v]) => {
                              const pct = v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100);
                              return (
                                <div key={kc} className="ide-card p-2 text-xs">
                                  <div className="font-mono text-primary">{kc}</div>
                                  <div className="text-[10px] text-muted-foreground">{KC_NAMES[kc as keyof typeof KC_NAMES]}</div>
                                  <div className={`mt-1 font-mono ${pct >= 60 ? "text-success" : "text-destructive"}`}>{pct}%</div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="rounded-md border border-border bg-panel p-4 text-xs whitespace-pre-wrap leading-relaxed">
                            {s.aiReport || <span className="text-muted-foreground">No AI report stored.</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Results;
