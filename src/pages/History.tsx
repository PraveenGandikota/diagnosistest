import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, ShieldAlert } from "lucide-react";
import { useStudentSession } from "@/lib/student-session";
import { fetchSkills, fetchSubmissions, type DBSubmission, type Skill } from "@/lib/quiz-db";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingState } from "@/components/dashboard/LoadingState";

const History = () => {
  const { session } = useStudentSession();
  const navigate = useNavigate();
  const [subs, setSubs] = useState<DBSubmission[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) { navigate("/"); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchSubmissions({ studentUuid: session.student.id }),
      fetchSkills(),
    ]).then(([s, sk]) => {
      if (cancelled) return;
      setSubs(s);
      setSkills(sk);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [session, navigate]);

  if (!session) return null;

  const skillName = (id: string | null | undefined) =>
    skills.find((s) => s.id === id)?.name ?? "Diagnostic quiz";

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          ← Back to skills
        </Link>
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Attempt history</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Every diagnostic exam you have completed, most recent first.
        </p>

        {loading ? (
          <div className="panel p-6"><LoadingState lines={5} label="Loading your attempts…" /></div>
        ) : subs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No attempts yet"
            description="Once you complete a diagnostic exam, it will appear here with your score and weak topics."
          />
        ) : (
          <div className="space-y-3">
            {subs.map((s) => (
              <div key={s.id} className="ide-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{skillName(s.skillId)} · Quiz {s.quizNumber ?? 1}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.date).toLocaleString()} · {s.mcqCorrect}/{s.mcqTotal} correct
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.scorePct >= 60 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {s.scorePct}%
                  </span>
                </div>

                {s.missedKCs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.missedKCs.slice(0, 6).map((kc) => (
                      <span key={kc} className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                        {kc}
                      </span>
                    ))}
                  </div>
                )}

                {s.terminationReason && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>{s.terminationReason}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
