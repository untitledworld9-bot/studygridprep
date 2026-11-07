/**
 * ============================================================
 *  Study Grid Prep — AI Content Studio Worker (Groq backend)
 *  Deploy this as a Cloudflare Worker. Set GROQ_API_KEY as a
 *  Secret in Worker Settings → Variables and Secrets — reuse the
 *  same key already used for the Mock Test AI Analysis feature.
 *
 *  Called from:
 *   1. content-studio.js (Content Studio: blog, notes, formulaSheet,
 *      news, examUpdate, collegeArticle, careerGuide, landingPage,
 *      featurePage, staticPage, faq — actions: generate, continue,
 *      improve, rewrite, expand, shorten, seo, grammar)
 *   2. content-hub-admin.html (College AI Assist: contentType = "collegeArticle")
 *   3. hiring-admin.html (Hiring Portal Qualifying Test: contentType = "quiz")
 * ============================================================
 */

const ALLOWED_ORIGINS = [
  "https://studygridprep.online",
  "https://studygridprep.info"
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// System instruction — this is what keeps the model's output in the
// exact shape the editor's block renderer understands.
const SYSTEM_INSTRUCTION = `You are the content-generation engine for Study Grid Prep, an Indian competitive exam prep platform (JEE, NEET, CUET, Boards). You write clear, SEO-optimized, human-readable educational content in a block format.

You MUST respond with ONLY valid JSON — no markdown fences, no commentary, no preamble. The JSON must match exactly this shape:

{
  "title": "string",
  "slug": "string (lowercase, hyphenated)",
  "seo": {
    "metaTitle": "string, under 60 chars",
    "metaDescription": "string, under 155 chars",
    "keywords": ["string", "string"]
  },
  "blocks": [
    { "type": "heading", "level": 2, "text": "string" },
    { "type": "paragraph", "text": "string" },
    { "type": "tip", "tone": "info|warning|success", "text": "string" },
    { "type": "table", "csv": "Col A, Col B\\nVal 1, Val 2" },
    { "type": "faq", "items": [{ "q": "string", "a": "string" }] },
    { "type": "cta", "text": "string", "buttonLabel": "string", "href": "string" }
  ]
}

Rules:
- Use "heading" blocks (level 2) to break the page into logical sections.
- Write in a friendly but informative tone, appropriate for Indian students aged 15-19.
- Include at least one "faq" block with 3-5 relevant questions if the content type is blog/notes/guide.
- Include one "cta" block near the end pointing to Study Grid Prep's sign-up, unless the action is "seo" or "grammar" only.
- CRITICAL: the "href" field on any "cta" block MUST be one of these exact relative paths only — NEVER invent, guess, or use any other URL or domain: "/login.html" (sign up / get started), "/" (homepage), "/mock.html" (mock tests). Do not use full URLs (no "https://", no external domains like ".in", ".com" etc.) under any circumstance.
- Never invent fake statistics, university rankings, or exam dates — keep factual claims general.
- If "contentType" is "collegeArticle", also ensure the blocks clearly include: (1) a "table" block for fees whose first CSV header row contains "Course,Fee" (e.g. "Course,Fee\\nB.Tech,₹2,20,000 per year"), (2) a "table" block for cutoffs whose first CSV header row contains "Course,Category,Closing Rank" (e.g. "Course,Category,Closing Rank\\nCSE,General,1250"), and (3) a placements "paragraph" block explicitly formatted with "Average package is ₹XX LPA and highest package is ₹YY LPA. Top recruiters: Company A, Company B, Company C." so the Content Hub Admin college parser can extract fees, cutoffs, packages, and recruiters cleanly.
- If "action" is "continue", only return NEW blocks to append (do not repeat existingBlocks).
- If "action" is "improve", "rewrite", "expand", "shorten", or "grammar", return the FULL revised block set reflecting that change, based on existingBlocks.
- If "action" is "seo", return the same blocks unchanged but with improved seo{} and title/slug.`;

// Add-on System Instruction ONLY when contentType === "quiz" (called by hiring-admin.html)
// Keeps Content Studio & Content Hub Admin 100% untouched while preventing 500 errors
// on Hiring Portal AI Question Generation.
const HIRING_QUIZ_ADDON = `

HIRING PORTAL QUALIFYING TEST MODE (contentType is "quiz"):
You are now acting as an Experienced Senior HR Manager & Domain Hiring Assessor for Study Grid Prep (JEE, NEET, CUET, Boards EdTech platform).
Generate job-relevant, practical qualifying assessment questions tailored to the hiring role in "Existing title" and "Instruction".
- NEVER generate random general-knowledge trivia. Every question must test real role skills, on-the-job decision making, EdTech domain competency, and workplace judgment suitable for evaluating candidates at Study Grid Prep.
- Put each generated question as a separate {"type": "paragraph", "text": "..."} item inside the "blocks" array (do NOT include heading, faq, or cta blocks when contentType is "quiz").
- Inside each paragraph block's "text", use this exact multi-line format so the Hiring Admin parser reads every question accurately:
Q: <full question prompt>
TYPE: <mcq or integer or text>
A) <option A (include A-D lines only if TYPE is mcq)>
B) <option B>
C) <option C>
D) <option D>
ANSWER: <A, B, C, or D for mcq; exact number for integer; short keyword/phrase for text>
- Emergency / Visual Image Support: Only if a question genuinely requires visual inspection or the instruction asks for an image/diagram question, add an "IMAGE: https://placehold.co/800x420/11172a/818cf8.png?text=<URL_ENCODED_DIAGRAM_TEXT>" line right after "TYPE: ...". Otherwise omit the IMAGE line.`;

// Safety net: even with instructions, models sometimes invent external
// URLs for CTA buttons. Force any non-whitelisted href back to a safe
// default rather than trusting the model's output blindly.
const ALLOWED_CTA_HREFS = ["/login.html", "/", "/mock.html"];
function sanitizeCtaLinks(result) {
  if (!Array.isArray(result?.blocks)) return result;
  result.blocks = result.blocks.map(b => {
    if (b.type === "cta" && !ALLOWED_CTA_HREFS.includes(b.href)) {
      return { ...b, href: "/login.html" };
    }
    return b;
  });
  return result;
}

// Safely parse JSON even if the model wraps it in markdown fences or
// Groq returns arecoverable failed_generation string.
function safeParseModelJson(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty model response");
  }
  let cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (_) {
        return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
      }
    }
    throw new Error("Model returned invalid JSON");
  }
}

async function callGroq(env, body) {
  const { prompt, action, contentType, existingTitle, existingBlocks } = body;
  const isQuiz = contentType === "quiz";

  const systemContent = isQuiz
    ? SYSTEM_INSTRUCTION + HIRING_QUIZ_ADDON
    : SYSTEM_INSTRUCTION;

  const userParts = [
    `Action: ${action || "generate"}`,
    `Content type: ${contentType || "blog"}`,
    existingTitle ? `Existing title: ${existingTitle}` : null,
    existingBlocks?.length ? `Existing blocks (JSON): ${JSON.stringify(existingBlocks)}` : null,
    prompt ? `Instruction: ${prompt}` : null,
  ].filter(Boolean).join("\n\n");

  const attempts = [
    { model: "openai/gpt-oss-20b", useJsonFormat: true, temperature: isQuiz ? 0.5 : 0.7 },
    { model: "openai/gpt-oss-20b", useJsonFormat: false, temperature: 0.4 },
    { model: "llama-3.3-70b-versatile", useJsonFormat: true, temperature: 0.5 }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const payload = {
        model: attempt.model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userParts }
        ],
        temperature: attempt.temperature,
        max_completion_tokens: 4096,
      };
      if (attempt.useJsonFormat) {
        payload.response_format = { type: "json_object" };
      }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        // If Groq returns 400 json_validate_failed, salvage failed_generation if valid JSON is inside
        try {
          const errJson = JSON.parse(errText);
          const failedGen = errJson?.error?.failed_generation;
          if (failedGen) {
            return sanitizeCtaLinks(safeParseModelJson(failedGen));
          }
        } catch (_) {}
        throw new Error(`Groq API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error("Groq returned no content");

      return sanitizeCtaLinks(safeParseModelJson(text));
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Generation failed");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    try {
      const body = await request.json();
      if (!body.prompt && body.action === "generate") {
        return new Response(JSON.stringify({ error: "prompt is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
        });
      }

      const result = await callGroq(env, body);

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Generation failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
      });
    }
  }
};
