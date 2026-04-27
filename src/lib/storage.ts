import { getTopicDisplayName, normalizeQuestionType, type Question } from "@/lib/quiz-types";
import {
  getMissedKCsFromAnswers,
  getWeakestKCFromScores,
  type KCScoreMap,
} from "@/lib/submission-analytics";
import { SEED_QUESTIONS } from "@/lib/seed-questions";

const KEY_BANK = "quiz_question_bank_extra";
const KEY_BANK_VERSION = "quiz_question_bank_version";
const KEY_SUBS = "quiz_submissions";
const KEY_THEME = "quiz_theme";
const CURRENT_BANK_VERSION = "grit-pool-sheet8-v3-4opts";

export interface SubmissionAnswer {
  qid: string;
  kc: string;
  kcName?: string;
  type: string;
  question: string;
  correct: boolean;
  selectedIdx: number;
  correctIdx: number;
  options: string[];
}

export interface Submission {
  id: string;
  studentName: string;
  quizName: string;
  date: string;
  durationSec: number;
  mcqCorrect: number;
  mcqTotal: number;
  cc1Passed: boolean;
  cc2Passed: boolean;
  scorePct: number;
  weakestKC: string;
  missedKCs: string[];
  kcScores: KCScoreMap;
  aiReport: string;
  answers: SubmissionAnswer[];
}

export const storage = {
  getQuestions(): Question[] {
    ensureQuestionBankVersion();
    try {
      const extra = JSON.parse(localStorage.getItem(KEY_BANK) || "[]") as Question[];
      return dedupeQuestions([...SEED_QUESTIONS, ...extra].map(normalizeQuestion));
    } catch {
      return dedupeQuestions(SEED_QUESTIONS.map(normalizeQuestion));
    }
  },
  setExtraQuestions(extra: Question[]) {
    ensureQuestionBankVersion();
    localStorage.setItem(KEY_BANK, JSON.stringify(dedupeQuestions(extra.map(normalizeQuestion))));
  },
  getExtraQuestions(): Question[] {
    ensureQuestionBankVersion();
    try {
      const extra = JSON.parse(localStorage.getItem(KEY_BANK) || "[]") as Question[];
      return dedupeQuestions(extra.map(normalizeQuestion));
    } catch {
      return [];
    }
  },
  addQuestions(questions: Question[]) {
    const current = storage.getExtraQuestions();
    storage.setExtraQuestions([...current, ...questions]);
  },
  deleteQuestion(id: string) {
    const current = storage.getExtraQuestions().filter((question) => question.id !== id);
    storage.setExtraQuestions(current);
  },
  getSubmissions(): Submission[] {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY_SUBS) || "[]");
      if (!Array.isArray(stored)) return [];
      return stored.map((submission, index) => normalizeSubmission(submission, index));
    } catch {
      return [];
    }
  },
  addSubmission(submission: Submission) {
    const all = storage.getSubmissions();
    all.unshift(submission);
    localStorage.setItem(KEY_SUBS, JSON.stringify(all));
  },
  deleteSubmission(id: string) {
    const all = storage.getSubmissions().filter((submission) => submission.id !== id);
    localStorage.setItem(KEY_SUBS, JSON.stringify(all));
  },
  getTheme(): "dark" | "light" {
    return (localStorage.getItem(KEY_THEME) as "dark" | "light") || "dark";
  },
  setTheme(theme: "dark" | "light") {
    localStorage.setItem(KEY_THEME, theme);
  },
};

function normalizeQuestion(question: Question): Question {
  const kcName = getTopicDisplayName(question.kc, question.kcName);
  return {
    ...question,
    kcName,
    quizName: (question.quizName || "Imported Quiz").trim(),
    priority: (question.priority || "").trim(),
    type: normalizeQuestionType(question.type),
  };
}

function normalizeSubmission(value: unknown, index: number): Submission {
  const raw = isRecord(value) ? value : {};
  const answers = Array.isArray(raw.answers)
    ? raw.answers.map((answer) => normalizeSubmissionAnswer(answer))
    : [];
  const kcScores = buildKCScoreMap(raw.kcScores, answers);
  const normalizedMissedKCs = normalizeTopicList(normalizeStringArray(raw.missedKCs));
  const missedKCs = normalizedMissedKCs.length > 0 ? normalizedMissedKCs : getMissedTopicsFromAnswers(answers);
  const storedWeakest = normalizeString(raw.weakestKC);
  const weakestKC =
    (storedWeakest ? getTopicDisplayName(storedWeakest, storedWeakest) : "") ||
    getWeakestKCFromScores(kcScores) ||
    missedKCs[0] ||
    "--";

  return {
    id: normalizeString(raw.id) || `submission_${index + 1}`,
    studentName: normalizeString(raw.studentName) || "Unknown student",
    quizName: normalizeString(raw.quizName) || "Imported Quiz",
    date: normalizeString(raw.date) || new Date(0).toISOString(),
    durationSec: normalizeNumber(raw.durationSec),
    mcqCorrect: normalizeNumber(raw.mcqCorrect),
    mcqTotal: normalizeNumber(raw.mcqTotal),
    cc1Passed: Boolean(raw.cc1Passed),
    cc2Passed: Boolean(raw.cc2Passed),
    scorePct: normalizeNumber(raw.scorePct),
    weakestKC,
    missedKCs,
    kcScores,
    aiReport: normalizeString(raw.aiReport)
      .replace(/\bKC-(\d+)\b/gi, "Topic $1")
      .replace(/\bknowledge concepts?\b/gi, "topics")
      .replace(/\bKCs\b/g, "topics")
      .replace(/\bKC\b/g, "topic"),
    answers,
  };
}

function normalizeSubmissionAnswer(value: unknown): SubmissionAnswer {
  const raw = isRecord(value) ? value : {};
  const kc = normalizeString(raw.kc);
  return {
    qid: normalizeString(raw.qid),
    kc,
    kcName: getTopicDisplayName(kc, normalizeString(raw.kcName)),
    type: normalizeString(raw.type),
    question: normalizeString(raw.question),
    correct: Boolean(raw.correct),
    selectedIdx: normalizeNumber(raw.selectedIdx),
    correctIdx: normalizeNumber(raw.correctIdx),
    options: Array.isArray(raw.options) ? raw.options.map((option) => String(option ?? "")) : [],
  };
}

function buildKCScoreMap(rawScores: unknown, answers: SubmissionAnswer[]): KCScoreMap {
  const normalized = normalizeKCScoreMap(rawScores);
  if (Object.keys(normalized).length > 0) return normalized;

  return answers.reduce<KCScoreMap>((acc, answer) => {
    const topic = getTopicDisplayName(answer.kc, answer.kcName);
    if (!topic) return acc;
    if (!acc[topic]) acc[topic] = { correct: 0, total: 0 };
    acc[topic].total += 1;
    if (answer.correct) acc[topic].correct += 1;
    return acc;
  }, {});
}

function normalizeKCScoreMap(rawScores: unknown): KCScoreMap {
  if (!isRecord(rawScores)) return {};

  return Object.entries(rawScores).reduce<KCScoreMap>((acc, [kc, value]) => {
    if (!isRecord(value)) return acc;
    const topic = getTopicDisplayName(kc, kc);
    if (!acc[topic]) acc[topic] = { correct: 0, total: 0 };
    acc[topic].correct += normalizeNumber(value.correct);
    acc[topic].total += normalizeNumber(value.total);
    return acc;
  }, {});
}

function getMissedTopicsFromAnswers(answers: SubmissionAnswer[]) {
  const missedTopicCodes = getMissedKCsFromAnswers(answers);
  return normalizeTopicList(
    missedTopicCodes.map((kc) => {
      const answer = answers.find((entry) => entry.kc === kc);
      return getTopicDisplayName(kc, answer?.kcName);
    }),
  );
}

function normalizeTopicList(values: string[]) {
  const seen = new Set<string>();
  values.forEach((value) => {
    const normalized = getTopicDisplayName(value, value);
    if (normalized) seen.add(normalized);
  });
  return Array.from(seen);
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  value.forEach((entry) => {
    const normalized = normalizeString(entry);
    if (normalized) seen.add(normalized);
  });
  return Array.from(seen);
}

function normalizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function dedupeQuestions(questions: Question[]): Question[] {
  const byId = new Map<string, Question>();
  questions.forEach((question) => {
    byId.set(question.id, question);
  });
  return Array.from(byId.values());
}

function ensureQuestionBankVersion() {
  if (localStorage.getItem(KEY_BANK_VERSION) === CURRENT_BANK_VERSION) return;
  localStorage.removeItem(KEY_BANK);
  localStorage.setItem(KEY_BANK_VERSION, CURRENT_BANK_VERSION);
}
