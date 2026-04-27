import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, ExternalLink, Sparkles, X } from "lucide-react";
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
import { storage } from "@/lib/storage";

interface AIReport {
  summary: string;
  improvementPlan: ImprovementPlanItem[];
  nextSteps: string[];
}

const Result = () => {
  const { session, reset } = useQuiz();
  const { hasAccess } = useAdminAccess();
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAnswer, setOpenAnswer] = useState<string | null>(null);
  const savedRef = useRef(false);

  const questionById = useMemo(
    () => new Map(session.questions.map((question) => [question.id, question])),
    [session.questions],
  );

  const {
    mcqCorrect,
    mcqTotal,
    scorePct,
    durationSec,
    topicBreakdown,
    topicsToRevisit,
    fallbackReport,
  } = useMemo(() => {
    const correct = session.answers.filter((answer) => answer.correct).length;
    const total = session.answers.length || 1;
    const score = Math.round((correct / total) * 100);
    const duration = session.startTime ? Math.round((Date.now() - session.startTime) / 1000) : 0;
    const topics = buildTopicBreakdown(session.answers, session.questions);
    const weakTopics = topics.filter((topic) => topic.pct < 100);

    return {
      mcqCorrect: correct,
      mcqTotal: total,
      scorePct: score,
      durationSec: duration,
      topicBreakdown: topics,
      topicsToRevisit: weakTopics,
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
      quizName: session.quizName || "Python coding quiz",
      score: scorePct,
      correct: mcqCorrect,
      total: mcqTotal,
      timeTaken: `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`,
      topicBreakdown: topicBreakdown.map((topic) => ({
        topic: topic.topic,
        description: topic.description,
        correct: topic.correct,
        total: topic.total,
        pct: topic.pct,
        resourceTitle: topic.resource.title,
        resourceUrl: topic.resource.url,
      })),
    };

    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/diagnose-report`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        if (cancelled) return;

        if (response.status === 429) {
          setError("The AI planner is temporarily rate limited. A local improvement plan is shown below.");
          setLoading(false);
          return;
        }
        if (response.status === 402) {
          setError("AI credits are currently unavailable. A local improvement plan is shown below.");
          setLoading(false);
          return;
        }
        if (!response.ok) {
          setError("The AI planner is unavailable right now. A local improvement plan is shown below.");
          setLoading(false);
          return;
        }

        const data = (await response.json()) as AIReport | { error: string };
        if ("error" in data) {
          setError("The AI planner is unavailable right now. A local improvement plan is shown below.");
          setLoading(false);
          return;
        }

        setAiReport(data);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Network issue while generating AI guidance. A local improvement plan is shown below.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [durationSec, mcqCorrect, mcqTotal, scorePct, session.answers.length, session.quizName, topicBreakdown]);

  useEffect(() => {
    if (savedRef.current || loading || session.answers.length === 0) return;

    savedRef.current = true;
    const reportText = [
      `SUMMARY\n${displayReport.summary}`,
      `\nIMPROVEMENT PLAN\n${displayReport.improvementPlan.map((item) => `- ${item.topic}: ${item.recommendation}`).join("\n")}`,
      `\nNEXT STEPS\n${displayReport.nextSteps.map((item) => `- ${item}`).join("\n")}`,
    ].join("\n");

    storage.addSubmission({
      id: `sub_${Date.now()}`,
      studentName: session.studentName || "Unknown student",
      quizName: session.quizName || "Imported Quiz",
      date: new Date().toISOString(),
      durationSec,
      mcqCorrect,
      mcqTotal,
      cc1Passed: false,
      cc2Passed: false,
      scorePct,
      weakestKC: topicsToRevisit[0]?.topic || "--",
      missedKCs: topicsToRevisit.map((topic) => topic.topic),
      kcScores: topicBreakdown.reduce<Record<string, { correct: number; total: number }>>((acc, topic) => {
        acc[topic.topic] = { correct: topic.correct, total: topic.total };
        return acc;
      }, {}),
      aiReport: reportText,
      answers: session.answers,
    });
  }, [displayReport, durationSec, loading, mcqCorrect, mcqTotal, scorePct, session.answers, session.quizName, session.studentName, topicBreakdown, topicsToRevisit]);

  if (session.answers.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel p-8 text-center">
          <h2 className="mb-3 text-xl font-semibold">No quiz session yet</h2>
          <p className="mb-5 text-sm text-muted-foreground">Take the quiz first to see your coding improvement plan.</p>
          <Link to="/quiz" className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Start Quiz
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="panel gradient-border p-6">
          <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Coding Quiz Review
          </div>
          <h1 className="mb-1 text-3xl font-bold">{session.studentName || "Unknown student"}</h1>
          <div className="text-sm text-muted-foreground">
            Quiz: {session.quizName || "Imported Quiz"} - Completed in {Math.floor(durationSec / 60)}m {durationSec % 60}s -{" "}
            <span className={scorePct >= 60 ? "text-success" : "text-destructive"}>Score {scorePct}%</span> -{" "}
            {new Date().toLocaleDateString(undefined, { month: "short", year: "numeric", day: "numeric" })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Correct" value={`${mcqCorrect}/${mcqTotal}`} sub={`${Math.round((mcqCorrect / mcqTotal) * 100)}%`} />
          <Stat label="Topics to revisit" value={String(topicsToRevisit.length)} sub={topicsToRevisit.length === 0 ? "No urgent gaps" : "Priority review areas"} />
          <Stat label="Time" value={`${Math.floor(durationSec / 60)}m ${durationSec % 60}s`} sub="elapsed" />
        </div>

        <div className="panel p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Topic Snapshot</h3>
          {topicBreakdown.length === 0 ? (
            <div className="text-xs text-muted-foreground">No topic data available for this attempt.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {topicBreakdown.map((topic) => (
                <div key={topic.topic} className="rounded-md border border-border bg-card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{topic.topic}</div>
                      <div className="text-xs text-muted-foreground">{topic.description}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${topic.pct === 100 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {topic.pct === 100 ? "Solid" : "Revise"}
                    </span>
                  </div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    You answered {topic.correct} out of {topic.total} question{topic.total === 1 ? "" : "s"} correctly in this topic.
                  </div>
                  <a
                    href={topic.resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {topic.resource.title} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel gradient-border p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Improvement Plan
          </h3>

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="h-4 w-full animate-pulse rounded bg-muted" style={{ width: `${100 - index * 12}%` }} />
              ))}
              <div className="text-xs text-muted-foreground">Generating a personalized revision plan...</div>
            </div>
          )}

          {!loading && error && (
            <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
              {error}
            </div>
          )}

          {!loading && (
            <div className="space-y-6">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Summary</div>
                <p className="text-sm leading-relaxed">{displayReport.summary}</p>
              </div>

              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Priority Revision Areas</div>
                <div className="space-y-3">
                  {displayReport.improvementPlan.map((item, index) => {
                    const topicMeta = topicBreakdown.find((topic) => topic.topic === item.topic)
                      ?? getStudentTopic({ topic: item.topic });

                    return (
                      <div key={`${item.topic}-${index}`} className="rounded-md border border-border bg-card p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="font-semibold">{item.topic}</div>
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Focus</span>
                        </div>
                        <p className="mb-2 text-sm text-muted-foreground">{item.observation}</p>
                        <p className="mb-3 text-sm">{item.recommendation}</p>
                        <a
                          href={topicMeta.resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          {topicMeta.resource.title} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <p className="mt-2 text-xs text-muted-foreground">{topicMeta.resource.reason}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Suggested Next Steps</div>
                <ul className="space-y-2">
                  {displayReport.nextSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-background">
                        {index + 1}
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
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Answer Review</h3>
          <p className="mb-4 text-sm text-muted-foreground">Open each question to review the feedback and suggestions one at a time.</p>
          <div className="space-y-2">
            {session.answers.map((answer) => {
              const open = openAnswer === answer.qid;
              const question = questionById.get(answer.qid);
              if (!question) return null;

              const feedback = buildQuestionFeedback(question, answer.selectedIdx, answer.correct);

              return (
                <div key={answer.qid} className="ide-card overflow-hidden">
                  <button
                    onClick={() => setOpenAnswer(open ? null : answer.qid)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/30"
                  >
                    {answer.correct ? <Check className="h-4 w-4 flex-shrink-0 text-success" /> : <X className="h-4 w-4 flex-shrink-0 text-destructive" />}
                    <span className="badge-type">{answer.type}</span>
                    <span className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {feedback.topic}
                    </span>
                    <span className="flex-1 truncate">{answer.question}</span>
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {open && (
                    <div className="border-t border-border bg-panel/50 px-4 py-4 text-sm anim-slide-in">
                      <div className="mb-2 font-mono text-xs text-muted-foreground">
                        Your answer: <span className={answer.correct ? "text-success" : "text-destructive"}>{formatChoice(answer.selectedIdx, answer.options)}</span>
                      </div>
                      {!answer.correct && (
                        <div className="mb-4 font-mono text-xs text-muted-foreground">
                          Correct answer: <span className="text-success">{formatChoice(answer.correctIdx, answer.options)}</span>
                        </div>
                      )}

                      <div className="rounded-md border border-border bg-card p-4">
                        <div className={`mb-2 font-semibold ${answer.correct ? "text-success" : "text-foreground"}`}>{feedback.headline}</div>
                        <p className="mb-3 text-sm">{feedback.professionalRemark}</p>
                        <p className="mb-3 text-sm text-muted-foreground">{feedback.conceptSummary}</p>
                        <div className="mb-3 rounded-md bg-muted/40 p-3 text-sm">
                          <span className="font-medium">Recommended revision:</span> {feedback.recommendation}
                        </div>
                        <a
                          href={feedback.resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          {feedback.resource.title} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <p className="mt-2 text-xs text-muted-foreground">{feedback.resource.reason}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/quiz"
            onClick={() => reset()}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Take quiz again
          </Link>
          <Link to="/playground" className="rounded-md border border-border bg-panel px-5 py-2.5 text-sm font-semibold hover:bg-card">
            Practice in the Playground
          </Link>
          {hasAccess && (
            <Link to="/admin" className="rounded-md border border-border bg-panel px-5 py-2.5 text-sm font-semibold hover:bg-card">
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
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-1 font-mono text-2xl font-semibold text-primary">{value}</div>
    <div className="text-xs text-muted-foreground">{sub}</div>
  </div>
);

function formatChoice(index: number, options: string[]) {
  const option = options[index] ?? "No option stored";
  return `${String.fromCharCode(65 + index)} - ${option}`;
}

export default Result;
