import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ClipboardList, ShieldAlert } from "lucide-react";
import { useStudentSession } from "@/lib/student-session";
import {
  fetchQuestionsForQuiz, fetchSkills, fetchSubmissions,
  type DBSubmission, type Skill,
} from "@/lib/quiz-db";
import type { Question } from "@/lib/quiz-types";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingState } from "@/components/dashboard/LoadingState";
import { AttemptReview } from "@/components/AttemptReview";
import { getAttemptCounts } from "@/lib/submission-analytics";

const History = () => {
  const { session } = useStudentSession();
  const navigate = useNavigate();
  const [subs, setSubs] = useState<DBSubmission[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<DBSubmission | null>(null);
  const [questionsById, setQuestionsById] = useState<Map<string, Question>>(new Map());

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

  // Open one attempt — best-effort enrich its answers with live question detail.
  const openAttempt = async (s: DBSubmission) => {
    setSelected(s);
    setQuestionsById(new Map());
    if (s.skillId && s.levelId) {
      const qs = await fetchQuestionsForQuiz(s.skillId, s.levelId, s.quizNumber ?? 1);
      setQuestionsById(new Map(qs.map((q) => [q.id, q])));
    }
  };

  const retake = (s: DBSubmission) => {
    if (s.skillId && s.levelId) {
      navigate(`/quiz?skill=${s.skillId}&level=${s.levelId}&quiz=${s.quizNumber ?? 1}`);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      <div className="mx-auto max-w-4xl">
        {selected ? (
          <AttemptReview
            submission={selected}
            questionsById={questionsById}
            skillName={skillName(selected.skillId)}
            onBack={() => setSelected(null)}
            onRetake={selected.skillId && selected.levelId ? () => retake(selected) : undefined}
          />
        ) : (
          <>
            <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              ← Back to skills
            </Link>
            <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Attempt history</h1>
            <p className="mb-8 text-sm text-muted-foreground">
              Every diagnostic exam you have completed, most recent first. Open any attempt for a full question-by-question review.
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
                {subs.map((s) => {
                  const counts = getAttemptCounts(s.answers);
                  return (
                    <button
                      key={s.id}
                      onClick={() => openAttempt(s)}
                      className="ide-card w-full p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/20 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">{skillName(s.skillId)} · Quiz {s.quizNumber ?? 1}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(s.date).toLocaleString()} · {s.mcqCorrect}/{s.mcqTotal} correct
                            {s.answers.length > 0 && counts.unanswered > 0 && ` · ${counts.unanswered} unanswered`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.scorePct >= 60 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                            {s.scorePct}%
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
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

                      <div className="mt-3 text-xs font-medium text-primary">View full review →</div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default History;
