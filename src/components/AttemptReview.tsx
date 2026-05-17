import { useMemo, useState } from "react";
import { ArrowLeft, Check, FileWarning, Minus, RotateCcw, ShieldAlert, X } from "lucide-react";
import type { DBSubmission, DBSubmissionAnswer } from "@/lib/quiz-db";
import type { Question } from "@/lib/quiz-types";
import { PyHighlight } from "@/components/PyHighlight";
import { formatCodeBlock, hasRenderableCode } from "@/lib/code-format";
import {
  buildTopicStats, getAttemptCounts, type Mastery, type ReviewFilter,
} from "@/lib/submission-analytics";

interface Props {
  submission: DBSubmission;
  /** Live questions keyed by id — used to enrich answers with explanation/remediation. */
  questionsById: Map<string, Question>;
  skillName: string;
  onBack: () => void;
  onRetake?: () => void;
}

const FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "correct", label: "Correct" },
  { key: "wrong", label: "Wrong" },
  { key: "unanswered", label: "Unanswered" },
  { key: "weak", label: "Weak topics" },
];

const masteryTone: Record<Mastery, string> = {
  Strong: "bg-success/15 text-success border-success/30",
  Moderate: "bg-warning/15 text-warning border-warning/30",
  Weak: "bg-destructive/15 text-destructive border-destructive/30",
};

const topicOf = (a: DBSubmissionAnswer) => (a.kcName || a.kc || "General").trim() || "General";

export const AttemptReview = ({ submission, questionsById, skillName, onBack, onRetake }: Props) => {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [topicFilter, setTopicFilter] = useState<string>("ALL");

  const answers = submission.answers;
  const isLegacy = answers.length === 0;
  const counts = getAttemptCounts(answers);
  const topicStats = useMemo(() => buildTopicStats(answers), [answers]);
  const weakTopics = useMemo(
    () => new Set(topicStats.filter((t) => t.mastery === "Weak").map((t) => t.topic)),
    [topicStats],
  );

  const visible = answers.filter((a) => {
    if (topicFilter !== "ALL" && topicOf(a) !== topicFilter) return false;
    if (filter === "correct") return a.correct;
    if (filter === "wrong") return !a.correct && a.selectedIdx >= 0;
    if (filter === "unanswered") return a.selectedIdx < 0;
    if (filter === "weak") return weakTopics.has(topicOf(a));
    return true;
  });

  const durationText = `${Math.floor(submission.durationSec / 60)}m ${submission.durationSec % 60}s`;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to attempt history
      </button>

      {/* Summary header */}
      <div className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold sm:text-2xl">{skillName} · Quiz {submission.quizNumber ?? 1}</h2>
            <p className="text-sm text-muted-foreground">{new Date(submission.date).toLocaleString()}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${submission.scorePct >= 60 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {submission.scorePct}%
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Correct" value={counts.correct} tone="success" />
          <Metric label="Wrong" value={counts.wrong} tone="destructive" />
          <Metric label="Unanswered" value={counts.unanswered} tone="muted" />
          <Metric label="Time used" value={durationText} />
        </div>

        {submission.terminationReason && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Exam auto-submitted — reason: {submission.terminationReason}</span>
          </div>
        )}

        {topicStats.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Weak topics</div>
            <div className="flex flex-wrap gap-1.5">
              {topicStats.filter((t) => t.mastery !== "Strong").length === 0 ? (
                <span className="text-xs text-success">No weak topics — solid attempt.</span>
              ) : (
                topicStats.filter((t) => t.mastery !== "Strong").map((t) => (
                  <span key={t.topic} className={`rounded-full border px-2 py-0.5 text-[11px] ${masteryTone[t.mastery]}`}>
                    {t.topic} · {t.pct}%
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {onRetake && (
          <button
            onClick={onRetake}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted/40"
          >
            <RotateCcw className="h-4 w-4" /> Retake this quiz
          </button>
        )}
      </div>

      {/* Topic performance */}
      {topicStats.length > 0 && (
        <div className="panel p-5 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Topic performance</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topicStats.map((t) => (
              <div
                key={t.topic}
                className={`rounded-md border p-3 ${t.mastery === "Weak" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold">{t.topic}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${masteryTone[t.mastery]}`}>
                    {t.mastery}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{t.correct}/{t.total} correct · {t.pct}%</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${t.mastery === "Strong" ? "bg-success" : t.mastery === "Moderate" ? "bg-warning" : "bg-destructive"}`}
                    style={{ width: `${Math.max(t.pct, 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question-level review */}
      <div className="panel p-5 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Question review</h3>

        {isLegacy ? (
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <FileWarning className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>Legacy attempt: question-level review unavailable.</span>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    filter === f.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {topicStats.length > 1 && (
                <select
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  className="ml-auto rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  <option value="ALL">All topics</option>
                  {topicStats.map((t) => <option key={t.topic} value={t.topic}>{t.topic}</option>)}
                </select>
              )}
            </div>

            {visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No questions match this filter.</p>
            ) : (
              <div className="space-y-3">
                {visible.map((a) => {
                  const idx = answers.indexOf(a);
                  return (
                    <QuestionReviewCard
                      key={a.qid || idx}
                      number={idx + 1}
                      answer={a}
                      question={questionsById.get(a.qid)}
                      highScore={submission.scorePct >= 60}
                    />
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

const Metric = ({ label, value, tone }: { label: string; value: string | number; tone?: "success" | "destructive" | "muted" }) => (
  <div className="rounded-md border border-border bg-card p-3">
    <div className={`text-xl font-bold ${
      tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : tone === "muted" ? "text-muted-foreground" : ""
    }`}>{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

const QuestionReviewCard = ({
  number, answer, question, highScore,
}: { number: number; answer: DBSubmissionAnswer; question?: Question; highScore: boolean }) => {
  const unanswered = answer.selectedIdx < 0;
  const status = unanswered ? "unanswered" : answer.correct ? "correct" : "wrong";
  const topic = answer.kcName || answer.kc || "General";
  const remediation = highScore
    ? (question?.remediationIntermediate?.trim() || question?.remediationBeginner?.trim())
    : (question?.remediationBeginner?.trim() || question?.remediationIntermediate?.trim());

  return (
    <div className="ide-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-4 py-2.5 text-xs">
        <span className="font-semibold">Q{number}</span>
        <span className="badge-type">{answer.type}</span>
        <span className="text-muted-foreground">{topic}</span>
        {question?.subTopic && <span className="text-muted-foreground">· {question.subTopic}</span>}
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
          status === "correct" ? "bg-success/15 text-success" : status === "wrong" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
        }`}>
          {status === "correct" ? <Check className="h-3 w-3" /> : status === "wrong" ? <X className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {status === "correct" ? "Correct" : status === "wrong" ? "Wrong" : "Unanswered"}
        </span>
      </div>

      <div className="px-4 py-3">
        <p className="mb-3 whitespace-pre-wrap break-words text-sm font-medium">{answer.question}</p>
        {question && hasRenderableCode(question.code) && (
          <div className="mb-3"><PyHighlight code={formatCodeBlock(question.code)} /></div>
        )}

        <div className="grid gap-1.5">
          {answer.options.map((option, i) => {
            const isCorrect = i === answer.correctIdx;
            const isPicked = i === answer.selectedIdx;
            let cls = "border-border bg-card";
            if (isCorrect) cls = "border-success bg-success/10";
            else if (isPicked) cls = "border-destructive bg-destructive/10";
            return (
              <div key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}>
                <span className="font-semibold">{String.fromCharCode(65 + i)}</span>
                <span className="flex-1 whitespace-pre-wrap break-words">{option}</span>
                {isCorrect && <span className="text-[10px] font-semibold uppercase text-success">Correct</span>}
                {isPicked && !isCorrect && <span className="text-[10px] font-semibold uppercase text-destructive">Your answer</span>}
                {isPicked && isCorrect && <span className="text-[10px] font-semibold uppercase text-success">Your answer</span>}
              </div>
            );
          })}
        </div>

        {unanswered && (
          <p className="mt-2 text-xs text-muted-foreground">You did not answer this question.</p>
        )}

        {question?.explanation?.trim() && (
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Explanation</div>
            <p className="whitespace-pre-wrap break-words">{question.explanation}</p>
          </div>
        )}
        {remediation && (
          <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">How to improve</div>
            <p className="whitespace-pre-wrap break-words">{remediation}</p>
          </div>
        )}
        {question?.masteryIndicator?.trim() && (
          <div className="mt-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-success">What mastery looks like</div>
            <p className="whitespace-pre-wrap break-words">{question.masteryIndicator}</p>
          </div>
        )}
      </div>
    </div>
  );
};
