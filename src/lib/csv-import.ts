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

const COLUMN_ALIASES: Record<string, string[]> = {
  quiz_name: ["quiz_name", "quizname", "quiz", "module", "module_name"],
  kc: ["kc", "kc_id", "kcid", "topic_id", "topicid"],
  kc_name: ["kc_name", "kcname", "topic", "topic_name", "topicname"],
  type: ["type", "question_type", "questiontype", "item_category"],
  question: ["question", "question_text", "questiontext", "item"],
  code: ["code", "code_snippet"],
  option_a: ["option_a", "optiona", "a"],
  option_b: ["option_b", "optionb", "b"],
  option_c: ["option_c", "optionc", "c"],
  option_d: ["option_d", "optiond", "d"],
  correct_idx: ["correct_idx", "correctidx", "correct", "correct_option", "answer"],
  explanation: ["explanation", "rationale", "kc_description", "topic_description"],
  wrong_a: ["wrong_a", "wronga", "diagnosis_a", "diagnosisa"],
  wrong_b: ["wrong_b", "wrongb", "diagnosis_b", "diagnosisb"],
  wrong_c: ["wrong_c", "wrongc", "diagnosis_c", "diagnosisc"],
};

function findIndex(headers: string[], target: string): number {
  const aliases = COLUMN_ALIASES[target] || [target];
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (aliases.some((a) => norm(a) === h)) return i;
  }
  return -1;
}

function parseCorrectIdx(value: string): number {
  const trimmed = (value || "").trim();
  if (!trimmed) return 0;
  const upper = trimmed.toUpperCase();
  const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  if (letterMap[upper] !== undefined) return letterMap[upper];
  const num = parseInt(trimmed, 10);
  return Number.isFinite(num) ? num : 0;
}

export interface ParseResult {
  rows: QuestionInsert[];
  errors: string[];
}

export function parseQuestionCsv(text: string, defaultQuizName = "Imported Quiz"): ParseResult {
  const matrix = parseCsv(text);
  const errors: string[] = [];
  if (matrix.length < 2) {
    return { rows: [], errors: ["CSV must contain a header row and at least one question."] };
  }
  const headers = matrix[0];
  const idx = {
    quiz_name: findIndex(headers, "quiz_name"),
    kc: findIndex(headers, "kc"),
    kc_name: findIndex(headers, "kc_name"),
    type: findIndex(headers, "type"),
    question: findIndex(headers, "question"),
    code: findIndex(headers, "code"),
    option_a: findIndex(headers, "option_a"),
    option_b: findIndex(headers, "option_b"),
    option_c: findIndex(headers, "option_c"),
    option_d: findIndex(headers, "option_d"),
    correct_idx: findIndex(headers, "correct_idx"),
    explanation: findIndex(headers, "explanation"),
    wrong_a: findIndex(headers, "wrong_a"),
    wrong_b: findIndex(headers, "wrong_b"),
    wrong_c: findIndex(headers, "wrong_c"),
  };

  const required: (keyof typeof idx)[] = ["question", "option_a", "option_b", "correct_idx"];
  for (const r of required) {
    if (idx[r] === -1) errors.push(`Missing required column: ${r}`);
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: QuestionInsert[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const get = (i: number) => (i >= 0 && i < cells.length ? (cells[i] || "").trim() : "");
    const question = get(idx.question);
    if (!question) continue;
    rows.push({
      quiz_name: get(idx.quiz_name) || defaultQuizName,
      kc: get(idx.kc) || "KC-01",
      kc_name: get(idx.kc_name) || "Python fundamentals",
      type: get(idx.type) || "Multiple-choice (MCQ)",
      question,
      code: get(idx.code),
      option_a: get(idx.option_a),
      option_b: get(idx.option_b),
      option_c: get(idx.option_c),
      option_d: get(idx.option_d),
      correct_idx: parseCorrectIdx(get(idx.correct_idx)),
      explanation: get(idx.explanation),
      wrong_a: get(idx.wrong_a),
      wrong_b: get(idx.wrong_b),
      wrong_c: get(idx.wrong_c),
    });
  }
  return { rows, errors };
}
