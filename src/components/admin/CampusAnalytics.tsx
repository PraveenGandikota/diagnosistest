import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowLeft, ClipboardList, GraduationCap, Layers, ShieldAlert, TrendingUp, Users,
} from "lucide-react";
import {
  fetchQuestionsForQuiz, fetchSkills, fetchStudents, fetchSubmissions,
  type DBSubmission, type Skill, type Student,
} from "@/lib/quiz-db";
import type { Question } from "@/lib/quiz-types";
import {
  getAttemptsTrend, getCampusMetrics, getCampusStudentRows, getPassFail,
  getSkillAverages, getTopWeakTopics, PASS_MARK,
} from "@/lib/submission-analytics";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingCards, LoadingState } from "@/components/dashboard/LoadingState";
import { ResponsiveTableWrapper } from "@/components/dashboard/ResponsiveTableWrapper";
import { AttemptReview } from "@/components/AttemptReview";

const COLOR = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  destructive: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
  muted: "hsl(var(--muted-foreground))",
};

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

interface Props {
  campusId: string;
  campusName: string;
}

export const CampusAnalytics = ({ campusId, campusName }: Props) => {
  const [subs, setSubs] = useState<DBSubmission[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<DBSubmission | null>(null);
  const [attemptQuestions, setAttemptQuestions] = useState<Map<string, Question>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    // campus_id filter ensures a campus admin only ever sees their own campus.
    Promise.all([
      fetchSubmissions({ campusId }),
      fetchStudents(campusId),
      fetchSkills(),
    ])
      .then(([sub, st, sk]) => {
        if (cancelled) return;
        setSubs(sub); setStudents(st); setSkills(sk);
      })
      .catch((e) => { if (!cancelled) { console.error(e); setLoadError("Could not load campus analytics."); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [campusId]);

  const skillName = (id: string | null | undefined) =>
    skills.find((s) => s.id === id)?.name ?? "—";

  const metrics = useMemo(() => getCampusMetrics(subs), [subs]);
  const skillAverages = useMemo(() => getSkillAverages(subs), [subs]);
  const trend = useMemo(() => getAttemptsTrend(subs), [subs]);
  const passFail = useMemo(() => getPassFail(subs), [subs]);
  const weakTopics = useMemo(() => getTopWeakTopics(subs, 8), [subs]);
  const studentRows = useMemo(() => getCampusStudentRows(subs), [subs]);

  const openAttempt = async (sub: DBSubmission) => {
    setSelectedAttempt(sub);
    setAttemptQuestions(new Map());
    if (sub.skillId && sub.levelId) {
      const qs = await fetchQuestionsForQuiz(sub.skillId, sub.levelId, sub.quizNumber ?? 1);
      setAttemptQuestions(new Map(qs.map((q) => [q.id, q])));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingCards count={4} />
        <div className="panel p-6"><LoadingState lines={5} label="Loading campus analytics…" /></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
        {loadError}
      </div>
    );
  }

  // ----- Drill-down: a single attempt -----
  if (selectedAttempt) {
    return (
      <AttemptReview
        submission={selectedAttempt}
        questionsById={attemptQuestions}
        skillName={skillName(selectedAttempt.skillId)}
        onBack={() => setSelectedAttempt(null)}
      />
    );
  }

  // ----- Drill-down: one student -----
  if (selectedStudent) {
    const student = students.find((s) => s.id === selectedStudent);
    const studentSubs = subs.filter((s) => s.studentUuid === selectedStudent);
    return (
      <StudentDrillDown
        name={student?.name ?? studentSubs[0]?.studentName ?? "Student"}
        externalId={student?.student_id ?? studentSubs[0]?.studentExternalId ?? ""}
        subs={studentSubs}
        skillName={skillName}
        onBack={() => setSelectedStudent(null)}
        onOpenAttempt={openAttempt}
      />
    );
  }

  const attemptedCount = new Set(subs.map((s) => s.studentUuid).filter(Boolean)).size;
  const hasData = subs.length > 0;

  // Merge attempted + not-attempted students into one table.
  const rowByUuid = new Map(studentRows.map((r) => [r.studentUuid, r]));
  const tableRows = students
    .map((st) => ({ student: st, row: rowByUuid.get(st.id) ?? null }))
    .sort((a, b) => {
      if (!!a.row !== !!b.row) return a.row ? -1 : 1;        // attempted first
      if (a.row && b.row) return a.row.avgScore - b.row.avgScore; // weakest first
      return a.student.name.localeCompare(b.student.name);
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{campusName} · Campus analytics</h2>
        <p className="text-sm text-muted-foreground">Performance for your campus only. Click any student for a full drill-down.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total students" value={students.length} sub={`${attemptedCount} attempted`} />
        <StatCard icon={GraduationCap} label="Active students" value={metrics.activeStudents} sub="with at least one attempt" tone="success" />
        <StatCard icon={ClipboardList} label="Total submissions" value={metrics.totalSubmissions} sub="exam attempts" />
        <StatCard
          icon={TrendingUp} label="Average score" value={`${metrics.avgScore}%`}
          sub={metrics.avgScore >= PASS_MARK ? "On track" : "Needs revision"}
          tone={!hasData ? "default" : metrics.avgScore >= PASS_MARK ? "success" : "warning"}
        />
        <StatCard
          icon={TrendingUp} label="Pass percentage" value={`${metrics.passPct}%`}
          sub={`${PASS_MARK}%+ counts as a pass`}
          tone={!hasData ? "default" : metrics.passPct >= 50 ? "success" : "warning"}
        />
        <StatCard icon={Layers} label="Skills attempted" value={metrics.skillsAttempted} sub="distinct skills" />
        <StatCard icon={ClipboardList} label="Quizzes conducted" value={metrics.quizzesConducted} sub="distinct skill · level · quiz" />
      </div>

      {!hasData ? (
        <EmptyState
          icon={ClipboardList}
          title="No attempts yet"
          description="Once students in your campus complete diagnostic exams, performance charts will appear here."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Skill-wise performance */}
          <DashboardSection title="Skill-wise performance" description="Average score per skill across this campus.">
            {skillAverages.length === 0 ? (
              <EmptyEmbed text="No submissions found for any skill." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={skillAverages.map((s) => ({ name: skillName(s.skillId), score: s.avgScore }))}
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Avg score"]} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {skillAverages.map((s, i) => (
                        <Cell key={i} fill={s.avgScore >= PASS_MARK ? COLOR.success : COLOR.destructive} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardSection>

          {/* Pass vs fail */}
          <DashboardSection title="Pass vs fail" description={`Submissions scoring ${PASS_MARK}% or above.`}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Pass", value: passFail.pass },
                      { name: "Fail", value: passFail.fail },
                    ]}
                    dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}
                  >
                    <Cell fill={COLOR.success} />
                    <Cell fill={COLOR.destructive} />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Pass · {passFail.pass}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Fail · {passFail.fail}</span>
            </div>
          </DashboardSection>

          {/* Attempts trend */}
          <DashboardSection title="Attempts over time" description="Daily submission volume for this campus." className="lg:col-span-2">
            {trend.length === 0 ? (
              <EmptyEmbed text="No dated submissions yet." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ left: 4, right: 16 }}>
                    <CartesianGrid stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="attempts" stroke={COLOR.primary} strokeWidth={2} dot={{ r: 3 }} name="Attempts" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardSection>

          {/* Weakest skills */}
          <DashboardSection title="Weakest skills" description="Lowest average-scoring skills first.">
            {skillAverages.length === 0 ? (
              <EmptyEmbed text="No submissions found for any skill." />
            ) : (
              <div className="space-y-2.5">
                {[...skillAverages].reverse().slice(0, 6).map((s) => (
                  <div key={s.skillId} className="flex items-center gap-3">
                    <div className="w-32 truncate text-sm font-medium">{skillName(s.skillId)}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${s.avgScore >= PASS_MARK ? "bg-success" : s.avgScore >= 40 ? "bg-warning" : "bg-destructive"}`}
                        style={{ width: `${Math.max(s.avgScore, 3)}%` }}
                      />
                    </div>
                    <div className="w-20 text-right text-xs text-muted-foreground">{s.avgScore}% · {s.attempts}x</div>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>

          {/* Top weak topics */}
          <DashboardSection title="Top weak topics" description="Lowest-accuracy topics across all submissions.">
            {weakTopics.length === 0 ? (
              <EmptyEmbed text="No topic data captured yet." />
            ) : (
              <div className="space-y-2">
                {weakTopics.map((t) => (
                  <div key={t.topic} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.topic}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      t.accuracyPct >= PASS_MARK ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    }`}>
                      {t.accuracyPct}%
                    </span>
                    <span className="w-20 text-right text-[11px] text-muted-foreground">{t.wrongCount} wrong</span>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        </div>
      )}

      {/* Student performance table */}
      <DashboardSection title="Student performance" description="Every student in your campus. Click a row for a full drill-down.">
        {students.length === 0 ? (
          <EmptyState icon={Users} title="No students yet" description="Ask your super admin to upload your campus roster." />
        ) : (
          <ResponsiveTableWrapper>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Attempts</th>
                  <th className="px-4 py-3 text-left">Avg score</th>
                  <th className="px-4 py-3 text-left">Strongest skill</th>
                  <th className="px-4 py-3 text-left">Weakest skill</th>
                  <th className="px-4 py-3 text-left">Latest attempt</th>
                  <th className="px-4 py-3 text-left">Terminations</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(({ student, row }) => (
                  <tr
                    key={student.id}
                    onClick={() => row && setSelectedStudent(student.id)}
                    className={`border-t border-border ${row ? "cursor-pointer hover:bg-muted/20" : "opacity-70"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{student.name}</div>
                      <div className="text-xs text-muted-foreground">{student.student_id}</div>
                    </td>
                    {row ? (
                      <>
                        <td className="px-4 py-3">{row.attempts}</td>
                        <td className={`px-4 py-3 font-semibold ${row.avgScore >= PASS_MARK ? "text-success" : "text-destructive"}`}>
                          {row.avgScore}%
                        </td>
                        <td className="px-4 py-3 text-xs">{skillName(row.strongestSkillId)}</td>
                        <td className="px-4 py-3 text-xs">{skillName(row.weakestSkillId)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {row.latestDate ? new Date(row.latestDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {row.terminationCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                              <ShieldAlert className="h-3 w-3" /> {row.terminationCount}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">0</span>}
                        </td>
                      </>
                    ) : (
                      <td className="px-4 py-3 text-xs text-muted-foreground" colSpan={6}>Not attempted yet</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableWrapper>
        )}
      </DashboardSection>
    </div>
  );
};

const EmptyEmbed = ({ text }: { text: string }) => (
  <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
    {text}
  </div>
);

// ---------- Student drill-down ----------

interface DrillProps {
  name: string;
  externalId: string;
  subs: DBSubmission[];
  skillName: (id: string | null | undefined) => string;
  onBack: () => void;
  onOpenAttempt: (sub: DBSubmission) => void;
}

const StudentDrillDown = ({ name, externalId, subs, skillName, onBack, onOpenAttempt }: DrillProps) => {
  const metrics = useMemo(() => getCampusMetrics(subs), [subs]);
  const weakTopics = useMemo(() => getTopWeakTopics(subs, 6), [subs]);
  const skillAverages = useMemo(() => getSkillAverages(subs), [subs]);
  const trend = useMemo(() => getAttemptsTrend(subs), [subs]);
  const ordered = [...subs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const terminated = subs.filter((s) => s.terminationReason);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to campus analytics
      </button>

      <div className="panel p-5 sm:p-6">
        <h2 className="text-xl font-bold sm:text-2xl">{name}</h2>
        <p className="text-sm text-muted-foreground">ID {externalId || "—"}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Attempts" value={metrics.totalSubmissions} />
          <StatCard label="Average score" value={`${metrics.avgScore}%`} tone={metrics.avgScore >= PASS_MARK ? "success" : "warning"} />
          <StatCard label="Pass rate" value={`${metrics.passPct}%`} />
          <StatCard label="Terminated" value={terminated.length} tone={terminated.length ? "destructive" : "default"} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardSection title="Performance trend" description="Average score by attempt date.">
          {trend.length === 0 ? (
            <EmptyEmbed text="No dated attempts." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: 4, right: 16 }}>
                  <CartesianGrid stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Avg score"]} />
                  <Line type="monotone" dataKey="avgScore" stroke={COLOR.primary} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardSection>

        <DashboardSection title="Weak areas" description="Weakest topics and skills for this student.">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Weak skills</div>
          {skillAverages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No skill data yet.</p>
          ) : (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {[...skillAverages].reverse().slice(0, 4).map((s) => (
                <span key={s.skillId} className={`rounded-full border px-2 py-0.5 text-[11px] ${
                  s.avgScore >= PASS_MARK ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}>
                  {skillName(s.skillId)} · {s.avgScore}%
                </span>
              ))}
            </div>
          )}
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Weak topics</div>
          {weakTopics.length === 0 ? (
            <p className="text-xs text-muted-foreground">No topic data captured yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {weakTopics.map((t) => (
                <span key={t.topic} className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                  {t.topic} · {t.accuracyPct}%
                </span>
              ))}
            </div>
          )}
        </DashboardSection>
      </div>

      <DashboardSection title="All attempts" description="Click any attempt for a full question-level review.">
        {ordered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No attempts yet" description="This student has not completed any exam." />
        ) : (
          <div className="space-y-2">
            {ordered.map((s) => (
              <button
                key={s.id}
                onClick={() => onOpenAttempt(s)}
                className="ide-card flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/20"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{skillName(s.skillId)} · Quiz {s.quizNumber ?? 1}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.date).toLocaleString()} · {s.mcqCorrect}/{s.mcqTotal} correct
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.terminationReason && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                      <ShieldAlert className="h-3 w-3" /> Terminated
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.scorePct >= PASS_MARK ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {s.scorePct}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
};
