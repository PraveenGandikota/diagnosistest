import { describe, expect, it } from "vitest";
import { parseQuestionCsv } from "./question-import";

describe("parseQuestionCsv", () => {
  it("parses the simple quiz format with quiz_name and priority", () => {
    const csv = [
      "quiz_name,kc,kc_name,type,question,code,option_a,option_b,option_c,option_d,correct,explanation,wrong_a,wrong_b,wrong_c,priority",
      "\"Subscription Cost Quiz\",KC-01,\"Default parameters\",Debugging,\"Why is the default ignored?\",\"def calculatePrice(price, tax):\\n    tax = 5\",\"Move default to signature\",\"Change 5 to 10\",\"Remove tax\",\"Use global tax\",A,\"Defaults belong in the signature.\",\"Wrong override\",\"Still hardcoded\",\"Breaks the API\",\"KC-01_Debugging the question\"",
    ].join("\n");

    const questions = parseQuestionCsv(csv, "sample.csv");

    expect(questions).toHaveLength(1);
    expect(questions[0].quizName).toBe("Subscription Cost Quiz");
    expect(questions[0].priority).toBe("KC-01_Debugging the question");
    expect(questions[0].type).toBe("Debugging");
  });

  it("parses the diagnose-sheet format and forward-fills KC metadata", () => {
    const csv = [
      "Question ID,Question Text,KC ID,KC Name,KC Description,Item Category,Item,Option A,Option B,Option C,Option D,Diagnosis A,Diagnosis B,Diagnosis C,Diagnosis D,Priority",
      "\"subscription_cost_calculation_001\",\"### Subscription Cost Calculation\\nDetails\",KC-01,\"Default parameter syntax\",\"Use the default in the signature\",Fixing bug,\"The function ignores the passed tax.\\n\\ndef calculatePrice(price, tax):\\n    tax = 5\\n    return price + (price * tax / 100)\",\"Move tax=5 to the signature [correct]\",\"Change 5 to 10\",\"Remove tax\",\"Use a global\",\"Demonstrates KC-01 mastery\",\"Missing KC-01\",\"Missing KC-01\",\"Missing KC-01\",\"KC-01_Fixing bug\"",
      ",,,,,\"Debugging the question\",\"calculatePrice(100, 10) returns 105. What is the root cause?\",\"Wrong formula\",\"Default is overwritten [correct]\",\"Tax should be a string\",\"Return is missing\",\"Missing KC-01\",\"Demonstrates KC-01 mastery\",\"Missing KC-01\",\"Missing KC-01\",\"KC-01_Debugging the question\"",
    ].join("\n");

    const questions = parseQuestionCsv(csv, "Subscription_Cost_KC_Diagnose.csv");

    expect(questions).toHaveLength(2);
    expect(questions[0].quizName).toBe("Subscription Cost Calculation");
    expect(questions[0].code).toContain("def calculatePrice");
    expect(questions[1].kc).toBe("KC-01");
    expect(questions[1].kcName).toBe("Default parameter syntax");
    expect(questions[1].type).toBe("Debugging");
    expect(questions[1].priority).toBe("KC-01_Debugging the question");
  });

  it("pads to 4 options with a placeholder when only 3 are provided but 4 diagnoses are present", () => {
    const csv = [
      "Question ID,Question Text,KC ID,KC Name,KC Description,Item Category,Item,Option A,Option B,Option C,Diagnosis A,Diagnosis B,Diagnosis C,Diagnosis D,Priority",
      "\"String_Quiz\",\"Prompt text\",KC-01,\"String iteration\",\"Walk every character\",Fixing bug,\"Select the fix\",\"Use s ✓\",\"Use s[:-1]\",\"Use s[1:]\",\"Demonstrates KC-01 mastery\",\"Missing KC-01 a\",\"Missing KC-01 b\",\"Missing KC-01 c\",\"KC-01_Debugging the question\"",
    ].join("\n");

    const questions = parseQuestionCsv(csv, "sheet.csv");

    expect(questions).toHaveLength(1);
    expect(questions[0].quizName).toBe("String Quiz");
    expect(questions[0].options).toHaveLength(4);
    expect(questions[0].options.slice(0, 3)).toEqual(["Use s", "Use s[:-1]", "Use s[1:]"]);
    expect(questions[0].options[3]).toMatch(/Option D|please add/i);
    expect(questions[0].correct).toBe(0);
    expect(questions[0].wrongDiagnosis).toEqual(["Missing KC-01 a", "Missing KC-01 b", "Missing KC-01 c"]);
  });

  it("synthesizes Option D when mastery is at position D and Option D is missing", () => {
    const csv = [
      "Question ID,Question Text,KC ID,KC Name,KC Description,Item Category,Item,Option A,Option B,Option C,Diagnosis A,Diagnosis B,Diagnosis C,Diagnosis D,Priority",
      "\"String_Quiz\",\"Prompt\",KC-03,\"Case-insensitive\",\"Handle both\",Reading question,\"For AeIoU return what?\",\"0\",\"2\",\"3\",\"Missing KC-03 — no case\",\"Missing KC-03 — partial\",\"Missing KC-03 — partial\",\"Demonstrates KC-03 mastery\",\"\"",
    ].join("\n");

    const questions = parseQuestionCsv(csv, "sheet.csv");

    expect(questions).toHaveLength(1);
    expect(questions[0].options).toHaveLength(4);
    expect(questions[0].correct).toBe(3);
    expect(questions[0].options[3]).toMatch(/please add/i);
  });
});
