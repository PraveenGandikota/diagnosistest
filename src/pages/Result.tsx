import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, X, Sparkles } from "lucide-react";
import { useQuiz, computeKCScores } from "@/lib/quiz-store";
import { ALL_KCS, KC_NAMES, type KCId } from "@/lib/quiz-types";
import { storage } from "@/lib/storage";

const Result = () => {
  const { session, reset } = useQuiz();
  const [report, setReport] = useState("");
  const [streamDone, setStreamDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openAnswer, setOpenAnswer] = useState<string | null>(null);
  const savedRef = useRef(false);

  const { mcqCorrect, mcqTotal, scorePct, durationSec, kcScores } = useMemo(() => {
    const correct = session.answers.filter((a) => a.correct).length;
    const total = session.answers.length || 1;
    const cc1 = session.cc.find((c) => c.ccid === 1);
    const cc2 = session.cc.find((c) => c.ccid === 2);
    const ccPoints = (cc1?.passed ? 1 : 0) + (cc2?.passed ? 1 : 0);
    // Score: 70% MCQ, 30% code (15% per challenge)
    const score = Math.round((correct / total) * 70 + ccPoints * 15);
    const dur = session.startTime ? Math.round((Date.now() - session.startTime) / 1000) : 0;
    const kcs = computeKCScores(session.answers);
    // Boost KC scores from code challenges
    [...(cc1?.kcsDemonstrated || []), ...(cc2?.kcsDemonstrated || [])].forEach((k) => {
      kcs[k].correct += 1;
      kcs[k].total += 1;
    });
    [...(cc1?.kcsMissed || []), ...(cc2?.kcsMissed || [])].forEach((k) => {
      kcs[k].total += 1;
    });
    return { mcqCorrect: correct, mcqTotal: total, scorePct: score, durationSec: dur, kcScores: kcs };
  }, [session]);

  const cc1 = session.cc.find((c) => c.ccid === 1);
  const cc2 = session.cc.find((c) => c.ccid === 2);

  const weakestKC = useMemo(() => {
    let worst: { kc: KCId; pct: number } | null = null;
    ALL_KCS.forEach((kc) => {
      const s = kcScores[kc];
      const pct = s.total === 0 ? 100 : (s.correct / s.total) * 100;
      if (!worst || pct < worst.pct) worst = { kc, pct };
    });
    return worst!.kc;
  }, [kcScores]);

  // Stream the AI report
  useEffect(() => {
    if (session.answers.length === 0) return;
    let cancelled = false;
    setReport("");
    setStreamDone(false);
    setError(null);

    const kcBreakdown = ALL_KCS.map((kc) => {
      const s = kcScores[kc];
      const pct = s.total === 0 ? 0 : Math.round((s.correct / s.total) * 100);
      return { kc, name: KC_NAMES[kc], pct, correct: s.correct, total: s.total };
    });

    const payload = {
      score: scorePct,
      correct: mcqCorrect,
      total: mcqTotal,
      cc1Result: cc1 ? `${cc1.passedCount}/${cc1.totalCount} tests passed` : "skipped",
      cc2Result: cc2 ? `${cc2.passedCount}/${cc2.totalCount} tests passed` : "skipped",
      timeTaken: `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`,
      kcBreakdown,
    };

    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/diagnose-report`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(payload),
        });
        if (resp.status === 429) { setError("Rate limit reached. Please try again in a moment."); return; }
        if (resp.status === 402) { setError("AI credits exhausted. Add credits in Settings → Workspace → Usage."); return; }
        if (!resp.ok || !resp.body) { setError("Could not generate report."); return; }

        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let acc = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const j = line.slice(6).trim();
            if (j === "[DONE]") { setStreamDone(true); break; }
            try {
              const parsed = JSON.parse(j);
              const c = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (c) { acc += c; setReport(acc); }
            } catch {
              buf = line + "\n" + buf;
              break;
            }
          }
        }
        if (!cancelled) setStreamDone(true);
      } catch (e) {
        if (!cancelled) setError("Network error generating report.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist submission once report is done (or even partial after a delay)
  useEffect(() => {
    if (savedRef.current || !streamDone) return;
    savedRef.current = true;
    storage.addSubmission({
      id: `sub_${Date.now()}`,
      studentName: session.studentName || "Anonymous",
      studentId: session.studentId || "—",
      date: new Date().toISOString(),
      durationSec,
      mcqCorrect,
      mcqTotal,
      cc1Passed: !!cc1?.passed,
      cc2Passed: !!cc2?.passed,
      scorePct,
      weakestKC,
      kcScores,
      aiReport: report,
      answers: session.answers,
    });
  }, [streamDone, report, session, durationSec, mcqCorrect, mcqTotal, cc1, cc2, scorePct, weakestKC, kcScores]);

  if (session.answers.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel p-8 text-center">
          <h2 className="mb-3 text-xl font-semibold">No quiz session yet</h2>
          <p className="mb-5 text-sm text-muted-foreground">Take the quiz first to see your diagnosis.</p>
          <Link to="/quiz" className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Start Quiz</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="panel gradient-border p-6">
          <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Your Learning Diagnosis
          </div>
          <h1 className="mb-1 text-3xl font-bold">{session.studentName || "Anonymous"}</h1>
          <div className="text-sm text-muted-foreground">
            Completed in {Math.floor(durationSec / 60)}m {durationSec % 60}s ·{" "}
            <span className={scorePct >= 60 ? "text-success" : "text-destructive"}>Score {scorePct}%</span> ·{" "}
            {new Date().toLocaleDateString(undefined, { month: "short", year: "numeric", day: "numeric" })}
          </div>
        </div>

        {/* Score breakdown */}
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="MCQ" value={`${mcqCorrect}/${mcqTotal}`} sub={`${Math.round((mcqCorrect / mcqTotal) * 100)}%`} />
          <Stat label="Code" value={`${(cc1?.passed ? 1 : 0) + (cc2?.passed ? 1 : 0)}/2`} sub={`${(cc1?.passedCount || 0) + (cc2?.passedCount || 0)} test cases`} />
          <Stat label="Time" value={`${Math.floor(durationSec / 60)}m ${durationSec % 60}s`} sub="elapsed" />
        </div>

        {/* KC mastery */}
        <div className="panel p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">KC Mastery</h3>
          <div className="space-y-3">
            {ALL_KCS.map((kc) => {
              const s = kcScores[kc];
              const pct = s.total === 0 ? 0 : Math.round((s.correct / s.total) * 100);
              const color =
                pct >= 75 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-destructive";
              return (
                <div key={kc} className="group">
                  <div className="mb-1 flex items-center justify-between text-xs font-mono">
                    <span><span className="text-primary">{kc}</span> · {KC_NAMES[kc]}</span>
                    <span className="text-muted-foreground">{pct}% {pct >= 60 ? "✓" : "✗"}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${color} anim-fill`} style={{ width: `${pct}%`, transition: "width 1s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Report */}
        <div className="panel gradient-border p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> AI Tutor Report
          </h3>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          ) : (
            <div className={`whitespace-pre-wrap font-sans text-sm leading-relaxed ${!streamDone ? "blink-cursor" : ""}`}>
              {report || <span className="text-muted-foreground">Generating personalized analysis…</span>}
            </div>
          )}
        </div>

        {/* Answer review */}
        <div className="panel p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Answer Review</h3>
          <div className="space-y-2">
            {session.answers.map((a) => {
              const open = openAnswer === a.qid;
              return (
                <div key={a.qid} className="ide-card overflow-hidden">
                  <button
                    onClick={() => setOpenAnswer(open ? null : a.qid)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/30"
                  >
                    {a.correct ? <Check className="h-4 w-4 flex-shrink-0 text-success" /> : <X className="h-4 w-4 flex-shrink-0 text-destructive" />}
                    <span className="badge-kc">{a.kc}</span>
                    <span className="badge-type">{a.type}</span>
                    <span className="flex-1 truncate">{a.question}</span>
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {open && (
                    <div className="border-t border-border bg-panel/50 px-4 py-3 text-xs anim-slide-in">
                      <div className="mb-2 font-mono text-muted-foreground">Your answer: <span className={a.correct ? "text-success" : "text-destructive"}>{String.fromCharCode(65 + a.selectedIdx)} — {a.options[a.selectedIdx]}</span></div>
                      {!a.correct && (
                        <div className="font-mono text-muted-foreground">Correct: <span className="text-success">{String.fromCharCode(65 + a.correctIdx)} — {a.options[a.correctIdx]}</span></div>
                      )}
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
          <Link to="/results" className="rounded-md border border-border bg-panel px-5 py-2.5 text-sm font-semibold hover:bg-card">
            View all submissions
          </Link>
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

export default Result;
