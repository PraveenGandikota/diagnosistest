export interface RemediationLink {
  title: string;
  url: string;
}

const norm = (s: string | undefined | null) => (s || "").toLowerCase();

interface SkillRule {
  match: (skill: string) => boolean;
  resolve: (topic: string, subTopic: string) => RemediationLink | null;
}

const SQL_RULES: { match: RegExp; link: RemediationLink }[] = [
  { match: /\b(join|inner join|left join|right join|full join|cross join)\b/i, link: { title: "SQL JOIN reference (MDN-style W3Schools)", url: "https://www.w3schools.com/sql/sql_join.asp" } },
  { match: /\b(group by|having|aggregate|count|sum|avg|min|max)\b/i, link: { title: "SQL GROUP BY reference", url: "https://www.w3schools.com/sql/sql_groupby.asp" } },
  { match: /\b(window|partition|over|rank|row_number|lead|lag)\b/i, link: { title: "PostgreSQL window functions", url: "https://www.postgresql.org/docs/current/tutorial-window.html" } },
  { match: /\b(index|primary key|foreign key|constraint|normaliz)/i, link: { title: "SQL constraints & indexes", url: "https://www.w3schools.com/sql/sql_constraints.asp" } },
  { match: /\b(transaction|commit|rollback|isolation|acid)\b/i, link: { title: "PostgreSQL transactions", url: "https://www.postgresql.org/docs/current/tutorial-transactions.html" } },
  { match: /\b(subquery|cte|with)\b/i, link: { title: "Common Table Expressions (PostgreSQL)", url: "https://www.postgresql.org/docs/current/queries-with.html" } },
];

const UI_RULES: { match: RegExp; link: RemediationLink }[] = [
  { match: /\b(flex|flexbox|grid|layout)\b/i, link: { title: "CSS Flexbox guide (MDN)", url: "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Flexbox" } },
  { match: /\b(grid|css grid)\b/i, link: { title: "CSS Grid guide (MDN)", url: "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Grids" } },
  { match: /\b(react|component|jsx|hook|state|props)\b/i, link: { title: "React fundamentals", url: "https://react.dev/learn" } },
  { match: /\b(useeffect|useState|usememo|usecallback|useref)\b/i, link: { title: "React hooks reference", url: "https://react.dev/reference/react/hooks" } },
  { match: /\b(dom|event|listener|querySelector)\b/i, link: { title: "DOM & events (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction" } },
  { match: /\b(html|semantic|element|aria|accessibility)\b/i, link: { title: "HTML basics (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/HTML" } },
  { match: /\b(css|selector|specificity|cascade)\b/i, link: { title: "CSS fundamentals (MDN)", url: "https://developer.mozilla.org/en-US/docs/Learn/CSS/First_steps" } },
  { match: /\b(javascript|js|closure|prototype|async|promise|await)\b/i, link: { title: "JavaScript guide (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" } },
];

const SERVER_RULES: { match: RegExp; link: RemediationLink }[] = [
  { match: /\b(rest|api|endpoint|route|http)\b/i, link: { title: "HTTP & REST overview (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview" } },
  { match: /\b(status code|2\d\d|4\d\d|5\d\d)\b/i, link: { title: "HTTP status codes (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status" } },
  { match: /\b(express|middleware|router)\b/i, link: { title: "Express routing guide", url: "https://expressjs.com/en/guide/routing.html" } },
  { match: /\b(node|nodejs|npm|module|require)\b/i, link: { title: "Node.js learn portal", url: "https://nodejs.org/en/learn" } },
  { match: /\b(auth|jwt|oauth|session|cookie)\b/i, link: { title: "Web authentication overview (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/Security" } },
  { match: /\b(async|promise|callback|event loop)\b/i, link: { title: "Async JavaScript (MDN)", url: "https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous" } },
];

const DSML_RULES: { match: RegExp; link: RemediationLink }[] = [
  { match: /\b(numpy|array|ndarray|broadcast)\b/i, link: { title: "NumPy quickstart", url: "https://numpy.org/doc/stable/user/quickstart.html" } },
  { match: /\b(pandas|dataframe|series|groupby|merge)\b/i, link: { title: "pandas user guide", url: "https://pandas.pydata.org/docs/user_guide/index.html" } },
  { match: /\b(scikit|sklearn|fit|predict|train|test split|classifier|regressor)\b/i, link: { title: "scikit-learn user guide", url: "https://scikit-learn.org/stable/user_guide.html" } },
  { match: /\b(matplotlib|plot|chart|figure|axis)\b/i, link: { title: "Matplotlib tutorials", url: "https://matplotlib.org/stable/tutorials/index.html" } },
  { match: /\b(probability|distribution|statistic|hypothesis|p[- ]value)\b/i, link: { title: "Statistics fundamentals (Khan Academy)", url: "https://www.khanacademy.org/math/statistics-probability" } },
  { match: /\b(regression|classification|clustering|gradient|loss)\b/i, link: { title: "Machine learning intro (Google)", url: "https://developers.google.com/machine-learning/crash-course" } },
];

const GENAI_RULES: { match: RegExp; link: RemediationLink }[] = [
  { match: /\b(prompt|prompt engineering|few[- ]shot|chain[- ]of[- ]thought)\b/i, link: { title: "Anthropic prompt engineering guide", url: "https://docs.anthropic.com/claude/docs/prompt-engineering" } },
  { match: /\b(openai|gpt|chatgpt|completion|chat completion)\b/i, link: { title: "OpenAI quickstart", url: "https://platform.openai.com/docs/quickstart" } },
  { match: /\b(claude|anthropic|messages api)\b/i, link: { title: "Anthropic Claude API overview", url: "https://docs.anthropic.com/claude/docs/intro-to-claude" } },
  { match: /\b(gemini|google ai|vertex)\b/i, link: { title: "Google AI prompt design guide", url: "https://ai.google.dev/gemini-api/docs/prompting-strategies" } },
  { match: /\b(rag|retrieval|vector|embedding|chunk)\b/i, link: { title: "RAG patterns (LangChain docs)", url: "https://python.langchain.com/docs/tutorials/rag/" } },
  { match: /\b(agent|tool use|function call|tool calling)\b/i, link: { title: "Anthropic tool use guide", url: "https://docs.anthropic.com/claude/docs/tool-use" } },
];

const CS_RULES: { match: RegExp; link: RemediationLink }[] = [
  { match: /\b(oop|inheritance|polymorphism|encapsulation|class|object)\b/i, link: { title: "Object-oriented programming overview (MDN)", url: "https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/Classes_in_JavaScript" } },
  { match: /\b(process|thread|scheduling|deadlock|semaphore|mutex)\b/i, link: { title: "Operating systems notes (GeeksforGeeks)", url: "https://www.geeksforgeeks.org/operating-systems/" } },
  { match: /\b(dbms|relational|er diagram|normaliz)\b/i, link: { title: "DBMS fundamentals (GeeksforGeeks)", url: "https://www.geeksforgeeks.org/dbms/" } },
  { match: /\b(tcp|udp|ip|osi|network|dns|http)\b/i, link: { title: "Computer networks notes (GeeksforGeeks)", url: "https://www.geeksforgeeks.org/computer-network-tutorials/" } },
  { match: /\b(complexity|big o|asymptotic|recursion)\b/i, link: { title: "Algorithm complexity primer", url: "https://www.khanacademy.org/computing/computer-science/algorithms/asymptotic-notation/a/asymptotic-notation" } },
];

const COMP_THINKING_RULES: { match: RegExp; link: RemediationLink }[] = [
  { match: /\b(decompos|break down)/i, link: { title: "Decomposition (BBC Bitesize)", url: "https://www.bbc.co.uk/bitesize/guides/zd88jty/revision/2" } },
  { match: /\b(pattern|abstraction)\b/i, link: { title: "Computational thinking (BBC Bitesize)", url: "https://www.bbc.co.uk/bitesize/guides/zp92mp3/revision/1" } },
  { match: /\b(algorithm|step|sequence|flow)\b/i, link: { title: "Algorithms intro (Khan Academy)", url: "https://www.khanacademy.org/computing/computer-science/algorithms" } },
  { match: /\b(logic|condition|truth table|boolean)\b/i, link: { title: "Boolean logic basics (Khan Academy)", url: "https://www.khanacademy.org/computing/computer-science/cryptography/ciphers/a/ciphers-vs-codes" } },
];

const skillRules: SkillRule[] = [
  {
    match: (s) => /\bsql\b/.test(s),
    resolve: (topic, subTopic) => firstMatch(SQL_RULES, `${topic} ${subTopic}`),
  },
  {
    match: (s) => /ui\s*engineering|frontend|front[- ]end/.test(s),
    resolve: (topic, subTopic) => firstMatch(UI_RULES, `${topic} ${subTopic}`),
  },
  {
    match: (s) => /server[\s-]*side|backend|back[- ]end/.test(s),
    resolve: (topic, subTopic) => firstMatch(SERVER_RULES, `${topic} ${subTopic}`),
  },
  {
    match: (s) => /\bdsml\b|data\s*science|machine\s*learning|\bml\b/.test(s),
    resolve: (topic, subTopic) => firstMatch(DSML_RULES, `${topic} ${subTopic}`),
  },
  {
    match: (s) => /gen[\s-]*ai|generative\s*ai|applied\s*gen\s*ai/.test(s),
    resolve: (topic, subTopic) => firstMatch(GENAI_RULES, `${topic} ${subTopic}`),
  },
  {
    match: (s) => /\bcs\b|computer\s*science\s*fundamentals|cs\s*fundamentals/.test(s),
    resolve: (topic, subTopic) => firstMatch(CS_RULES, `${topic} ${subTopic}`),
  },
  {
    match: (s) => /computational\s*thinking/.test(s),
    resolve: (topic, subTopic) => firstMatch(COMP_THINKING_RULES, `${topic} ${subTopic}`),
  },
  {
    match: (s) => /quantitative\s*reasoning|quantitative\s*aptitude/.test(s),
    resolve: () => ({ title: "Practice problems (Khan Academy)", url: "https://www.khanacademy.org/math" }),
  },
  {
    match: (s) => /critical\s*thinking|communication/.test(s),
    resolve: () => ({ title: "Communication practice (Harvard Extension)", url: "https://www.extension.harvard.edu/inside-extension/improve-your-communication-skills-public-speaking" }),
  },
];

function firstMatch(rules: { match: RegExp; link: RemediationLink }[], text: string): RemediationLink | null {
  const found = rules.find((r) => r.match.test(text));
  return found ? found.link : null;
}

export function getRemediationLink(
  skillName: string | undefined | null,
  topicName: string | undefined | null,
  subTopicName?: string | undefined | null,
): RemediationLink | null {
  const skill = norm(skillName);
  if (!skill) return null;
  const topic = norm(topicName);
  const sub = norm(subTopicName);
  const rule = skillRules.find((r) => r.match(skill));
  if (!rule) return null;
  return rule.resolve(topic, sub);
}
