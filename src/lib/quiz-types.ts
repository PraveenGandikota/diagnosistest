export type QuestionType =
  | "Multiple-choice (MCQ)"
  | "Fill in the blank"
  | "Code completion"
  | "Code modification"
  | "Debugging";

export type KCId =
  | "KC-01" | "KC-02" | "KC-03" | "KC-04" | "KC-05"
  | "KC-06" | "KC-07" | "KC-08" | "KC-09" | "KC-10";

export interface Question {
  id: string;
  kc: KCId;
  kcName: string;
  type: QuestionType;
  question: string;
  code: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explanation: string;
  wrongDiagnosis: [string, string, string]; // for the 3 wrong options in order
}

export const KC_NAMES: Record<KCId, string> = {
  "KC-01": "String iteration",
  "KC-02": "Correct vowel set (no y)",
  "KC-03": "Case-insensitive matching",
  "KC-04": "Membership test with `in`",
  "KC-05": "Counter accumulation",
  "KC-06": "Lookup data structure",
  "KC-07": "Robustness to non-alpha input",
  "KC-08": "Algorithmic efficiency O(n)",
  "KC-09": "Return vs print",
  "KC-10": "Edge case: 1-char string",
};

export const ALL_KCS = Object.keys(KC_NAMES) as KCId[];

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
  "code completion": "Code completion",
  "tweaking": "Code completion",
  "code modification": "Code modification",
  "fixing bug": "Code modification",
  "debugging": "Debugging",
};

const KC_ITEM_TYPE_PREFERENCES: Record<KCId, QuestionType[]> = {
  "KC-01": ["Code modification", "Code completion", "Debugging", "Fill in the blank", "Multiple-choice (MCQ)"],
  "KC-02": ["Fill in the blank", "Multiple-choice (MCQ)", "Debugging", "Code completion", "Code modification"],
  "KC-03": ["Debugging", "Code modification", "Multiple-choice (MCQ)", "Fill in the blank", "Code completion"],
  "KC-04": ["Code completion", "Fill in the blank", "Code modification", "Debugging", "Multiple-choice (MCQ)"],
  "KC-05": ["Debugging", "Code modification", "Fill in the blank", "Multiple-choice (MCQ)", "Code completion"],
  "KC-06": ["Multiple-choice (MCQ)", "Code completion", "Debugging", "Code modification", "Fill in the blank"],
  "KC-07": ["Multiple-choice (MCQ)", "Debugging", "Code modification", "Fill in the blank", "Code completion"],
  "KC-08": ["Debugging", "Code modification", "Multiple-choice (MCQ)", "Code completion", "Fill in the blank"],
  "KC-09": ["Debugging", "Code modification", "Fill in the blank", "Multiple-choice (MCQ)", "Code completion"],
  "KC-10": ["Code modification", "Debugging", "Multiple-choice (MCQ)", "Fill in the blank", "Code completion"],
};

export function normalizeQuestionType(type: string | undefined | null): QuestionType {
  const normalized = (type || "").trim().toLowerCase();
  return LEGACY_QUESTION_TYPE_MAP[normalized] ?? "Multiple-choice (MCQ)";
}

export function getKCTypePreference(kc: KCId): QuestionType[] {
  return KC_ITEM_TYPE_PREFERENCES[kc] ?? QUESTION_TYPES;
}

export function getKCTypePriority(kc: KCId, type: string | undefined | null): number {
  const normalizedType = normalizeQuestionType(type);
  const preference = getKCTypePreference(kc);
  const idx = preference.indexOf(normalizedType);
  return idx === -1 ? preference.length : idx;
}
