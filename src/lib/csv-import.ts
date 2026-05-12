import type { QuestionInsert } from "./quiz-db";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"') {
        if (next === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { row.push(cell); cell = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += c;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}

function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const Q_ALIASES: Record<string, string[]> = {
  skill: ["skill", "skill_name", "track"],
  level: ["level", "level_name"],
  quiz_number: ["quiz_number", "quiznumber", "quiz", "quiz_no", "quiz_id"],
  kc: ["kc", "kc_id", "kcid", "kc_diagnosis", "knowledge_component"],
  topic: ["topic", "topic_name"],
  sub_topic: ["sub_topic", "subtopic", "sub_topic_name"],
  type: ["type", "question_type"],
  question: ["question", "question_text", "generated_diagnosis_question"],
  code: ["code", "code_snippet"],
  option_a: ["option_a", "a"],
  option_b: ["option_b", "b"],
  option_c: ["option_c", "c"],
  option_d: ["option_d", "d"],
  correct: ["correct_option", "correct", "correct_idx", "answer"],
  wrong_a: ["option_a_diagnosis", "wrong_a_diagnosis", "wrong_a", "diagnosis_a"],
  wrong_b: ["option_b_diagnosis", "wrong_b_diagnosis", "wrong_b", "diagnosis_b"],
  wrong_c: ["option_c_diagnosis", "wrong_c_diagnosis", "wrong_c", "diagnosis_c"],
  wrong_d: ["option_d_diagnosis", "wrong_d_diagnosis", "wrong_d", "diagnosis_d"],
  explanation: ["explanation", "rationale"],
};

function findIndex(headers: string[], key: string): number {
  const aliases = Q_ALIASES[key] || [key];
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (aliases.some((a) => norm(a) === h)) return i;
  }
  return -1;
}

function parseCorrect(value: string): number {
  const t = (value || "").trim().toUpperCase();
  if (!t) return 0;
  const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  if (map[t] !== undefined) return map[t];
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : 0;
}

export interface ParsedQuestionRow extends QuestionInsert {
  _skillName: string;
  _levelName: string;
}

export interface ParseResult {
  rows: ParsedQuestionRow[];
  errors: string[];
}

export function parseQuestionCsv(text: string): ParseResult {
  const matrix = parseCsv(text);
  if (matrix.length < 2) return { rows: [], errors: ["CSV must contain a header row and at least one question."] };
  const headers = matrix[0];
  const idx = {
    skill: findIndex(headers, "skill"),
    level: findIndex(headers, "level"),
    quiz_number: findIndex(headers, "quiz_number"),
    kc: findIndex(headers, "kc"),
    topic: findIndex(headers, "topic"),
    sub_topic: findIndex(headers, "sub_topic"),
    type: findIndex(headers, "type"),
    question: findIndex(headers, "question"),
    code: findIndex(headers, "code"),
    option_a: findIndex(headers, "option_a"),
    option_b: findIndex(headers, "option_b"),
    option_c: findIndex(headers, "option_c"),
    option_d: findIndex(headers, "option_d"),
    correct: findIndex(headers, "correct"),
    wrong_a: findIndex(headers, "wrong_a"),
    wrong_b: findIndex(headers, "wrong_b"),
    wrong_c: findIndex(headers, "wrong_c"),
    wrong_d: findIndex(headers, "wrong_d"),
    explanation: findIndex(headers, "explanation"),
  };

  const errors: string[] = [];
  for (const r of ["skill", "level", "question", "option_a", "option_b", "correct"] as const) {
    if (idx[r] === -1) errors.push(`Missing required column: ${r}`);
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: ParsedQuestionRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const get = (i: number) => (i >= 0 && i < cells.length ? (cells[i] || "").trim() : "");
    const question = get(idx.question);
    if (!question) continue;
    const skillName = get(idx.skill);
    const levelName = get(idx.level) || "L1";
    const correctIdx = parseCorrect(get(idx.correct));
    // 4 wrong-diagnosis columns: skip the one matching the correct option.
    const allWrongs = [get(idx.wrong_a), get(idx.wrong_b), get(idx.wrong_c), get(idx.wrong_d)];
    const wrongs = allWrongs.filter((_, i) => i !== correctIdx);
    rows.push({
      _skillName: skillName,
      _levelName: levelName,
      quiz_name: `${skillName} - ${levelName} - Quiz ${get(idx.quiz_number) || 1}`,
      kc: get(idx.kc) || "KC",
      kc_name: get(idx.topic) || get(idx.kc) || "Topic",
      topic: get(idx.topic),
      sub_topic: get(idx.sub_topic),
      type: get(idx.type) || "Multiple-choice (MCQ)",
      question,
      code: get(idx.code),
      option_a: get(idx.option_a),
      option_b: get(idx.option_b),
      option_c: get(idx.option_c),
      option_d: get(idx.option_d),
      correct_idx: correctIdx,
      explanation: get(idx.explanation),
      wrong_a: wrongs[0] || "",
      wrong_b: wrongs[1] || "",
      wrong_c: wrongs[2] || "",
      quiz_number: parseInt(get(idx.quiz_number), 10) || 1,
    });
  }
  return { rows, errors };
}

// ---------- Students CSV ----------

const S_ALIASES: Record<string, string[]> = {
  campus: ["campus", "campus_name", "centre", "center"],
  student_id: ["student_id", "studentid", "id", "user_id"],
  name: ["name", "student_name", "full_name"],
  email: ["email", "email_address"],
};

function findStudentIdx(headers: string[], key: string): number {
  const aliases = S_ALIASES[key] || [key];
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (aliases.some((a) => norm(a) === h)) return i;
  }
  return -1;
}

export interface ParsedStudentRow {
  _campusName: string;
  student_id: string;
  name: string;
  email: string | null;
}

export function parseStudentCsv(text: string): { rows: ParsedStudentRow[]; errors: string[] } {
  const matrix = parseCsv(text);
  if (matrix.length < 2) return { rows: [], errors: ["CSV must contain a header row and at least one student."] };
  const headers = matrix[0];
  const idx = {
    campus: findStudentIdx(headers, "campus"),
    student_id: findStudentIdx(headers, "student_id"),
    name: findStudentIdx(headers, "name"),
    email: findStudentIdx(headers, "email"),
  };
  const errors: string[] = [];
  for (const r of ["campus", "student_id", "name"] as const) {
    if (idx[r] === -1) errors.push(`Missing required column: ${r}`);
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: ParsedStudentRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const get = (i: number) => (i >= 0 && i < cells.length ? (cells[i] || "").trim() : "");
    const studentId = get(idx.student_id);
    const name = get(idx.name);
    if (!studentId || !name) continue;
    rows.push({
      _campusName: get(idx.campus),
      student_id: studentId,
      name,
      email: get(idx.email) || null,
    });
  }
  return { rows, errors };
}
