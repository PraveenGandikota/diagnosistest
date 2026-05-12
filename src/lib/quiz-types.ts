export type QuestionType =
  | "Multiple-choice (MCQ)"
  | "Fill in the blank"
  | "Code completion"
  | "Code modification"
  | "Debugging";

// KCs are now free-form strings (KC code from CSV); legacy KC-01..KC-12 still work.
export type KCId = string;

export interface Question {
  id: string;
  kc: KCId;
  kcName: string;
  topic?: string;
  subTopic?: string;
  skillId?: string | null;
  levelId?: string | null;
  quizNumber?: number;
  quizName?: string;
  priority?: string;
  type: QuestionType;
  question: string;
  code: string;
  options: string[];
  correct: number;
  explanation: string;
  wrongDiagnosis: string[];
}

export const QUESTION_TYPES: QuestionType[] = [
  "Multiple-choice (MCQ)",
  "Fill in the blank",
  "Code completion",
  "Code modification",
  "Debugging",
];

const LEGACY_QUESTION_TYPE_MAP: Record<string, QuestionType> = {
  "multiple-choice (mcq)": "Multiple-choice (MCQ)",
  "multiple choice (mcq)": "Multiple-choice (MCQ)",
  "multiple choice": "Multiple-choice (MCQ)",
  "mcq": "Multiple-choice (MCQ)",
  "reading": "Multiple-choice (MCQ)",
  "fill in the blank": "Fill in the blank",
  "fill in the blanks": "Fill in the blank",
  "code completion": "Code completion",
  "tweaking": "Code completion",
  "code modification": "Code modification",
  "fixing bug": "Code modification",
  "debugging": "Debugging",
};

export function normalizeQuestionType(type: string | undefined | null): QuestionType {
  const normalized = (type || "").trim().toLowerCase();
  return LEGACY_QUESTION_TYPE_MAP[normalized] ?? "Multiple-choice (MCQ)";
}

export function getTopicDisplayName(kc: string | undefined | null, kcName?: string | undefined | null) {
  const n = (kcName || "").trim();
  if (n && n.toLowerCase() !== "imported") return n;
  return (kc || "").trim() || "General";
}

// Kept for backward-compat with quiz-store.
export const ALL_KCS: KCId[] = [];
export function getKCTypePriority(_kc: KCId, _type: string | undefined | null): number { return 0; }
export function getPriorityQuestionType(_priority: string | undefined | null): QuestionType | null { return null; }
