export type QuestionType =
  | "Multiple-choice (MCQ)"
  | "Fill in the blank"
  | "Code completion"
  | "Code modification"
  | "Debugging";

export type KCId =
  | "KC-01" | "KC-02" | "KC-03" | "KC-04" | "KC-05"
  | "KC-06" | "KC-07" | "KC-08" | "KC-09" | "KC-10"
  | "KC-11" | "KC-12";

export interface Question {
  id: string;
  kc: KCId;
  kcName: string;
  quizName?: string;
  priority?: string;
  type: QuestionType;
  question: string;
  code: string;
  options: string[];
  correct: number;
  explanation: string;
  wrongDiagnosis: string[]; // indexed by option position; entry at the correct index is "" and unused
}

export const KC_NAMES: Record<KCId, string> = {
  "KC-01": "KC-01",
  "KC-02": "KC-02",
  "KC-03": "KC-03",
  "KC-04": "KC-04",
  "KC-05": "KC-05",
  "KC-06": "KC-06",
  "KC-07": "KC-07",
  "KC-08": "KC-08",
  "KC-09": "KC-09",
  "KC-10": "KC-10",
  "KC-11": "KC-11",
  "KC-12": "KC-12",
};

export const ALL_KCS = Object.keys(KC_NAMES) as KCId[];

const LEGACY_TOPIC_CODE_PATTERN = /^KC-(\d+)$/i;

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
  "reading question": "Multiple-choice (MCQ)",
  "fill in the blank": "Fill in the blank",
  "fill in the blanks": "Fill in the blank",
  "code completion": "Code completion",
  "tweaking": "Code completion",
  "tweaking the code": "Code completion",
  "code modification": "Code modification",
  "fixing bug": "Code modification",
  "debugging": "Debugging",
  "debugging the question": "Debugging",
};

const DEFAULT_TYPE_PREFERENCE: QuestionType[] = [
  "Code modification",
  "Debugging",
  "Code completion",
  "Fill in the blank",
  "Multiple-choice (MCQ)",
];

const KC_ITEM_TYPE_PREFERENCES: Partial<Record<KCId, QuestionType[]>> = {
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
  return KC_ITEM_TYPE_PREFERENCES[kc] ?? DEFAULT_TYPE_PREFERENCE;
}

export function getKCTypePriority(kc: KCId, type: string | undefined | null): number {
  const normalizedType = normalizeQuestionType(type);
  const preference = getKCTypePreference(kc);
  const idx = preference.indexOf(normalizedType);
  return idx === -1 ? preference.length : idx;
}

export function getPriorityQuestionType(priority: string | undefined | null): QuestionType | null {
  const trimmed = (priority || "").trim();
  if (!trimmed) return null;
  const label = trimmed.includes("_") ? trimmed.split("_").slice(1).join(" ") : trimmed;
  return normalizeQuestionType(label);
}

export function isLegacyTopicCode(value: string | undefined | null) {
  return LEGACY_TOPIC_CODE_PATTERN.test((value || "").trim());
}

export function getTopicDisplayName(kc: string | undefined | null, kcName?: string | undefined | null) {
  const normalizedName = (kcName || "").trim();
  if (normalizedName && !isLegacyTopicCode(normalizedName) && normalizedName.toLowerCase() !== "imported") {
    return normalizedName;
  }

  const normalizedCode = (kc || "").trim();
  const legacyCodeMatch = normalizedCode.match(LEGACY_TOPIC_CODE_PATTERN);
  if (legacyCodeMatch) {
    return `Topic ${legacyCodeMatch[1]}`;
  }

  if (normalizedName && normalizedName.toLowerCase() !== "imported") {
    return normalizedName;
  }

  return normalizedCode || "Python fundamentals";
}
