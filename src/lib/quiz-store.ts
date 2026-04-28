import { create } from "zustand";
import type { KCId, Question } from "./quiz-types";
import { ALL_KCS, getKCTypePriority, getPriorityQuestionType, normalizeQuestionType } from "./quiz-types";

export interface AnswerRecord {
  qid: string;
  kc: KCId;
  kcName?: string;
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
  quizName: string;
  questions: Question[];
  currentIdx: number;
  answers: AnswerRecord[];
  startTime: number | null;
  cc: CCRecord[];
  finished: boolean;
}

interface State {
  session: QuizSession;
  setStudent: (name: string) => void;
  startQuiz: (questions: Question[], quizName: string) => void;
  recordAnswer: (answer: AnswerRecord) => void;
  nextQuestion: () => void;
  recordCC: (record: CCRecord) => void;
  finish: () => void;
  reset: () => void;
}

export interface PickQuestionsOptions {
  targetCount?: number;
  quizName?: string;
}

const empty: QuizSession = {
  studentName: "",
  quizName: "",
  questions: [],
  currentIdx: 0,
  answers: [],
  startTime: null,
  cc: [],
  finished: false,
};

export const useQuiz = create<State>((set) => ({
  session: empty,
  setStudent: (name) => set((state) => ({ session: { ...state.session, studentName: name } })),
  startQuiz: (questions, quizName) => set((state) => ({
    session: {
      ...state.session,
      quizName,
      questions,
      currentIdx: 0,
      answers: [],
      cc: [],
      finished: false,
      startTime: Date.now(),
    },
  })),
  recordAnswer: (answer) => set((state) => ({ session: { ...state.session, answers: [...state.session.answers, answer] } })),
  nextQuestion: () => set((state) => ({ session: { ...state.session, currentIdx: state.session.currentIdx + 1 } })),
  recordCC: (record) => set((state) => ({ session: { ...state.session, cc: [...state.session.cc, record] } })),
  finish: () => set((state) => ({ session: { ...state.session, finished: true } })),
  reset: () => set({ session: empty }),
}));

export function computeKCScores(answers: AnswerRecord[]): Record<KCId, { correct: number; total: number }> {
  const out = {} as Record<KCId, { correct: number; total: number }>;
  ALL_KCS.forEach((kc) => (out[kc] = { correct: 0, total: 0 }));
  answers.forEach((answer) => {
    if (!out[answer.kc]) out[answer.kc] = { correct: 0, total: 0 };
    out[answer.kc].total += 1;
    if (answer.correct) out[answer.kc].correct += 1;
  });
  return out;
}

export function pickQuestions(bank: Question[], options: PickQuestionsOptions = {}): Question[] {
  const { targetCount, quizName } = options;
  const filteredBank = quizName
    ? bank.filter((question) => question.quizName === quizName)
    : bank;

  const byKC = new Map<KCId, Question[]>();
  filteredBank.forEach((question) => {
    const normalizedQuestion = {
      ...question,
      type: normalizeQuestionType(question.type),
    };
    if (!byKC.has(normalizedQuestion.kc)) byKC.set(normalizedQuestion.kc, []);
    byKC.get(normalizedQuestion.kc)?.push(normalizedQuestion);
  });

  const manualPriorityByKC = new Map<KCId, string>();
  filteredBank.forEach((question) => {
    const priority = (question.priority || "").trim();
    if (priority && !manualPriorityByKC.has(question.kc)) {
      manualPriorityByKC.set(question.kc, priority);
    }
  });

  const picked: Question[] = [];
  for (const kc of ALL_KCS) {
    const questions = byKC.get(kc);
    if (!questions || questions.length === 0) continue;
    const chosen = selectQuestionForKC(questions, manualPriorityByKC.get(kc));
    picked.push(shuffleQuestionOptions(chosen));
  }

  if (typeof targetCount === "number") {
    return picked.slice(0, targetCount);
  }
  return picked;
}

// Pick a random question for the KC, preferring questions whose type matches the
// manual priority (if any) or the configured KC preference. Among the best-matching
// candidates, choose randomly so each attempt surfaces a different question.
function selectQuestionForKC(questions: Question[], priorityText: string | undefined): Question {
  const desiredType = getPriorityQuestionType(priorityText);

  if (desiredType) {
    const matching = questions.filter(
      (q) => normalizeQuestionType(q.type) === desiredType,
    );
    if (matching.length > 0) return randomFrom(matching);
  }

  // Group by the KC type preference rank, then randomly pick from the best-ranked group.
  const byRank = new Map<number, Question[]>();
  for (const q of questions) {
    const rank = getKCTypePriority(q.kc, q.type);
    if (!byRank.has(rank)) byRank.set(rank, []);
    byRank.get(rank)!.push(q);
  }
  const bestRank = Math.min(...byRank.keys());
  return randomFrom(byRank.get(bestRank)!);
}

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffleQuestionOptions(question: Question): Question {
  const n = question.options.length;
  if (n <= 1) return question;

  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return {
    ...question,
    options: order.map((i) => question.options[i]),
    correct: order.indexOf(question.correct),
    wrongDiagnosis: order.map((i) => question.wrongDiagnosis[i] ?? ""),
  };
}
