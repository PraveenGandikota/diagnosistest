import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, GraduationCap, LogOut, Stethoscope, BookOpen, ChevronRight, ClipboardList, Sparkles, Layers, Trophy } from "lucide-react";
import { useStudentSession } from "@/lib/student-session";
import {
  fetchCampuses, fetchSkills, fetchSkillsWithQuestions, fetchLevelsForSkill, fetchQuizzesForLevel, findStudent,
  fetchSubmissions,
  type Campus, type Skill, type Level, type DBSubmission,
} from "@/lib/quiz-db";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingCards, LoadingState } from "@/components/dashboard/LoadingState";

const Home = () => {
  const { session, logout } = useStudentSession();
  if (!session) return <StudentLogin />;
  return <SkillPicker logout={logout} />;
};

export default Home;

// ---------- Login ----------

const StudentLogin = () => {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusesLoading, setCampusesLoading] = useState(true);
  const [campusId, setCampusId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { setSession } = useStudentSession();

  useEffect(() => {
    setCampusesLoading(true);
    fetchCampuses()
      .then(setCampuses)
      .finally(() => setCampusesLoading(false));
  }, []);

  const handleLogin = async () => {
    if (!campusId || !studentId.trim() || !name.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }
    setBusy(true);
    const s = await findStudent(studentId, name);
    setBusy(false);
    if (!s || s.campus_id !== campusId) {
      toast.error("Student not found in the selected campus. Check with your admin.");
      return;
    }
    const campus = campuses.find((c) => c.id === campusId)!;
    setSession({ student: s, campus });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md panel p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Diagnostic Platform</div>
            <h1 className="text-xl font-semibold leading-tight">Sign in</h1>
          </div>
        </div>

        <p className="mb-5 text-sm text-muted-foreground">
          Pick your campus and confirm your student details to begin a diagnostic quiz.
        </p>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Campus</span>
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              disabled={campusesLoading || campuses.length === 0}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">{campusesLoading ? "Loading campuses…" : "Select your campus"}</option>
              {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Student ID</span>
            <input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. GR-2024-001"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Full name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              placeholder="As registered with the campus"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>

        <button
          onClick={handleLogin}
          disabled={busy || campusesLoading}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Continue"}
        </button>

        {!campusesLoading && campuses.length === 0 && (
          <p className="mt-5 rounded-md border border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
            No campuses set up yet. Ask your super admin to upload campus and student data first.
          </p>
        )}
      </div>
    </div>
  );
};

// ---------- Skill Picker ----------

const SkillPicker = ({ logout }: { logout: () => void }) => {
  const { session } = useStudentSession();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [submissions, setSubmissions] = useState<DBSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchSkillsWithQuestions(),
      session?.student.id ? fetchSubmissions({ studentUuid: session.student.id }) : Promise.resolve([] as DBSubmission[]),
    ])
      .then(([s, subs]) => {
        if (cancelled) return;
        setSkills(s);
        setSubmissions(subs);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session?.student.id]);

  const attemptCount = (skillId: string) => submissions.filter((s) => s.skillId === skillId).length;
  const bestScoreForSkill = (skillId: string) => {
    const subs = submissions.filter((s) => s.skillId === skillId);
    if (subs.length === 0) return null;
    return Math.max(...subs.map((s) => s.scorePct));
  };
  const totalAttempts = submissions.length;
  const skillsTouched = useMemo(() => new Set(submissions.map((s) => s.skillId).filter(Boolean)).size, [submissions]);

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5 text-primary" /> Diagnostic Platform
            </div>
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Welcome, {session?.student.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {session?.campus.name} · ID {session?.student.student_id}
            </p>
          </div>
          <button
            onClick={logout}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/40"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <MiniStat icon={ClipboardList} label="Quizzes attempted" value={String(totalAttempts)} />
          <MiniStat icon={Layers} label="Skills explored" value={String(skillsTouched)} />
          <MiniStat icon={Sparkles} label="Skills available" value={loading ? "—" : String(skills.length)} />
        </div>

        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pick a skill to diagnose</h2>
            <p className="text-sm text-muted-foreground">
              Each skill has levels (L1, L2…) with diagnostic quizzes that reveal your weak topics.
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingCards count={4} />
        ) : skills.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No skills available yet"
            description="The super admin still needs to upload questions. Check back shortly."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {skills.map((s) => {
              const attempts = attemptCount(s.id);
              const best = bestScoreForSkill(s.id);
              return (
                <Link
                  key={s.id}
                  to={`/skills/${s.id}`}
                  className="ide-card group flex flex-col p-5 transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    {best !== null && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${best >= 60 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        <Trophy className="h-3 w-3" /> Best {best}%
                      </span>
                    )}
                  </div>
                  <h3 className="mb-1 text-lg font-semibold group-hover:text-primary">{s.name}</h3>
                  <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{s.description || "Diagnostic quizzes for this skill."}</p>
                  <div className="mt-auto flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {attempts} attempt{attempts === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-primary">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const MiniStat = ({ icon: Icon, label, value }: { icon: typeof ClipboardList; label: string; value: string }) => (
  <div className="ide-card flex items-center gap-3 p-4">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
    </div>
  </div>
);

// ---------- Skill detail (levels & quizzes) ----------

export const SkillDetail = () => {
  const { skillId } = useParams<{ skillId: string }>();
  const { session } = useStudentSession();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [quizzesByLevel, setQuizzesByLevel] = useState<Record<string, { quizNumber: number; questionCount: number }[]>>({});
  const [submissions, setSubmissions] = useState<DBSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) { navigate("/"); return; }
    if (!skillId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [allSkills, lvs, subs] = await Promise.all([
        fetchSkills(),
        fetchLevelsForSkill(skillId),
        fetchSubmissions({ studentUuid: session.student.id, skillId }),
      ]);
      if (cancelled) return;
      setSkills(allSkills);
      setLevels(lvs);
      setSubmissions(subs);
      const map: Record<string, { quizNumber: number; questionCount: number }[]> = {};
      await Promise.all(lvs.map(async (l) => { map[l.id] = await fetchQuizzesForLevel(skillId, l.id); }));
      if (cancelled) return;
      setQuizzesByLevel(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [skillId, session, navigate]);

  const skill = skills.find((s) => s.id === skillId);
  const isCompleted = (levelId: string, quizNumber: number) =>
    submissions.some((s) => s.levelId === levelId && s.quizNumber === quizNumber);

  const attemptStats = (levelId: string, quizNumber: number) => {
    const matches = submissions.filter((s) => s.levelId === levelId && s.quizNumber === quizNumber);
    if (matches.length === 0) return null;
    const best = Math.max(...matches.map((m) => m.scorePct));
    const latest = matches[0];
    return { attempts: matches.length, best, latestDate: latest.date };
  };

  if (!session) return null;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-10 md:px-10">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          ← Back to skills
        </Link>
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl">{skill?.name || "Skill"}</h1>
        <p className="mb-8 text-sm text-muted-foreground">{skill?.description}</p>

        {loading ? (
          <LoadingState lines={6} label="Loading levels and quizzes…" />
        ) : levels.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No levels configured yet"
            description="Ask your super admin to upload questions for this skill."
          />
        ) : (
          <div className="space-y-6">
            {levels.map((lv) => {
              const quizzes = quizzesByLevel[lv.id] || [];
              const done = quizzes.filter((q) => isCompleted(lv.id, q.quizNumber)).length;
              const pct = quizzes.length === 0 ? 0 : Math.round((done / quizzes.length) * 100);
              return (
                <section key={lv.id} className="panel p-5">
                  <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{lv.name}</h2>
                      <p className="text-xs text-muted-foreground">{done} of {quizzes.length} quizzes complete</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
                    </div>
                  </header>
                  {quizzes.length === 0 ? (
                    <EmptyState
                      icon={ClipboardList}
                      title="No quizzes uploaded for this level"
                      description="Once questions are uploaded, quizzes will appear here."
                    />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {quizzes.map((q) => {
                        const completed = isCompleted(lv.id, q.quizNumber);
                        const stats = attemptStats(lv.id, q.quizNumber);
                        return (
                          <Link
                            key={q.quizNumber}
                            to={`/quiz?skill=${skillId}&level=${lv.id}&quiz=${q.quizNumber}`}
                            className={`ide-card group flex flex-col p-4 transition-all hover:border-primary/50 hover:shadow-md ${completed ? "border-success/30 bg-success/5" : ""}`}
                          >
                            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              Quiz {q.quizNumber}
                            </div>
                            <div className="mb-2 text-sm font-semibold">{q.questionCount} question{q.questionCount === 1 ? "" : "s"}</div>
                            {stats && (
                              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
                                <span className={`rounded-full px-2 py-0.5 font-semibold ${stats.best >= 60 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                                  Best {stats.best}%
                                </span>
                                <span className="text-muted-foreground">
                                  {stats.attempts} attempt{stats.attempts === 1 ? "" : "s"} · {new Date(stats.latestDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            <div className="mt-auto flex items-center justify-between text-xs">
                              <span className={completed ? "font-medium text-success" : "text-muted-foreground"}>
                                {completed ? "Completed" : "Not attempted"}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
