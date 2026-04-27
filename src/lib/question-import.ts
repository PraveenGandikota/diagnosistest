import { getTopicDisplayName, normalizeQuestionType, type KCId, type Question } from "./quiz-types";

type CsvRow = Record<string, string>;

export function exportQuestionsToCsv(questions: Question[]): string {
  const headers = [
    "Question ID",
    "Question Text",
    "Topic ID",
    "Topic Name",
    "Topic Description",
    "Distractors",
    "Student Errors (if any)",
    "Item Category",
    "Item",
    "Option A",
    "Option B",
    "Option C",
    "Option D",
    "Diagnosis A",
    "Diagnosis B",
    "Diagnosis C",
    "Diagnosis D",
    "Priority",
  ];
  const rows = questions.map((q) => {
    const opts = [0, 1, 2, 3].map((i) => q.options[i] ?? "");
    const diagnoses: string[] = [];
    let wrongPtr = 0;
    for (let i = 0; i < 4; i += 1) {
      if (i === q.correct) diagnoses.push("Demonstrates strong understanding of this topic.");
      else diagnoses.push(q.wrongDiagnosis[wrongPtr++] ?? "");
    }
    const item = [q.question, q.code].filter(Boolean).join("\n\n");
    return [
      q.id,
      "",
      serializeTopicId(q.kc),
      q.kcName ?? "",
      q.explanation ?? "",
      "",
      "",
      q.type,
      item,
      opts[0],
      opts[1],
      opts[2],
      opts[3],
      diagnoses[0],
      diagnoses[1],
      diagnoses[2],
      diagnoses[3],
      q.priority ?? "",
    ];
  });
  return [headers, ...rows].map(serializeCsvRow).join("\n");
}

function serializeCsvRow(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",");
}

function escapeCsvCell(value: string): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function parseQuestionCsv(text: string, fileName = "Imported Quiz"): Question[] {
  const rows = toObjectRows(parseDelimitedText(text, guessDelimiter(text)));
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const normalizedHeaders = headers.map(normalizeHeader);
  const fallbackQuizName = prettifyLabel(fileName.replace(/\.[^.]+$/, "")) || "Imported Quiz";

  if (normalizedHeaders.includes("item") && normalizedHeaders.includes("itemcategory")) {
    return parseDiagnoseRows(rows, fallbackQuizName);
  }

  return parseSimpleRows(rows, fallbackQuizName);
}

function normalizeTopicId(value: string | undefined) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  const normalized = trimmed.toUpperCase();
  if (/^KC-\d+$/.test(normalized)) return normalized;

  const topicMatch = normalized.match(/^TOPIC[-_\s]?(\d+)$/);
  if (topicMatch) {
    return `KC-${topicMatch[1].padStart(2, "0")}`;
  }

  return trimmed;
}

function serializeTopicId(value: string) {
  const normalized = normalizeTopicId(value);
  const topicMatch = normalized.match(/^KC-(\d+)$/);
  if (topicMatch) {
    return `topic-${topicMatch[1]}`;
  }
  return value;
}

function parseSimpleRows(rows: CsvRow[], fallbackQuizName: string): Question[] {
  return rows.flatMap((row, idx) => {
    const questionText = getField(row, "question", "item", "questiontext");
    const rawOptionsAll = getRawOptionsAll(row);
    if (!questionText.trim() || rawOptionsAll.every((o) => !o.trim())) return [];

    const diagnoses = [
      getField(row, "diagnosisa"),
      getField(row, "diagnosisb"),
      getField(row, "diagnosisc"),
      getField(row, "diagnosisd"),
    ];
    const correctIdx = getExplicitCorrectIndex(
      getField(row, "correct", "correctoption"),
      rawOptionsAll,
      diagnoses,
    );
    const { options, adjustedCorrect } = finalizeOptions(rawOptionsAll, correctIdx, diagnoses);
    const wrongDiagnosis = diagnoses.some(Boolean)
      ? buildWrongDiagnoses(diagnoses, adjustedCorrect, options.length)
      : buildFallbackWrongDiagnoses([
          getField(row, "wronga"),
          getField(row, "wrongb"),
          getField(row, "wrongc"),
          getField(row, "wrongd"),
        ], options.length - 1);

    const normalizedTopicId = normalizeTopicId(getField(row, "kc", "kcid", "topic", "topicid") || "KC-01");

    return [{
      id: getField(row, "id", "questionid") || `imported_${idx + 1}`,
      quizName: getField(row, "quizname") || fallbackQuizName,
      priority: getField(row, "priority"),
      kc: normalizedTopicId as KCId,
      kcName: getTopicDisplayName(
        normalizedTopicId,
        getField(row, "kcname", "topicname"),
      ),
      type: normalizeQuestionType(getField(row, "type", "questiontype", "itemcategory") || "Multiple-choice (MCQ)"),
      question: normalizeMultilineText(questionText).trim(),
      code: normalizeMultilineText(getField(row, "code")),
      options,
      correct: adjustedCorrect,
      explanation: getField(row, "explanation", "kcdescription", "topicdescription") || "Imported from CSV",
      wrongDiagnosis,
    }];
  });
}

function parseDiagnoseRows(rows: CsvRow[], fallbackQuizName: string): Question[] {
  const context = {
    questionId: "",
    questionText: "",
    kc: "KC-01" as KCId,
    kcName: "",
    kcDescription: "",
    quizName: fallbackQuizName,
  };
  let generated = 0;

  return rows.flatMap((row) => {
    const questionId = getField(row, "questionid", "id");
    const questionText = getField(row, "questiontext", "question");
    const kc = normalizeTopicId(getField(row, "kcid", "kc", "topicid", "topic"));
    const kcName = getField(row, "kcname", "topicname");
    const kcDescription = getField(row, "kcdescription", "topicdescription", "explanation");
    const explicitQuizName = getField(row, "quizname");

    if (questionId) context.questionId = questionId;
    if (questionText) context.questionText = questionText;
    if (kc) context.kc = kc as KCId;
    if (kcName) context.kcName = kcName;
    if (kcDescription) context.kcDescription = kcDescription;
    if (explicitQuizName) {
      context.quizName = explicitQuizName;
    } else if (questionId || questionText) {
      context.quizName = deriveQuizName(questionId, questionText, fallbackQuizName);
    }

    const item = getField(row, "item", "question");
    const rawOptionsAll = getRawOptionsAll(row);
    if (!item.trim() || rawOptionsAll.every((o) => !o.trim())) return [];

    generated += 1;
    const diagnoses = [
      getField(row, "diagnosisa"),
      getField(row, "diagnosisb"),
      getField(row, "diagnosisc"),
      getField(row, "diagnosisd"),
    ];
    const correctIdx = getExplicitCorrectIndex(
      getField(row, "correct", "correctoption"),
      rawOptionsAll,
      diagnoses,
    );
    const { options, adjustedCorrect } = finalizeOptions(rawOptionsAll, correctIdx, diagnoses);
    const split = splitPromptAndCode(item);
    const idBase = context.questionId || `${slugify(context.quizName)}_${context.kc.toLowerCase()}`;

    return [{
      id: `${idBase}_${generated}`,
      quizName: context.quizName || fallbackQuizName,
      priority: getField(row, "priority"),
      kc: context.kc,
      kcName: getTopicDisplayName(context.kc, context.kcName),
      type: normalizeQuestionType(getField(row, "itemcategory", "type") || "Multiple-choice (MCQ)"),
      question: split.question,
      code: split.code,
      options,
      correct: adjustedCorrect,
      explanation: context.kcDescription || "Imported from diagnose sheet",
      wrongDiagnosis: buildWrongDiagnoses(diagnoses, adjustedCorrect, options.length),
    }];
  });
}

const OPTION_D_PLACEHOLDER = "[Option D - please add to CSV]";

function getRawOptionsAll(row: CsvRow): string[] {
  return [
    getField(row, "optiona"),
    getField(row, "optionb"),
    getField(row, "optionc"),
    getField(row, "optiond"),
  ];
}

function finalizeOptions(
  rawOptionsAll: string[],
  correctIdx: number,
  diagnoses: string[] = [],
): { options: string[]; adjustedCorrect: number } {
  const cleaned = rawOptionsAll.map(cleanOptionText);
  const lastNonEmptyOption = (() => {
    for (let i = cleaned.length - 1; i >= 0; i -= 1) {
      if (cleaned[i].length > 0) return i;
    }
    return -1;
  })();
  const lastNonEmptyDiagnosis = (() => {
    for (let i = diagnoses.length - 1; i >= 0; i -= 1) {
      if ((diagnoses[i] || "").trim().length > 0) return i;
    }
    return -1;
  })();
  const cutoff = Math.max(lastNonEmptyOption, correctIdx, lastNonEmptyDiagnosis);
  if (cutoff < 0) return { options: [], adjustedCorrect: 0 };
  const options = cleaned.slice(0, cutoff + 1).map((opt, idx) => {
    if (opt.length > 0) return opt;
    if (idx === correctIdx) return OPTION_D_PLACEHOLDER;
    return `[Option ${String.fromCharCode(65 + idx)} - please add to CSV]`;
  });
  return { options, adjustedCorrect: Math.min(correctIdx, options.length - 1) };
}

function splitPromptAndCode(item: string): { question: string; code: string } {
  const normalized = normalizeMultilineText(item).replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  const codeStart = lines.findIndex((line, idx) => idx > 0 && /^(def|class)\s+/.test(line.trim()));
  if (codeStart <= 0) {
    return { question: normalized, code: "" };
  }

  return {
    question: lines.slice(0, codeStart).join("\n").trim(),
    code: lines.slice(codeStart).join("\n").trim(),
  };
}

function getExplicitCorrectIndex(correctValue: string, rawOptions: string[], diagnoses: string[]): number {
  const byLetter = ({ A: 0, B: 1, C: 2, D: 3 } as Record<string, number>)[correctValue.trim().toUpperCase()];
  if (typeof byLetter === "number") return byLetter;

  const markedOption = rawOptions.findIndex((option) => /\[correct\]|✓/i.test(option));
  if (markedOption >= 0) return markedOption;

  const masteryDiagnosis = diagnoses.findIndex((diagnosis) => /demonstrates|mastery|\[correct\]/i.test(diagnosis));
  if (masteryDiagnosis >= 0) return masteryDiagnosis;
  return 0;
}

function buildWrongDiagnoses(diagnoses: string[], correctIdx: number, optionCount: number): string[] {
  return buildFallbackWrongDiagnoses(
    diagnoses
      .slice(0, optionCount)
      .map((diagnosis) => diagnosis.trim())
      .filter((_, idx) => idx !== correctIdx),
    Math.max(0, optionCount - 1),
  );
}

function buildFallbackWrongDiagnoses(values: string[], expectedCount: number): string[] {
  const out = values.map((value) => value.trim()).filter((value) => value.length > 0);
  while (out.length < expectedCount) out.push("Not quite.");
  return out.slice(0, expectedCount);
}

function cleanOptionText(option: string): string {
  return option.replace(/\s*(\[correct\]|✓)\s*/gi, "").trim();
}

function deriveQuizName(questionId: string, questionText: string, fallbackQuizName: string): string {
  const lines = normalizeMultilineText(questionText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headingLine = lines.find((line) => /^#+\s+/.test(line));
  if (headingLine) {
    return headingLine.replace(/^#+\s*/, "").trim();
  }
  if (questionId) {
    const isHexHash = /^[a-f0-9]{16,}$/i.test(questionId);
    if (!isHexHash) {
      return prettifyLabel(questionId.replace(/_\d+$/, ""));
    }
  }
  const firstLine = lines[0];
  if (firstLine) {
    const truncated = firstLine.length > 60 ? firstLine.slice(0, 57).trimEnd() + "..." : firstLine;
    return truncated;
  }
  return fallbackQuizName;
}

function normalizeMultilineText(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function prettifyLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getField(row: CsvRow, ...keys: string[]): string {
  for (const [header, value] of Object.entries(row)) {
    const normalizedHeader = normalizeHeader(header);
    if (keys.some((key) => normalizedHeader === normalizeHeader(key))) {
      return value ?? "";
    }
  }
  return "";
}

function toObjectRows(rows: string[][]): CsvRow[] {
  const [headers, ...dataRows] = rows;
  if (!headers) return [];

  return dataRows
    .filter((cells) => cells.some((cell) => cell.trim().length > 0))
    .map((cells) => Object.fromEntries(headers.map((header, idx) => [header, cells[idx] ?? ""])));
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function guessDelimiter(text: string): "," | "\t" {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  return firstLine.includes("\t") ? "\t" : ",";
}

function parseDelimitedText(text: string, delimiter: "," | "\t"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === "\"") {
        if (next === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
