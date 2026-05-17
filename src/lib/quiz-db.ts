import { supabase } from "@/integrations/supabase/client";
import type { Question, KCId } from "./quiz-types";
import { getTopicDisplayName, normalizeQuestionType } from "./quiz-types";

// ---------- Types ----------

export interface Campus { id: string; name: string; code: string; admin_access_code: string; }
export interface Skill {
  id: string; name: string; description: string; sort_order: number;
  /** Optional unlock code a student must enter before starting an exam. */
  exam_access_code?: string | null;
  /** Countdown length in minutes (0 = untimed). */
  exam_duration_min?: number;
  /** Allowed attempts per quiz (default 1). */
  max_attempts?: number;
}
export interface Level { id: string; skill_id: string; name: string; sort_order: number; }
export interface Student {
  id: string; student_id: string; name: string; email: string | null; campus_id: string;
  /** Login credential; falls back to student_id when unset. */
  access_code?: string | null;
}

export interface DBSubmissionAnswer {
  qid: string; kc: string; kcName?: string; type: string; question: string;
  correct: boolean; selectedIdx: number; correctIdx: number; options: string[];
}

export interface DBSubmission {
  id: string;
  studentName: string;
  studentExternalId?: string;
  studentUuid?: string | null;
  campusId?: string | null;
  skillId?: string | null;
  levelId?: string | null;
  quizNumber?: number;
  quizName: string;
  date: string;
  durationSec: number;
  mcqCorrect: number;
  mcqTotal: number;
  scorePct: number;
  weakestKC: string;
  missedKCs: string[];
  kcScores: Record<string, { correct: number; total: number }>;
  aiReport: string;
  answers: DBSubmissionAnswer[];
  /** Internal anti-cheat counter recorded during the exam. */
  violations?: number;
  /** Set when the exam was auto-submitted by the proctoring rules. */
  terminationReason?: string | null;
}

// ---------- Mappers ----------

function rowToQuestion(row: any): Question {
  const options = [row.option_a, row.option_b, row.option_c, row.option_d].filter((o) => o !== null && o !== undefined && String(o).trim() !== "");
  const correctIdx = Math.max(0, Math.min(row.correct_idx ?? 0, options.length - 1));
  const wrongs = [row.wrong_a, row.wrong_b, row.wrong_c].map((w) => w || "Not quite.");
  const wrongDiagnosis = options.map((_, i) => {
    if (i === correctIdx) return "";
    const wrongIdx = i < correctIdx ? i : i - 1;
    return wrongs[wrongIdx] ?? "Not quite.";
  });
  return {
    id: row.id,
    quizName: row.quiz_name || "General",
    kc: row.kc as KCId,
    kcName: getTopicDisplayName(row.kc, row.kc_name),
    topic: row.topic || "",
    subTopic: row.sub_topic || "",
    skillId: row.skill_id ?? null,
    levelId: row.level_id ?? null,
    quizNumber: row.quiz_number ?? 1,
    type: normalizeQuestionType(row.type),
    question: row.question,
    code: row.code || "",
    options,
    correct: correctIdx,
    explanation: row.explanation || "",
    wrongDiagnosis,
    remediationBeginner: row.recommended_remediation_beginner || "",
    remediationIntermediate: row.recommended_remediation_intermediate || "",
    masteryIndicator: row.mastery_indicator || "",
  };
}

function safeAnswers(value: unknown): DBSubmissionAnswer[] {
  if (Array.isArray(value)) return value as DBSubmissionAnswer[];
  if (value && typeof value === "object") {
    const vals = Object.values(value as Record<string, unknown>);
    return vals.filter((v): v is DBSubmissionAnswer => !!v && typeof v === "object");
  }
  return [];
}

function safeKcScores(value: unknown): Record<string, { correct: number; total: number }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, { correct: number; total: number }> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const obj = v as { correct?: unknown; total?: unknown };
      const correct = typeof obj.correct === "number" ? obj.correct : 0;
      const total = typeof obj.total === "number" ? obj.total : 0;
      out[k] = { correct, total };
    }
  }
  return out;
}

function rowToSubmission(row: any): DBSubmission {
  const kcScores = safeKcScores(row.kc_scores);
  const answers = safeAnswers(row.answers);
  const missed = new Set<string>();
  answers.forEach((a) => { if (a && !a.correct) missed.add(a.kcName || a.kc); });
  return {
    id: row.id,
    studentName: row.student_name,
    studentExternalId: row.student_id,
    studentUuid: row.student_uuid ?? null,
    campusId: row.campus_id ?? null,
    skillId: row.skill_id ?? null,
    levelId: row.level_id ?? null,
    quizNumber: row.quiz_number ?? 1,
    quizName: row.quiz_name,
    date: row.created_at,
    durationSec: row.duration_sec,
    mcqCorrect: row.mcq_correct,
    mcqTotal: row.mcq_total,
    scorePct: row.score_pct,
    weakestKC: row.weakest_kc || "--",
    missedKCs: Array.from(missed),
    kcScores,
    aiReport: row.ai_report || "",
    answers,
    violations: typeof row.violations === "number" ? row.violations : 0,
    terminationReason: row.termination_reason ?? null,
  };
}

// ---------- Campuses / Skills / Levels / Students ----------

export async function fetchCampuses(): Promise<Campus[]> {
  const { data, error } = await supabase.from("campuses").select("*").order("name");
  if (error) { console.error(error); return []; }
  return (data || []) as Campus[];
}

export async function insertCampus(c: { name: string; code: string; admin_access_code: string }) {
  return supabase.from("campuses").insert(c).select().single();
}

export async function deleteCampus(id: string) {
  return supabase.from("campuses").delete().eq("id", id);
}

export async function fetchSkills(): Promise<Skill[]> {
  const { data, error } = await supabase.from("skills").select("*").order("sort_order");
  if (error) { console.error(error); return []; }
  return (data || []) as Skill[];
}

export async function fetchSkillsWithQuestions(): Promise<Skill[]> {
  const [skillsRes, questionsRes] = await Promise.all([
    supabase.from("skills").select("*").order("sort_order"),
    supabase.from("questions").select("skill_id").not("skill_id", "is", null),
  ]);
  if (skillsRes.error) { console.error(skillsRes.error); return []; }
  if (questionsRes.error) { console.error(questionsRes.error); return []; }
  const allowed = new Set<string>();
  (questionsRes.data || []).forEach((row: { skill_id: string | null }) => {
    if (row.skill_id) allowed.add(row.skill_id);
  });
  return ((skillsRes.data || []) as Skill[]).filter((s) => allowed.has(s.id));
}

export async function fetchLevelsForSkill(skillId: string): Promise<Level[]> {
  const { data, error } = await supabase.from("levels").select("*").eq("skill_id", skillId).order("sort_order");
  if (error) { console.error(error); return []; }
  return (data || []) as Level[];
}

export async function fetchAllLevels(): Promise<Level[]> {
  const { data, error } = await supabase.from("levels").select("*").order("sort_order");
  if (error) { console.error(error); return []; }
  return (data || []) as Level[];
}

export async function ensureLevel(skillId: string, name: string): Promise<Level | null> {
  const { data: existing } = await supabase.from("levels").select("*").eq("skill_id", skillId).eq("name", name).maybeSingle();
  if (existing) return existing as Level;
  const order = parseInt(name.replace(/[^0-9]/g, ""), 10) || 0;
  const { data, error } = await supabase.from("levels").insert({ skill_id: skillId, name, sort_order: order }).select().single();
  if (error) { console.error(error); return null; }
  return data as Level;
}

export async function ensureSkill(name: string): Promise<Skill | null> {
  const { data: existing } = await supabase.from("skills").select("*").eq("name", name).maybeSingle();
  if (existing) return existing as Skill;
  const { data, error } = await supabase.from("skills").insert({ name, sort_order: 99 }).select().single();
  if (error) { console.error(error); return null; }
  return data as Skill;
}

export async function fetchSkillById(id: string): Promise<Skill | null> {
  const { data, error } = await supabase.from("skills").select("*").eq("id", id).maybeSingle();
  if (error) { console.error(error); return null; }
  return (data as Skill) || null;
}

/** Super-admin updates the per-skill exam config (unlock code, duration, attempts). */
export async function updateSkillExamConfig(
  skillId: string,
  cfg: { exam_access_code: string | null; exam_duration_min: number; max_attempts: number },
) {
  return supabase.from("skills").update(cfg as any).eq("id", skillId);
}

export async function fetchStudents(campusId?: string): Promise<Student[]> {
  let q = supabase.from("students").select("*").order("name");
  if (campusId) q = q.eq("campus_id", campusId);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return (data || []) as Student[];
}

export async function findStudent(studentExternalId: string, name: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("student_id", studentExternalId.trim())
    .ilike("name", name.trim())
    .maybeSingle();
  if (error) { console.error(error); return null; }
  return (data as Student) || null;
}

export async function insertStudents(
  rows: { student_id: string; name: string; email: string | null; campus_id: string; access_code?: string | null }[],
) {
  if (rows.length === 0) return { count: 0, error: null };
  // Default the login credential to the Student ID when the CSV omits it.
  const normalised = rows.map((r) => ({
    ...r,
    access_code: r.access_code && r.access_code.trim() ? r.access_code.trim() : r.student_id,
  }));
  let { error } = await supabase.from("students").upsert(normalised as any, { onConflict: "campus_id,student_id" });
  // Fall back gracefully if the access_code column is not in the schema yet.
  if (error && /access_code|column|schema cache/i.test(error.message || "")) {
    const bare = rows.map((r) => ({ student_id: r.student_id, name: r.name, email: r.email, campus_id: r.campus_id }));
    ({ error } = await supabase.from("students").upsert(bare, { onConflict: "campus_id,student_id" }));
  }
  return { count: rows.length, error };
}

/** Resolves a Campus row by id (used to auto-resolve a student's campus on login). */
export async function fetchCampusById(id: string): Promise<Campus | null> {
  const { data, error } = await supabase.from("campuses").select("*").eq("id", id).maybeSingle();
  if (error) { console.error(error); return null; }
  return (data as Campus) || null;
}

/**
 * Logs a student in with Student ID + access credential. Campus is resolved
 * automatically. Both typed values and stored values are normalised (leading/
 * trailing whitespace trimmed only — inner spaces are preserved, so a name like
 * "Student 9" stays intact). The credential is accepted if it matches the
 * student's access_code, their name, or their Student ID.
 */
export async function loginStudent(
  studentExternalId: string,
  accessCode: string,
): Promise<{ student: Student; campus: Campus } | null> {
  const normalize = (value: unknown) => String(value ?? "").trim();
  const id = normalize(studentExternalId);
  const code = normalize(accessCode);
  if (!id || !code) return null;

  const { data, error } = await supabase.from("students").select("*").eq("student_id", id);
  if (error || !data || data.length === 0) return null;

  const matches = (data as Student[]).filter((s) => {
    if (normalize(s.student_id) !== id) return false;
    const acceptedCredentials = [s.access_code, s.name, s.student_id].map(normalize).filter(Boolean);
    return acceptedCredentials.includes(code);
  });
  // 0 = wrong credential; >1 = same ID+code across campuses (cannot disambiguate).
  if (matches.length !== 1) return null;

  const student = matches[0];
  const campus = await fetchCampusById(student.campus_id);
  if (!campus) return null;
  return { student, campus };
}

export async function deleteStudent(id: string) {
  return supabase.from("students").delete().eq("id", id);
}

// ---------- Questions ----------

export async function fetchAllQuestions(): Promise<Question[]> {
  const { data, error } = await supabase.from("questions").select("*").order("created_at");
  if (error) { console.error(error); return []; }
  return (data || []).map(rowToQuestion);
}

export async function fetchQuestionsForQuiz(skillId: string, levelId: string, quizNumber: number): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("skill_id", skillId)
    .eq("level_id", levelId)
    .eq("quiz_number", quizNumber)
    .order("created_at");
  if (error) { console.error(error); return []; }
  return (data || []).map(rowToQuestion);
}

export async function fetchQuizzesForLevel(skillId: string, levelId: string): Promise<{ quizNumber: number; questionCount: number }[]> {
  const { data, error } = await supabase.from("questions").select("quiz_number").eq("skill_id", skillId).eq("level_id", levelId);
  if (error) { console.error(error); return []; }
  const map = new Map<number, number>();
  (data || []).forEach((r: any) => map.set(r.quiz_number, (map.get(r.quiz_number) || 0) + 1));
  return Array.from(map.entries()).map(([quizNumber, questionCount]) => ({ quizNumber, questionCount })).sort((a, b) => a.quizNumber - b.quizNumber);
}

export interface QuestionInsert {
  quiz_name: string;
  kc: string;
  kc_name: string;
  type: string;
  question: string;
  code: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_idx: number;
  explanation: string;
  wrong_a: string;
  wrong_b: string;
  wrong_c: string;
  skill_id?: string | null;
  level_id?: string | null;
  quiz_number?: number;
  topic?: string;
  sub_topic?: string;
  recommended_remediation_beginner?: string;
  recommended_remediation_intermediate?: string;
  mastery_indicator?: string;
}

export async function insertQuestions(rows: QuestionInsert[]) {
  if (rows.length === 0) return { count: 0, error: null };
  const { error } = await supabase.from("questions").insert(rows);
  return { count: rows.length, error };
}

export async function updateQuestion(id: string, row: QuestionInsert) {
  return supabase.from("questions").update(row).eq("id", id);
}

export async function deleteQuestion(id: string) {
  return supabase.from("questions").delete().eq("id", id);
}

export async function deleteQuizByName(quizName: string) {
  return supabase.from("questions").delete().eq("quiz_name", quizName);
}

// ---------- Submissions ----------

export async function saveSubmission(sub: Omit<DBSubmission, "id" | "date">) {
  const base = {
    student_name: sub.studentName,
    student_id: sub.studentExternalId || "",
    student_uuid: sub.studentUuid || null,
    campus_id: sub.campusId || null,
    skill_id: sub.skillId || null,
    level_id: sub.levelId || null,
    quiz_number: sub.quizNumber || 1,
    quiz_name: sub.quizName,
    duration_sec: sub.durationSec,
    mcq_correct: sub.mcqCorrect,
    mcq_total: sub.mcqTotal,
    score_pct: sub.scorePct,
    weakest_kc: sub.weakestKC,
    kc_scores: sub.kcScores as any,
    ai_report: sub.aiReport,
    answers: sub.answers as any,
  };
  const withIntegrity = {
    ...base,
    violations: sub.violations ?? 0,
    termination_reason: sub.terminationReason ?? null,
  };

  let res = await supabase.from("submissions").insert(withIntegrity as any).select().single();
  // Fall back gracefully if the integrity columns are not in the schema cache yet.
  if (res.error && /violations|termination_reason|column|schema cache/i.test(res.error.message || "")) {
    res = await supabase.from("submissions").insert(base).select().single();
  }
  return { data: res.data, error: res.error };
}

/**
 * Attaches the generated AI report to an already-saved submission row.
 * Updates only ai_report — never the answers / score / integrity columns — so
 * it is safe to run asynchronously after the submission has been persisted.
 */
export async function updateSubmissionReport(id: string, aiReport: string) {
  return supabase.from("submissions").update({ ai_report: aiReport }).eq("id", id);
}

// ---------- Exam sessions (Super Admin generated unlock codes) ----------

export interface ExamSession {
  id: string;
  campus_id: string | null;
  skill_id: string;
  level_id: string | null;
  quiz_number: number;
  code: string;
  duration_sec: number;
  max_attempts: number;
  starts_at: string;
  ends_at: string;
  status: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateExamSessionInput {
  campusId: string | null;
  skillId: string;
  levelId: string | null;
  quizNumber: number;
  durationSec: number;
  maxAttempts: number;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  createdBy?: string | null;
}

export interface ExamSessionValidation {
  valid: boolean;
  message: string;
  session: ExamSession | null;
}

// exam_sessions postdates the generated Supabase types — access it untyped.
const examSessions = () => (supabase as any).from("exam_sessions");

/** Random, unambiguous, uppercase alphanumeric code (excludes 0/O/1/I). */
export function generateExamSessionCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const size = Math.max(6, length);
  const bytes = new Uint32Array(size);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < size; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Creates an exam session, generating a unique code (retries on collision). */
export async function createExamSession(
  input: CreateExamSessionInput,
): Promise<{ data: ExamSession | null; error: string | null }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateExamSessionCode();
    const { data, error } = await examSessions()
      .insert({
        campus_id: input.campusId,
        skill_id: input.skillId,
        level_id: input.levelId,
        quiz_number: input.quizNumber,
        code,
        duration_sec: input.durationSec,
        max_attempts: input.maxAttempts,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        status: "active",
        created_by: input.createdBy ?? null,
      })
      .select()
      .single();
    if (!error && data) return { data: data as ExamSession, error: null };
    // Unique-violation on code → regenerate and retry; anything else → report.
    if (error && /duplicate|unique/i.test(error.message || "")) continue;
    return { data: null, error: error?.message || "Could not create the exam session." };
  }
  return { data: null, error: "Could not generate a unique code — please try again." };
}

/** Sessions visible to an admin. A campus admin sees only their campus + global. */
export async function fetchActiveExamSessionsForAdmin(opts: {
  isSuper: boolean;
  campusId: string | null;
}): Promise<ExamSession[]> {
  let q = examSessions().select("*").order("created_at", { ascending: false });
  if (!opts.isSuper && opts.campusId) {
    q = q.or(`campus_id.eq.${opts.campusId},campus_id.is.null`);
  }
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return (data || []) as ExamSession[];
}

/** Closes a session so its code can no longer start new exams. */
export async function closeExamSession(sessionId: string) {
  return examSessions().update({ status: "closed" }).eq("id", sessionId);
}

/** Validates a code a student typed before starting an exam. */
export async function validateExamSessionCode(input: {
  code: string;
  campusId: string | null;
  skillId: string;
  levelId: string | null;
  quizNumber: number;
}): Promise<ExamSessionValidation> {
  const code = input.code.trim().toUpperCase();
  if (!code) return { valid: false, message: "Enter the exam session code.", session: null };

  const { data, error } = await examSessions().select("*").eq("code", code).maybeSingle();
  if (error) return { valid: false, message: "Could not verify the code — please try again.", session: null };
  if (!data) return { valid: false, message: "Invalid exam code. Check with your invigilator.", session: null };

  const s = data as ExamSession;
  if (s.status !== "active") return { valid: false, message: "This exam session has been closed.", session: null };

  const now = Date.now();
  if (now < new Date(s.starts_at).getTime())
    return { valid: false, message: "This exam has not started yet.", session: null };
  if (now > new Date(s.ends_at).getTime())
    return { valid: false, message: "This exam code has expired.", session: null };

  if (s.campus_id && input.campusId && s.campus_id !== input.campusId)
    return { valid: false, message: "This code is not valid for your campus.", session: null };
  if (s.skill_id !== input.skillId)
    return { valid: false, message: "This code is for a different skill.", session: null };
  if (s.level_id && input.levelId && s.level_id !== input.levelId)
    return { valid: false, message: "This code is for a different level.", session: null };
  if (s.quiz_number !== input.quizNumber)
    return { valid: false, message: "This code is for a different quiz.", session: null };

  return { valid: true, message: "Code accepted.", session: s };
}

/**
 * Counts how many times a student has already attempted a specific quiz.
 * Used to enforce the one-attempt rule (configurable via skills.max_attempts).
 */
export async function countAttempts(
  studentUuid: string,
  skillId: string,
  levelId: string,
  quizNumber: number,
): Promise<number> {
  if (!studentUuid || !skillId || !levelId) return 0;
  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("student_uuid", studentUuid)
    .eq("skill_id", skillId)
    .eq("level_id", levelId)
    .eq("quiz_number", quizNumber);
  if (error) { console.error(error); return 0; }
  return count ?? 0;
}

export async function fetchSubmissions(filters?: { campusId?: string; studentUuid?: string; skillId?: string }): Promise<DBSubmission[]> {
  let q = supabase.from("submissions").select("*").order("created_at", { ascending: false });
  if (filters?.campusId) q = q.eq("campus_id", filters.campusId);
  if (filters?.studentUuid) q = q.eq("student_uuid", filters.studentUuid);
  if (filters?.skillId) q = q.eq("skill_id", filters.skillId);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return (data || []).map(rowToSubmission);
}

export async function fetchSubmissionsByStudentName(studentName: string): Promise<DBSubmission[]> {
  const trimmed = studentName.trim();
  if (!trimmed) return [];
  const { data, error } = await supabase.from("submissions").select("*").ilike("student_name", trimmed).order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data || []).map(rowToSubmission);
}

export async function deleteSubmission(id: string) {
  return supabase.from("submissions").delete().eq("id", id);
}
