import { supabase } from "@/integrations/supabase/client";
import type { Question, KCId } from "./quiz-types";
import { getTopicDisplayName, normalizeQuestionType } from "./quiz-types";

export interface DBSubmissionAnswer {
  qid: string;
  kc: string;
  kcName?: string;
  type: string;
  question: string;
  correct: boolean;
  selectedIdx: number;
  correctIdx: number;
  options: string[];
}

export interface DBSubmission {
  id: string;
  studentName: string;
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

function rowToQuestion(row: any): Question {
  const options = [row.option_a, row.option_b, row.option_c, row.option_d].filter(
    (opt) => opt !== null && opt !== undefined,
  );
  const correctIdx = Math.max(0, Math.min(row.correct_idx ?? 0, options.length - 1));
  const wrongs = [row.wrong_a, row.wrong_b, row.wrong_c].map((w) => w || "Not quite.");
  // Re-index wrongs by option position: the CSV stores 3 wrong diagnoses in the order of
  // wrong options (skipping the correct one). Convert to an array indexed by option index
  // so option shuffling stays correct.
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
    type: normalizeQuestionType(row.type),
    question: row.question,
    code: row.code || "",
    options,
    correct: correctIdx,
    explanation: row.explanation || "",
    wrongDiagnosis,
  };
}

export async function fetchAllQuestions(): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("fetchAllQuestions error", error);
    return [];
  }
  return (data || []).map(rowToQuestion);
}

export async function fetchQuizNames(): Promise<string[]> {
  const { data, error } = await supabase.from("questions").select("quiz_name");
  if (error) return [];
  const names = new Set<string>();
  (data || []).forEach((row: any) => names.add(row.quiz_name || "General"));
  return Array.from(names).sort();
}

export async function fetchQuestionsForQuiz(quizName: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_name", quizName)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map(rowToQuestion);
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

export async function saveSubmission(sub: Omit<DBSubmission, "id" | "date">) {
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      student_name: sub.studentName,
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

function rowToSubmission(row: any): DBSubmission {
  const kcScores = (row.kc_scores || {}) as Record<string, { correct: number; total: number }>;
  const answers = (row.answers || []) as DBSubmissionAnswer[];
  const missed = new Set<string>();
  answers.forEach((answer) => {
    if (!answer.correct) missed.add(answer.kcName || answer.kc);
  });

  return {
    id: row.id,
    studentName: row.student_name,
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

export async function fetchSubmissions(): Promise<DBSubmission[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map(rowToSubmission);
}

export async function fetchSubmissionsByStudentName(studentName: string): Promise<DBSubmission[]> {
  const trimmedName = studentName.trim();
  if (!trimmedName) return [];

  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .ilike("student_name", trimmedName)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return (data || []).map(rowToSubmission);
}

export async function deleteSubmission(id: string) {
  return supabase.from("submissions").delete().eq("id", id);
}
