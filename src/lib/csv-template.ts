// CSV templates for Super Admin uploads.

const QUESTION_HEADERS = [
  "skill", "level", "quiz_number",
  "kc", "topic", "sub_topic", "type",
  "question", "code",
  "option_a", "option_b", "option_c", "option_d",
  "correct_option",
  "wrong_a_diagnosis", "wrong_b_diagnosis", "wrong_c_diagnosis",
  "explanation",
];

const QUESTION_SAMPLE: string[][] = [
  [
    "Computational Thinking", "L1", "1",
    "KC-01", "Decomposition", "Breaking down a problem", "Multiple-choice (MCQ)",
    "Which of these best describes decomposition?", "",
    "Breaking a problem into smaller parts",
    "Finding the same pattern in different problems",
    "Removing irrelevant detail",
    "Writing step-by-step instructions",
    "A",
    "Correct — that is pattern recognition.",
    "That is abstraction.",
    "That is algorithm design.",
    "Decomposition is the process of breaking a complex problem into smaller, manageable parts.",
  ],
  [
    "Computational Thinking", "L1", "2",
    "KC-02", "Pattern Recognition", "Spotting similarities", "Multiple-choice (MCQ)",
    "Pattern recognition helps you...", "",
    "Use the same solution for similar problems",
    "Hide implementation details",
    "Decompose a problem into subproblems",
    "Translate code to another language",
    "A",
    "That is abstraction.",
    "That is decomposition.",
    "Translation is unrelated.",
    "Pattern recognition lets us reuse solutions across similar problems.",
  ],
];

const STUDENT_HEADERS = ["campus", "student_id", "name", "email"];

const STUDENT_SAMPLE: string[][] = [
  ["Bangalore Main", "GR-2024-001", "Aarav Sharma", "aarav@example.com"],
  ["Bangalore Main", "GR-2024-002", "Priya Iyer", "priya@example.com"],
  ["Hyderabad", "GR-2024-101", "Rohit Verma", "rohit@example.com"],
];

function escapeCsvCell(value: string): string {
  const str = value ?? "";
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function buildCsv(headers: string[], rows: string[][]): string {
  return [headers.join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))].join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadQuestionTemplate() {
  downloadCsv("questions_template.csv", buildCsv(QUESTION_HEADERS, QUESTION_SAMPLE));
}

export function downloadStudentTemplate() {
  downloadCsv("students_template.csv", buildCsv(STUDENT_HEADERS, STUDENT_SAMPLE));
}

// Back-compat alias used by old Admin code path.
export const downloadSampleCsv = downloadQuestionTemplate;
