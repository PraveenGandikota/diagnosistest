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

/**
 * Pick questions for a quiz session.
 * Strategy:
 *   1. One question from EVERY KC first (round 1) — full coverage.
 *   2. If more slots remain, do additional rounds, again one per KC.
 *   3. Within each KC, prioritize question types in this order:
 *        Fill in the blank > Tweaking > Fixing bug > Debugging > Reading
 *      (Higher-priority types come first; ties broken randomly.)
 */
const TYPE_PRIORITY: Record<string, number> = {
  "Fill in the blank": 1,
  "Tweaking": 2,
  "Fixing bug": 3,
  "Debugging": 4,
  "Reading": 5,
};

export function pickQuestions(bank: Question[], targetCount = 12): Question[] {
  const byKC = new Map<KCId, Question[]>();
  bank.forEach((q) => {
    if (!byKC.has(q.kc)) byKC.set(q.kc, []);
    byKC.get(q.kc)!.push(q);
  });

  // Sort each KC's questions by type priority, with random tie-break
  for (const [, qs] of byKC) {
    qs.sort((a, b) => {
      const pa = TYPE_PRIORITY[a.type] ?? 99;
      const pb = TYPE_PRIORITY[b.type] ?? 99;
      if (pa !== pb) return pa - pb;
      return Math.random() - 0.5;
    });
  }

  // Round-robin through KCs, taking next-best question from each
  const cursors = new Map<KCId, number>();
  byKC.forEach((_, kc) => cursors.set(kc, 0));
  const kcOrder = Array.from(byKC.keys()).sort(() => Math.random() - 0.5);

  const picked: Question[] = [];
  let progress = true;
  while (picked.length < targetCount && progress) {
    progress = false;
    for (const kc of kcOrder) {
      if (picked.length >= targetCount) break;
      const idx = cursors.get(kc)!;
      const list = byKC.get(kc)!;
      if (idx < list.length) {
        picked.push(list[idx]);
        cursors.set(kc, idx + 1);
        progress = true;
      }
    }
  }
  return picked;
}

