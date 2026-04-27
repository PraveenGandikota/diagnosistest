import { describe, expect, it } from "vitest";
import { normalizeQuestionType, type Question } from "./quiz-types";
import { pickQuestions } from "./quiz-store";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q",
    kc: "KC-01",
    kcName: "String iteration",
    quizName: "Sample Quiz",
    type: "Multiple-choice (MCQ)",
    question: "Pick the best answer.",
    code: "",
    options: ["Correct", "Wrong A", "Wrong B"],
    correct: 0,
    explanation: "Because it is correct.",
    wrongDiagnosis: ["diag A", "diag B"],
    ...overrides,
  };
}

describe("normalizeQuestionType", () => {
  it("maps legacy type names into the shared item taxonomy", () => {
    expect(normalizeQuestionType("Reading")).toBe("Multiple-choice (MCQ)");
    expect(normalizeQuestionType("Tweaking")).toBe("Code completion");
    expect(normalizeQuestionType("Fixing bug")).toBe("Code modification");
  });
});

describe("pickQuestions", () => {
  it("uses the KC-specific item-type preference when there is no explicit priority", () => {
    const picked = pickQuestions([
      makeQuestion({
        id: "mcq",
        kc: "KC-02",
        kcName: "Correct vowel set (no y)",
        type: "Multiple-choice (MCQ)",
      }),
      makeQuestion({
        id: "fill",
        kc: "KC-02",
        kcName: "Correct vowel set (no y)",
        type: "Fill in the blank",
      }),
    ]);

    expect(picked).toHaveLength(1);
    expect(picked[0].id).toBe("fill");
  });

  it("filters by quiz name and picks the priority item type for each KC", () => {
    const picked = pickQuestions([
      makeQuestion({
        id: "other-quiz",
        kc: "KC-01",
        quizName: "Other Quiz",
        type: "Debugging",
      }),
      makeQuestion({
        id: "priority-carrier",
        kc: "KC-01",
        quizName: "Target Quiz",
        type: "Code modification",
        priority: "KC-01_Debugging the question",
      }),
      makeQuestion({
        id: "priority-target",
        kc: "KC-01",
        quizName: "Target Quiz",
        type: "Debugging",
      }),
    ], {
      quizName: "Target Quiz",
      targetCount: 1,
    });

    expect(picked).toHaveLength(1);
    expect(picked[0].id).toBe("priority-target");
  });

  it("returns one item per KC in KC order without randomization", () => {
    const picked = pickQuestions([
      makeQuestion({ id: "kc02", kc: "KC-02", kcName: "KC 02" }),
      makeQuestion({ id: "kc01", kc: "KC-01", kcName: "KC 01" }),
      makeQuestion({ id: "kc03", kc: "KC-03", kcName: "KC 03" }),
    ]);

    expect(picked.map((question) => question.id)).toEqual(["kc01", "kc02", "kc03"]);
  });
});
