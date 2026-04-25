import type { Question } from "@/lib/quiz-types";
import { SEED_QUESTIONS } from "@/lib/seed-questions";

const KEY_BANK = "quiz_question_bank_extra";
const KEY_SUBS = "quiz_submissions";
const KEY_THEME = "quiz_theme";

export interface Submission {
  id: string;
  studentName: string;
  studentId: string;
  date: string;
  durationSec: number;
  mcqCorrect: number;
  mcqTotal: number;
  cc1Passed: boolean;
  cc2Passed: boolean;
  scorePct: number;
  weakestKC: string;
  kcScores: Record<string, { correct: number; total: number }>;
  aiReport: string;
  answers: Array<{
    qid: string;
    kc: string;
    type: string;
    question: string;
    correct: boolean;
    selectedIdx: number;
    correctIdx: number;
    options: string[];
  }>;
}

export const storage = {
  getQuestions(): Question[] {
    try {
      const extra = JSON.parse(localStorage.getItem(KEY_BANK) || "[]") as Question[];
      return [...SEED_QUESTIONS, ...extra];
    } catch {
      return SEED_QUESTIONS;
    }
  },
  setExtraQuestions(extra: Question[]) {
    localStorage.setItem(KEY_BANK, JSON.stringify(extra));
  },
  getExtraQuestions(): Question[] {
    try {
      return JSON.parse(localStorage.getItem(KEY_BANK) || "[]");
    } catch {
      return [];
    }
  },
  addQuestions(qs: Question[]) {
    const cur = storage.getExtraQuestions();
    storage.setExtraQuestions([...cur, ...qs]);
  },
  deleteQuestion(id: string) {
    const cur = storage.getExtraQuestions().filter((q) => q.id !== id);
    storage.setExtraQuestions(cur);
  },
  getSubmissions(): Submission[] {
    try {
      return JSON.parse(localStorage.getItem(KEY_SUBS) || "[]");
    } catch {
      return [];
    }
  },
  addSubmission(s: Submission) {
    const all = storage.getSubmissions();
    all.unshift(s);
    localStorage.setItem(KEY_SUBS, JSON.stringify(all));
  },
  deleteSubmission(id: string) {
    const all = storage.getSubmissions().filter((s) => s.id !== id);
    localStorage.setItem(KEY_SUBS, JSON.stringify(all));
  },
  getTheme(): "dark" | "light" {
    return (localStorage.getItem(KEY_THEME) as "dark" | "light") || "dark";
  },
  setTheme(t: "dark" | "light") {
    localStorage.setItem(KEY_THEME, t);
  },
};
