import { describe, expect, it } from "vitest";
import { normalizeQuestionType, type Question } from "./quiz-types";
import { pickQuestions, shuffleQuestionOptions } from "./quiz-store";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q",
    kc: "KC-01",
    kcName: "String iteration",
    type: "Multiple-choice (MCQ)",
    question: "Pick the best answer.",
    code: "",
    options: ["Correct", "Wrong A", "Wrong B", "Wrong C"],
    correct: 0,
    explanation: "Because it is correct.",
    wrongDiagnosis: ["diag A", "diag B", "diag C"],
    ...overrides,
  };
}

function sequenceRng(values: number[]) {
  let idx = 0;
  return () => {
    const value = values[idx];
    idx += 1;
    return value ?? 0;
  };
}

describe("normalizeQuestionType", () => {
  it("maps legacy type names into the shared item taxonomy", () => {
    expect(normalizeQuestionType("Reading")).toBe("Multiple-choice (MCQ)");
    expect(normalizeQuestionType("Tweaking")).toBe("Code completion");
    expect(normalizeQuestionType("Fixing bug")).toBe("Code modification");
  });
});

describe("shuffleQuestionOptions", () => {
  it("moves the correct answer away from A and keeps wrong feedback aligned", () => {
    const shuffled = shuffleQuestionOptions(
      makeQuestion(),
      sequenceRng([0.75, 0.5, 0]),
    );

    expect(shuffled.correct).toBe(1);
    expect(shuffled.options).toEqual(["Wrong B", "Correct", "Wrong A", "Wrong C"]);
    expect(shuffled.wrongDiagnosis).toEqual(["diag B", "diag A", "diag C"]);
  });
});

describe("pickQuestions", () => {
  it("uses the KC-specific item-type preference instead of a global order", () => {
    const picked = pickQuestions(
      [
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
      ],
      1,
      sequenceRng([0, 0, 0, 0, 0, 0]),
    );

    expect(picked).toHaveLength(1);
    expect(picked[0].id).toBe("fill");
  });
});
