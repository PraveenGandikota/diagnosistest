// Decides whether a `code` value is real, renderable code or just a
// placeholder / identifier that should NOT get a dark code container.

const PLACEHOLDER_VALUES = new Set([
  "", "na", "n/a", "n.a", "-", "--", "—", "none", "null", "nil", "undefined", "tbd",
]);

// Identifier-style labels such as CS001, LR001, PF001, KC-12.
const IDENTIFIER_CODE = /^[a-z]{1,6}[-_ ]?\d{1,6}[a-z]?$/i;

// Characters that almost always indicate actual code.
const CODE_PUNCT = /[(){}\[\];=+\-*/%<>!&|:."'`#\\]/;

export function hasRenderableCode(code: string | null | undefined): boolean {
  if (code == null) return false;
  const t = code.trim();
  if (t === "") return false;

  const lower = t.toLowerCase();
  if (PLACEHOLDER_VALUES.has(lower)) return false;

  // Pure identifier label (CS001 / LR001 / PF001) — not code.
  if (IDENTIFIER_CODE.test(t)) return false;

  // A single bare token with no whitespace and no code punctuation is a
  // label/identifier, not a snippet (e.g. "CS001", "Loops", "General").
  if (!/\s/.test(t) && !CODE_PUNCT.test(t)) return false;

  return true;
}

// Normalises a code string into clean multiline form for display.
export function formatCodeBlock(code: string | null | undefined): string {
  if (!code) return "";
  let s = code.replace(/\r\n?/g, "\n");
  s = s.replace(/\\n/g, "\n");
  s = s.replace(/\\t/g, "\t");

  // Single-line, semicolon-separated statements → one statement per line.
  if (!s.includes("\n") && /;\s*\S/.test(s)) {
    s = s
      .split(";")
      .map((part) => part.trim())
      .filter((part, idx, arr) => part.length > 0 || idx === arr.length - 1)
      .map((part, idx, arr) => (idx === arr.length - 1 ? part : `${part};`))
      .filter((part) => part.length > 0)
      .join("\n");
  }

  return s.replace(/\n{3,}/g, "\n\n").trim();
}
