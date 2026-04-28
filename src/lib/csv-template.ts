// Sample CSV template for question uploads.
// Headers map directly to Supabase `questions` table columns.

export const SAMPLE_CSV_HEADERS = [
  "quiz_name",
  "kc",
  "kc_name",
  "type",
  "question",
  "code",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_idx",
  "explanation",
  "wrong_a",
  "wrong_b",
  "wrong_c",
] as const;

const SAMPLE_ROWS: string[][] = [
  [
    "Module 1: Variables & Types",
    "KC-01",
    "Variables and Assignment",
    "Multiple-choice (MCQ)",
    "Which statement correctly assigns the value 10 to a variable named x?",
    "",
    "x = 10",
    "10 = x",
    "x := 10",
    "let x = 10",
    "0",
    "In Python, variables are assigned using the = operator with the variable name on the left.",
    "Assignment direction is variable on the left, value on the right.",
    ":= is the walrus operator, used inside expressions, not for normal assignment.",
    "Python does not use the let keyword.",
  ],
  [
    "Module 1: Variables & Types",
    "KC-02",
    "Data Types",
    "Multiple-choice (MCQ)",
    "What is the type of the value 3.14 in Python?",
    "",
    "int",
    "float",
    "str",
    "bool",
    "1",
    "Numbers with a decimal point are float in Python.",
    "int is for whole numbers without a decimal point.",
    "str is for text wrapped in quotes.",
    "bool only stores True or False.",
  ],
  [
    "Module 2: Control Flow",
    "KC-03",
    "If/Else Statements",
    "Debugging",
    "What does this code print?",
    "x = 5\nif x > 3:\n    print('big')\nelse:\n    print('small')",
    "big",
    "small",
    "Error",
    "Nothing",
    "0",
    "Since 5 > 3 is True, the if branch runs and prints 'big'.",
    "The else branch only runs when the condition is False.",
    "The code is syntactically valid, no error occurs.",
    "A print statement always produces output.",
  ],
];

function escapeCsvCell(value: string): string {
  const str = value ?? "";
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function buildSampleCsv(): string {
  const lines = [SAMPLE_CSV_HEADERS.join(",")];
  for (const row of SAMPLE_ROWS) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  return lines.join("\n");
}

export function downloadSampleCsv() {
  const blob = new Blob([buildSampleCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quiz_questions_template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
