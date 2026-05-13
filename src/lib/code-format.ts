const PLACEHOLDER_VALUES = new Set(["", "na", "n/a", "-", "none", "null", "undefined"]);

export function hasRenderableCode(code: string | null | undefined): boolean {
  if (code == null) return false;
  const t = code.trim().toLowerCase();
  if (PLACEHOLDER_VALUES.has(t)) return false;
  return true;
}

export function formatCodeBlock(code: string | null | undefined): string {
  if (!code) return "";
  let s = code.replace(/\r\n?/g, "\n");
  s = s.replace(/\\n/g, "\n");
  s = s.replace(/\\t/g, "\t");

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
