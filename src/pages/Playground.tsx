import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, SkipForward, Lightbulb, ChevronRight, Check, X } from "lucide-react";
import { runAndAnalyze, TEST_CASES, type AnalysisReport } from "@/lib/code-runner";
import { useQuiz } from "@/lib/quiz-store";
import type { KCId } from "@/lib/quiz-types";

interface Challenge {
  id: 1 | 2;
  title: string;
  prompt: string;
  starter: string;
  hints: string[];
}

const CHALLENGES: Challenge[] = [
  {
    id: 1,
    title: "Write countVowels from scratch",
    prompt:
      "Implement countVowels(s) that returns the number of vowels (a, e, i, o, u) in s, case-insensitive. Return an integer.",
    starter:
      `def countVowels(s):
    # Count vowels (a,e,i,o,u) case-insensitively
    # Return an integer
    pass

# Examples:
# countVowels("nxtwave") == 2
# countVowels("Sky") == 0
# countVowels("AeIoU") == 5
# countVowels("hello123!") == 2
# countVowels("a") == 1
`,
    hints: [
      "Think about where you initialize your counter — should it be inside or outside the loop?",
      "Pseudocode:\n  count = 0\n  for ch in s.lower():\n      if ch in <vowel-set>:\n          count += 1\n  return count",
      "Skeleton — fill in the blanks:\n  def countVowels(s):\n      ____ = 0\n      for ch in s.____():\n          if ch in \"____\":\n              ____ += 1\n      return ____",
    ],
  },
  {
    id: 2,
    title: "Fix all 4 bugs",
    prompt: "Find and fix every bug. Goal: countVowels works for all test cases.",
    starter: `def countVowels(s):
    vowels = "aeiouy"       # Bug 1
    for ch in s:
        count = 0           # Bug 2
        if ch == vowels:    # Bug 3
            count += 1
    print(count)            # Bug 4
`,
    hints: [
      "Bug hunt checklist: vowel set, counter placement, comparison operator, return vs print.",
      "Bug 1: y is not a vowel by spec. Bug 2: counter shouldn't reset every iteration.",
      "Bug 3: use `in` for membership, not `==`. Bug 4: return the value, don't just print it. Don't forget case-insensitivity!",
    ],
  },
];

const Playground = () => {
  const navigate = useNavigate();
  const { session, recordCC } = useQuiz();
  const [idx, setIdx] = useState(0);
  const [code, setCode] = useState(CHALLENGES[0].starter);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [running, setRunning] = useState(false);
  const [hintIdx, setHintIdx] = useState(-1);
  const [embedded, setEmbedded] = useState(true);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // If user opens /playground directly without taking the quiz, run standalone
  useEffect(() => {
    setEmbedded(session.questions.length > 0);
  }, [session.questions.length]);

  const challenge = CHALLENGES[idx];

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      const r = runAndAnalyze(code);
      setReport(r);
      setRunning(false);
    }, 800);
  };

  const handleSubmit = () => {
    const r = report ?? runAndAnalyze(code);
    if (embedded) {
      recordCC({
        ccid: challenge.id,
        code,
        passed: r.passedCount === r.totalCount,
        passedCount: r.passedCount,
        totalCount: r.totalCount,
        kcsDemonstrated: r.kcsDemonstrated as KCId[],
        kcsMissed: r.kcsMissed as KCId[],
      });
    }
    if (idx + 1 < CHALLENGES.length) {
      setIdx(idx + 1);
      setCode(CHALLENGES[idx + 1].starter);
      setReport(null);
      setHintIdx(-1);
    } else {
      if (embedded) navigate("/result");
      else {
        setIdx(0);
        setCode(CHALLENGES[0].starter);
        setReport(null);
      }
    }
  };

  const handleSkip = () => {
    if (embedded) {
      recordCC({
        ccid: challenge.id,
        code,
        passed: false,
        passedCount: 0,
        totalCount: TEST_CASES.length,
        kcsDemonstrated: [],
        kcsMissed: [],
      });
    }
    if (idx + 1 < CHALLENGES.length) {
      setIdx(idx + 1);
      setCode(CHALLENGES[idx + 1].starter);
      setReport(null);
      setHintIdx(-1);
    } else if (embedded) navigate("/result");
  };

  // Tab key in textarea inserts 4 spaces
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = taRef.current!;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = code;
      const next = val.slice(0, start) + "    " + val.slice(end);
      setCode(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Challenge {idx + 1} of {CHALLENGES.length}
            </div>
            <h2 className="text-2xl font-semibold">{challenge.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = Math.min(hintIdx + 1, challenge.hints.length - 1);
                setHintIdx(next);
              }}
              disabled={hintIdx >= challenge.hints.length - 1}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-xs font-medium hover:bg-card disabled:opacity-40"
            >
              <Lightbulb className="h-4 w-4 text-warning" />
              Hint {hintIdx + 2 <= challenge.hints.length ? `${hintIdx + 2}/${challenge.hints.length}` : "max"}
            </button>
            {embedded && (
              <button
                onClick={handleSkip}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-xs font-medium hover:bg-card"
              >
                <SkipForward className="h-4 w-4" /> Skip
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Problem */}
          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-mono uppercase text-muted-foreground">
              📝 Problem
            </div>
            <p className="mb-4 text-sm text-foreground">{challenge.prompt}</p>
            <div className="mb-2 text-xs font-mono uppercase text-muted-foreground">Test cases</div>
            <ul className="space-y-1 font-mono text-xs">
              {TEST_CASES.map((tc) => (
                <li key={tc.input} className="text-muted-foreground">
                  countVowels({JSON.stringify(tc.input)}) → <span className="text-primary">{tc.expected}</span>
                </li>
              ))}
            </ul>
            {hintIdx >= 0 && (
              <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs anim-slide-in">
                <div className="mb-1 flex items-center gap-2 font-mono font-semibold text-warning">
                  <Lightbulb className="h-3.5 w-3.5" /> Hint {hintIdx + 1}
                </div>
                <pre className="whitespace-pre-wrap font-mono text-foreground">{challenge.hints[hintIdx]}</pre>
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="panel gradient-border overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-panel px-4 py-2">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
                <span className="ml-2">solution.py</span>
              </div>
              <button
                onClick={handleRun}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {running ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Run
              </button>
            </div>
            <CodeEditor value={code} onChange={setCode} ref={taRef} onKeyDown={onKeyDown} />
          </div>
        </div>

        {/* Terminal output */}
        <div className="mt-4 terminal rounded-md border border-border p-4 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">$ python solution.py</div>
          {!report && !running && <div className="text-muted-foreground">// Click Run to execute against {TEST_CASES.length} test cases</div>}
          {running && <div className="text-warning">⏳ Running tests...</div>}
          {report && (
            <div className="space-y-1">
              {report.results.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  {r.passed ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5 text-destructive" />}
                  <span className={r.passed ? "" : "text-destructive"}>
                    countVowels({JSON.stringify(r.case.input)}) → {String(r.actual)}
                    {!r.passed && <span className="text-muted-foreground"> (expected {r.case.expected})</span>}
                  </span>
                </div>
              ))}
              <div className={`mt-2 ${report.passedCount === report.totalCount ? "text-success" : "text-warning"}`}>
                {report.passedCount}/{report.totalCount} tests passed
                {report.passedCount === report.totalCount && " ✓"}
              </div>
              {report.staticIssues.length > 0 && (
                <div className="mt-2 border-t border-border pt-2">
                  <div className="mb-1 text-muted-foreground">// Static analysis</div>
                  {report.staticIssues.map((s, i) => (
                    <div key={i} className="text-warning">⚠ {s}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {report && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {idx + 1 < CHALLENGES.length
                ? "Submit & Next Challenge"
                : embedded
                ? "Submit & See Diagnosis"
                : "Reset"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import { forwardRef } from "react";

const CodeEditor = forwardRef<
  HTMLTextAreaElement,
  { value: string; onChange: (v: string) => void; onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void }
>(({ value, onChange, onKeyDown }, ref) => {
  const lineCount = value.split("\n").length;
  return (
    <div className="relative grid grid-cols-[auto_1fr] bg-[hsl(var(--terminal-bg))]">
      <div className="select-none border-r border-border px-3 py-3 text-right font-mono text-xs leading-6 text-muted-foreground">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={ref}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="block min-h-[320px] resize-y bg-transparent px-3 py-3 font-mono text-sm leading-6 text-foreground outline-none"
      />
    </div>
  );
});
CodeEditor.displayName = "CodeEditor";

export default Playground;
