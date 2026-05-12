import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, GraduationCap, LogOut, Stethoscope, BookOpen, ChevronRight } from "lucide-react";
import { useStudentSession } from "@/lib/student-session";
import {
  fetchCampuses, fetchSkills, fetchLevelsForSkill, fetchQuizzesForLevel, findStudent,
  fetchSubmissions,
  type Campus, type Skill, type Level, type DBSubmission,
} from "@/lib/quiz-db";
import { toast } from "sonner";

const Home = () => {
  const { session, logout } = useStudentSession();
  if (!session) return <StudentLogin />;
  return <SkillPicker logout={logout} />;
};

export default Home;

// ---------- Login ----------

const StudentLogin = () => {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { setSession } = useStudentSession();

  useEffect(() => { fetchCampuses().then(setCampuses); }, []);

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
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md panel p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Diagnostic Platform</div>
            <h1 className="text-xl font-bold">Sign in</h1>
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Campus</span>
          <select value={campusId} onChange={(e) => setCampusId(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">Select your campus</option>
            {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Student ID</span>
          <input value={studentId} onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <label className="mb-5 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>

        <button onClick={handleLogin} disabled={busy}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? "Checking…" : "Continue"}
        </button>

        {campuses.length === 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            No campuses set up yet. Ask your super admin to upload campus and student data.
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

  useEffect(() => {
    fetchSkills().then(setSkills);
    if (session?.student.id) fetchSubmissions({ studentUuid: session.student.id }).then(setSubmissions);
  }, [session?.student.id]);

  const attemptCount = (skillId: string) => submissions.filter((s) => s.skillId === skillId).length;

  return (
    <div className="min-h-screen px-6 py-10 md:px-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5 text-primary" /> Diagnostic Platform
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Welcome, {session?.student.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {session?.campus.name} · ID {session?.student.student_id}
            </p>
          </div>
          <button onClick={logout}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/40">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        <h2 className="mb-3 text-lg font-semibold">Pick a skill to diagnose</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Each skill has levels (L1, L2…) with multiple diagnostic quizzes. Take them to find your weak knowledge components.
        </p>

        {skills.length === 0 ? (
          <div className="ide-card p-8 text-center text-sm text-muted-foreground">
            No skills available yet. The super admin needs to upload questions.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {skills.map((s) => (
              <Link key={s.id} to={`/skills/${s.id}`}
                className="ide-card group p-5 transition-all hover:border-primary/50 hover:shadow-md">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h3 className="mb-1 text-lg font-semibold group-hover:text-primary">{s.name}</h3>
                <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{attemptCount(s.id)} attempt{attemptCount(s.id) === 1 ? "" : "s"}</span>
                  <span className="inline-flex items-center gap-1 text-primary font-medium">
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Skill detail (levels & quizzes) ----------

export const SkillDetail = () => {
  const { skillId } = useParams<{ skillId: string }>();
  const { session } = useStudentSession();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [quizzesByLevel, setQuizzesByLevel] = useState<Record<string, { quizNumber: number; questionCount: number }[]>>({});
  const [submissions, setSubmissions] = useState<DBSubmission[]>([]);

  useEffect(() => {
    if (!session) { navigate("/"); return; }
    if (!skillId) return;
    fetchSkills().then(setSkills);
    fetchLevelsForSkill(skillId).then(async (lvs) => {
      setLevels(lvs);
      const map: Record<string, { quizNumber: number; questionCount: number }[]> = {};
      await Promise.all(lvs.map(async (l) => { map[l.id] = await fetchQuizzesForLevel(skillId, l.id); }));
      setQuizzesByLevel(map);
    });
    fetchSubmissions({ studentUuid: session.student.id, skillId }).then(setSubmissions);
  }, [skillId, session, navigate]);

  const skill = skills.find((s) => s.id === skillId);
  const isCompleted = (levelId: string, quizNumber: number) =>
    submissions.some((s) => s.levelId === levelId && s.quizNumber === quizNumber);

  if (!session) return null;

  return (
    <div className="min-h-screen px-6 py-10 md:px-12">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          ← Back to skills
        </Link>
        <h1 className="mb-1 text-3xl font-bold">{skill?.name || "Skill"}</h1>
        <p className="mb-8 text-sm text-muted-foreground">{skill?.description}</p>

        {levels.length === 0 ? (
          <div className="ide-card p-8 text-center text-sm text-muted-foreground">No levels configured for this skill yet.</div>
        ) : (
          <div className="space-y-6">
            {levels.map((lv) => {
              const quizzes = quizzesByLevel[lv.id] || [];
              const done = quizzes.filter((q) => isCompleted(lv.id, q.quizNumber)).length;
              return (
                <div key={lv.id} className="panel p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{lv.name}</h2>
                    <span className="text-xs text-muted-foreground">{done} / {quizzes.length} quizzes complete</span>
                  </div>
                  {quizzes.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                      No quizzes uploaded for this level yet.
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {quizzes.map((q) => {
                        const completed = isCompleted(lv.id, q.quizNumber);
                        return (
                          <Link key={q.quizNumber}
                            to={`/quiz?skill=${skillId}&level=${lv.id}&quiz=${q.quizNumber}`}
                            className={`ide-card group p-4 transition-all hover:border-primary/50 hover:shadow-md ${completed ? "border-success/30 bg-success/5" : ""}`}>
                            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Quiz {q.quizNumber}
                            </div>
                            <div className="mb-2 text-sm font-semibold">{q.questionCount} question{q.questionCount === 1 ? "" : "s"}</div>
                            <div className="flex items-center justify-between text-xs">
                              <span className={completed ? "text-success font-medium" : "text-muted-foreground"}>
                                {completed ? "Completed" : "Not attempted"}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
