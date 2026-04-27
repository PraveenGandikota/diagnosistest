import { describe, expect, it } from "vitest";
import { buildQuestionFeedback, cleanFeedbackText, getStudentTopic } from "./student-feedback";
import type { Question } from "./quiz-types";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    kc: "KC-01",
    kcName: "Default parameter syntax and behavior",
    quizName: "Subscription Cost Calculation with Default Parameters",
    type: "Debugging",
    question: "Fix the function so it uses the default argument correctly.",
    code: "",
    options: ["A", "B", "C", "D"],
    correct: 0,
    explanation: "Default values should be declared in the function signature so the caller can still override them.",
    wrongDiagnosis: [
      "Missing KC-01 — hardcodes a specific value, still ignores caller",
      "No understanding — unrelated change",
      "Guessing — this does not fix the function contract",
    ],
    ...overrides,
  };
}

describe("cleanFeedbackText", () => {
  it("removes KC-specific wording from stored diagnoses", () => {
    expect(cleanFeedbackText("Missing KC-01 — hardcodes a specific value, still ignores caller"))
      .toBe("Hardcodes a specific value, still ignores caller.");
  });
});

describe("getStudentTopic", () => {
  it("maps a default-argument topic to an official Python docs resource", () => {
    const topic = getStudentTopic({ topic: "Default parameter syntax and behavior" });
    expect(topic.resource.url).toContain("default-argument-values");
  });
});

describe("buildQuestionFeedback", () => {
  it("returns student-facing feedback without KC references", () => {
    const feedback = buildQuestionFeedback(makeQuestion(), 1, false);
    expect(feedback.headline).toBe("You missed an important concept here.");
    expect(feedback.professionalRemark).not.toContain("KC-");
    expect(feedback.recommendation.toLowerCase()).toContain("default parameter");
  });
});
