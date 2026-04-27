import csvText from "@/data/grit-pool-sheet8.csv?raw";
import type { Question } from "./quiz-types";
import { parseQuestionCsv } from "./question-import";

export const SEED_QUESTIONS: Question[] = parseQuestionCsv(
  csvText,
  "Grit Quiz Pool",
);
