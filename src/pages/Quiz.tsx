import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronRight, History, Play } from "lucide-react";
import { PyHighlight } from "@/components/PyHighlight";
import { fetchQuestionsForQuiz, fetchQuizNames, fetchSubmissionsByStudentName, type DBSubmission } from "@/lib/quiz-db";
import { pickQuestions, useQuiz } from "@/lib/quiz-store";
import type { Question } from "@/lib/quiz-types";

const Quiz = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const moduleParam = params.get("module") || "";

  const { session, setStudent, startQuiz, recordAnswer, nextQuestion, reset } = useQuiz();
  const [phase, setPhase] = useState<"intro" | "running">("intro");
  const [name, setName] = useState(session.studentName);
  const [nameError, setNameError] = useState("");
  const [quizNames, setQuizNames] = useState<string[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState(moduleParam || session.quizName);
  const [bank, setBank] = useState<Question[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [animClass, setAnimClass] = useState("");
  const [pastAttempts, setPastAttempts] = useState<DBSubmission[]>([]);
  const [loadingPastAttempts, setLoadingPastAttempts] = useState(false);
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);

  // Each visit to /quiz (or switch to a different module) starts a fresh attempt.
  // This covers: browser-back from /result, clicking "Retake", switching modules from
  // the home page, and revisiting via the sidebar.
  useEffect(() => {
    if (session.questions.length > 0 || session.startTime) {
      reset();
      setSelected(null);
      setAnswered(false);
    }
    setPhase("intro");
    if (moduleParam) setSelectedQuiz(moduleParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleParam]);

  useEffect(() => {
    fetchQuizNames().then((names) => {
      setQuizNames(names);
      if (!selectedQuiz && names.length > 0) setSelectedQuiz(moduleParam || names[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedQuiz) return;
    setLoadingBank(true);
    fetchQuestionsForQuiz(selectedQuiz).then((qs) => {
      setBank(qs);
      setLoadingBank(false);
    });
  }, [selectedQuiz]);

  useEffect(() => {
    const trimmedName = name.trim();
    setOpenAttemptId(null);

    if (!trimmedName) {
      setPastAttempts([]);
      setLoadingPastAttempts(false);
      return;
    }

    let cancelled = false;
    setLoadingPastAttempts(true);

    const timer = window.setTimeout(async () => {
      const attempts = await fetchSubmissionsByStudentName(trimmedName);
      if (cancelled) return;
      setPastAttempts(attempts);
      setLoadingPastAttempts(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [name]);

  const q = session.questions[session.currentIdx];
  const topicCount = useMemo(() => new Set(bank.map((x) => x.kc)).size, [bank]);

  const handleStart = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Please enter your name to start.");
      return;
    }
    if (!selectedQuiz || bank.length === 0) return;
    setStudent(trimmedName);
    const picked = pickQuestions(bank, { quizName: selectedQuiz, targetCount: bank.length });
    startQuiz(picked.length > 0 ? picked : bank, selectedQuiz);
    setPhase("running");
    setSelected(null);
    setAnswered(false);
    setNameError("");
  };

  const handleSelect = (idx: number) => {
    if (answered || !q) return;
    setSelected(idx);
    setAnswered(true);
    const correct = idx === q.correct;
    setAnimClass(correct ? "anim-bounce" : "anim-shake");
    recordAnswer({
      qid: q.id,
      kc: q.kc,
      kcName: q.kcName,
      type: q.type,
      question: q.question,
      options: q.options,
      selectedIdx: idx,
      correctIdx: q.correct,
      correct,
    });
    setTimeout(() => setAnimClass(""), 500);
  };

  const handleNext = () => {
    if (session.currentIdx + 1 >= session.questions.length) {
      navigate("/result");
      return;
    }
    nextQuestion();
    setSelected(null);
    setAnswered(false);
  };

  const progress = session.questions.length
    ? ((session.currentIdx + (answered ? 1 : 0)) / session.questions.length) * 100
    : 0;

  if (phase === "intro") {
    return (
      <div className="min-h-screen px-6 py-10">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="panel p-8">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Setup</div>
            <h2 className="mb-6 text-2xl font-semibold">Start your module quiz</h2>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Your name *</span>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError && e.target.value.trim()) setNameError("");
                }}
                placeholder="Your name"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                We use this to save the attempt and show your earlier results.
              </p>
              {nameError && <p className="mt-1.5 text-xs text-destructive">{nameError}</p>}
            </label>

            <label className="mb-6 block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Module</span>
              <select
                value={selectedQuiz}
                onChange={(e) => setSelectedQuiz(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {quizNames.length === 0 && <option value="">No modules available</option>}
                {quizNames.map((moduleName) => (
                  <option key={moduleName} value={moduleName}>
                    {moduleName}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {loadingBank ? "Loading..." : `${bank.length} question${bank.length === 1 ? "" : "s"} - ${topicCount} topic${topicCount === 1 ? "" : "s"}`}
              </p>
            </label>

            <button
              onClick={handleStart}
              disabled={!selectedQuiz || bank.length === 0 || !name.trim() || loadingBank}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Start quiz
            </button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              You'll get personalised feedback after finishing.
            </p>
            <div className="mt-4 text-center">
              <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">Back to home</Link>
            </div>
          </div>

          <StudentAttemptsPanel
            studentName={name}
            attempts={pastAttempts}
            selectedQuiz={selectedQuiz}
            loading={loadingPastAttempts}
            openAttemptId={openAttemptId}
            onToggleAttempt={(attemptId) => setOpenAttemptId((current) => current === attemptId ? null : attemptId)}
          />
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="badge-kc">{session.quizName}</span>
            <span className="badge-type">{q.type}</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Q{session.currentIdx + 1} of {session.questions.length}
          </span>
        </div>

        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className={`panel p-6 ${animClass}`}>
          <QuestionText text={q.question} />
          {q.code && <div className="mb-5"><PyHighlight code={q.code} /></div>}

          <div className="grid gap-2.5">
            {q.options.map((option, index) => {
              const isCorrect = index === q.correct;
              const isSelected = index === selected;
              let cls = "border-border bg-card hover:border-primary/50 hover:bg-primary/5";
              if (answered) {
                if (isCorrect) cls = "border-success bg-success/10";
                else if (isSelected) cls = "border-destructive bg-destructive/10";
                else cls = "border-border bg-card opacity-60";
              }
              const codeLike = isCodeLike(option);
              return (
                <button
                  key={index}
                  disabled={answered}
                  onClick={() => handleSelect(index)}
                  className={`flex items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-all ${cls}`}
                >
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-border bg-background text-xs font-semibold">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span
                    className={`flex-1 whitespace-pre-wrap break-words ${codeLike ? "font-mono" : ""}`}
                  >
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          {answered && (
            <div className="mt-5 flex justify-end">
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                {session.currentIdx + 1 >= session.questions.length ? "Finish & view feedback" : "Next"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StudentAttemptsPanel = ({
  studentName,
  attempts,
  selectedQuiz,
  loading,
  openAttemptId,
  onToggleAttempt,
}: {
  studentName: string;
  attempts: DBSubmission[];
  selectedQuiz: string;
  loading: boolean;
  openAttemptId: string | null;
  onToggleAttempt: (attemptId: string) => void;
}) => {
  const trimmedName = studentName.trim();

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Past attempts</h3>
          <p className="text-sm text-muted-foreground">
            Review earlier scores and missed questions before you retake a module.
          </p>
        </div>
      </div>

      {!trimmedName ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          Enter your name to load your saved attempts.
        </div>
      ) : loading ? (
        <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading past attempts...
        </div>
      ) : attempts.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          No saved attempts found for {trimmedName} yet.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {attempts.length} saved attempt{attempts.length === 1 ? "" : "s"} found for {trimmedName}.
          </div>

          {attempts.map((attempt) => {
            const isOpen = openAttemptId === attempt.id;
            const missedAnswers = attempt.answers.filter((answer) => !answer.correct);
            const matchesSelectedModule = selectedQuiz && attempt.quizName === selectedQuiz;

            return (
              <div key={attempt.id} className="overflow-hidden rounded-lg border border-border bg-card">
                <button
                  onClick={() => onToggleAttempt(attempt.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{attempt.quizName}</span>
                      {matchesSelectedModule && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Current module
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(attempt.date).toLocaleString()} - {formatDuration(attempt.durationSec)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-sm font-semibold ${attempt.scorePct >= 60 ? "text-success" : "text-destructive"}`}>
                      {attempt.scorePct}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {attempt.mcqCorrect}/{attempt.mcqTotal} correct
                    </div>
                  </div>

                  {isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-muted/20 px-4 py-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Missed topics
                    </div>
                    <div className="mb-4 text-sm">
                      {attempt.missedKCs.length === 0 ? "No missed topics in this attempt." : attempt.missedKCs.join(", ")}
                    </div>

                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Missed questions
                    </div>
                    {missedAnswers.length === 0 ? (
                      <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
                        All questions were answered correctly.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {missedAnswers.map((answer) => (
                          <div key={answer.qid} className="rounded-md border border-border bg-card p-3 text-sm">
                            <div className="mb-1 font-medium">{answer.question}</div>
                            <div className="text-xs text-muted-foreground">
                              Your answer: {formatChoice(answer.selectedIdx, answer.options)}
                            </div>
                            <div className="text-xs text-success">
                              Correct answer: {formatChoice(answer.correctIdx, answer.options)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {attempt.aiReport && (
                      <div className="mt-4 rounded-md border border-border bg-card p-4 text-xs whitespace-pre-wrap">
                        {attempt.aiReport}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Renders a question with support for fenced ```code``` blocks and inline `code` spans
// so admins can include code snippets directly in the question text.
const QuestionText = ({ text }: { text: string }) => {
  const segments = splitFencedCode(text);
  return (
    <div className="mb-4 space-y-3 text-lg font-medium leading-relaxed">
      {segments.map((seg, i) =>
        seg.type === "code" ? (
          <PyHighlight key={i} code={seg.content} />
        ) : (
          <p key={i} className="whitespace-pre-wrap break-words">
            {renderInlineCode(seg.content)}
          </p>
        ),
      )}
    </div>
  );
};

function splitFencedCode(text: string): { type: "text" | "code"; content: string }[] {
  const out: { type: "text" | "code"; content: string }[] = [];
  const re = /```(?:[a-zA-Z]+)?\s*\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", content: text.slice(last, m.index) });
    out.push({ type: "code", content: m[1].replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", content: text.slice(last) });
  return out.filter((seg) => seg.content.length > 0);
}

function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`\n]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function isCodeLike(text: string): boolean {
  if (!text) return false;
  if (text.includes("\n")) return true;
  // Heuristic: option contains operators, brackets, or assignment-like syntax.
  return /[(){}\[\]]|=|->|::|==|!=|<=|>=|=>/.test(text);
}

function formatDuration(durationSec: number) {
  return `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
}

function formatChoice(idx: number, options: string[]) {
  const option = options[idx] ?? "-";
  return `${String.fromCharCode(65 + idx)} · ${option}`;
}

export default Quiz;
