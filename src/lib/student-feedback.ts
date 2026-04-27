import type { AnswerRecord } from "@/lib/quiz-store";
import type { Question } from "@/lib/quiz-types";
import { getTopicDisplayName } from "@/lib/quiz-types";

export interface LearningResource {
  title: string;
  url: string;
  reason: string;
}

export interface TopicBreakdown {
  topic: string;
  description: string;
  correct: number;
  total: number;
  pct: number;
  resource: LearningResource;
}

export interface ImprovementPlanItem {
  topic: string;
  observation: string;
  recommendation: string;
}

export interface ImprovementReport {
  summary: string;
  improvementPlan: ImprovementPlanItem[];
  nextSteps: string[];
}

export interface QuestionFeedback {
  topic: string;
  conceptSummary: string;
  headline: string;
  professionalRemark: string;
  recommendation: string;
  resource: LearningResource;
}

interface TopicInput {
  topicCode?: string;
  topic?: string;
  description?: string;
  question?: string;
}

interface TopicResourceMatcher {
  match: RegExp;
  resource: LearningResource;
  recommendation: string;
}

const RESOURCE_MATCHERS: TopicResourceMatcher[] = [
  {
    match: /(default parameter|function signature|optional argument)/i,
    resource: {
      title: "Python docs: default argument values",
      url: "https://docs.python.org/3/tutorial/controlflow.html#default-argument-values",
      reason: "A good refresher on how defaults belong in the function signature, not inside the function body.",
    },
    recommendation: "Review how default arguments are declared in the function signature, then rewrite one example from scratch.",
  },
  {
    match: /(return vs print|return numeric result|return string result|return string literals|three-way conditional return)/i,
    resource: {
      title: "Python docs: defining functions",
      url: "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
      reason: "Useful for revisiting function outputs and the difference between returning a value and printing it.",
    },
    recommendation: "Revise how functions return values, and test a short function by calling it instead of printing inside it.",
  },
  {
    match: /(no input reading|input reading|stdin|parameter passed by the caller)/i,
    resource: {
      title: "Python docs: input()",
      url: "https://docs.python.org/3/library/functions.html#input",
      reason: "Helpful when separating interactive input from reusable function logic.",
    },
    recommendation: "Practice writing functions that accept parameters directly, and keep input() outside the function body.",
  },
  {
    match: /(case-insensitive|lowercase|uppercase|str\.lower)/i,
    resource: {
      title: "Python docs: str.lower()",
      url: "https://docs.python.org/3/library/stdtypes.html#str.lower",
      reason: "A focused reference for normalizing string case before comparisons.",
    },
    recommendation: "Revisit case normalization and test your code with mixed uppercase and lowercase inputs.",
  },
  {
    match: /(membership test|comparison operators| in operator |operator|membership)/i,
    resource: {
      title: "Python docs: membership tests",
      url: "https://docs.python.org/3/reference/expressions.html#membership-test-operations",
      reason: "Good for understanding how in and not in behave with strings, sets, and other containers.",
    },
    recommendation: "Review how the in operator works, then simplify one verbose comparison into a clean membership test.",
  },
  {
    match: /(lookup data structure|algorithmic efficiency|single pass|o\(n\)|set|fast membership)/i,
    resource: {
      title: "Python docs: sets",
      url: "https://docs.python.org/3/tutorial/datastructures.html#sets",
      reason: "Useful for performance-focused questions that rely on fast membership checks.",
    },
    recommendation: "Study when sets improve lookup speed, then refactor one repeated membership check to use a set.",
  },
  {
    match: /(string reversal|vowel-to-digit|non-vowel|result building|digit must be string|string operation|string literals)/i,
    resource: {
      title: "Python docs: string methods and text sequences",
      url: "https://docs.python.org/3/library/stdtypes.html#text-sequence-type-str",
      reason: "Helpful for string slicing, text transformation, and building string results correctly.",
    },
    recommendation: "Revise string operations and rebuild a short text-transformation function with small hand-tested examples.",
  },
  {
    match: /(percentage fee formula|adding fee to base price|use tax parameter|arithmetic|formula)/i,
    resource: {
      title: "Python docs: expressions",
      url: "https://docs.python.org/3/reference/expressions.html",
      reason: "Useful for reviewing arithmetic expressions and how parameter values are used inside formulas.",
    },
    recommendation: "Rework the arithmetic step by step and verify the formula with one or two sample inputs manually.",
  },
  {
    match: /(iteration|loop|array traversal|counter accumulation|dual counter|edge case|approach the question|breaking down the question)/i,
    resource: {
      title: "Python docs: control flow",
      url: "https://docs.python.org/3/tutorial/controlflow.html",
      reason: "A solid refresher for loops, branching, and small algorithm design decisions.",
    },
    recommendation: "Review loop structure and branch logic, then trace one sample input line by line before coding.",
  },
];

const FALLBACK_RESOURCE: LearningResource = {
  title: "Python Tutorial",
  url: "https://docs.python.org/3/tutorial/",
  reason: "A broad Python refresher that is useful when you need to revisit the concept from first principles.",
};

export function buildTopicBreakdown(answers: AnswerRecord[], questions: Question[]): TopicBreakdown[] {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const topics = new Map<string, TopicBreakdown>();

  answers.forEach((answer) => {
    const question = questionById.get(answer.qid);
    const topic = getStudentTopic({
      topicCode: question?.kc || answer.kc,
      topic: question?.kcName || answer.kcName,
      description: question?.explanation,
      question: question?.question || answer.question,
    });

    const existing = topics.get(topic.topic) ?? {
      topic: topic.topic,
      description: topic.description,
      correct: 0,
      total: 0,
      pct: 0,
      resource: topic.resource,
    };

    existing.total += 1;
    if (answer.correct) existing.correct += 1;
    existing.pct = Math.round((existing.correct / existing.total) * 100);
    topics.set(topic.topic, existing);
  });

  return Array.from(topics.values()).sort((a, b) => {
    if (a.pct !== b.pct) return a.pct - b.pct;
    return a.topic.localeCompare(b.topic);
  });
}

export function buildFallbackImprovementReport(topicBreakdown: TopicBreakdown[], scorePct: number): ImprovementReport {
  const weakTopics = topicBreakdown.filter((topic) => topic.pct < 100);

  if (weakTopics.length === 0) {
    return {
      summary: `You completed this quiz with strong accuracy. There are no urgent revision topics, so your next step is to reinforce consistency and speed.`,
      improvementPlan: topicBreakdown.slice(0, 2).map((topic) => ({
        topic: topic.topic,
        observation: `You handled this topic well in this attempt.`,
        recommendation: `Keep this skill sharp by solving one more variation that uses the same idea under slightly different input conditions.`,
      })),
      nextSteps: [
        "Retake the quiz once at a slightly faster pace and check whether your accuracy stays stable.",
        "Pick one solved question and explain the logic aloud before you code it again.",
        "Use the linked reference as a quick review before moving to a harder practice set.",
      ],
    };
  }

  return {
    summary: `Your attempt shows a few clear topics to revisit. Focused revision on the weakest areas should improve your next quiz noticeably.`,
    improvementPlan: weakTopics.slice(0, 4).map((topic) => ({
      topic: topic.topic,
      observation: `Your answers suggest a gap in this topic during the current attempt.`,
      recommendation: `Revise ${topic.topic.toLowerCase()}, then solve one small practice example before retaking the quiz.`,
    })),
    nextSteps: [
      `Start with ${weakTopics[0].topic} and review the rule behind it before writing code.`,
      "Rework at least one missed question without looking at the earlier answer choices.",
      "Return to the quiz after revision and check whether the same mistake pattern disappears.",
    ],
  };
}

export function buildQuestionFeedback(question: Question, selectedIdx: number, isCorrect: boolean): QuestionFeedback {
  const topic = getStudentTopic({
    topicCode: question.kc,
    topic: question.kcName,
    description: question.explanation,
    question: question.question,
  });
  const rawRemark = isCorrect
    ? question.explanation
    : question.wrongDiagnosis[selectedIdx < question.correct ? selectedIdx : selectedIdx - 1] ?? question.explanation;

  const professionalRemark = professionalizeRemark(rawRemark, topic.topic, isCorrect);
  const conceptSummary = topic.description || "This question checks a practical Python coding concept that is worth revisiting carefully.";
  const recommendation = isCorrect
    ? `To reinforce this strength, review ${topic.topic.toLowerCase()} once more and try a slightly different variation of the same pattern.`
    : `${topic.recommendation} Focus on ${topic.topic.toLowerCase()} before your next attempt.`;

  return {
    topic: topic.topic,
    conceptSummary,
    headline: isCorrect ? "Strong answer." : "You missed an important concept here.",
    professionalRemark,
    recommendation,
    resource: topic.resource,
  };
}

export function getStudentTopic(input: TopicInput) {
  const topic = normalizeTopicLabel(input.topicCode, input.topic);
  const description = summarizeDescription(input.description);
  const searchableText = `${topic} ${input.description || ""} ${input.question || ""}`;
  const matched = RESOURCE_MATCHERS.find((entry) => entry.match.test(searchableText));

  return {
    topic,
    description,
    recommendation: matched?.recommendation ?? "Review the underlying Python concept with one short example and then retry a similar question.",
    resource: matched?.resource ?? FALLBACK_RESOURCE,
  };
}

function normalizeTopicLabel(topicCode: string | undefined, topicName: string | undefined) {
  const cleaned = cleanFeedbackText(getTopicDisplayName(topicCode, topicName));
  return cleaned || "Python fundamentals";
}

function summarizeDescription(description: string | undefined) {
  const cleaned = cleanFeedbackText(description || "");
  if (!cleaned) return "";
  const firstSentence = cleaned.match(/[^.!?]+[.!?]?/)?.[0]?.trim() ?? cleaned;
  return ensureSentence(firstSentence);
}

function professionalizeRemark(rawRemark: string, topic: string, isCorrect: boolean) {
  const cleaned = cleanFeedbackText(rawRemark);
  if (isCorrect) {
    return cleaned
      ? `You applied ${topic.toLowerCase()} correctly. ${ensureSentence(cleaned)}`
      : `You applied ${topic.toLowerCase()} correctly in this question.`;
  }

  if (!cleaned) {
    return `Your selected option does not fully apply ${topic.toLowerCase()} in the way this question expects.`;
  }

  if (/does not address|not valid|no understanding/i.test(cleaned)) {
    return `Your selected option does not address the core ${topic.toLowerCase()} logic expected here.`;
  }

  return `Your selected option suggests a gap in ${topic.toLowerCase()}. ${ensureSentence(cleaned)}`;
}

export function cleanFeedbackText(value: string) {
  return ensureSentence(
    value
      .replace(/\[correct\]/gi, "")
      .replace(/Demonstrates\s+KC-\d+\s+mastery/gi, "")
      .replace(/Missing\s+KC-\d+\s*[\u2013\u2014-]\s*/gi, "")
      .replace(/KC-\d+\s*[\u2013\u2014-]\s*/gi, "")
      .replace(/\bKC-(\d+)\b/gi, "Topic $1")
      .replace(/\bknowledge concepts?\b/gi, "topics")
      .replace(/\bKCs\b/g, "topics")
      .replace(/\bKC\b/g, "topic")
      .replace(/No understanding\s*[\u2013\u2014-]?\s*/gi, "This option does not address the core issue. ")
      .replace(/Guessing\s*[\u2013\u2014-]?\s*/gi, "This option does not address the expected reasoning. ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function ensureSentence(value: string) {
  if (!value) return "";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}
