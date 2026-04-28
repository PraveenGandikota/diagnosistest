import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { PyHighlight } from "@/components/PyHighlight";
import { fetchQuestionsForQuiz, fetchQuizNames } from "@/lib/quiz-db";
import { pickQuestions, useQuiz } from "@/lib/quiz-store";
import type { Question } from "@/lib/quiz-types";

const Quiz = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const moduleParam = params.get("module") || "";

  const { session, setStudent, startQuiz, recordAnswer, nextQuestion } = useQuiz();
  const [phase, setPhase] = useState<"intro" | "running">(session.startTime ? "running" : "intro");
  const [name, setName] = useState(session.studentName);
  const [nameError, setNameError] = useState("");
  const [quizNames, setQuizNames] = useState<string[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState(moduleParam || session.quizName);
  const [bank, setBank] = useState<Question[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [animClass, setAnimClass] = useState("");

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
      qid: q.id, kc: q.kc, kcName: q.kcName, type: q.type,
      question: q.question, options: q.options,
      selectedIdx: idx, correctIdx: q.correct, correct,
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
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel w-full max-w-md p-8">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Setup</div>
          <h2 className="mb-6 text-2xl font-semibold">Start your module quiz</h2>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Your name *</span>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError && e.target.value.trim()) setNameError(""); }}
              placeholder="Your name"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
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
              {quizNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {loadingBank ? "Loading…" : `${bank.length} question${bank.length === 1 ? "" : "s"} · ${topicCount} topic${topicCount === 1 ? "" : "s"}`}
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
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
          </div>
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
          <h3 className="mb-4 text-lg font-medium leading-relaxed">{q.question}</h3>
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
                  <span className="flex-1">{option}</span>
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

export default Quiz;
