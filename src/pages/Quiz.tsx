import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Clock, KeyRound, LayoutGrid, Lock, Maximize2, Play, Send, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PyHighlight } from "@/components/PyHighlight";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { countAttempts, fetchQuestionsForQuiz, fetchSkillById, validateExamSessionCode, type ExamSession, type Skill } from "@/lib/quiz-db";
import { useQuiz } from "@/lib/quiz-store";
import { useStudentSession } from "@/lib/student-session";
import type { Question } from "@/lib/quiz-types";
import { formatCodeBlock, hasRenderableCode } from "@/lib/code-format";
import {
  enterFullscreen, exitFullscreen, useCountdown, useElapsed, useFullscreenGuard, useTabSwitchGuard,
} from "@/lib/exam-hooks";

const MAX_VIOLATIONS = 3;

type ViolationKind = "fullscreen" | "tab";

const Quiz = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const skillId = params.get("skill") || "";
  const levelId = params.get("level") || "";
  const quizNumber = parseInt(params.get("quiz") || "1", 10);

  const { session: studentSession } = useStudentSession();
  const {
    session, setStudent, startQuiz, selectOption, goToQuestion,
    recordViolation, setTermination, finalize, reset,
  } = useQuiz();

  const [phase, setPhase] = useState<"intro" | "running">("intro");
  const [bank, setBank] = useState<Question[]>([]);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [unlockInput, setUnlockInput] = useState("");
  const [validating, setValidating] = useState(false);
  // The exam session unlocked by a valid code — its duration/attempts govern the exam.
  const [validatedSession, setValidatedSession] = useState<ExamSession | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [violationModal, setViolationModal] = useState<{ count: number; kind: ViolationKind } | null>(null);
  const [navExitModal, setNavExitModal] = useState(false);

  // Prevents one incident (an Esc-then-tab burst) from counting multiple times.
  const violationLock = useRef(false);

  const durationSec = validatedSession?.duration_sec ?? 0;
  const hasTimer = durationSec > 0;
  const maxAttempts = validatedSession?.max_attempts ?? (skill?.max_attempts ?? 1);
  // The attempt limit is only known once a session code is validated, so the
  // "no attempts left" screen is shown only after validation — never before.
  const attemptsExhausted = !!validatedSession && attemptsUsed >= validatedSession.max_attempts;
  const attemptsRemaining = validatedSession ? Math.max(0, validatedSession.max_attempts - attemptsUsed) : 0;

  const elapsed = useElapsed(session.startTime, phase === "running");

  useEffect(() => {
    if (!studentSession) { navigate("/"); return; }
    reset();
    setPhase("intro");
    setUnlockInput("");
    setValidatedSession(null);
    if (skillId && levelId) {
      setLoading(true);
      Promise.all([
        fetchQuestionsForQuiz(skillId, levelId, quizNumber),
        fetchSkillById(skillId),
        countAttempts(studentSession.student.id, skillId, levelId, quizNumber),
      ]).then(([qs, sk, used]) => {
        setBank(qs);
        setSkill(sk);
        setAttemptsUsed(used);
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId, levelId, quizNumber]);

  // Always release fullscreen if the student leaves the quiz page.
  useEffect(() => () => { exitFullscreen(); }, []);

  const submitExam = useCallback((terminationReason?: string) => {
    if (terminationReason) setTermination(terminationReason);
    finalize();
    exitFullscreen();
    navigate("/result");
  }, [finalize, navigate, setTermination]);

  const handleExpire = useCallback(() => {
    submitExam("time_expired");
  }, [submitExam]);

  const remaining = useCountdown(session.startTime, durationSec, phase === "running" && hasTimer, handleExpire);

  const handleViolation = useCallback((kind: ViolationKind) => {
    if (violationLock.current) return;
    violationLock.current = true;
    const count = recordViolation();
    if (count >= MAX_VIOLATIONS) {
      submitExam("integrity_violation");
      return;
    }
    setViolationModal({ count, kind });
  }, [recordViolation, submitExam]);

  const guardActive = phase === "running" && !confirmSubmit;
  useFullscreenGuard(guardActive, useCallback(() => handleViolation("fullscreen"), [handleViolation]));
  useTabSwitchGuard(guardActive, useCallback(() => handleViolation("tab"), [handleViolation]));

  const resumeExam = async () => {
    await enterFullscreen();
    setViolationModal(null);
    violationLock.current = false;
  };

  // Block leaving an active exam via browser Back or refresh/close.
  useEffect(() => {
    if (phase !== "running") return;
    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
      setNavExitModal(true);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [phase]);

  // Step 1: validate the exam session code. An exam cannot start without one.
  const handleValidateCode = async () => {
    if (!studentSession || validating) return;
    const typed = unlockInput.trim();
    if (!typed) { toast.error("Enter the exam session code to continue."); return; }
    setValidating(true);
    const res = await validateExamSessionCode({
      code: typed,
      campusId: studentSession.campus.id,
      skillId, levelId, quizNumber,
    });
    setValidating(false);
    if (!res.valid || !res.session) {
      toast.error(res.message);
      return;
    }
    setValidatedSession(res.session);
  };

  // Step 2: begin the exam using the validated session's duration / attempts.
  const handleStartExam = () => {
    if (!studentSession || !validatedSession || bank.length === 0) return;
    if (attemptsUsed >= validatedSession.max_attempts) {
      toast.error(`You have used all ${validatedSession.max_attempts} attempt${validatedSession.max_attempts === 1 ? "" : "s"} for this quiz.`);
      return;
    }
    setStudent(studentSession.student.name);
    startQuiz(bank, {
      quizName: `Quiz ${quizNumber}`,
      skillId, levelId, quizNumber,
      studentExternalId: studentSession.student.student_id,
      studentUuid: studentSession.student.id,
      campusId: studentSession.campus.id,
    });
    setPhase("running");
    enterFullscreen();
  };

  // ---------- Intro ----------

  if (!studentSession) return null;

  if (phase === "intro") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md panel p-6 sm:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Proctored Diagnostic Exam
          </div>
          <h2 className="mb-1 text-2xl font-semibold">{skill?.name ? `${skill.name} · ` : ""}Quiz {quizNumber}</h2>

          {loading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading exam…</p>
          ) : bank.length === 0 ? (
            <>
              <p className="mb-6 mt-2 text-sm text-muted-foreground">No questions are available for this quiz yet.</p>
              <button onClick={() => navigate(-1)} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Back to skill page
              </button>
            </>
          ) : attemptsExhausted ? (
            <>
              <div className="my-4 flex h-11 w-11 items-center justify-center rounded-full bg-success/10 text-success">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="mb-1 text-lg font-semibold">Exam already completed</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                You have used all {maxAttempts} attempt{maxAttempts === 1 ? "" : "s"} allowed for this quiz.
                Review your performance in Attempt History.
              </p>
              <button
                onClick={() => navigate("/history")}
                className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                View attempt history
              </button>
              <button onClick={() => navigate(-1)} className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Back to skill page
              </button>
            </>
          ) : (
            <>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">
                {bank.length} question{bank.length === 1 ? "" : "s"}. Your feedback report is generated after you submit.
              </p>

              <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
                {validatedSession ? (
                  <>
                    <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 font-medium">
                      {Math.round(validatedSession.duration_sec / 60)} minutes
                    </span>
                    <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 font-medium">
                      Attempt {attemptsUsed + 1} of {validatedSession.max_attempts}
                    </span>
                  </>
                ) : (
                  <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 font-medium text-warning">
                    Code required
                  </span>
                )}
                <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 font-medium">Fullscreen proctored</span>
              </div>

              <ul className="mb-5 space-y-2 rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                <li className="flex items-start gap-2"><Maximize2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" /> The exam runs in fullscreen mode.</li>
                <li className="flex items-start gap-2"><LayoutGrid className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" /> Use the question palette to move between questions — answers save as you go.</li>
                <li className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" /> Leaving fullscreen or switching tabs is recorded. After {MAX_VIOLATIONS} times the exam auto-submits.</li>
                {hasTimer && <li className="flex items-start gap-2"><Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" /> When the timer runs out the exam submits automatically.</li>}
              </ul>

              <label className="mb-2 block">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" /> Exam session code
                </span>
                <input
                  value={unlockInput}
                  onChange={(e) => setUnlockInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { validatedSession ? handleStartExam() : handleValidateCode(); } }}
                  disabled={!!validatedSession}
                  placeholder="Code announced by your invigilator"
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
              </label>

              {validatedSession ? (
                <p className="mb-5 text-[11px] font-medium text-success">
                  Code accepted — {Math.round(validatedSession.duration_sec / 60)} minute exam ·{" "}
                  {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining
                  {attemptsUsed > 0 ? ` (${attemptsUsed} of ${validatedSession.max_attempts} used)` : ""}.
                </p>
              ) : (
                <p className="mb-5 text-[11px] text-muted-foreground">
                  Enter the exam session code announced by your invigilator to continue.
                </p>
              )}

              {validatedSession ? (
                <button
                  onClick={handleStartExam}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Play className="h-4 w-4" /> Start exam
                </button>
              ) : (
                <button
                  onClick={handleValidateCode}
                  disabled={validating || unlockInput.trim() === ""}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" /> {validating ? "Checking code…" : "Validate code"}
                </button>
              )}
              <button onClick={() => navigate(-1)} className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Back to skill page
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- Running ----------

  const total = session.questions.length;
  const q = session.questions[session.currentIdx];
  if (!q || total === 0) return null;

  const selected = session.selections[session.currentIdx];
  const answeredCount = session.selections.filter((s) => s !== null).length;
  const notAnswered = total - answeredCount;
  const isLast = session.currentIdx === total - 1;

  const timeText = hasTimer ? formatClock(remaining) : formatClock(elapsed);
  const timeLabel = hasTimer ? "Time left" : "Time elapsed";
  const timeDanger = hasTimer && remaining <= 60;

  const palette = (
    <PalettePanel
      timeText={timeText}
      timeLabel={timeLabel}
      timeDanger={timeDanger}
      skillName={skill?.name ?? ""}
      quizNumber={quizNumber}
      total={total}
      answeredCount={answeredCount}
      notAnswered={notAnswered}
      currentIdx={session.currentIdx}
      selections={session.selections}
      visited={session.visited}
      onJump={(i) => { goToQuestion(i); setPaletteOpen(false); }}
      onSubmit={() => { setPaletteOpen(false); setConfirmSubmit(true); }}
    />
  );

  return (
    <div className="flex min-h-screen">
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10">
        <div className="mx-auto max-w-3xl">
          {/* Header — no violation counter is ever shown here. */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge-kc">Quiz {quizNumber}</span>
              <span className="badge-type">{q.type}</span>
              {q.kcName && <span className="badge-type">{q.kcName}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums ${timeDanger ? "text-destructive" : "text-muted-foreground"}`}>
                <Clock className="h-3.5 w-3.5" /> {timeText}
              </span>
              <button
                onClick={() => setPaletteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted/40 lg:hidden"
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Palette
              </button>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Question {session.currentIdx + 1} of {total}</span>
            <span>{answeredCount} answered</span>
          </div>
          <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(answeredCount / total) * 100}%` }} />
          </div>

          <div className="panel p-5 sm:p-6">
            <QuestionText text={q.question} />
            {hasRenderableCode(q.code) && (
              <div className="mb-5">
                <PyHighlight code={formatCodeBlock(q.code)} />
              </div>
            )}

            <div className="grid gap-2.5">
              {q.options.map((option, index) => {
                const isSelected = index === selected;
                const codeLike = isCodeLike(option);
                return (
                  <button
                    key={index}
                    onClick={() => selectOption(index)}
                    className={`flex items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border text-xs font-semibold ${
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className={`flex-1 whitespace-pre-wrap break-words ${codeLike ? "font-mono" : ""}`}>{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom navigation */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              onClick={() => goToQuestion(session.currentIdx - 1)}
              disabled={session.currentIdx === 0}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/40 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>
            {isLast ? (
              <button
                onClick={() => setConfirmSubmit(true)}
                className="inline-flex items-center gap-2 rounded-md bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground hover:opacity-90"
              >
                <Send className="h-4 w-4" /> Submit exam
              </button>
            ) : (
              <button
                onClick={() => goToQuestion(session.currentIdx + 1)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Save &amp; Next <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop palette — fixed viewport height; only the grid inside scrolls. */}
      <aside className="hidden w-72 flex-shrink-0 border-l border-border bg-card lg:block">
        <div className="sticky top-0 h-screen">{palette}</div>
      </aside>

      {/* Mobile palette drawer */}
      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent side="right" className="flex w-80 flex-col p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle>Question palette</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1">{palette}</div>
        </SheetContent>
      </Sheet>

      {/* Submit confirmation */}
      {confirmSubmit && (
        <ModalShell>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Send className="h-5 w-5" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">Submit the exam?</h3>
          <p className="mb-1 text-sm text-muted-foreground">
            {notAnswered > 0
              ? "You have unanswered questions. Are you sure you want to submit?"
              : "Are you sure you want to submit the exam?"}
          </p>
          <p className="mb-5 text-sm text-muted-foreground">
            Answered <span className="font-semibold text-foreground">{answeredCount}</span> of {total}.
            {notAnswered > 0 && <span className="text-warning"> {notAnswered} not answered.</span>}
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmSubmit(false)}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted/40"
            >
              Keep going
            </button>
            <button
              onClick={() => submitExam()}
              className="inline-flex items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-semibold text-success-foreground hover:opacity-90"
            >
              <Send className="h-4 w-4" /> Submit exam
            </button>
          </div>
        </ModalShell>
      )}

      {/* Blocking fullscreen / integrity violation modal */}
      {violationModal && (
        <ModalShell>
          {(() => {
            const isFinal = violationModal.count >= MAX_VIOLATIONS - 1;
            return (
              <>
                <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full ${isFinal ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                  {isFinal ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <h3 className="mb-1 text-lg font-semibold">
                  {isFinal ? "Final warning" : "Stay in the exam"}
                </h3>
                <p className="mb-2 text-sm text-muted-foreground">
                  {violationModal.kind === "fullscreen"
                    ? "You exited fullscreen. Please continue in fullscreen to proceed."
                    : "You navigated away from the exam. Please continue in fullscreen to proceed."}
                </p>
                <p className="mb-5 text-sm font-medium text-destructive">
                  {isFinal
                    ? "This is your final warning. One more time leaving the exam will automatically submit it."
                    : `This has been recorded. After ${MAX_VIOLATIONS} violations the exam is submitted automatically.`}
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={resumeExam}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <Maximize2 className="h-4 w-4" /> Continue in Fullscreen
                  </button>
                </div>
              </>
            );
          })()}
        </ModalShell>
      )}

      {/* Navigation-exit warning (browser Back during an active exam) */}
      {navExitModal && (
        <ModalShell>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="mb-1 text-lg font-semibold">Leave the exam?</h3>
          <p className="mb-5 text-sm text-muted-foreground">
            You are currently taking an exam. Leaving this page will auto-submit your current answers.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setNavExitModal(false)}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted/40"
            >
              Continue Exam
            </button>
            <button
              onClick={() => submitExam("navigation_exit")}
              className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"
            >
              <Send className="h-4 w-4" /> Submit and Leave
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

// ---------- Question palette ----------

interface PaletteProps {
  timeText: string;
  timeLabel: string;
  timeDanger: boolean;
  skillName: string;
  quizNumber: number;
  total: number;
  answeredCount: number;
  notAnswered: number;
  currentIdx: number;
  selections: (number | null)[];
  visited: boolean[];
  onJump: (idx: number) => void;
  onSubmit: () => void;
}

const PalettePanel = ({
  timeText, timeLabel, timeDanger, skillName, quizNumber, total, answeredCount, notAnswered,
  currentIdx, selections, visited, onJump, onSubmit,
}: PaletteProps) => (
  <div className="flex h-full flex-col">
    <div className="border-b border-border p-4">
      <div className={`mb-1 flex items-center gap-2 text-2xl font-bold tabular-nums ${timeDanger ? "text-destructive" : ""}`}>
        <Clock className={`h-5 w-5 ${timeDanger ? "text-destructive" : "text-primary"}`} /> {timeText}
      </div>
      <div className="text-xs text-muted-foreground">{timeLabel}</div>
      <div className="mt-3 text-sm font-semibold">{skillName || "Diagnostic exam"}</div>
      <div className="text-xs text-muted-foreground">Quiz {quizNumber}</div>
    </div>

    <div className="grid grid-cols-3 gap-2 border-b border-border p-4 text-center">
      <Tally label="Total" value={total} />
      <Tally label="Answered" value={answeredCount} tone="success" />
      <Tally label="Not answered" value={notAnswered} tone="warning" />
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Questions</div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: total }, (_, i) => {
          const isCurrent = i === currentIdx;
          const isAnswered = selections[i] !== null;
          const isVisited = visited[i];
          let cls = "border-border bg-muted/40 text-muted-foreground";
          if (isAnswered) cls = "border-success bg-success/15 text-success";
          else if (isVisited) cls = "border-warning bg-warning/15 text-warning";
          if (isCurrent) cls = "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30";
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              className={`flex h-9 w-full items-center justify-center rounded-md border text-sm font-semibold transition-colors ${cls}`}
              aria-label={`Go to question ${i + 1}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-1.5 text-[11px] text-muted-foreground">
        <Legend className="border-primary bg-primary" label="Current question" />
        <Legend className="border-success bg-success/15" label="Answered" />
        <Legend className="border-warning bg-warning/15" label="Visited, not answered" />
        <Legend className="border-border bg-muted/40" label="Not visited" />
      </div>
    </div>

    <div className="border-t border-border p-4">
      <button
        onClick={onSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-success px-4 py-2.5 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90"
      >
        <Send className="h-4 w-4" /> Submit exam
      </button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        You can submit from here at any time.
      </p>
    </div>
  </div>
);

const Tally = ({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" }) => (
  <div>
    <div className={`text-xl font-bold ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : ""}`}>
      {value}
    </div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

const Legend = ({ className, label }: { className: string; label: string }) => (
  <div className="flex items-center gap-2">
    <span className={`h-3 w-3 flex-shrink-0 rounded border ${className}`} />
    <span>{label}</span>
  </div>
);

const ModalShell = ({ children }: { children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">{children}</div>
  </div>
);

// ---------- Question text rendering ----------

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

// Countdown clock as mm:ss.
function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default Quiz;
