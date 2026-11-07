/**
 * ============================================================
 *  Study Grid Prep — AI Content Studio & Hiring Assessment Worker (Groq backend)
 *  Deploy this as a Cloudflare Worker. Set GROQ_API_KEY as a
 *  Secret in Worker Settings → Variables and Secrets — reuse the
 *  same key already used for the Mock Test AI Analysis feature.
 *
 *  Called from:
 *   1. content-studio.js (Blog / Notes / Guides / SEO / Rewrite)
 *   2. content-hub-admin.html (College AI Assist — collegeArticle)
 *   3. hiring-admin.html (Hiring Portal Qualifying Test — quiz / HR Questions)
 * ============================================================
 */

const ALLOWED_ORIGINS = [
  "https://studygridprep.online",
  "https://studygridprep.info"
];

function corsHeaders(origin) {
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https?:\/\/localhost(:\d+)?$/i.test(origin) ||
    /\.run\.app$/i.test(origin) ||
    /\.pages\.dev$/i.test(origin);
  const allow = isAllowed && origin ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ─────────────────────────────────────────────────────────────
// 1. Default System Instruction (Content Studio + College Hub)
//    Keeps the model's output in the exact shape the editor's
//    block renderer understands.
// ─────────────────────────────────────────────────────────────
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
    { "type": "image", "url": "https://...", "alt": "string", "size": "full" },
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
- Image rendering rule: Only include an "image" block when visually needed or requested; when included, "url" MUST be a valid, directly renderable HTTPS image URL (for example a clean diagram/banner placeholder like "https://placehold.co/960x480/11172a/818cf8.png?text=Study+Grid+Prep" or a verified direct HTTPS URL). Never invent broken or fake image paths.
- Never invent fake statistics, university rankings, or exam dates — keep factual claims general.
- If "action" is "continue", only return NEW blocks to append (do not repeat existingBlocks).
- If "action" is "improve", "rewrite", "expand", "shorten", or "grammar", return the FULL revised block set reflecting that change, based on existingBlocks.
- If "action" is "seo", return the same blocks unchanged but with improved seo{} and title/slug.`;

// ─────────────────────────────────────────────────────────────
// 2. Hiring Portal Assessment System Instruction (contentType === "quiz")
//    Specifically designed for Study Grid Prep's Hiring Admin Panel
//    so every question is written like an Experienced Senior HR &
//    Domain Hiring Manager — never random trivia, and NEVER fails JSON validation.
// ─────────────────────────────────────────────────────────────
const HIRING_QUIZ_SYSTEM_INSTRUCTION = `You are an Experienced Senior HR Manager & Technical/Domain Hiring Assessor for Study Grid Prep, India's competitive exam preparation EdTech platform (JEE, NEET, CUET, Boards).

Your task is to generate high-signal, job-relevant qualifying test questions to evaluate candidates applying for roles at Study Grid Prep (such as Content Writer, Subject Matter Expert, Physics/Chemistry/Maths/Biology Faculty, Video Editor, Graphic Designer, UI/UX Designer, Frontend/Full-Stack Developer, Marketing & Growth Specialist, Operations Executive, HR Recruiter, Student Counselor, Doubt Solver, etc.).

CRITICAL HR & QUESTION QUALITY RULES:
1. NEVER generate random general-knowledge trivia or unrelated school questions.
2. Every question MUST feel like it was crafted by an experienced HR & Hiring Lead specifically for Study Grid Prep:
   - Test practical on-the-job decision-making, role-specific technical/domain mastery, real EdTech workplace scenarios, attention to detail, quality standards for JEE/NEET/CUET students, and professional judgment.
   - For MCQ questions: provide 4 realistic, well-thought-out options (A, B, C, D) where distractors represent common workplace mistakes and the correct option reflects best professional/domain practice.
   - For Integer questions: ask a practical quantitative/calculation/metrics/domain numerical problem whose exact answer is a single number.
   - For Text questions: ask a concise scenario/concept question whose answer is a clear, specific keyword or short phrase (1 to 4 words) that can be auto-graded.
3. IMAGE RENDERING RULE (EMERGENCY / VISUAL QUESTIONS ONLY):
   - The Study Grid Prep test runner renders question images directly via <img src="mediaUrl">.
   - By default, set "mediaType": "none" and "mediaUrl": "" (and omit the IMAGE: line).
   - ONLY when a question genuinely requires visual inspection (e.g., inspecting a formula card, chart, banner layout, UI mockup, or when the admin's instruction asks for an image/diagram question), set "mediaType": "image" and provide a 100% working, directly renderable HTTPS image URL in "mediaUrl" (and in the "IMAGE: <url>" line), such as:
     "https://placehold.co/800x420/11172a/818cf8.png?text=<URL_ENCODED_DIAGRAM_OR_SCENARIO_TEXT>"
   - NEVER output broken, relative, or non-existent image URLs.

You MUST respond with ONLY valid JSON — no markdown fences, no commentary outside JSON. The JSON MUST match this exact shape so both structured parsers and block parsers succeed 100% of the time:

{
  "title": "Qualifying Assessment — <Role Title>",
  "slug": "qualifying-assessment",
  "seo": {
    "metaTitle": "Hiring Assessment",
    "metaDescription": "Qualifying test questions for Study Grid Prep hiring",
    "keywords": ["hiring", "assessment"]
  },
  "questions": [
    {
      "prompt": "Full question text",
      "answerType": "mcq",
      "mediaType": "none",
      "mediaUrl": "",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": 0
    }
  ],
  "blocks": [
    {
      "type": "paragraph",
      "text": "Q: Full question text\\nTYPE: mcq\\nA) Option A text\\nB) Option B text\\nC) Option C text\\nD) Option D text\\nANSWER: A"
    }
  ]
}

Formatting rules for "questions" and "blocks":
- For every question you generate, include it in BOTH "questions" (structured array) AND "blocks" (one paragraph block per question using the exact Q: / TYPE: / optional IMAGE: / A)-D) / ANSWER: lines).
- In "questions", "correctAnswer" must be 0, 1, 2, or 3 for "mcq" (matching A, B, C, or D), a number for "integer", or a short string for "text".
- In "blocks", if the question has a valid HTTPS image URL, include "IMAGE: https://..." right after the "TYPE: ..." line.`;

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
    if (b.type === "image" && b.url && !/^https:\/\//i.test(String(b.url).trim())) {
      return {
        ...b,
        url: "https://placehold.co/960x480/11172a/818cf8.png?text=" + encodeURIComponent(b.alt || "Study Grid Prep")
      };
    }
    return b;
  });
  return result;
}

// Safely extract and parse JSON from model output even if the model wraps it
// in ```json fences or adds leading/trailing text.
function safeParseModelJson(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty model response");
  }
  let cleaned = rawText.trim();
  // Strip markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Extract first {...} object block
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (_) {
        // Remove trailing commas before } or ] and retry
        const repaired = candidate.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(repaired);
      }
    }
    throw new Error("Could not parse valid JSON from model output");
  }
}

// Ensure that for quiz/hiring requests, if the model populated `questions`
// we also synchronize `blocks` (and vice-versa) so hiring-admin.html always
// gets 100% parseable questions.
function ensureQuizBlocksAndQuestions(result) {
  if (!result || typeof result !== "object") return result;
  if (Array.isArray(result.questions) && result.questions.length > 0) {
    const syncedBlocks = result.questions.map(q => {
      const type = String(q.answerType || q.type || "mcq").toLowerCase();
      const prompt = String(q.prompt || q.question || q.q || "").trim();
      const rawImg = String(q.mediaUrl || q.imageUrl || q.image || "").trim();
      const hasImg = /^https:\/\//i.test(rawImg);
      const lines = [`Q: ${prompt}`, `TYPE: ${type}`];
      if (hasImg) lines.push(`IMAGE: ${rawImg}`);
      if (type === "mcq" && Array.isArray(q.options)) {
        const letters = ["A", "B", "C", "D"];
        q.options.slice(0, 4).forEach((opt, idx) => {
          const cleanOpt = String(opt || "").replace(/^[A-D][).:\-\s]+/i, "").trim();
          lines.push(`${letters[idx]}) ${cleanOpt}`);
        });
        let ansLetter = "A";
        if (typeof q.correctAnswer === "number" && q.correctAnswer >= 0 && q.correctAnswer < 4) {
          ansLetter = letters[q.correctAnswer];
        } else if (typeof q.correctAnswer === "string" || typeof q.answer === "string") {
          const rawAns = String(q.correctAnswer ?? q.answer ?? "A").trim().toUpperCase();
          if (letters.includes(rawAns[0])) ansLetter = rawAns[0];
        }
        lines.push(`ANSWER: ${ansLetter}`);
      } else {
        lines.push(`ANSWER: ${q.correctAnswer ?? q.answer ?? ""}`);
      }
      return { type: "paragraph", text: lines.join("\n") };
    });
    if (!Array.isArray(result.blocks) || result.blocks.length === 0) {
      result.blocks = syncedBlocks;
    }
  }
  return result;
}

async function callGroq(env, body) {
  const { prompt, action, contentType, existingTitle, existingBlocks, roleDetails } = body;
  const isHiringQuiz =
    contentType === "quiz" ||
    contentType === "hiring_quiz" ||
    Boolean(roleDetails);

  const systemPrompt = isHiringQuiz ? HIRING_QUIZ_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION;

  const userParts = [
    `Action: ${action || "generate"}`,
    `Content type: ${contentType || "blog"}`,
    existingTitle ? `Existing title / Role title: ${existingTitle}` : null,
    roleDetails ? `Hiring Role Details (JSON): ${JSON.stringify(roleDetails)}` : null,
    existingBlocks?.length ? `Existing blocks (JSON): ${JSON.stringify(existingBlocks)}` : null,
    prompt ? `Instruction:\n${prompt}` : null,
  ].filter(Boolean).join("\n\n");

  // Primary model is openai/gpt-oss-20b as configured; if Groq rejects strict json_object
  // validation (400 json_validate_failed) or has a transient 5xx/rate-limit, we automatically
  // salvage failed_generation or retry with fallback so it never fails 4 out of 5 times.
  const attempts = [
    { model: "openai/gpt-oss-20b", useJsonMode: true, temperature: isHiringQuiz ? 0.5 : 0.7 },
    { model: "openai/gpt-oss-20b", useJsonMode: false, temperature: 0.4 },
    { model: "llama-3.3-70b-versatile", useJsonMode: true, temperature: 0.5 },
  ];

  let lastError = null;

  for (const cfg of attempts) {
    try {
      const payload = {
        model: cfg.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userParts }
        ],
        temperature: cfg.temperature,
        max_completion_tokens: 4096,
      };
      if (cfg.useJsonMode) {
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
        // If Groq returned 400 json_validate_failed with a failed_generation payload,
        // try to salvage the JSON from failed_generation right away!
        try {
          const errObj = JSON.parse(errText);
          const failedGen = errObj?.error?.failed_generation;
          if (failedGen) {
            const salvaged = safeParseModelJson(failedGen);
            const checked = isHiringQuiz ? ensureQuizBlocksAndQuestions(salvaged) : salvaged;
            return sanitizeCtaLinks(checked);
          }
        } catch (_) {}
        throw new Error(`Groq API error ${res.status} (${cfg.model}): ${errText}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error(`Groq (${cfg.model}) returned no content`);

      const parsed = safeParseModelJson(text);
      const normalized = isHiringQuiz ? ensureQuizBlocksAndQuestions(parsed) : parsed;
      return sanitizeCtaLinks(normalized);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Groq generation failed after retries");
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
