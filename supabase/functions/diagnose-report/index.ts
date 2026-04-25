// Deno edge function — streams a personalized Python tutor report from Lovable AI.
// CORS enabled, no auth required (verify_jwt = false in config).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReportPayload {
  score: number;
  correct: number;
  total: number;
  cc1Result: string;
  cc2Result: string;
  timeTaken: string;
  kcBreakdown: { kc: string; name: string; pct: number; correct: number; total: number }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const payload = (await req.json()) as ReportPayload;

    const kcLines = payload.kcBreakdown
      .map((k) => `- ${k.kc} ${k.name}: ${k.correct}/${k.total} (${k.pct}%)`)
      .join("\n");

    const systemPrompt = `You are a senior Python developer doing a code review with a junior. Direct, specific, encouraging but honest. Plain text only, no markdown, no headers, no bullet symbols. Use four short paragraphs separated by a blank line.`;

    const userPrompt = `Student results on the "Count Vowels" Python problem:

Overall MCQ score: ${payload.score}% (${payload.correct}/${payload.total})
Code challenge 1 (write from scratch): ${payload.cc1Result}
Code challenge 2 (fix all bugs): ${payload.cc2Result}
Time taken: ${payload.timeTaken}

Knowledge Concept performance:
${kcLines}

Possible inputs they had to handle: digits, symbols, spaces, uppercase, lowercase, single char, empty string.
Question types attempted: fixing bug, fill in the blank, reading, debugging, tweaking.

Write four paragraphs:
Paragraph 1 — Overall summary, 2-3 sentences, honest and encouraging.
Paragraph 2 — What they demonstrated mastery of: name 2-3 specific KCs and explain why those skills matter in real code.
Paragraph 3 — Exact gaps: name each weak KC, describe the typical mistake pattern, and why it causes real bugs.
Paragraph 4 — This week's action plan: 3 specific exercises with time estimates, e.g. "Write 5 small functions that use counter accumulation — 20 min".`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached, please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("diagnose-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
