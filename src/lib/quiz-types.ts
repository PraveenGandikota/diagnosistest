export type QuestionType =
  | "Fixing bug"
  | "Fill in the blank"
  | "Reading"
  | "Debugging"
  | "Tweaking";

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
