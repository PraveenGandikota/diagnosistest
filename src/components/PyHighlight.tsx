/**
 * Lightweight Python syntax highlighter — no external lib needed.
 * Outputs spans with semantic classes that map to the design system.
 */
const KEYWORDS = new Set([
  "def","return","for","in","if","elif","else","while","break","continue",
  "import","from","as","class","try","except","finally","raise","with",
  "pass","lambda","yield","not","and","or","is","None","True","False","global","nonlocal",
]);

const BUILTINS = new Set([
  "print","len","range","str","int","float","list","dict","set","tuple","bool","input","sum","map","filter",
  "abs","min","max","sorted","reversed","enumerate","zip","type","isinstance",
]);

interface Props {
  code: string;
  withLineNumbers?: boolean;
  className?: string;
}

export const PyHighlight = ({ code, withLineNumbers = true, className = "" }: Props) => {
  const lines = code.replace(/\t/g, "    ").split("\n");
  return (
    <pre className={`overflow-x-auto rounded-md bg-[hsl(var(--terminal-bg))] p-4 text-sm leading-relaxed text-foreground ${className}`}>
      <code className="font-mono">
        {lines.map((line, idx) => (
          <div key={idx} className="flex">
            {withLineNumbers && (
              <span className="mr-4 inline-block w-6 select-none text-right text-muted-foreground">
                {idx + 1}
              </span>
            )}
            <span className="flex-1 whitespace-pre">{tokenize(line)}</span>
          </div>
        ))}
      </code>
    </pre>
  );
};

function tokenize(line: string) {
  const out: React.ReactNode[] = [];
  // Split on tokens preserving them
  const re = /(#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|([^\sA-Za-z_0-9"'#]+)/g;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(line))) {
    const [tok, comment, str, num, ident, ws, sym] = m;
    if (comment) out.push(<span key={key++} style={{ color: "hsl(var(--muted-foreground))", fontStyle: "italic" }}>{tok}</span>);
    else if (str) out.push(<span key={key++} style={{ color: "hsl(var(--success))" }}>{tok}</span>);
    else if (num) out.push(<span key={key++} style={{ color: "hsl(var(--warning))" }}>{tok}</span>);
    else if (ident) {
      if (KEYWORDS.has(ident)) out.push(<span key={key++} style={{ color: "hsl(var(--primary))", fontWeight: 600 }}>{tok}</span>);
      else if (BUILTINS.has(ident)) out.push(<span key={key++} style={{ color: "hsl(265 89% 70%)" }}>{tok}</span>);
      else out.push(<span key={key++}>{tok}</span>);
    } else if (ws) out.push(<span key={key++}>{tok}</span>);
    else if (sym) out.push(<span key={key++} style={{ color: "hsl(var(--muted-foreground))" }}>{tok}</span>);
  }
  return out;
}
