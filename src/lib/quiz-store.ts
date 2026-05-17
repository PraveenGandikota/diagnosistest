import { create } from "zustand";
import type { KCId, Question } from "./quiz-types";

export interface AnswerRecord {
  qid: string; kc: KCId; kcName?: string; type: string;
  question: string; options: string[];
  selectedIdx: number; correctIdx: number; correct: boolean;
}

export interface QuizSession {
  studentName: string;
  /** External Student ID (display) — saved with the submission. */
  studentExternalId: string | null;
  /** students.id — links the submission to the student row for analytics. */
  studentUuid: string | null;
  /** campuses.id — links the submission to the campus for campus analytics. */
  campusId: string | null;
  quizName: string;
  skillId: string | null;
  levelId: string | null;
  quizNumber: number;
  questions: Question[];
  currentIdx: number;
  /** Selected option index per question (parallel to `questions`); null = unanswered. */
  selections: (number | null)[];
  /** Whether a question has been viewed at least once (parallel to `questions`). */
  visited: boolean[];
  /** Built by finalize() at submit time — consumed by the Result page. */
  answers: AnswerRecord[];
  startTime: number | null;
  finished: boolean;
  /** Internal anti-cheat counter — never shown to the student as a live badge. */
  violations: number;
  /** Set when the exam was auto-submitted by the proctoring rules. */
  terminationReason: string | null;
}

interface State {
  session: QuizSession;
  setStudent: (name: string) => void;
  startQuiz: (
    questions: Question[],
    info: {
      quizName: string;
      skillId: string | null;
      levelId: string | null;
      quizNumber: number;
      studentExternalId: string | null;
      studentUuid: string | null;
      campusId: string | null;
    },
  ) => void;
  selectOption: (optionIdx: number) => void;
  goToQuestion: (idx: number) => void;
  /** Increments the internal violation counter and returns the new total. */
  recordViolation: () => number;
  setTermination: (reason: string) => void;
  /** Converts `selections` into the `answers` array the Result page reads. */
  finalize: () => void;
  reset: () => void;
  // --- legacy helpers kept for backward compatibility ---
  recordAnswer: (a: AnswerRecord) => void;
  nextQuestion: () => void;
  finish: () => void;
}

const empty: QuizSession = {
  studentName: "", studentExternalId: null, studentUuid: null, campusId: null,
  quizName: "", skillId: null, levelId: null, quizNumber: 1,
  questions: [], currentIdx: 0, selections: [], visited: [], answers: [],
  startTime: null, finished: false, violations: 0, terminationReason: null,
};

export const useQuiz = create<State>((set) => ({
  session: empty,

  setStudent: (name) => set((s) => ({ session: { ...s.session, studentName: name } })),

  startQuiz: (questions, info) => set((s) => {
    const shuffled = shuffleAll(questions);
    return {
      session: {
        ...s.session, ...info,
        questions: shuffled,
        currentIdx: 0,
        selections: shuffled.map(() => null),
        visited: shuffled.map((_, i) => i === 0),
        answers: [],
        finished: false,
        startTime: Date.now(),
        violations: 0,
        terminationReason: null,
      },
    };
  }),

  selectOption: (optionIdx) => set((s) => {
    const selections = [...s.session.selections];
    selections[s.session.currentIdx] = optionIdx;
    return { session: { ...s.session, selections } };
  }),

  goToQuestion: (idx) => set((s) => {
    if (idx < 0 || idx >= s.session.questions.length) return s;
    const visited = [...s.session.visited];
    visited[idx] = true;
    return { session: { ...s.session, currentIdx: idx, visited } };
  }),

  recordViolation: () => {
    let count = 0;
    set((s) => {
      count = s.session.violations + 1;
      return { session: { ...s.session, violations: count } };
    });
    return count;
  },

  setTermination: (reason) => set((s) => ({ session: { ...s.session, terminationReason: reason } })),

  finalize: () => set((s) => {
    const answers: AnswerRecord[] = s.session.questions.map((q, i) => {
      const sel = s.session.selections[i];
      return {
        qid: q.id, kc: q.kc, kcName: q.kcName, type: q.type,
        question: q.question, options: q.options,
        selectedIdx: sel ?? -1,
        correctIdx: q.correct,
        correct: sel !== null && sel === q.correct,
      };
    });
    return { session: { ...s.session, answers, finished: true } };
  }),

  reset: () => set({ session: empty }),

  // --- legacy ---
  recordAnswer: (a) => set((s) => ({ session: { ...s.session, answers: [...s.session.answers, a] } })),
  nextQuestion: () => set((s) => ({ session: { ...s.session, currentIdx: s.session.currentIdx + 1 } })),
  finish: () => set((s) => ({ session: { ...s.session, finished: true } })),
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
