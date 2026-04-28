import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Code2, GraduationCap, ListChecks } from "lucide-react";
import { fetchAllQuestions } from "@/lib/quiz-db";
import type { Question } from "@/lib/quiz-types";

interface CourseModule {
  quizName: string;
  questionCount: number;
  topicCount: number;
}

const COURSE = {
  id: "programming-fundamentals",
  title: "Programming Fundamentals",
  description: "Build a strong foundation in Python with bite-sized modules and instant feedback.",
  icon: Code2,
};

const Home = () => {
  const [modules, setModules] = useState<CourseModule[] | null>(null);
  const [view, setView] = useState<"courses" | "modules">("courses");

  useEffect(() => {
    fetchAllQuestions().then((questions: Question[]) => {
      const byQuiz = new Map<string, { count: number; topics: Set<string> }>();
      questions.forEach((q) => {
        const name = q.quizName || "General";
        if (!byQuiz.has(name)) byQuiz.set(name, { count: 0, topics: new Set() });
        const entry = byQuiz.get(name)!;
        entry.count += 1;
        entry.topics.add(q.kc);
      });
      const list: CourseModule[] = Array.from(byQuiz.entries())
        .map(([quizName, v]) => ({ quizName, questionCount: v.count, topicCount: v.topics.size }))
        .sort((a, b) => a.quizName.localeCompare(b.quizName));
      setModules(list);
    });
  }, []);

  const totalQuestions = modules?.reduce((s, m) => s + m.questionCount, 0) ?? 0;

  if (view === "modules") {
    return (
      <div className="min-h-screen px-6 py-10 md:px-12">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => setView("courses")}
            className="mb-4 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to courses
          </button>
          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Code2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{COURSE.title}</h1>
              <p className="mt-1 text-muted-foreground">{COURSE.description}</p>
            </div>
          </div>

          <h2 className="mb-4 text-lg font-semibold">Modules</h2>
          {modules === null ? (
            <div className="text-sm text-muted-foreground">Loading modules…</div>
          ) : modules.length === 0 ? (
            <div className="ide-card p-8 text-center">
              <ListChecks className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No modules available yet. An admin can upload questions in the Admin panel.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {modules.map((m, idx) => (
                <Link
                  key={m.quizName}
                  to={`/quiz?module=${encodeURIComponent(m.quizName)}`}
                  className="ide-card group p-5 transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>Module {idx + 1}</span>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold group-hover:text-primary">{m.quizName}</h3>
                  <div className="mb-4 flex gap-3 text-xs text-muted-foreground">
                    <span>{m.questionCount} question{m.questionCount === 1 ? "" : "s"}</span>
                    <span>•</span>
                    <span>{m.topicCount} topic{m.topicCount === 1 ? "" : "s"}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Start module <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 md:px-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5 text-primary" /> Learning Platform
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight md:text-5xl">
          Pick a course to <span className="text-primary">start learning</span>.
        </h1>
        <p className="mb-10 max-w-2xl text-muted-foreground">
          Each course is organised into modules. Take a module quiz, get personalised feedback, and track your progress.
        </p>

        <h2 className="mb-4 text-lg font-semibold">Courses</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => setView("modules")}
            className="ide-card group p-6 text-left transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <COURSE.icon className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-xl font-semibold group-hover:text-primary">{COURSE.title}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{COURSE.description}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{modules?.length ?? "…"} modules · {totalQuestions} questions</span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                Open course <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </button>

          <div className="ide-card flex flex-col justify-center p-6 opacity-60">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">More courses coming soon</h3>
            <p className="text-sm text-muted-foreground">Additional learning tracks will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
