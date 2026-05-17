import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowLeft, Building2, ClipboardList, Download, GraduationCap, Layers,
  ShieldAlert, TrendingUp, Users,
} from "lucide-react";
import {
  fetchCampuses, fetchSkills, fetchStudents, fetchSubmissions,
  type Campus, type DBSubmission, type Skill, type Student,
} from "@/lib/quiz-db";
import {
  getAttemptsTrend, getCampusMetrics, getCampusRanking, getCampusStudentRows,
  getIntegrityStats, getIntegrityTrend, getSkillAverages, getSkillPassFail,
  getTopWeakTopics, PASS_MARK,
} from "@/lib/submission-analytics";
import { downloadCsv } from "@/lib/csv-export";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingCards, LoadingState } from "@/components/dashboard/LoadingState";
import { ResponsiveTableWrapper } from "@/components/dashboard/ResponsiveTableWrapper";
import { CampusAnalytics } from "@/components/admin/CampusAnalytics";

const COLOR = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  destructive: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
};
const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};
const RANGE_DAYS: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

type RangeKey = "all" | "7" | "30" | "90";

export const GlobalAnalytics = () => {
  const [subs, setSubs] = useState<DBSubmission[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [campusFilter, setCampusFilter] = useState("ALL");
  const [skillFilter, setSkillFilter] = useState("ALL");
  const [rangeFilter, setRangeFilter] = useState<RangeKey>("all");
  const [terminatedOnly, setTerminatedOnly] = useState(false);

  const [drillCampus, setDrillCampus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([fetchSubmissions(), fetchCampuses(), fetchSkills(), fetchStudents()])
      .then(([sub, c, sk, st]) => {
        if (cancelled) return;
        setSubs(sub); setCampuses(c); setSkills(sk); setStudents(st);
      })
      .catch((e) => { if (!cancelled) { console.error(e); setLoadError("Could not load global analytics."); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const campusName = (id: string | null | undefined) => campuses.find((c) => c.id === id)?.name ?? "—";
  const skillName = (id: string | null | undefined) => skills.find((s) => s.id === id)?.name ?? "—";

  // One filter set drives every chart, table and export.
  const filtered = useMemo(() => {
    const cutoff = rangeFilter !== "all" ? Date.now() - RANGE_DAYS[rangeFilter] * 86400000 : 0;
    return subs.filter((s) => {
      if (campusFilter !== "ALL" && s.campusId !== campusFilter) return false;
      if (skillFilter !== "ALL" && s.skillId !== skillFilter) return false;
      if (terminatedOnly && !s.terminationReason) return false;
      if (cutoff && new Date(s.date).getTime() < cutoff) return false;
      return true;
    });
  }, [subs, campusFilter, skillFilter, rangeFilter, terminatedOnly]);

  const metrics = useMemo(() => getCampusMetrics(filtered), [filtered]);
  const integrity = useMemo(() => getIntegrityStats(filtered), [filtered]);
  const ranking = useMemo(() => getCampusRanking(filtered), [filtered]);
  const skillAverages = useMemo(() => getSkillAverages(filtered), [filtered]);
  const skillPassFail = useMemo(() => getSkillPassFail(filtered), [filtered]);
  const weakTopics = useMemo(() => getTopWeakTopics(filtered, 12), [filtered]);
  const attemptsTrend = useMemo(() => getAttemptsTrend(filtered), [filtered]);
  const integrityTrend = useMemo(() => getIntegrityTrend(filtered), [filtered]);

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingCards count={4} />
        <div className="panel p-6"><LoadingState lines={6} label="Loading global analytics…" /></div>
      </div>
    );
  }
  if (loadError) {
    return <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{loadError}</div>;
  }

  // Drill-down: a campus reuses the full Campus Admin analytics view.
  if (drillCampus) {
    return (
      <div className="space-y-4">
        <button onClick={() => setDrillCampus(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to global analytics
        </button>
        <CampusAnalytics campusId={drillCampus} campusName={campusName(drillCampus)} />
      </div>
    );
  }

  const hasData = filtered.length > 0;

  // ----- Exports -----
  const exportCampuses = () => downloadCsv(
    "campus-ranking",
    ["Campus", "Attempts", "Avg score %", "Pass %", "Active students", "Strongest skill", "Weakest skill", "Violations"],
    ranking.map((r) => [
      campusName(r.campusId), r.attempts, r.avgScore, r.passPct, r.activeStudents,
      skillName(r.strongestSkillId), skillName(r.weakestSkillId), r.violations,
    ]),
  );
  const exportStudents = () => downloadCsv(
    "student-performance",
    ["Student", "Student ID", "Attempts", "Avg score %", "Strongest skill", "Weakest skill", "Latest attempt", "Terminations"],
    getCampusStudentRows(filtered).map((r) => [
      r.name, r.externalId, r.attempts, r.avgScore,
      skillName(r.strongestSkillId), skillName(r.weakestSkillId),
      r.latestDate ? new Date(r.latestDate).toLocaleString() : "—", r.terminationCount,
    ]),
  );
  const exportTopics = () => downloadCsv(
    "weak-topics",
    ["Topic", "Accuracy %", "Wrong answers", "Total answers"],
    weakTopics.map((t) => [t.topic, t.accuracyPct, t.wrongCount, t.total]),
  );
  const exportIntegrity = () => downloadCsv(
    "integrity-report",
    ["Campus", "Attempts", "Violations", "Terminated attempts"],
    ranking.map((r) => {
      const list = filtered.filter((s) => s.campusId === r.campusId);
      return [campusName(r.campusId), r.attempts, r.violations, list.filter((s) => s.terminationReason).length];
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Global assessment intelligence</h2>
        <p className="text-sm text-muted-foreground">Cross-campus performance, skill &amp; topic gaps, and exam integrity.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-3">
        <FilterSelect label="Campus" value={campusFilter} onChange={setCampusFilter}
          options={[{ v: "ALL", l: "All campuses" }, ...campuses.map((c) => ({ v: c.id, l: c.name }))]} />
        <FilterSelect label="Skill" value={skillFilter} onChange={setSkillFilter}
          options={[{ v: "ALL", l: "All skills" }, ...skills.map((s) => ({ v: s.id, l: s.name }))]} />
        <FilterSelect label="Date range" value={rangeFilter} onChange={(v) => setRangeFilter(v as RangeKey)}
          options={[{ v: "all", l: "All time" }, { v: "7", l: "Last 7 days" }, { v: "30", l: "Last 30 days" }, { v: "90", l: "Last 90 days" }]} />
        <label className="flex items-center gap-2 pb-1.5 text-xs font-medium text-muted-foreground">
          <input type="checkbox" checked={terminatedOnly} onChange={(e) => setTerminatedOnly(e.target.checked)} />
          Terminated attempts only
        </label>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} submission{filtered.length === 1 ? "" : "s"} in view</div>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Building2} label="Total campuses" value={campuses.length} />
        <StatCard icon={Users} label="Total students" value={students.length} />
        <StatCard icon={ClipboardList} label="Total submissions" value={metrics.totalSubmissions} />
        <StatCard icon={GraduationCap} label="Active students" value={metrics.activeStudents} tone="success" />
        <StatCard icon={TrendingUp} label="Avg global score" value={`${metrics.avgScore}%`}
          tone={!hasData ? "default" : metrics.avgScore >= PASS_MARK ? "success" : "warning"} />
        <StatCard icon={TrendingUp} label="Global pass %" value={`${metrics.passPct}%`}
          tone={!hasData ? "default" : metrics.passPct >= 50 ? "success" : "warning"} />
        <StatCard icon={Layers} label="Active skills" value={metrics.skillsAttempted} />
        <StatCard icon={ClipboardList} label="Quizzes conducted" value={metrics.quizzesConducted} />
        <StatCard icon={ShieldAlert} label="Integrity violations" value={integrity.totalViolations}
          tone={integrity.totalViolations > 0 ? "destructive" : "default"} />
        <StatCard icon={ShieldAlert} label="Auto-submissions" value={integrity.terminatedAttempts}
          sub={`${integrity.timeExpired} time-out · ${integrity.integrityTerminations} integrity`}
          tone={integrity.terminatedAttempts > 0 ? "warning" : "default"} />
      </div>

      {!hasData ? (
        <EmptyState icon={ClipboardList} title="No submissions in selected range"
          description="Adjust the filters above, or wait for students to complete diagnostic exams." />
      ) : (
        <>
          {/* Campus ranking */}
          <DashboardSection
            title="Campus ranking"
            description="Every campus ranked by average score. Click a campus for its full analytics."
            action={
              <div className="flex gap-2">
                <ExportButton label="Campuses" onClick={exportCampuses} />
                <ExportButton label="Students" onClick={exportStudents} />
              </div>
            }
          >
            <ResponsiveTableWrapper>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Campus</th>
                    <th className="px-4 py-3 text-left">Avg score</th>
                    <th className="px-4 py-3 text-left">Pass %</th>
                    <th className="px-4 py-3 text-left">Attempts</th>
                    <th className="px-4 py-3 text-left">Active students</th>
                    <th className="px-4 py-3 text-left">Strongest skill</th>
                    <th className="px-4 py-3 text-left">Weakest skill</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.campusId} onClick={() => setDrillCampus(r.campusId)}
                      className="cursor-pointer border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{campusName(r.campusId)}</td>
                      <td className={`px-4 py-3 font-semibold ${r.avgScore >= PASS_MARK ? "text-success" : "text-destructive"}`}>{r.avgScore}%</td>
                      <td className="px-4 py-3">{r.passPct}%</td>
                      <td className="px-4 py-3">{r.attempts}</td>
                      <td className="px-4 py-3">{r.activeStudents}</td>
                      <td className="px-4 py-3 text-xs">{skillName(r.strongestSkillId)}</td>
                      <td className="px-4 py-3 text-xs">{skillName(r.weakestSkillId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTableWrapper>
          </DashboardSection>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Campus comparison chart */}
            <DashboardSection title="Campus performance comparison" description="Average score per campus — full name shown on hover.">
              <HBarBox count={ranking.length}>
                <BarChart layout="vertical"
                  data={ranking.map((r) => ({ name: campusName(r.campusId), score: r.avgScore }))}
                  margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} interval={0} tickFormatter={truncateLabel} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Avg score"]} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {ranking.map((r, i) => (
                      <Cell key={i} fill={r.avgScore >= PASS_MARK ? COLOR.success : COLOR.destructive} />
                    ))}
                  </Bar>
                </BarChart>
              </HBarBox>
            </DashboardSection>

            {/* Submission growth */}
            <DashboardSection title="Submission growth" description="Daily submissions across all campuses.">
              {attemptsTrend.length === 0 ? <EmptyEmbed text="No dated submissions." /> : (
                <ChartBox>
                  <LineChart data={attemptsTrend} margin={{ left: 4, right: 16 }}>
                    <CartesianGrid stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="attempts" stroke={COLOR.primary} strokeWidth={2} dot={{ r: 3 }} name="Attempts" />
                  </LineChart>
                </ChartBox>
              )}
            </DashboardSection>

            {/* Skill averages */}
            <DashboardSection title="Global skill performance" description="Average score per skill. Click a bar to filter.">
              {skillAverages.length === 0 ? <EmptyEmbed text="No skill data." /> : (
                <HBarBox count={skillAverages.length}>
                  <BarChart layout="vertical"
                    data={skillAverages.map((s) => ({ id: s.skillId, name: skillName(s.skillId), score: s.avgScore }))}
                    margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} interval={0} tickFormatter={truncateLabel} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Avg score"]} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} onClick={(d: { id?: string }) => d?.id && setSkillFilter(d.id)}
                      className="cursor-pointer">
                      {skillAverages.map((s, i) => (
                        <Cell key={i} fill={s.avgScore >= PASS_MARK ? COLOR.success : COLOR.destructive} />
                      ))}
                    </Bar>
                  </BarChart>
                </HBarBox>
              )}
            </DashboardSection>

            {/* Skill pass/fail */}
            <DashboardSection title="Pass vs fail per skill" description="Submissions passing or failing each skill.">
              {skillPassFail.length === 0 ? <EmptyEmbed text="No skill data." /> : (
                <ChartBox>
                  <BarChart
                    data={skillPassFail.map((s) => ({ name: skillName(s.skillId), Pass: s.pass, Fail: s.fail }))}
                    margin={{ left: 4, right: 16 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={64} tickFormatter={truncateLabel} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Pass" stackId="a" fill={COLOR.success} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Fail" stackId="a" fill={COLOR.destructive} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartBox>
              )}
            </DashboardSection>
          </div>

          {/* Global weak topics */}
          <DashboardSection
            title="Global weak topics"
            description="Lowest-accuracy topics across the current filter."
            action={<ExportButton label="Topics" onClick={exportTopics} />}
          >
            {weakTopics.length === 0 ? (
              <EmptyEmbed text="No topic data captured for this selection." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {weakTopics.map((t) => (
                  <div key={t.topic} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.topic}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      t.accuracyPct >= PASS_MARK ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    }`}>{t.accuracyPct}%</span>
                    <span className="w-24 text-right text-[11px] text-muted-foreground">{t.wrongCount} wrong · {t.total}</span>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>

          {/* Integrity / exam health */}
          <DashboardSection
            title="Exam integrity &amp; health"
            description="Fullscreen/tab violations and auto-submission terminations."
            action={<ExportButton label="Integrity" onClick={exportIntegrity} />}
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <MiniStat label="Total violations" value={integrity.totalViolations} tone="destructive" />
              <MiniStat label="Integrity terminations" value={integrity.integrityTerminations} tone="destructive" />
              <MiniStat label="Time-expired auto-submits" value={integrity.timeExpired} tone="warning" />
              <MiniStat label="Terminated attempts" value={integrity.terminatedAttempts} tone="warning" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Integrity trend</div>
                {integrityTrend.length === 0 ? <EmptyEmbed text="No dated submissions." /> : (
                  <ChartBox height="h-56">
                    <LineChart data={integrityTrend} margin={{ left: 4, right: 16 }}>
                      <CartesianGrid stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="violations" stroke={COLOR.destructive} strokeWidth={2} dot={{ r: 3 }} name="Violations" />
                      <Line type="monotone" dataKey="terminations" stroke={COLOR.warning} strokeWidth={2} dot={{ r: 3 }} name="Terminations" />
                    </LineChart>
                  </ChartBox>
                )}
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campus-wise violations</div>
                {ranking.length === 0 ? <EmptyEmbed text="No campus data." /> : (
                  <ChartBox height="h-56">
                    <BarChart data={ranking.map((r) => ({ name: campusName(r.campusId), violations: r.violations }))}
                      margin={{ left: 4, right: 16 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={64} tickFormatter={truncateLabel} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="violations" fill={COLOR.destructive} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartBox>
                )}
              </div>
            </div>
          </DashboardSection>
        </>
      )}
    </div>
  );
};

// ---------- Small building blocks ----------

const FilterSelect = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-primary">
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </label>
);

const ExportButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/40">
    <Download className="h-3 w-3" /> {label}
  </button>
);

const ChartBox = ({ children, height = "h-64" }: { children: React.ReactElement; height?: string }) => (
  <div className={height}>
    <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
  </div>
);

// Shortens a long axis label; the full value still shows in the chart tooltip.
const truncateLabel = (s: unknown) => {
  const str = String(s ?? "");
  return str.length > 18 ? `${str.slice(0, 17)}…` : str;
};

// Horizontal bar chart whose height grows with the row count, scrolling past a cap.
const HBarBox = ({ count, children }: { count: number; children: React.ReactElement }) => (
  <div className="max-h-[440px] overflow-y-auto">
    <div style={{ height: Math.max(180, count * 38 + 28) }}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  </div>
);

const EmptyEmbed = ({ text }: { text: string }) => (
  <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
    {text}
  </div>
);

const MiniStat = ({ label, value, tone }: { label: string; value: number; tone: "destructive" | "warning" }) => (
  <div className={`rounded-md border p-3 ${value > 0 ? (tone === "destructive" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5") : "border-border bg-card"}`}>
    <div className={`text-xl font-bold ${value > 0 ? (tone === "destructive" ? "text-destructive" : "text-warning") : ""}`}>{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);
