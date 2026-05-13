import { Fragment, useEffect, useMemo, useState } from "react";
import { Building2, ClipboardList, Download, FileWarning, GraduationCap, Layers, LogOut, ShieldCheck, Trash2, TrendingUp, Upload, Users, Plus } from "lucide-react";
import { AdminAccessGate } from "@/components/AdminAccessGate";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingCards, LoadingState } from "@/components/dashboard/LoadingState";
import { ResponsiveTableWrapper } from "@/components/dashboard/ResponsiveTableWrapper";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import {
  fetchAllQuestions, fetchSubmissions, deleteSubmission as deleteSubDb,
  insertQuestions,
  fetchCampuses, insertCampus, deleteCampus,
  fetchSkills, ensureSkill, ensureLevel,
  fetchStudents, insertStudents, deleteStudent,
  type DBSubmission, type Campus, type Skill, type Student,
} from "@/lib/quiz-db";
import { downloadQuestionTemplate, downloadStudentTemplate } from "@/lib/csv-template";
import { parseQuestionCsv, parseStudentCsv } from "@/lib/csv-import";
import { useAdminAccess } from "@/lib/admin-access";
import type { Question } from "@/lib/quiz-types";
import { toast } from "sonner";

type Tab = "overview" | "students" | "submissions" | "uploads" | "campuses";

const Admin = () => (
  <AdminAccessGate title="Admin dashboard" description="Enter your access code (super admin or campus admin).">
    {({ lock }) => <Dashboard onLock={lock} />}
  </AdminAccessGate>
);

const Dashboard = ({ onLock }: { onLock: () => void }) => {
  const { session, isSuper } = useAdminAccess();
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  const tabs: Tab[] = isSuper
    ? ["overview", "students", "submissions", "uploads", "campuses"]
    : ["overview", "students", "submissions"];

  const tabLabels: Record<Tab, string> = {
    overview: "Overview",
    students: "Students",
    submissions: "Submissions",
    uploads: "Uploads",
    campuses: "Campuses",
  };

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isSuper ? "Super Admin" : `Campus Admin · ${session?.campusName ?? "Campus"}`}
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">Diagnostic Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSuper
                ? "Cross-campus diagnostic performance, uploads, and roster management."
                : `Diagnostic performance for ${session?.campusName ?? "your campus"}.`}
            </p>
          </div>
          <button onClick={onLock} className="inline-flex flex-shrink-0 items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted/40">
            <LogOut className="h-4 w-4" /> Lock
          </button>
        </div>

        <div className="mb-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-1 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium ${tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                aria-current={tab === t ? "page" : undefined}
              >
                {tabLabels[t]}
                {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            ))}
          </div>
        </div>

        {tab === "overview" && <Overview refreshKey={refreshKey} campusFilter={isSuper ? null : session?.campusId ?? null} isSuper={isSuper} campusName={session?.campusName ?? null} />}
        {tab === "students" && <StudentsTab refreshKey={refreshKey} onChange={refresh} campusFilter={isSuper ? null : session?.campusId ?? null} isSuper={isSuper} />}
        {tab === "submissions" && <SubmissionsTab refreshKey={refreshKey} onChange={refresh} campusFilter={isSuper ? null : session?.campusId ?? null} />}
        {tab === "uploads" && isSuper && <UploadsTab onChange={refresh} />}
        {tab === "campuses" && isSuper && <CampusesTab refreshKey={refreshKey} onChange={refresh} />}
      </div>
    </div>
  );
};

// ---------- Overview ----------

const Overview = ({ refreshKey, campusFilter, isSuper, campusName }: { refreshKey: number; campusFilter: string | null; isSuper: boolean; campusName: string | null }) => {
  const [subs, setSubs] = useState<DBSubmission[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      fetchSubmissions(campusFilter ? { campusId: campusFilter } : undefined),
      fetchAllQuestions(),
      fetchSkills(),
      fetchCampuses(),
      fetchStudents(campusFilter || undefined),
    ])
      .then(([s, q, sk, c, st]) => { setSubs(s); setQuestions(q); setSkills(sk); setCampuses(c); setStudents(st); })
      .catch((err) => { console.error("Overview load failed", err); setLoadError("Could not load dashboard data. Check your network or Supabase credentials."); })
      .finally(() => setLoading(false));
  }, [refreshKey, campusFilter]);

  const total = subs.length;
  const avg = total ? Math.round(subs.reduce((s, x) => s + x.scorePct, 0) / total) : 0;
  const studentSet = new Set(subs.map((s) => s.studentUuid).filter(Boolean));

  const skillStats = useMemo(() => {
    const out: Record<string, { total: number; sumScore: number; weakKcs: Record<string, { c: number; t: number }> }> = {};
    subs.forEach((s) => {
      const id = s.skillId || "unknown";
      if (!out[id]) out[id] = { total: 0, sumScore: 0, weakKcs: {} };
      out[id].total++;
      out[id].sumScore += s.scorePct;
      Object.entries(s.kcScores).forEach(([k, v]) => {
        if (v.total === 0) return;
        if (!out[id].weakKcs[k]) out[id].weakKcs[k] = { c: 0, t: 0 };
        out[id].weakKcs[k].c += v.correct;
        out[id].weakKcs[k].t += v.total;
      });
    });
    return out;
  }, [subs]);

  const campusStats = useMemo(() => {
    if (campusFilter) return [];
    const studentsByCampus = new Map<string, number>();
    students.forEach((s) => {
      studentsByCampus.set(s.campus_id, (studentsByCampus.get(s.campus_id) || 0) + 1);
    });
    const grouped = new Map<string, { attempts: number; sumScore: number; activeStudents: Set<string>; weakKcs: Record<string, { c: number; t: number }> }>();
    subs.forEach((s) => {
      const cid = s.campusId || "unknown";
      if (!grouped.has(cid)) grouped.set(cid, { attempts: 0, sumScore: 0, activeStudents: new Set(), weakKcs: {} });
      const bucket = grouped.get(cid)!;
      bucket.attempts++;
      bucket.sumScore += s.scorePct;
      if (s.studentUuid) bucket.activeStudents.add(s.studentUuid);
      Object.entries(s.kcScores).forEach(([k, v]) => {
        if (v.total === 0) return;
        if (!bucket.weakKcs[k]) bucket.weakKcs[k] = { c: 0, t: 0 };
        bucket.weakKcs[k].c += v.correct;
        bucket.weakKcs[k].t += v.total;
      });
    });
    return campuses.map((c) => {
      const bucket = grouped.get(c.id);
      const attempts = bucket?.attempts || 0;
      const avgScore = attempts ? Math.round((bucket!.sumScore) / attempts) : 0;
      const weakest = bucket
        ? Object.entries(bucket.weakKcs)
            .map(([k, v]) => ({ k, pct: Math.round((v.c / v.t) * 100) }))
            .sort((a, b) => a.pct - b.pct)[0]
        : null;
      return {
        campusId: c.id,
        campusName: c.name,
        campusCode: c.code,
        studentCount: studentsByCampus.get(c.id) || 0,
        attempts,
        avgScore,
        activeStudents: bucket?.activeStudents.size || 0,
        weakestTopic: weakest ? `${weakest.k} (${weakest.pct}%)` : "—",
      };
    }).sort((a, b) => b.attempts - a.attempts);
  }, [subs, campuses, students, campusFilter]);

  const topicGaps = useMemo(() => {
    if (!campusFilter) return [];
    const agg = new Map<string, { c: number; t: number }>();
    subs.forEach((s) => {
      Object.entries(s.kcScores).forEach(([k, v]) => {
        if (v.total === 0) return;
        const cur = agg.get(k) || { c: 0, t: 0 };
        cur.c += v.correct;
        cur.t += v.total;
        agg.set(k, cur);
      });
    });
    return Array.from(agg.entries())
      .map(([topic, v]) => ({ topic, correct: v.c, total: v.t, pct: Math.round((v.c / v.t) * 100) }))
      .sort((a, b) => a.pct - b.pct);
  }, [subs, campusFilter]);

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingCards count={4} />
        <div className="panel p-6"><LoadingState lines={4} label="Loading dashboard…" /></div>
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

  const fourthLabel = campusFilter ? "Skills tested" : "Campuses";
  const fourthValue = String(campusFilter ? Object.keys(skillStats).length : campuses.length);
  const fourthIcon = campusFilter ? Layers : Building2;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ClipboardList} label="Total submissions" value={total} sub={isSuper ? "Across all campuses" : `For ${campusName ?? "this campus"}`} />
        <StatCard icon={Users} label="Active students" value={studentSet.size} sub="Students with attempts" tone="success" />
        <StatCard icon={TrendingUp} label="Average score" value={`${avg}%`} sub={avg >= 60 ? "On track" : "Needs revision"} tone={avg === 0 ? "default" : avg >= 60 ? "success" : "warning"} />
        <StatCard icon={fourthIcon} label={fourthLabel} value={fourthValue} sub={isSuper ? "Onboarded universities" : "Tested by this campus"} />
      </div>

      {!campusFilter && (
        <DashboardSection
          title="Campus-wise performance"
          description="Snapshot across every campus. Sorted by attempts."
        >
          {campusStats.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No campuses yet"
              description="Add a campus in the Campuses tab to start tracking performance."
            />
          ) : (
            <ResponsiveTableWrapper>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Campus</th>
                    <th className="px-4 py-3 text-left">Students</th>
                    <th className="px-4 py-3 text-left">Attempts</th>
                    <th className="px-4 py-3 text-left">Active</th>
                    <th className="px-4 py-3 text-left">Avg score</th>
                    <th className="px-4 py-3 text-left">Weakest topic</th>
                  </tr>
                </thead>
                <tbody>
                  {campusStats.map((c) => (
                    <tr key={c.campusId} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.campusName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.campusCode}</div>
                      </td>
                      <td className="px-4 py-3">{c.studentCount}</td>
                      <td className="px-4 py-3">{c.attempts}</td>
                      <td className="px-4 py-3">{c.activeStudents}</td>
                      <td className={`px-4 py-3 font-semibold ${c.attempts === 0 ? "text-muted-foreground" : c.avgScore >= 60 ? "text-success" : "text-destructive"}`}>
                        {c.attempts === 0 ? "—" : `${c.avgScore}%`}
                      </td>
                      <td className="px-4 py-3 text-xs">{c.weakestTopic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTableWrapper>
          )}
        </DashboardSection>
      )}

      {campusFilter && (
        <DashboardSection
          title="Topic gaps"
          description={`Weakest topics across ${campusName ?? "this campus"}, aggregated from every submission.`}
        >
          {topicGaps.length === 0 ? (
            <EmptyState
              icon={FileWarning}
              title="No submissions yet for this campus"
              description="Topic gaps will appear here once students start attempting quizzes."
            />
          ) : (
            <div className="space-y-2.5">
              {topicGaps.slice(0, 8).map((t) => (
                <div key={t.topic} className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <div className="w-full truncate text-sm font-medium sm:w-44">{t.topic}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${t.pct >= 75 ? "bg-success" : t.pct >= 40 ? "bg-warning" : "bg-destructive"}`}
                      style={{ width: `${Math.max(t.pct, 2)}%` }}
                    />
                  </div>
                  <div className="w-24 text-right text-xs text-muted-foreground">
                    {t.correct}/{t.total} · <span className={t.pct >= 60 ? "text-success" : "text-destructive"}>{t.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardSection>
      )}

      <DashboardSection title="Per-skill performance" description="Average score and weakest topics for each skill in scope.">
        {Object.keys(skillStats).length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No submissions yet"
            description="Once a student completes a quiz, skill-level breakdowns will appear here."
          />
        ) : (
          <div className="space-y-3">
            {Object.entries(skillStats).map(([skillId, st]) => {
              const skill = skills.find((s) => s.id === skillId);
              const avgScore = Math.round(st.sumScore / st.total);
              const weakest = Object.entries(st.weakKcs)
                .map(([k, v]) => ({ k, pct: Math.round((v.c / v.t) * 100) }))
                .sort((a, b) => a.pct - b.pct).slice(0, 3);
              return (
                <div key={skillId} className="rounded-md border border-border p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{skill?.name || "Unknown skill"}</div>
                    <div className="text-sm text-muted-foreground">
                      {st.total} attempt{st.total === 1 ? "" : "s"} · avg{" "}
                      <span className={avgScore >= 60 ? "font-semibold text-success" : "font-semibold text-destructive"}>{avgScore}%</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Weakest topics: {weakest.length === 0 ? "—" : weakest.map((w) => `${w.k} (${w.pct}%)`).join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashboardSection>

      <div className="text-xs text-muted-foreground">
        {questions.length} question{questions.length === 1 ? "" : "s"} in bank · {students.length} student{students.length === 1 ? "" : "s"} in scope
      </div>
    </div>
  );
};

// ---------- Students ----------

const StudentsTab = ({ refreshKey, onChange, campusFilter, isSuper }: { refreshKey: number; onChange: () => void; campusFilter: string | null; isSuper: boolean }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [filter, setFilter] = useState<string>(campusFilter || "ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStudents(campusFilter || undefined), fetchCampuses()])
      .then(([s, c]) => { setStudents(s); setCampuses(c); setLoading(false); });
  }, [refreshKey, campusFilter]);

  const filtered = filter === "ALL" ? students : students.filter((s) => s.campus_id === filter);

  const handleDel = async (id: string) => {
    if (!confirm("Delete this student?")) return;
    const { error } = await deleteStudent(id);
    if (error) { toast.error("Failed"); return; }
    onChange();
  };

  if (loading) return <div className="panel p-6"><LoadingState lines={5} label="Loading students…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {filtered.length} student{filtered.length === 1 ? "" : "s"} {isSuper && filter !== "ALL" ? "(filtered)" : ""}
        </div>
        {isSuper && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="student-campus-filter">Filter by campus:</label>
            <select
              id="student-campus-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
            >
              <option value="ALL">All campuses</option>
              {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          description={isSuper ? "Upload a student roster in the Uploads tab, or add a campus first." : "Ask your super admin to upload your campus roster."}
        />
      ) : (
        <ResponsiveTableWrapper>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Student ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Campus</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const campus = campuses.find((c) => c.id === s.campus_id);
                return (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs">{s.student_id}</td>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3 text-xs">{campus?.name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.email || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDel(s.id)}
                        aria-label={`Delete ${s.name}`}
                        className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ResponsiveTableWrapper>
      )}
    </div>
  );
};

// ---------- Submissions ----------

const SubmissionsTab = ({ refreshKey, onChange, campusFilter }: { refreshKey: number; onChange: () => void; campusFilter: string | null }) => {
  const [subs, setSubs] = useState<DBSubmission[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [skillFilter, setSkillFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSubmissions(campusFilter ? { campusId: campusFilter } : undefined),
      fetchSkills(),
    ]).then(([s, sk]) => { setSubs(s); setSkills(sk); setLoading(false); });
  }, [refreshKey, campusFilter]);

  const filtered = skillFilter === "ALL" ? subs : subs.filter((s) => s.skillId === skillFilter);

  const handleDel = async (id: string) => {
    if (!confirm("Delete this submission?")) return;
    await deleteSubDb(id); onChange();
  };

  if (loading) return <div className="panel p-6"><LoadingState lines={5} label="Loading submissions…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {filtered.length} attempt{filtered.length === 1 ? "" : "s"}{skillFilter !== "ALL" ? " (filtered)" : ""}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="submissions-skill-filter">Filter by skill:</label>
          <select
            id="submissions-skill-filter"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
          >
            <option value="ALL">All skills</option>
            {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No submissions yet"
          description="Once a student completes a quiz, their attempt and KC breakdown will appear here."
        />
      ) : (
        <ResponsiveTableWrapper>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Skill / Quiz</th>
                <th className="px-4 py-3 text-left">Score</th>
                <th className="px-4 py-3 text-left">Weak topics</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const skill = skills.find((sk) => sk.id === s.skillId);
                const isOpen = openId === s.id;
                return (
                  <Fragment key={s.id}>
                    <tr className="cursor-pointer border-t border-border hover:bg-muted/20" onClick={() => setOpenId(isOpen ? null : s.id)}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{s.studentName}</div>
                        <div className="text-xs text-muted-foreground">{s.studentExternalId || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{skill?.name || "—"} · Quiz {s.quizNumber}</td>
                      <td className={`px-4 py-3 font-semibold ${s.scorePct >= 60 ? "text-success" : "text-destructive"}`}>{s.scorePct}%</td>
                      <td className="px-4 py-3 text-xs">{s.missedKCs.slice(0, 3).join(", ") || "None"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDel(s.id); }}
                          aria-label="Delete submission"
                          className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-border bg-muted/10">
                        <td colSpan={6} className="px-4 py-4 text-xs">
                          <div className="mb-2 font-semibold">Topic breakdown</div>
                          {Object.keys(s.kcScores).length === 0 ? (
                            <div className="text-muted-foreground">No topic data captured for this attempt.</div>
                          ) : (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              {Object.entries(s.kcScores).map(([k, v]) => {
                                const pct = v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100);
                                const tone = pct >= 75 ? "border-success/30 bg-success/10" : pct >= 40 ? "border-warning/30 bg-warning/10" : "border-destructive/30 bg-destructive/10";
                                return (
                                  <div key={k} className={`rounded border p-2 ${tone}`}>
                                    <div className="truncate font-medium">{k}</div>
                                    <div className="text-muted-foreground">{v.correct}/{v.total} · {pct}%</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {s.aiReport && (
                            <div className="mt-3 whitespace-pre-wrap rounded border border-border bg-card p-3">
                              {s.aiReport}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </ResponsiveTableWrapper>
      )}
    </div>
  );
};

// ---------- Uploads (Super Admin only) ----------

const UploadsTab = ({ onChange }: { onChange: () => void }) => {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <QuestionUpload onChange={onChange} />
      <StudentUpload onChange={onChange} />
    </div>
  );
};

const QuestionUpload = ({ onChange }: { onChange: () => void }) => {
  const [preview, setPreview] = useState<ReturnType<typeof parseQuestionCsv>["rows"]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const handleFile = async (f: File) => {
    const text = await f.text();
    const r = parseQuestionCsv(text);
    setErrors(r.errors); setWarnings(r.warnings); setPreview(r.rows);
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;
    setBusy(true);
    // Resolve skills/levels by name
    const skillCache = new Map<string, string>();
    const levelCache = new Map<string, string>();
    const rows = [];
    for (const row of preview) {
      let sId = skillCache.get(row._skillName);
      if (!sId) {
        const sk = await ensureSkill(row._skillName);
        if (!sk) continue;
        sId = sk.id; skillCache.set(row._skillName, sId);
      }
      const lkey = `${sId}|${row._levelName}`;
      let lId = levelCache.get(lkey);
      if (!lId) {
        const lv = await ensureLevel(sId, row._levelName);
        if (!lv) continue;
        lId = lv.id; levelCache.set(lkey, lId);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _skillName, _levelName, ...rest } = row;
      rows.push({ ...rest, skill_id: sId, level_id: lId });
    }
    const { error } = await insertQuestions(rows);
    setBusy(false);
    if (error) { toast.error(`Upload failed: ${error.message}`); return; }
    toast.success(`Uploaded ${rows.length} questions`);
    setPreview([]); setWarnings([]); onChange();
  };

  return (
    <DashboardSection
      title="Upload questions"
      description="CSV with skill, level (optional, defaults to L1), quiz_number (optional, defaults to 1), topic, sub-topic, options, diagnosis, remediation and mastery."
      action={
        <button onClick={downloadQuestionTemplate} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-muted/40">
          <Download className="h-3 w-3" /> Template
        </button>
      }
    >
      <input
        type="file"
        accept=".csv,.tsv"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="block w-full cursor-pointer rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground"
      />
      {errors.length > 0 && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
          {errors.join(" · ")}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          {warnings.join(" · ")}
        </div>
      )}
      {preview.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">{preview.length} row{preview.length === 1 ? "" : "s"} ready to upload</div>
          <button onClick={handleUpload} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload questions"}
          </button>
        </div>
      )}
    </DashboardSection>
  );
};

const StudentUpload = ({ onChange }: { onChange: () => void }) => {
  const [preview, setPreview] = useState<ReturnType<typeof parseStudentCsv>["rows"]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchCampuses().then(setCampuses); }, []);

  const handleFile = async (f: File) => {
    const text = await f.text();
    const r = parseStudentCsv(text);
    setErrors(r.errors); setPreview(r.rows);
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;
    setBusy(true);
    const byName = new Map(campuses.map((c) => [c.name.toLowerCase(), c.id]));
    const missingCampuses = new Set<string>();
    const rows = preview.map((r) => {
      const cid = byName.get(r._campusName.toLowerCase());
      if (!cid) missingCampuses.add(r._campusName);
      return cid ? { student_id: r.student_id, name: r.name, email: r.email, campus_id: cid } : null;
    }).filter(Boolean) as { student_id: string; name: string; email: string | null; campus_id: string }[];

    if (missingCampuses.size > 0) {
      toast.error(`Unknown campus: ${Array.from(missingCampuses).join(", ")}. Create them in the Campuses tab first.`);
      setBusy(false); return;
    }
    const { error } = await insertStudents(rows);
    setBusy(false);
    if (error) { toast.error(`Upload failed: ${error.message}`); return; }
    toast.success(`Uploaded ${rows.length} students`);
    setPreview([]); onChange();
  };

  return (
    <DashboardSection
      title="Upload students"
      description="CSV with campus, student_id, name, email. Campuses must already exist."
      action={
        <button onClick={downloadStudentTemplate} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-muted/40">
          <Download className="h-3 w-3" /> Template
        </button>
      }
    >
      {campuses.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Add a campus first"
          description="Students must belong to an existing campus. Create one in the Campuses tab before uploading."
        />
      ) : (
        <>
          <input
            type="file"
            accept=".csv,.tsv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block w-full cursor-pointer rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground"
          />
          {errors.length > 0 && (
            <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
              {errors.join(" · ")}
            </div>
          )}
          {preview.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">{preview.length} student{preview.length === 1 ? "" : "s"} ready to upload</div>
              <button onClick={handleUpload} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload students"}
              </button>
            </div>
          )}
        </>
      )}
    </DashboardSection>
  );
};

// ---------- Campuses (Super Admin only) ----------

const CampusesTab = ({ refreshKey, onChange }: { refreshKey: number; onChange: () => void }) => {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [adminCode, setAdminCode] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchCampuses().then((c) => { setCampuses(c); setLoading(false); });
  }, [refreshKey]);

  const handleAdd = async () => {
    if (!name.trim() || !code.trim() || !adminCode.trim()) {
      toast.error("All fields required"); return;
    }
    const { error } = await insertCampus({ name: name.trim(), code: code.trim(), admin_access_code: adminCode.trim() });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success("Campus added");
    setName(""); setCode(""); setAdminCode(""); onChange();
  };

  const handleDel = async (id: string) => {
    if (!confirm("Delete this campus and all its students/submissions?")) return;
    await deleteCampus(id); onChange();
  };

  if (loading) return <div className="panel p-6"><LoadingState lines={4} label="Loading campuses…" /></div>;

  return (
    <div className="space-y-4">
      <DashboardSection title="Add a campus" description="Create a campus and set its admin access code. Campus admins will use this code to sign in.">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Campus name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bangalore Main"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Short code</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. BLR"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Admin access code</span>
            <input value={adminCode} onChange={(e) => setAdminCode(e.target.value)} placeholder="Used by campus admin to log in"
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <button onClick={handleAdd} className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Add campus
          </button>
        </div>
      </DashboardSection>

      {campuses.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No campuses yet"
          description="Add your first campus above. You'll be able to upload students and let campus admins log in once one is created."
        />
      ) : (
        <ResponsiveTableWrapper>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Admin Code</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {campuses.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.admin_access_code}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDel(c.id)}
                      aria-label={`Delete campus ${c.name}`}
                      className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableWrapper>
      )}
    </div>
  );
};

export default Admin;
