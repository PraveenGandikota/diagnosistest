import { create } from "zustand";
import type { Question, KCId } from "./quiz-types";
import { ALL_KCS } from "./quiz-types";

export interface AnswerRecord {
  qid: string;
  kc: KCId;
  type: string;
  question: string;
  options: string[];
  selectedIdx: number;
  correctIdx: number;
  correct: boolean;
}

export interface CCRecord {
  ccid: 1 | 2;
  code: string;
  passed: boolean;
  passedCount: number;
  totalCount: number;
  kcsDemonstrated: KCId[];
  kcsMissed: KCId[];
}

export interface QuizSession {
  studentName: string;
  studentId: string;
  questions: Question[];
  currentIdx: number;
  answers: AnswerRecord[];
  startTime: number | null;
  cc: CCRecord[];
  finished: boolean;
}

interface State {
  session: QuizSession;
  setStudent: (n: string, id: string) => void;
  startQuiz: (qs: Question[]) => void;
  recordAnswer: (a: AnswerRecord) => void;
  nextQuestion: () => void;
  recordCC: (rec: CCRecord) => void;
  finish: () => void;
  reset: () => void;
}

const empty: QuizSession = {
  studentName: "",
  studentId: "",
  questions: [],
  currentIdx: 0,
  answers: [],
  startTime: null,
  cc: [],
  finished: false,
};

export const useQuiz = create<State>((set) => ({
  session: empty,
  setStudent: (n, id) => set((s) => ({ session: { ...s.session, studentName: n, studentId: id } })),
  startQuiz: (qs) => set((s) => ({
    session: {
      ...s.session,
      questions: qs,
      currentIdx: 0,
      answers: [],
      cc: [],
      finished: false,
      startTime: Date.now(),
    },
  })),
  recordAnswer: (a) => set((s) => ({ session: { ...s.session, answers: [...s.session.answers, a] } })),
  nextQuestion: () => set((s) => ({ session: { ...s.session, currentIdx: s.session.currentIdx + 1 } })),
  recordCC: (rec) => set((s) => ({ session: { ...s.session, cc: [...s.session.cc, rec] } })),
  finish: () => set((s) => ({ session: { ...s.session, finished: true } })),
  reset: () => set({ session: empty }),
}));

export function computeKCScores(answers: AnswerRecord[]): Record<KCId, { correct: number; total: number }> {
  const out = {} as Record<KCId, { correct: number; total: number }>;
  ALL_KCS.forEach((kc) => (out[kc] = { correct: 0, total: 0 }));
  answers.forEach((a) => {
    out[a.kc].total++;
    if (a.correct) out[a.kc].correct++;
  });
  return out;
}

export function pickQuestions(bank: Question[], targetCount = 12): Question[] {
  // Group by KC, sample up to ceil(target/kcs) per KC, then top up
  const byKC = new Map<KCId, Question[]>();
  bank.forEach((q) => {
    if (!byKC.has(q.kc)) byKC.set(q.kc, []);
    byKC.get(q.kc)!.push(q);
  });
  const shuffled = (a: Question[]) => [...a].sort(() => Math.random() - 0.5);
  const perKC = Math.max(1, Math.ceil(targetCount / byKC.size));
  let picked: Question[] = [];
  for (const [, qs] of byKC) {
    picked.push(...shuffled(qs).slice(0, perKC));
  }
  picked = shuffled(picked).slice(0, targetCount);
  if (picked.length < targetCount) {
    const remaining = bank.filter((q) => !picked.includes(q));
    picked.push(...shuffled(remaining).slice(0, targetCount - picked.length));
  }
  return picked;
}
