import { create } from "zustand";
import type { KCId, Question } from "./quiz-types";
import { ALL_KCS, getKCTypePriority, normalizeQuestionType } from "./quiz-types";

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

type RandomFn = () => number;

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
    out[a.kc].total += 1;
    if (a.correct) out[a.kc].correct += 1;
  });
  return out;
}

export function shuffleArray<T>(items: T[], rng: RandomFn = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function shuffleQuestionOptions(question: Question, rng: RandomFn = Math.random): Question {
  const decorated = question.options.map((text, idx) => {
    const isCorrect = idx === question.correct;
    const wrongIdx = idx < question.correct ? idx : idx - 1;
    return {
      text,
      isCorrect,
      diagnosis: isCorrect ? null : question.wrongDiagnosis[wrongIdx],
    };
  });

  const shuffled = shuffleArray(decorated, rng);
  const correct = shuffled.findIndex((option) => option.isCorrect);
  const wrongDiagnosis = shuffled
    .filter((option) => !option.isCorrect)
    .map((option) => option.diagnosis ?? "Not quite.") as [string, string, string];

  return {
    ...question,
    options: shuffled.map((option) => option.text) as [string, string, string, string],
    correct: correct as 0 | 1 | 2 | 3,
    wrongDiagnosis,
  };
}

/**
 * Pick questions for a quiz session.
 * Strategy:
 *   1. One question from every KC first (round 1) for full coverage.
 *   2. If more slots remain, do additional rounds, again one per KC.
 *   3. Within each KC, use the KC's preferred item-type ordering.
 *   4. Randomize option positions per session so the correct answer
 *      is not pinned to the same letter across the bank.
 */
export function pickQuestions(bank: Question[], targetCount = 12, rng: RandomFn = Math.random): Question[] {
  const byKC = new Map<KCId, Question[]>();
  bank.forEach((question) => {
    const normalizedQuestion = {
      ...question,
      type: normalizeQuestionType(question.type),
    };
    if (!byKC.has(normalizedQuestion.kc)) byKC.set(normalizedQuestion.kc, []);
    byKC.get(normalizedQuestion.kc)?.push(normalizedQuestion);
  });

  for (const [, questions] of byKC) {
    const randomized = shuffleArray(questions, rng);
    randomized.sort((a, b) => getKCTypePriority(a.kc, a.type) - getKCTypePriority(b.kc, b.type));
    questions.splice(0, questions.length, ...randomized);
  }

  const cursors = new Map<KCId, number>();
  byKC.forEach((_, kc) => cursors.set(kc, 0));
  const kcOrder = shuffleArray(Array.from(byKC.keys()), rng);

  const picked: Question[] = [];
  let progress = true;
  while (picked.length < targetCount && progress) {
    progress = false;
    for (const kc of kcOrder) {
      if (picked.length >= targetCount) break;
      const idx = cursors.get(kc) ?? 0;
      const list = byKC.get(kc) ?? [];
      if (idx < list.length) {
        picked.push(list[idx]);
        cursors.set(kc, idx + 1);
        progress = true;
      }
    }
  }

  return picked.map((question) => shuffleQuestionOptions(question, rng));
}
