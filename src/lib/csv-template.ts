// CSV templates for Super Admin uploads.

const QUESTION_HEADERS = [
  "skill", "level", "quiz_number",
  "kc", "topic", "sub_topic", "type",
  "question", "code",
  "option_a", "option_b", "option_c", "option_d",
  "correct_option",
  "option_a_diagnosis", "option_b_diagnosis", "option_c_diagnosis", "option_d_diagnosis",
  "explanation",
  "recommended_remediation_for_beginner",
  "recommended_remediation_for_intermediate",
  "mastery_indicator",
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
    "Correct — that is exactly what decomposition is.",
    "That is pattern recognition, not decomposition.",
    "That is abstraction.",
    "That is algorithm design.",
    "Decomposition is the process of breaking a complex problem into smaller, manageable parts.",
    "Start by listing the parts of a small everyday task (e.g., making tea) and identify each step before moving to code.",
    "Practice breaking a medium-sized programming problem into 3-5 sub-problems and write a one-line goal for each.",
    "Can independently break a new problem into well-scoped sub-problems and explain how each one contributes to the whole.",
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
    "Correct — reusing a known solution shape is the essence of pattern recognition.",
    "That is abstraction, not pattern recognition.",
    "That is decomposition.",
    "Translation is unrelated to pattern recognition.",
    "Pattern recognition lets us reuse solutions across similar problems.",
    "Solve two simple problems back-to-back (e.g., sum of list, average of list) and circle the steps that repeat.",
    "Compare two solved problems from different domains and write down the shared structure as a reusable template.",
    "Can spot a familiar structure inside a new problem and adapt a known solution with minimal rework.",
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
