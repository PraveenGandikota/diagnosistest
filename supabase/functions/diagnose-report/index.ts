// Edge function — generates a structured Python tutor report via Lovable AI tool calling.
// Returns JSON: { summary, strengths[], improvements[], actionPlan[] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReportPayload {
  score: number;
  correct: number;
  total: number;
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

    const systemPrompt =
      "You are a senior Python tutor giving a focused, actionable code review. " +
      "Be specific, name concrete KCs, and avoid filler. Each list item is one short sentence (under 22 words). " +
      "No markdown, no emojis. Use plain text only.";

    const userPrompt = `Student results on the "Count Vowels" Python problem.

Overall MCQ score: ${payload.score}% (${payload.correct}/${payload.total} correct)
Time taken: ${payload.timeTaken}

Knowledge Concept performance:
${kcLines}

Generate a structured diagnosis report. Use the report tool. Constraints:
- summary: 1-2 sentences, honest and encouraging.
- strengths: 2-4 line items. Each names a specific KC the student demonstrated and why it matters.
- improvements: 2-5 line items. Each names a weak KC, the typical mistake pattern, and the real-world bug it causes. Pick from the lowest-scoring KCs.
- actionPlan: exactly 3 line items. Each is a concrete exercise with a time estimate (e.g., "Write 5 functions using counter accumulation — 20 min").`;

    const tools = [
      {
        type: "function",
        function: {
          name: "diagnosis_report",
          description: "Return a structured Python learning diagnosis report.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "One or two sentence overall summary." },
              strengths: {
                type: "array",
                items: { type: "string" },
                description: "What the student demonstrated mastery of. 2-4 short line items.",
              },
              improvements: {
                type: "array",
                items: { type: "string" },
                description: "Specific weaknesses with the mistake pattern. 2-5 short line items.",
              },
              actionPlan: {
                type: "array",
                items: { type: "string" },
                description: "Exactly 3 concrete exercises with time estimates.",
              },
            },
            required: ["summary", "strengths", "improvements", "actionPlan"],
            additionalProperties: false,
          },
        },
      },
    ];

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
        tools,
        tool_choice: { type: "function", function: { name: "diagnosis_report" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached, please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      console.error("No tool call returned:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Model did not return a structured report" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(argsStr);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse model output" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("diagnose-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
