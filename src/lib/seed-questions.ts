import type { Question } from "./quiz-types";

/**
 * Seed question bank — 10 representative questions covering all 10 KCs.
 * Admins can add more (or upload CSV) via the Admin panel.
 */
export const SEED_QUESTIONS: Question[] = [
  {
    id: "q1", kc: "KC-01", kcName: "String iteration",
    type: "Fixing bug",
    question: "This function should count vowels but skips the last character. Pick the fix.",
    code: `def countVowels(s):
    count = 0
    for i in range(len(s) - 1):   # bug
        if s[i].lower() in "aeiou":
            count += 1
    return count`,
    options: [
      "Change to range(len(s))",
      "Change to range(0, len(s) - 2)",
      "Change to range(1, len(s))",
      "Leave as is, the off-by-one is intentional",
    ],
    correct: 0,
    explanation: "range(len(s)) visits every index 0..n-1. Subtracting 1 skips the last char.",
    wrongDiagnosis: [
      "Missing KC-01 — skips two characters",
      "Missing KC-01 — skips the first character",
      "Missing KC-01 — doesn't iterate the full string",
    ],
  },
  {
    id: "q2", kc: "KC-02", kcName: "Vowel set",
    type: "Reading",
    question: 'What does countVowels("rhythm") return?',
    code: `def countVowels(s):
    vowels = "aeiou"
    count = 0
    for ch in s.lower():
        if ch in vowels:
            count += 1
    return count`,
    options: ["0", "1", "2", "6"],
    correct: 0,
    explanation: '"rhythm" has no a/e/i/o/u — y is NOT a vowel by spec.',
    wrongDiagnosis: [
      "Missing KC-02 — counted y as vowel",
      "Missing KC-02 — counted y twice",
      "Missing KC-02 — counted every character",
    ],
  },
  {
    id: "q3", kc: "KC-03", kcName: "Case-insensitive matching",
    type: "Debugging",
    question: 'countVowels("APPLE") returns 0. What is the root cause?',
    code: `def countVowels(s):
    count = 0
    for ch in s:
        if ch in "aeiou":
            count += 1
    return count`,
    options: [
      "Forgot to lowercase the input — fails on uppercase letters",
      "The 'in' operator is broken for strings",
      "The function is missing a return statement",
      "The for loop iterates over indices, not characters",
    ],
    correct: 0,
    explanation: 'Uppercase A,E,I,O,U are not in "aeiou". Use s.lower() or include both cases.',
    wrongDiagnosis: [
      "Missing KC-03 — misidentifying root cause",
      "Missing KC-03 — misidentifying root cause",
      "Missing KC-03 — misidentifying root cause",
    ],
  },
  {
    id: "q4", kc: "KC-04", kcName: "Membership with `in`",
    type: "Fixing bug",
    question: "Pick the fix for the buggy comparison.",
    code: `def countVowels(s):
    count = 0
    for ch in s.lower():
        if ch == "aeiou":     # bug
            count += 1
    return count`,
    options: [
      'Change to: if ch in "aeiou":',
      'Change to: if ch == "a" or "e" or "i" or "o" or "u":',
      'Change to: if "aeiou" == ch:',
      'Change to: if ch.equals("aeiou"):',
    ],
    correct: 0,
    explanation: "Use the membership operator `in` to test whether ch is one of the vowels.",
    wrongDiagnosis: [
      "Missing KC-04 — `or` chain always truthy",
      "Missing KC-04 — same broken equality, swapped sides",
      "Missing KC-04 — Python strings have no .equals method",
    ],
  },
  {
    id: "q5", kc: "KC-05", kcName: "Counter accumulation",
    type: "Debugging",
    question: 'countVowels("hello") returns 1 instead of 2. What\'s wrong?',
    code: `def countVowels(s):
    for ch in s.lower():
        count = 0           # bug
        if ch in "aeiou":
            count += 1
    return count`,
    options: [
      "count = 0 is inside the loop — it resets every iteration",
      "The vowel set is wrong",
      "The function should use print instead of return",
      "s.lower() returns the wrong type",
    ],
    correct: 0,
    explanation: "Initialize the counter ONCE before the loop; otherwise each iteration resets it.",
    wrongDiagnosis: [
      "Missing KC-05 — vowel set is fine",
      "Missing KC-05 — print/return unrelated",
      "Missing KC-05 — s.lower() returns a string",
    ],
  },
  {
    id: "q6", kc: "KC-06", kcName: "Lookup data structure",
    type: "Tweaking",
    question: "For an input of length 10⁶, which lookup is fastest per character?",
    code: "",
    options: [
      "set: ch in {'a','e','i','o','u'}  → O(1) average",
      "list: ch in ['a','e','i','o','u']  → O(n) per lookup",
      "tuple: ch in ('a','e','i','o','u')  → O(n) per lookup",
      "Lookups all have the same speed in Python",
    ],
    correct: 0,
    explanation: "Sets give O(1) hash-based membership; lists/tuples scan linearly.",
    wrongDiagnosis: [
      "Missing KC-06 — lists scan linearly",
      "Missing KC-06 — tuples scan linearly",
      "Missing KC-06 — they don't",
    ],
  },
  {
    id: "q7", kc: "KC-07", kcName: "Robustness to non-alpha",
    type: "Reading",
    question: 'What does countVowels("hello123!") return?',
    code: `def countVowels(s):
    count = 0
    for ch in s.lower():
        if ch in "aeiou":
            count += 1
    return count`,
    options: ["2", "3", "5", "Crashes on the '!'"],
    correct: 0,
    explanation: "Digits and symbols simply aren't in the vowel set — no special handling needed.",
    wrongDiagnosis: [
      "Missing KC-07 — only e and o are vowels here",
      "Missing KC-07 — counted non-vowels",
      "Missing KC-07 — `in` doesn't crash on symbols",
    ],
  },
  {
    id: "q8", kc: "KC-08", kcName: "Efficiency O(n)",
    type: "Debugging",
    question: "Why does this version time out on a 10⁶-char input?",
    code: `def countVowels(s):
    count = 0
    for ch in s:
        for v in "aeiou":           # nested loop
            if ch.lower() == v:
                count += 1
    return count`,
    options: [
      "Nested loop makes it O(5n); using `in` keeps it O(n) with constant work",
      "Strings can't be that long in Python",
      "ch.lower() is broken",
      "Python can't handle for-loops over a million items",
    ],
    correct: 0,
    explanation: "Replace the inner loop with `if ch.lower() in 'aeiou'` — one pass, constant inner work.",
    wrongDiagnosis: [
      "Missing KC-08 — they can",
      "Missing KC-08 — .lower() works fine",
      "Missing KC-08 — Python handles it; algorithm is the issue",
    ],
  },
  {
    id: "q9", kc: "KC-09", kcName: "Return vs print",
    type: "Debugging",
    question: "The autograder always sees None. Why?",
    code: `def countVowels(s):
    count = 0
    for ch in s.lower():
        if ch in "aeiou":
            count += 1
    print(count)`,
    options: [
      "The function prints but never returns — replace print with return",
      "print is undefined in Python 3",
      "count needs to be declared global",
      "The grader is broken",
    ],
    correct: 0,
    explanation: "Functions without an explicit return give None. Use `return count`.",
    wrongDiagnosis: [
      "Missing KC-09 — print exists",
      "Missing KC-09 — globals not needed",
      "Missing KC-09 — grader is right",
    ],
  },
  {
    id: "q10", kc: "KC-10", kcName: "Edge case: 1-char string",
    type: "Fixing bug",
    question: "This skips a single-character string. Pick the fix.",
    code: `def countVowels(s):
    count = 0
    for i in range(1, len(s)):   # bug
        if s[i].lower() in "aeiou":
            count += 1
    return count`,
    options: [
      "Change to range(len(s)) so index 0 is included",
      "Add a special if len(s) == 1: return 1",
      "Change to range(0, len(s) - 1)",
      "Replace the loop with recursion",
    ],
    correct: 0,
    explanation: "range(1, len(s)) skips index 0. Iterating from 0 handles 1-char strings naturally.",
    wrongDiagnosis: [
      "Missing KC-10 — special-case is unnecessary",
      "Missing KC-10 — also skips the last char",
      "Missing KC-10 — over-engineered",
    ],
  },
];
