// Edge function - generates a structured improvement plan for the coding quiz.
// Returns JSON: { summary, improvementPlan[], nextSteps[] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TopicBreakdown {
  topic: string;
  description: string;
  correct: number;
  total: number;
  pct: number;
  resourceTitle: string;
  resourceUrl: string;
}

interface ReportPayload {
  quizName: string;
  score: number;
  correct: number;
  total: number;
  timeTaken: string;
  topicBreakdown: TopicBreakdown[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const payload = (await req.json()) as ReportPayload;
    const topics = Array.isArray(payload?.topicBreakdown) ? payload.topicBreakdown : [];

    const topicLines = topics
      .map((topic) => {
        const resourceLine = `${topic.resourceTitle} - ${topic.resourceUrl}`;
        return `- ${topic.topic}: ${topic.correct}/${topic.total} (${topic.pct}%). ${topic.description} Resource: ${resourceLine}`;
      })
      .join("\n");

    const systemPrompt =
      "You are a senior Python tutor writing a concise, professional improvement plan after a coding quiz. " +
      "Do not mention KCs, knowledge concepts, or internal assessment labels. " +
      "Use only the provided topic names. Keep the tone supportive, direct, and practical. " +
      "No markdown, no emojis. Use plain text only.";

    const userPrompt = `Student results on the "${payload.quizName}" coding quiz.

Overall score: ${payload.score}% (${payload.correct}/${payload.total} correct)
Time taken: ${payload.timeTaken}

Topic performance:
${topicLines}

Generate a structured improvement plan. Use the report tool. Constraints:
- summary: 1-2 sentences, encouraging and honest, focused on what the learner should do next.
- improvementPlan: 2-4 items. Each item must use one provided topic name, explain what needs revision, and give one concrete recommendation.
- nextSteps: exactly 3 short action steps. Focus on revision and practice.
- Do not mention KCs, percentages, or "knowledge concepts" in the text.
- Do not invent new topic names.
- Do not include URLs in the tool output; the frontend will attach the provided resources.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "improvement_plan_report",
          description: "Return a structured coding quiz improvement plan.",
          parameters: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "One or two sentence overall summary.",
              },
              improvementPlan: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    topic: { type: "string" },
                    observation: { type: "string" },
                    recommendation: { type: "string" },
                  },
                  required: ["topic", "observation", "recommendation"],
                  additionalProperties: false,
                },
                description: "Priority revision areas with clear recommendations.",
              },
              nextSteps: {
                type: "array",
                items: { type: "string" },
                description: "Exactly 3 concrete next steps.",
              },
            },
            required: ["summary", "improvementPlan", "nextSteps"],
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
        tool_choice: { type: "function", function: { name: "improvement_plan_report" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached, please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted - add credits in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
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
  } catch (error) {
    console.error("diagnose-report error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
