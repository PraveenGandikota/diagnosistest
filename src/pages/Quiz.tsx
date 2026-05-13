import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { PyHighlight } from "@/components/PyHighlight";
import { fetchQuestionsForQuiz } from "@/lib/quiz-db";
import { useQuiz } from "@/lib/quiz-store";
import { useStudentSession } from "@/lib/student-session";
import type { Question } from "@/lib/quiz-types";
import { formatCodeBlock, hasRenderableCode } from "@/lib/code-format";

const Quiz = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const skillId = params.get("skill") || "";
  const levelId = params.get("level") || "";
  const quizNumber = parseInt(params.get("quiz") || "1", 10);

  const { session: studentSession } = useStudentSession();
  const { session, setStudent, startQuiz, recordAnswer, nextQuestion, reset } = useQuiz();
  const [phase, setPhase] = useState<"intro" | "running">("intro");
  const [bank, setBank] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [animClass, setAnimClass] = useState("");

  useEffect(() => {
    if (!studentSession) { navigate("/"); return; }
    reset();
    setPhase("intro");
    setSelected(null);
    setAnswered(false);
    if (skillId && levelId) {
      setLoading(true);
      fetchQuestionsForQuiz(skillId, levelId, quizNumber).then((qs) => {
        setBank(qs);
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId, levelId, quizNumber]);

  const q = session.questions[session.currentIdx];

  const handleStart = () => {
    if (bank.length === 0 || !studentSession) return;
    setStudent(studentSession.student.name);
    const quizName = `Quiz ${quizNumber}`;
    startQuiz(bank, { quizName, skillId, levelId, quizNumber });
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
      qid: q.id, kc: q.kc, kcName: q.kcName, type: q.type,
      question: q.question, options: q.options,
      selectedIdx: idx, correctIdx: q.correct, correct,
    });
    setTimeout(() => setAnimClass(""), 500);
  };

  const handleNext = () => {
    if (session.currentIdx + 1 >= session.questions.length) { navigate("/result"); return; }
    nextQuestion();
    setSelected(null);
    setAnswered(false);
  };

  const progress = session.questions.length
    ? ((session.currentIdx + (answered ? 1 : 0)) / session.questions.length) * 100 : 0;

  if (!studentSession) return null;

  if (phase === "intro") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md panel p-6 sm:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Diagnostic Quiz
          </div>
          <h2 className="mb-1 text-2xl font-semibold">Quiz {quizNumber}</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {loading
              ? "Loading questions…"
              : bank.length === 0
                ? "No questions are available for this quiz yet."
                : `${bank.length} question${bank.length === 1 ? "" : "s"} · instant feedback after each answer.`}
          </p>

          {!loading && bank.length > 0 && (
            <ul className="mb-6 space-y-2 rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" /> Answer at your own pace — no timer.</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" /> You'll see the right answer and a hint after each question.</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" /> A personalised improvement plan is generated at the end.</li>
            </ul>
          )}

          <button
            onClick={handleStart}
            disabled={bank.length === 0 || loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> {loading ? "Loading…" : "Start quiz"}
          </button>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Back to skill page
          </button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 md:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-kc">Quiz {quizNumber}</span>
            <span className="badge-type">{q.type}</span>
            {q.kcName && <span className="badge-type">{q.kcName}</span>}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Question {session.currentIdx + 1} of {session.questions.length}
          </span>
        </div>

        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className={`panel p-5 sm:p-6 ${animClass}`}>
          <QuestionText text={q.question} />
          {hasRenderableCode(q.code) && (
            <div className="mb-5">
              <PyHighlight code={formatCodeBlock(q.code)} />
            </div>
          )}

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
                <button key={index} disabled={answered} onClick={() => handleSelect(index)}
                  className={`flex items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-all ${cls}`}>
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-border bg-background text-xs font-semibold">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className={`flex-1 whitespace-pre-wrap break-words ${codeLike ? "font-mono" : ""}`}>{option}</span>
                </button>
              );
            })}
          </div>

          {answered && (
            <div className="mt-5 flex justify-end">
              <button onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
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

const QuestionText = ({ text }: { text: string }) => {
  const segments = splitFencedCode(text);
  return (
    <div className="mb-4 space-y-3 text-lg font-medium leading-relaxed">
      {segments.map((seg, i) =>
        seg.type === "code"
          ? (hasRenderableCode(seg.content) ? <PyHighlight key={i} code={formatCodeBlock(seg.content)} /> : null)
          : <p key={i} className="whitespace-pre-wrap break-words">{renderInlineCode(seg.content)}</p>
      )}
    </div>
  );
};

function splitFencedCode(text: string): { type: "text" | "code"; content: string }[] {
  const out: { type: "text" | "code"; content: string }[] = [];
  const re = /```(?:[a-zA-Z]+)?\s*\n?([\s\S]*?)```/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", content: text.slice(last, m.index) });
    out.push({ type: "code", content: m[1].replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", content: text.slice(last) });
  return out.length > 0 ? out : [{ type: "text", content: text }];
}

function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((p, i) => p.startsWith("`") && p.endsWith("`")
    ? <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{p.slice(1, -1)}</code>
    : <span key={i}>{p}</span>);
}

function isCodeLike(s: string) {
  return /[(){}\[\];=]|->|:=/.test(s);
}

export default Quiz;
