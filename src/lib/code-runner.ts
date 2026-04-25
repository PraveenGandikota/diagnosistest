/**
 * Simulated Python execution for the countVowels challenge.
 * We don't run Python — we run an equivalent JS reference + static analysis
 * on the submitted source to detect KC mastery.
 */
import type { KCId } from "./quiz-types";

export interface TestCase {
  input: string;
  expected: number;
}

export const TEST_CASES: TestCase[] = [
  { input: "nxtwave", expected: 2 },
  { input: "Sky", expected: 0 },
  { input: "AeIoU", expected: 5 },
  { input: "hello123!", expected: 2 },
  { input: "a", expected: 1 },
  { input: "RHYTHM", expected: 0 },
  { input: "", expected: 0 },
];

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const referenceImpl = (s: string) => {
  let n = 0;
  for (const ch of s.toLowerCase()) if (VOWELS.has(ch)) n++;
  return n;
};

export interface RunResult {
  case: TestCase;
  actual: number | string;
  passed: boolean;
}

export interface AnalysisReport {
  results: RunResult[];
  passedCount: number;
  totalCount: number;
  kcsDemonstrated: KCId[];
  kcsMissed: KCId[];
  staticIssues: string[];
}

/** Static analysis of submitted source */
function analyze(source: string): { demonstrated: KCId[]; missed: KCId[]; issues: string[] } {
  const src = source.replace(/#.*$/gm, ""); // strip comments
  const demonstrated: KCId[] = [];
  const missed: KCId[] = [];
  const issues: string[] = [];

  // KC-01 iteration
  if (/for\s+\w+\s+in\s+s\b/.test(src) || /for\s+\w+\s+in\s+s\.lower\(\)/.test(src) || /range\(\s*len\(s\)\s*\)/.test(src)) {
    demonstrated.push("KC-01");
  } else {
    missed.push("KC-01");
    issues.push("KC-01: didn't iterate the full string");
  }

  // KC-02 vowel set: must NOT include y
  if (/['"]aeiouy['"]/.test(src) || /\{[^}]*['"]y['"][^}]*\}/.test(src)) {
    missed.push("KC-02");
    issues.push("KC-02: included 'y' in the vowel set");
  } else if (/aeiou/i.test(src)) {
    demonstrated.push("KC-02");
  } else {
    missed.push("KC-02");
  }

  // KC-03 case-insensitive
  if (/\.lower\(\)/.test(src) || /\.upper\(\)/.test(src) || /AEIOU/.test(src)) {
    demonstrated.push("KC-03");
  } else {
    missed.push("KC-03");
    issues.push("KC-03: no case handling — uppercase letters won't be counted");
  }

  // KC-04 membership with `in`
  if (/\bin\b\s*['"]aeiou['"]/.test(src) || /\bin\b\s*\{/.test(src) || /\bin\b\s*VOWELS/.test(src) || /\bin\b\s*vowels\b/.test(src)) {
    demonstrated.push("KC-04");
  } else if (/==\s*['"]aeiou['"]/.test(src) || /==\s*['"][aeiou]['"]\s*or/.test(src)) {
    missed.push("KC-04");
    issues.push("KC-04: used == instead of `in` for membership");
  } else {
    missed.push("KC-04");
  }

  // KC-05 counter outside loop
  const lines = src.split("\n").map((l) => l.trim());
  let countInitLine = -1;
  let firstForLine = -1;
  lines.forEach((l, i) => {
    if (countInitLine === -1 && /^\s*count\s*=\s*0\b/.test(l)) countInitLine = i;
    if (firstForLine === -1 && /^\s*for\b/.test(l)) firstForLine = i;
  });
  if (countInitLine === -1) {
    missed.push("KC-05");
  } else if (firstForLine !== -1 && countInitLine > firstForLine) {
    missed.push("KC-05");
    issues.push("KC-05: count = 0 is inside the loop — resets each iteration");
  } else {
    demonstrated.push("KC-05");
  }

  // KC-06 efficient lookup (set or short string)
  if (/set\(['"]aeiou['"]\)/.test(src) || /\{['"]a['"]\s*,/.test(src)) {
    demonstrated.push("KC-06");
  } else if (/\[\s*['"]a['"]\s*,/.test(src)) {
    missed.push("KC-06");
    issues.push("KC-06: list lookup is O(n); prefer a set");
  } else {
    demonstrated.push("KC-06"); // short literal "aeiou" is fine
  }

  // KC-07 robustness — fine if no try/except needed and no isalpha guards
  if (/isalpha\(\)/.test(src) || /try:/.test(src)) {
    missed.push("KC-07");
    issues.push("KC-07: over-engineered guards — non-alpha chars simply aren't in the vowel set");
  } else {
    demonstrated.push("KC-07");
  }

  // KC-08 efficiency: no nested for-over-vowels
  if (/for\s+\w+\s+in\s+s.*\n[\s\S]*?for\s+\w+\s+in\s+['"]aeiou/.test(source)) {
    missed.push("KC-08");
    issues.push("KC-08: nested loop is O(5n) — use `in` for O(n)");
  } else {
    demonstrated.push("KC-08");
  }

  // KC-09 return
  if (/\breturn\s+\w+/.test(src)) {
    demonstrated.push("KC-09");
  } else {
    missed.push("KC-09");
    issues.push("KC-09: function never returns — autograders will see None");
  }

  // KC-10: range(0, len) or for ch in s — no range(1, ...)
  if (/range\(\s*1\s*,\s*len\(s\)\s*\)/.test(src)) {
    missed.push("KC-10");
    issues.push("KC-10: range(1, len(s)) skips index 0 — fails on 1-char strings");
  } else {
    demonstrated.push("KC-10");
  }

  return { demonstrated, missed, issues };
}

export function runAndAnalyze(source: string): AnalysisReport {
  const analysis = analyze(source);
  const results: RunResult[] = TEST_CASES.map((tc) => {
    let actual: number | string;
    let passed = false;
    try {
      // Heuristic: if static analysis flags critical issues, simulate the bug
      const out = simulateExecution(source, tc.input);
      actual = out;
      passed = out === tc.expected;
    } catch (e) {
      actual = `Error: ${(e as Error).message}`;
      passed = false;
    }
    return { case: tc, actual, passed };
  });

  return {
    results,
    passedCount: results.filter((r) => r.passed).length,
    totalCount: results.length,
    kcsDemonstrated: analysis.demonstrated,
    kcsMissed: analysis.missed,
    staticIssues: analysis.issues,
  };
}

/**
 * Simulate the student's countVowels by inspecting source and applying
 * the known bug patterns. If the source looks correct, return reference output.
 */
function simulateExecution(source: string, input: string): number {
  const src = source.replace(/#.*$/gm, "");

  // No return → None (we represent as -1 sentinel and treat as fail)
  if (!/\breturn\s+\w+/.test(src)) {
    if (/print\s*\(/.test(src)) return NaN; // prints but doesn't return
    return NaN;
  }

  const includesY = /['"]aeiouy['"]/.test(src);
  const noLower = !/\.lower\(\)/.test(src) && !/AEIOU/.test(src);
  const eqBug = /==\s*['"]aeiou['"]/.test(src);
  const countInsideLoop = (() => {
    const lines = src.split("\n").map((l) => l.trim());
    let initLine = -1, forLine = -1;
    lines.forEach((l, i) => {
      if (initLine === -1 && /^\s*count\s*=\s*0\b/.test(l)) initLine = i;
      if (forLine === -1 && /^\s*for\b/.test(l)) forLine = i;
    });
    return initLine > forLine && forLine !== -1;
  })();
  const offByOneLast = /range\(\s*len\(s\)\s*-\s*1\s*\)/.test(src);
  const offByOneFirst = /range\(\s*1\s*,\s*len\(s\)\s*\)/.test(src);

  if (eqBug) return 0;
  if (countInsideLoop) {
    // Counter resets — final value is 1 if last char is a vowel, else 0
    if (input.length === 0) return 0;
    const last = input[input.length - 1].toLowerCase();
    return "aeiou".includes(last) ? 1 : 0;
  }

  const vowels = includesY ? new Set(["a","e","i","o","u","y"]) : new Set(["a","e","i","o","u"]);
  const target = noLower ? input : input.toLowerCase();
  const stop = offByOneLast ? target.length - 1 : target.length;
  const start = offByOneFirst ? 1 : 0;

  let count = 0;
  for (let i = start; i < stop; i++) {
    if (vowels.has(target[i])) count++;
  }
  return count;
}
