const { createClient } = require("@supabase/supabase-js");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    if (!process.env.OPENAI_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { statusCode: 503, body: JSON.stringify({ error: "The AI service is not fully configured yet. Please try again later." }) };
    }
    const token = (event.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Please log in first." }) };
    const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error } = await authClient.auth.getUser(token);
    if (error || !user) return { statusCode: 401, body: JSON.stringify({ error: "Your session has expired. Please log in again." }) };
    const { messages, level = "student" } = JSON.parse(event.body || "{}");
    if (!Array.isArray(messages) || !messages.length) return { statusCode: 400, body: JSON.stringify({ error: "Enter a question first." }) };
    const safeMessages = messages.slice(-12).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 3000) })).filter(m => m.content.trim());
    if (!safeMessages.length) return { statusCode: 400, body: JSON.stringify({ error: "Enter a question first." }) };

    // Daily fair-use limits help protect the service from unexpected API costs.
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await admin.from("profiles").select("premium_until").eq("id", user.id).maybeSingle();
    const premium = !!(profile?.premium_until && new Date(profile.premium_until) > new Date());
    const dailyLimit = premium ? 60 : 5;
    const day = new Date().toISOString().slice(0, 10);
    const { data: usage } = await admin.from("ai_usage").select("request_count").eq("user_id", user.id).eq("usage_date", day).maybeSingle();
    const used = Number(usage?.request_count || 0);
    if (used >= dailyLimit) return { statusCode: 429, body: JSON.stringify({ error: premium ? "You have reached today's Premium AI fair-use limit. Please try again tomorrow." : "You've used today's 5 free AI questions. Premium offers up to 60 questions per day." }) };
    const nextUsed = used + 1;
    const { error: usageError } = await admin.from("ai_usage").upsert({ user_id: user.id, usage_date: day, request_count: nextUsed }, { onConflict: "user_id,usage_date" });
    if (usageError) throw usageError;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: .45, max_tokens: 900,
        messages: [{ role: "system", content: `You are StudyBuddy, a supportive educational tutor for university, high-school and junior-secondary learners. Adapt explanations to the learner's level (${String(level).slice(0, 40)}). Explain concepts clearly, use examples and guide students through reasoning. For assignments, help students understand and develop their own work rather than encouraging academic dishonesty. Be especially clear and age-appropriate for younger learners. Do not ask for personal details, passwords or payment details. If a question is ambiguous, ask one concise clarifying question. Be respectful and encouraging.` }, ...safeMessages]
      })
    });
    const data = await response.json();
    if (!response.ok) {
      // Roll back the request count when the AI provider rejects the request.
      await admin.from("ai_usage").upsert({ user_id: user.id, usage_date: day, request_count: used }, { onConflict: "user_id,usage_date" });
      return { statusCode: 502, body: JSON.stringify({ error: data.error?.message || "AI service is temporarily unavailable." }) };
    }
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply: data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.", remaining_requests: Math.max(0, dailyLimit - nextUsed), premium }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Something went wrong. Please try again." }) };
  }
};
