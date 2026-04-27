import { Link } from "react-router-dom";
import { ArrowRight, Code2, Brain, Zap, Sparkles } from "lucide-react";
import { PyHighlight } from "@/components/PyHighlight";
import { storage } from "@/lib/storage";
import { getTopicDisplayName } from "@/lib/quiz-types";

const Home = () => {
  const submissions = storage.getSubmissions();
  const bank = storage.getQuestions();
  const quizCount = new Set(bank.map((question) => question.quizName || "Imported Quiz")).size;
  const topicCount = new Set(bank.map((question) => getTopicDisplayName(question.kc, question.kcName))).size;

  return (
    <div className="min-h-screen px-6 py-10 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-xs font-mono text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" /> Python Learning Playground
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight md:text-5xl">
          Practice <span className="text-primary">real coding questions</span> with guided feedback.
        </h1>
        <p className="mb-8 max-w-2xl text-muted-foreground">
          Take a focused Python quiz, review professional feedback after each answer, and finish with a practical improvement plan plus curated learning links.
        </p>

        <div className="mb-10 panel gradient-border p-6">
          <div className="mb-2 flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Code2 className="h-4 w-4 text-primary" /> SAMPLE CHALLENGE
          </div>
          <h2 className="mb-3 font-mono text-lg font-semibold">countVowels(s)</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Given a string, count the number of vowels (a, e, i, o, u) in a case-insensitive way.
            <br />
            Constraints: 1 {"<="} s.length {"<="} 10^6
          </p>
          <PyHighlight
            code={`def countVowels(s: str) -> int:\n    """Return count of a/e/i/o/u in s, ignoring case."""\n    ...`}
          />
        </div>

        <div className="mb-12 flex flex-wrap gap-3">
          <Link
            to="/quiz"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.02]"
          >
            Take the Quiz <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/playground"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-5 py-3 text-sm font-semibold transition-colors hover:bg-card"
          >
            <Code2 className="h-4 w-4" /> Open Playground
          </Link>
        </div>

        <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Questions in bank" value={bank.length} />
          <Stat label="Coding topics" value={topicCount} />
          <Stat label="Active quizzes" value={quizCount} />
          <Stat label="Total submissions" value={submissions.length} />
        </div>

        <h3 className="mb-4 text-xl font-semibold">How it works</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Step n={1} title="Solve coding questions" desc="Work through practical Python questions one by one." icon={Brain} />
          <Step n={2} title="Get detailed feedback" desc="See what you missed, what to revise, and why it matters." icon={Zap} />
          <Step n={3} title="Revise with resources" desc="Open recommended references and return stronger for the next attempt." icon={Code2} />
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="ide-card p-4">
    <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-mono text-2xl font-semibold text-primary">{value}</div>
  </div>
);

const Step = ({
  n,
  title,
  desc,
  icon: Icon,
}: {
  n: number;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <div className="ide-card p-5">
    <div className="mb-3 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 font-mono text-sm font-bold text-primary">
        {n}
      </div>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
    <h4 className="mb-1 font-semibold">{title}</h4>
    <p className="text-sm text-muted-foreground">{desc}</p>
  </div>
);

export default Home;
