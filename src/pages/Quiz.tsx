import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { PyHighlight } from "@/components/PyHighlight";
import { storage } from "@/lib/storage";
import { pickQuestions, useQuiz } from "@/lib/quiz-store";

const Quiz = () => {
  const navigate = useNavigate();
  const { session, setStudent, startQuiz, recordAnswer, nextQuestion } = useQuiz();
  const [phase, setPhase] = useState<"intro" | "running">(session.startTime ? "running" : "intro");
  const [name, setName] = useState(session.studentName);
  const [nameError, setNameError] = useState("");
  const bank = useMemo(() => storage.getQuestions(), []);
  const quizNames = useMemo(
    () => Array.from(new Set(bank.map((question) => question.quizName || "Imported Quiz"))).sort((a, b) => a.localeCompare(b)),
    [bank],
  );
  const [selectedQuiz, setSelectedQuiz] = useState(session.quizName);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [animClass, setAnimClass] = useState("");

  const q = session.questions[session.currentIdx];
  const selectedQuizBank = useMemo(
    () => bank.filter((question) => question.quizName === selectedQuiz),
    [bank, selectedQuiz],
  );
  const selectedQuizTopicCount = useMemo(
    () => new Set(selectedQuizBank.map((question) => question.kc)).size,
    [selectedQuizBank],
  );

  useEffect(() => {
    if (!selectedQuiz && quizNames.length > 0) {
      setSelectedQuiz(quizNames[0]);
    }
  }, [quizNames, selectedQuiz]);

  const handleStart = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Student name is required before starting the quiz.");
      return;
    }
    if (!selectedQuiz) return;

    setStudent(trimmedName);
    const picked = pickQuestions(bank, {
      quizName: selectedQuiz,
      targetCount: selectedQuizTopicCount,
    });
    startQuiz(picked, selectedQuiz);
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

  const progress = useMemo(
    () => (session.questions.length ? ((session.currentIdx + (answered ? 1 : 0)) / session.questions.length) * 100 : 0),
    [session.currentIdx, session.questions.length, answered],
  );

  if (phase === "intro") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel w-full max-w-md p-8">
          <div className="mb-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">Setup</div>
          <h2 className="mb-6 text-2xl font-semibold">Start your coding quiz</h2>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-muted-foreground">Student name *</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError && event.target.value.trim()) {
                  setNameError("");
                }
              }}
              placeholder="Ada Lovelace"
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary"
            />
            {nameError && <p className="mt-2 text-xs text-destructive">{nameError}</p>}
          </label>
          <label className="mb-6 block">
            <span className="mb-1 block text-xs text-muted-foreground">Which quiz are you taking?</span>
            <select
              value={selectedQuiz}
              onChange={(event) => setSelectedQuiz(event.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary"
            >
              {quizNames.map((quizName) => (
                <option key={quizName} value={quizName}>
                  {quizName}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedQuizBank.length} question{selectedQuizBank.length === 1 ? "" : "s"} available in this quiz
            </p>
          </label>
          <button
            onClick={handleStart}
            disabled={!selectedQuiz || selectedQuizBank.length === 0 || !name.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-4 w-4" /> Start quiz
          </button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            You will receive detailed feedback and revision links after you finish the quiz.
          </p>
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="badge-type">{session.quizName || "Coding Quiz"}</span>
            <span className="badge-type">{q.type}</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
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
              let cls = "border-border bg-card hover:border-primary/50";
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
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-border bg-panel font-mono text-xs">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 font-mono">{option}</span>
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
                {session.currentIdx + 1 >= session.questions.length ? "Finish quiz and view suggestions" : "Next"}
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
