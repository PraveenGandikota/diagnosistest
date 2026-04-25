import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { TimerRing } from "@/components/TimerRing";
import { PyHighlight } from "@/components/PyHighlight";
import { storage } from "@/lib/storage";
import { pickQuestions, useQuiz } from "@/lib/quiz-store";

const TOTAL_SECS = 600;

const Quiz = () => {
  const navigate = useNavigate();
  const { session, setStudent, startQuiz, recordAnswer, nextQuestion } = useQuiz();
  const [phase, setPhase] = useState<"intro" | "running">(session.startTime ? "running" : "intro");
  const [name, setName] = useState(session.studentName);
  const [sid, setSid] = useState(session.studentId);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [animClass, setAnimClass] = useState("");
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECS);

  const q = session.questions[session.currentIdx];

  // Timer
  useEffect(() => {
    if (phase !== "running" || !session.startTime) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - session.startTime!) / 1000);
      const remaining = Math.max(0, TOTAL_SECS - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0) navigate("/result");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, session.startTime, navigate]);

  const handleStart = () => {
    setStudent(name.trim() || "Anonymous", sid.trim());
    const bank = storage.getQuestions();
    const picked = pickQuestions(bank, Math.min(12, bank.length));
    startQuiz(picked);
    setPhase("running");
    setSelected(null);
    setAnswered(false);
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
    [session.currentIdx, session.questions.length, answered]
  );

  if (phase === "intro") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel w-full max-w-md p-8">
          <div className="mb-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">Setup</div>
          <h2 className="mb-6 text-2xl font-semibold">Start your quiz</h2>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-muted-foreground">Name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="mb-6 block">
            <span className="mb-1 block text-xs text-muted-foreground">Student ID (optional)</span>
            <input
              value={sid}
              onChange={(e) => setSid(e.target.value)}
              placeholder="STU-001"
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary"
            />
          </label>
          <button
            onClick={handleStart}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Play className="h-4 w-4" /> Start 10-minute quiz
          </button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Up to 12 MCQs · one from every Knowledge Concept · then your AI diagnosis
          </p>
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto max-w-4xl">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="badge-kc">{q.kc} · {q.kcName}</span>
            <span className="badge-type">{q.type}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">
              Q{session.currentIdx + 1} of {session.questions.length}
            </span>
            <TimerRing value={timeLeft} max={TOTAL_SECS} />
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Question card */}
        <div className={`panel p-6 ${animClass}`}>
          <h3 className="mb-4 text-lg font-medium leading-relaxed">{q.question}</h3>
          {q.code && <div className="mb-5"><PyHighlight code={q.code} /></div>}

          <div className="grid gap-2.5">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correct;
              const isSelected = i === selected;
              let cls = "border-border bg-card hover:border-primary/50";
              if (answered) {
                if (isCorrect) cls = "border-success bg-success/10";
                else if (isSelected) cls = "border-destructive bg-destructive/10";
                else cls = "border-border bg-card opacity-60";
              }
              return (
                <button
                  key={i}
                  disabled={answered}
                  onClick={() => handleSelect(i)}
                  className={`flex items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-all ${cls}`}
                >
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-border bg-panel font-mono text-xs">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1 font-mono">{opt}</span>
                </button>
              );
            })}
          </div>

          {answered && (
            <div className="mt-5 rounded-md border border-border bg-card p-4 text-sm anim-slide-in">
              {selected === q.correct ? (
                <div className="text-success">
                  ✓ Correct. <span className="text-foreground">{q.explanation}</span>
                </div>
              ) : (
                <div>
                  <div className="text-destructive">
                    ✗ {q.wrongDiagnosis[selected! < q.correct ? selected! : selected! - 1] ?? "Not quite."}
                  </div>
                  <div className="mt-1 text-muted-foreground">{q.explanation}</div>
                </div>
              )}
            </div>
          )}

          {answered && (
            <div className="mt-5 flex justify-end">
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                {session.currentIdx + 1 >= session.questions.length ? "See your diagnosis" : "Next"}
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
