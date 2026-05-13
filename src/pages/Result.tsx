import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, ExternalLink, RotateCcw, Sparkles, X } from "lucide-react";
import { useAdminAccess } from "@/lib/admin-access";
import { useQuiz } from "@/lib/quiz-store";
import {
  buildFallbackImprovementReport,
  buildQuestionFeedback,
  buildTopicBreakdown,
  getStudentTopic,
  type ImprovementPlanItem,
  type ImprovementReport,
} from "@/lib/student-feedback";
import { saveSubmission } from "@/lib/quiz-db";
import { useStudentSession } from "@/lib/student-session";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/config";

interface AIReport {
  summary: string;
  improvementPlan: ImprovementPlanItem[];
  nextSteps: string[];
}

const Result = () => {
  const navigate = useNavigate();
  const { session, reset } = useQuiz();
  const { hasAccess } = useAdminAccess();
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAnswer, setOpenAnswer] = useState<string | null>(null);
  const savedRef = useRef(false);

  const questionById = useMemo(
    () => new Map(session.questions.map((q) => [q.id, q])),
    [session.questions],
  );

  const {
    mcqCorrect, mcqTotal, scorePct, durationSec,
    topicBreakdown, topicsToRevisit, fallbackReport,
  } = useMemo(() => {
    const correct = session.answers.filter((a) => a.correct).length;
    const total = session.answers.length || 1;
    const score = Math.round((correct / total) * 100);
    const duration = session.startTime ? Math.round((Date.now() - session.startTime) / 1000) : 0;
    const topics = buildTopicBreakdown(session.answers, session.questions);
    const weak = topics.filter((t) => t.pct < 100);
    return {
      mcqCorrect: correct, mcqTotal: total, scorePct: score, durationSec: duration,
      topicBreakdown: topics, topicsToRevisit: weak,
      fallbackReport: buildFallbackImprovementReport(topics, score),
    };
  }, [session.answers, session.questions, session.startTime]);

  const displayReport: ImprovementReport = aiReport ?? fallbackReport;

  useEffect(() => {
    if (session.answers.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAiReport(null);

    const payload = {
      quizName: session.quizName || "Module quiz",
      score: scorePct, correct: mcqCorrect, total: mcqTotal,
      timeTaken: `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`,
      topicBreakdown: topicBreakdown.map((t) => ({
        topic: t.topic, description: t.description,
        correct: t.correct, total: t.total, pct: t.pct,
        resourceTitle: t.resource.title, resourceUrl: t.resource.url,
      })),
    };

    (async () => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/diagnose-report`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(payload),
        });
        if (cancelled) return;
        if (!response.ok) {
          setError("AI feedback is unavailable right now. A local plan is shown below.");
          setLoading(false);
          return;
        }
        const data = (await response.json()) as AIReport | { error: string };
        if ("error" in data) {
          setError("AI feedback is unavailable right now. A local plan is shown below.");
        } else {
          setAiReport(data);
        }
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Network issue while generating AI feedback. A local plan is shown below.");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [durationSec, mcqCorrect, mcqTotal, scorePct, session.answers.length, session.quizName, topicBreakdown]);

  // Save submission to Supabase once feedback is ready.
  useEffect(() => {
    if (savedRef.current || loading || session.answers.length === 0) return;
    savedRef.current = true;

    const reportText = [
      `SUMMARY\n${displayReport.summary}`,
      `\nIMPROVEMENT PLAN\n${displayReport.improvementPlan.map((i) => `- ${i.topic}: ${i.recommendation}`).join("\n")}`,
      `\nNEXT STEPS\n${displayReport.nextSteps.map((i) => `- ${i}`).join("\n")}`,
    ].join("\n");

    const kcScores = topicBreakdown.reduce<Record<string, { correct: number; total: number }>>((acc, t) => {
      acc[t.topic] = { correct: t.correct, total: t.total };
      return acc;
    }, {});

    saveSubmission({
      studentName: session.studentName || "Anonymous",
      quizName: session.quizName || "Module Quiz",
      durationSec, mcqCorrect, mcqTotal, scorePct,
      weakestKC: topicsToRevisit[0]?.topic || "--",
      missedKCs: topicsToRevisit.map((t) => t.topic),
      kcScores,
      aiReport: reportText,
      answers: session.answers.map((a) => ({
        qid: a.qid, kc: a.kc, kcName: a.kcName, type: a.type,
        question: a.question, correct: a.correct,
        selectedIdx: a.selectedIdx, correctIdx: a.correctIdx, options: a.options,
      })),
    }).catch((e) => console.error("saveSubmission failed", e));
  }, [displayReport, durationSec, loading, mcqCorrect, mcqTotal, scorePct, session.answers, session.quizName, session.studentName, topicBreakdown, topicsToRevisit]);

  if (session.answers.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel p-8 text-center">
          <h2 className="mb-3 text-xl font-semibold">No quiz session yet</h2>
          <p className="mb-5 text-sm text-muted-foreground">Take a module quiz first to see your feedback.</p>
          <Link to="/" className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Browse modules
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="panel p-5 sm:p-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Quiz Feedback
          </div>
          <h1 className="mb-1 text-2xl font-bold sm:text-3xl">{session.studentName || "Student"}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{session.quizName}</span>
            <span aria-hidden>·</span>
            <span>{Math.floor(durationSec / 60)}m {durationSec % 60}s</span>
            <span aria-hidden>·</span>
            <span className={scorePct >= 60 ? "font-semibold text-success" : "font-semibold text-destructive"}>Score {scorePct}%</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Correct" value={`${mcqCorrect}/${mcqTotal}`} sub={`${Math.round((mcqCorrect / mcqTotal) * 100)}%`} />
          <Stat label="Topics to revisit" value={String(topicsToRevisit.length)} sub={topicsToRevisit.length === 0 ? "No urgent gaps" : "Priority areas"} />
          <Stat label="Time" value={`${Math.floor(durationSec / 60)}m ${durationSec % 60}s`} sub="elapsed" />
        </div>

        <div className="panel p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Topic snapshot</h3>
          {topicBreakdown.length === 0 ? (
            <div className="text-xs text-muted-foreground">No topic data available.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {topicBreakdown.map((t) => (
                <div key={t.topic} className="ide-card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t.topic}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${t.pct === 100 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {t.pct === 100 ? "Solid" : "Revise"}
                    </span>
                  </div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    {t.correct} / {t.total} correct
                  </div>
                  <a href={t.resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    {t.resource.title} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Improvement plan
          </h3>

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${100 - i * 12}%` }} />
              ))}
              <div className="text-xs text-muted-foreground">Generating personalised plan…</div>
            </div>
          )}

          {!loading && error && (
            <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">{error}</div>
          )}

          {!loading && (
            <div className="space-y-6">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Summary</div>
                <p className="text-sm leading-relaxed">{displayReport.summary}</p>
              </div>

              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Priority revision areas</div>
                <div className="space-y-3">
                  {displayReport.improvementPlan.map((item, idx) => {
                    const meta = topicBreakdown.find((t) => t.topic === item.topic) ?? getStudentTopic({ topic: item.topic });
                    return (
                      <div key={`${item.topic}-${idx}`} className="ide-card p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="font-semibold">{item.topic}</div>
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Focus</span>
                        </div>
                        <p className="mb-2 text-sm text-muted-foreground">{item.observation}</p>
                        <p className="mb-3 text-sm">{item.recommendation}</p>
                        <a href={meta.resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                          {meta.resource.title} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Suggested next steps</div>
                <ul className="space-y-2">
                  {displayReport.nextSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="panel p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Answer review</h3>
          <div className="space-y-2">
            {session.answers.map((a) => {
              const open = openAnswer === a.qid;
              const question = questionById.get(a.qid);
              if (!question) return null;
              const fb = buildQuestionFeedback(question, a.selectedIdx, a.correct);
              return (
                <div key={a.qid} className="ide-card overflow-hidden">
                  <button onClick={() => setOpenAnswer(open ? null : a.qid)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/40">
                    {a.correct ? <Check className="h-4 w-4 flex-shrink-0 text-success" /> : <X className="h-4 w-4 flex-shrink-0 text-destructive" />}
                    <span className="badge-type">{a.type}</span>
                    <span className="flex-1 truncate">{a.question}</span>
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {open && (
                    <div className="border-t border-border bg-muted/20 px-4 py-4 text-sm">
                      <div className="mb-2 text-xs text-muted-foreground">
                        Your answer: <span className={a.correct ? "text-success" : "text-destructive"}>{formatChoice(a.selectedIdx, a.options)}</span>
                      </div>
                      {!a.correct && (
                        <div className="mb-3 text-xs text-muted-foreground">
                          Correct: <span className="text-success">{formatChoice(a.correctIdx, a.options)}</span>
                        </div>
                      )}
                      <div className="rounded-md border border-border bg-card p-4">
                        <div className={`mb-2 font-semibold ${a.correct ? "text-success" : ""}`}>{fb.headline}</div>
                        <p className="mb-3 text-sm">{fb.professionalRemark}</p>
                        <p className="mb-3 text-sm text-muted-foreground">{fb.conceptSummary}</p>
                        <div className="rounded-md bg-muted/50 p-3 text-sm">
                          <span className="font-medium">Recommended:</span> {fb.recommendation}
                        </div>
                        {(() => {
                          const beginner = question.remediationBeginner?.trim();
                          const intermediate = question.remediationIntermediate?.trim();
                          const useIntermediate = scorePct >= 60;
                          const primary = useIntermediate ? (intermediate || beginner) : (beginner || intermediate);
                          if (!primary) return null;
                          return (
                            <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                                Remediation · {useIntermediate ? "Intermediate" : "Beginner"}
                              </div>
                              <p>{primary}</p>
                            </div>
                          );
                        })()}
                        {question.masteryIndicator?.trim() && (
                          <div className="mt-3 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-success">
                              What mastery looks like
                            </div>
                            <p>{question.masteryIndicator}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link to="/" onClick={() => reset()} className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Back to courses
          </Link>
          <button
            onClick={() => {
              const { skillId, levelId, quizNumber } = session;
              reset();
              if (skillId && levelId && quizNumber) {
                navigate(`/quiz?skill=${skillId}&level=${levelId}&quiz=${quizNumber}`);
              } else {
                navigate("/");
              }
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted/40"
          >
            <RotateCcw className="h-4 w-4" /> Retake quiz
          </button>
          {hasAccess && (
            <Link to="/admin" className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted/40">
              Open admin dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div className="ide-card p-4">
    <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-2xl font-semibold text-primary">{value}</div>
    <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
  </div>
);

function formatChoice(idx: number, options: string[]) {
  const opt = options[idx] ?? "—";
  return `${String.fromCharCode(65 + idx)} · ${opt}`;
}

export default Result;
