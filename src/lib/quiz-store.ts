import { create } from "zustand";
import type { KCId, Question } from "./quiz-types";

export interface AnswerRecord {
  qid: string; kc: KCId; kcName?: string; type: string;
  question: string; options: string[];
  selectedIdx: number; correctIdx: number; correct: boolean;
}

export interface QuizSession {
  studentName: string;
  quizName: string;
  skillId: string | null;
  levelId: string | null;
  quizNumber: number;
  questions: Question[];
  currentIdx: number;
  answers: AnswerRecord[];
  startTime: number | null;
  finished: boolean;
}

interface State {
  session: QuizSession;
  setStudent: (name: string) => void;
  startQuiz: (questions: Question[], info: { quizName: string; skillId: string | null; levelId: string | null; quizNumber: number }) => void;
  recordAnswer: (a: AnswerRecord) => void;
  nextQuestion: () => void;
  finish: () => void;
  reset: () => void;
}

const empty: QuizSession = {
  studentName: "", quizName: "", skillId: null, levelId: null, quizNumber: 1,
  questions: [], currentIdx: 0, answers: [], startTime: null, finished: false,
};

export const useQuiz = create<State>((set) => ({
  session: empty,
  setStudent: (name) => set((s) => ({ session: { ...s.session, studentName: name } })),
  startQuiz: (questions, info) => set((s) => ({
    session: { ...s.session, ...info, questions: shuffleAll(questions), currentIdx: 0, answers: [], finished: false, startTime: Date.now() },
  })),
  recordAnswer: (a) => set((s) => ({ session: { ...s.session, answers: [...s.session.answers, a] } })),
  nextQuestion: () => set((s) => ({ session: { ...s.session, currentIdx: s.session.currentIdx + 1 } })),
  finish: () => set((s) => ({ session: { ...s.session, finished: true } })),
  reset: () => set({ session: empty }),
}));

export function computeKCScores(answers: AnswerRecord[]): Record<string, { correct: number; total: number }> {
  const out: Record<string, { correct: number; total: number }> = {};
  answers.forEach((a) => {
    const key = a.kcName || a.kc;
    if (!out[key]) out[key] = { correct: 0, total: 0 };
    out[key].total += 1;
    if (a.correct) out[key].correct += 1;
  });
  return out;
}

function shuffleAll(questions: Question[]): Question[] {
  return questions.map(shuffleQuestionOptions);
}

function shuffleQuestionOptions(q: Question): Question {
  const n = q.options.length;
  if (n <= 1) return q;
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    correct: order.indexOf(q.correct),
    wrongDiagnosis: order.map((i) => q.wrongDiagnosis[i] ?? ""),
  };
}
