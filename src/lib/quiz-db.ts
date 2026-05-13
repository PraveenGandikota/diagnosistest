import { supabase } from "@/integrations/supabase/client";
import type { Question, KCId } from "./quiz-types";
import { getTopicDisplayName, normalizeQuestionType } from "./quiz-types";

// ---------- Types ----------

export interface Campus { id: string; name: string; code: string; admin_access_code: string; }
export interface Skill { id: string; name: string; description: string; sort_order: number; }
export interface Level { id: string; skill_id: string; name: string; sort_order: number; }
export interface Student { id: string; student_id: string; name: string; email: string | null; campus_id: string; }

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

export async function insertStudents(rows: { student_id: string; name: string; email: string | null; campus_id: string }[]) {
  if (rows.length === 0) return { count: 0, error: null };
  const { error } = await supabase.from("students").upsert(rows, { onConflict: "campus_id,student_id" });
  return { count: rows.length, error };
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
  const { data, error } = await supabase
    .from("submissions")
    .insert({
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
    })
    .select()
    .single();
  return { data, error };
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
