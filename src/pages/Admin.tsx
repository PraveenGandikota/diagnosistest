import { useEffect, useMemo, useState } from "react";
import { Download, LogOut, Trash2, Upload, Plus } from "lucide-react";
import { AdminAccessGate } from "@/components/AdminAccessGate";
import {
  fetchAllQuestions, fetchSubmissions, deleteSubmission as deleteSubDb,
  insertQuestions, deleteQuestion as deleteQuestionDb,
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

  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
              {isSuper ? "Super Admin" : `Campus Admin · ${session?.campusName}`}
            </div>
            <h1 className="text-2xl font-bold">Diagnostic Dashboard</h1>
          </div>
          <button onClick={onLock} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted/40">
            <LogOut className="h-4 w-4" /> Lock
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative px-4 py-2 text-sm font-medium capitalize ${tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
              {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        {tab === "overview" && <Overview refreshKey={refreshKey} campusFilter={isSuper ? null : session?.campusId ?? null} />}
        {tab === "students" && <StudentsTab refreshKey={refreshKey} onChange={refresh} campusFilter={isSuper ? null : session?.campusId ?? null} isSuper={isSuper} />}
        {tab === "submissions" && <SubmissionsTab refreshKey={refreshKey} onChange={refresh} campusFilter={isSuper ? null : session?.campusId ?? null} />}
        {tab === "uploads" && isSuper && <UploadsTab onChange={refresh} />}
        {tab === "campuses" && isSuper && <CampusesTab refreshKey={refreshKey} onChange={refresh} />}
      </div>
    </div>
  );
};

// ---------- Overview ----------

const Overview = ({ refreshKey, campusFilter }: { refreshKey: number; campusFilter: string | null }) => {
  const [subs, setSubs] = useState<DBSubmission[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSubmissions(campusFilter ? { campusId: campusFilter } : undefined),
      fetchAllQuestions(),
      fetchSkills(),
      fetchCampuses(),
    ]).then(([s, q, sk, c]) => { setSubs(s); setQuestions(q); setSkills(sk); setCampuses(c); setLoading(false); });
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

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Submissions" value={String(total)} />
        <Stat label="Active students" value={String(studentSet.size)} />
        <Stat label="Avg score" value={`${avg}%`} />
        <Stat label={campusFilter ? "Skills tested" : "Campuses"} value={String(campusFilter ? Object.keys(skillStats).length : campuses.length)} />
      </div>

      <div className="panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Per-skill performance</h3>
        {Object.keys(skillStats).length === 0 ? (
          <div className="text-xs text-muted-foreground">No submissions yet.</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(skillStats).map(([skillId, st]) => {
              const skill = skills.find((s) => s.id === skillId);
              const avgScore = Math.round(st.sumScore / st.total);
              const weakest = Object.entries(st.weakKcs)
                .map(([k, v]) => ({ k, pct: Math.round((v.c / v.t) * 100) }))
                .sort((a, b) => a.pct - b.pct).slice(0, 3);
              return (
                <div key={skillId} className="rounded-md border border-border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold">{skill?.name || "Unknown skill"}</div>
                    <div className="text-sm text-muted-foreground">{st.total} attempt{st.total === 1 ? "" : "s"} · avg <span className={avgScore >= 60 ? "text-success font-semibold" : "text-destructive font-semibold"}>{avgScore}%</span></div>
                  </div>
                  <div className="text-xs text-muted-foreground">Weakest KCs: {weakest.length === 0 ? "—" : weakest.map((w) => `${w.k} (${w.pct}%)`).join(" · ")}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">{questions.length} questions in bank</div>
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

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      {isSuper && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter by campus:</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1 text-xs">
            <option value="ALL">All campuses</option>
            {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div className="panel overflow-hidden">
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
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No students yet.</td></tr>
            ) : filtered.map((s) => {
              const campus = campuses.find((c) => c.id === s.campus_id);
              return (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{s.student_id}</td>
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3 text-xs">{campus?.name || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.email || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDel(s.id)} className="rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter by skill:</span>
        <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1 text-xs">
          <option value="ALL">All skills</option>
          {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Skill / Quiz</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Weak KCs</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No submissions yet.</td></tr>
            ) : filtered.map((s) => {
              const skill = skills.find((sk) => sk.id === s.skillId);
              const isOpen = openId === s.id;
              return (
                <>
                  <tr key={s.id} className="border-t border-border hover:bg-muted/20 cursor-pointer" onClick={() => setOpenId(isOpen ? null : s.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.studentName}</div>
                      <div className="text-xs text-muted-foreground">{s.studentExternalId || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{skill?.name || "—"} · Quiz {s.quizNumber}</td>
                    <td className={`px-4 py-3 font-semibold ${s.scorePct >= 60 ? "text-success" : "text-destructive"}`}>{s.scorePct}%</td>
                    <td className="px-4 py-3 text-xs">{s.missedKCs.slice(0, 3).join(", ") || "None"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); handleDel(s.id); }} className="rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={s.id + "-d"} className="border-t border-border bg-muted/20">
                      <td colSpan={6} className="px-4 py-4 text-xs">
                        <div className="mb-2 font-semibold">KC Breakdown</div>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          {Object.entries(s.kcScores).map(([k, v]) => {
                            const pct = v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100);
                            return <div key={k} className={`rounded border p-2 ${pct >= 75 ? "border-success/30 bg-success/10" : pct >= 40 ? "border-warning/30 bg-warning/10" : "border-destructive/30 bg-destructive/10"}`}>
                              <div className="font-mono">{k}</div><div>{v.correct}/{v.total} · {pct}%</div>
                            </div>;
                          })}
                        </div>
                        {s.aiReport && <div className="mt-3 rounded border border-border bg-card p-3 whitespace-pre-wrap">{s.aiReport}</div>}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
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
  const [busy, setBusy] = useState(false);

  const handleFile = async (f: File) => {
    const text = await f.text();
    const r = parseQuestionCsv(text);
    setErrors(r.errors); setPreview(r.rows);
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
    setPreview([]); onChange();
  };

  return (
    <div className="panel p-6">
      <h3 className="mb-2 text-base font-semibold">Upload Questions</h3>
      <p className="mb-4 text-xs text-muted-foreground">CSV with skill, level, quiz_number, kc, topic, sub_topic, question, options, etc.</p>
      <button onClick={downloadQuestionTemplate} className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-muted/40">
        <Download className="h-3 w-3" /> Download template
      </button>
      <input type="file" accept=".csv,.tsv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground" />
      {errors.length > 0 && <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{errors.join(" · ")}</div>}
      {preview.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs text-muted-foreground">{preview.length} rows ready</div>
          <button onClick={handleUpload} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      )}
    </div>
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
    <div className="panel p-6">
      <h3 className="mb-2 text-base font-semibold">Upload Students</h3>
      <p className="mb-4 text-xs text-muted-foreground">CSV with campus, student_id, name, email.</p>
      <button onClick={downloadStudentTemplate} className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-muted/40">
        <Download className="h-3 w-3" /> Download template
      </button>
      <input type="file" accept=".csv,.tsv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground" />
      {errors.length > 0 && <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{errors.join(" · ")}</div>}
      {preview.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs text-muted-foreground">{preview.length} students ready</div>
          <button onClick={handleUpload} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      )}
    </div>
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

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <h3 className="mb-3 text-base font-semibold">Add campus</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campus name"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm" />
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Short code (e.g. BLR)"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm" />
          <input value={adminCode} onChange={(e) => setAdminCode(e.target.value)} placeholder="Admin access code"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-mono" />
          <button onClick={handleAdd} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3 text-left">Admin Code</th><th></th></tr>
          </thead>
          <tbody>
            {campuses.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No campuses yet. Add one above.</td></tr>
            ) : campuses.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.admin_access_code}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDel(c.id)} className="rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="ide-card p-4">
    <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-2xl font-semibold text-primary">{value}</div>
  </div>
);

export default Admin;
