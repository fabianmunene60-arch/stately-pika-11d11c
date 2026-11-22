require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const compression = require("compression");

const {
  PAYSTACK_SECRET_KEY,
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  OPENAI_MODEL = "gpt-6.2-astra",
  ANTHROPIC_MODEL = "claude-haiku-5-5",
  AI_DEFAULT_PROVIDER = (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) ? "claude" : "openai",
  AI_FALLBACK_ENABLED = "true",
  PUBLIC_BASE_URL,
  AMOUNT = "50",
  PORT = 3000,
} = process.env;

if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
  console.error("Configure at least one AI key: OPENAI_API_KEY or ANTHROPIC_API_KEY.");
  process.exit(1);
}

const PRICE = Number(AMOUNT);
if (!Number.isFinite(PRICE) || PRICE <= 0) throw new Error("AMOUNT must be a positive number.");
const CURRENCY = "KES";
const FALLBACK_ENABLED = String(AI_FALLBACK_ENABLED).toLowerCase() !== "false";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "payments.json");
let payments = {};
try { payments = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch (_) { payments = {}; }

function savePayments() {
  const temp = DATA_FILE + ".tmp";
  try {
    fs.writeFileSync(temp, JSON.stringify(payments, null, 2), { mode: 0o600 });
    fs.renameSync(temp, DATA_FILE);
  } catch (e) { console.error("Could not persist payment records:", e.message); }
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression());
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(express.json({
  limit: "100kb",
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, "public", "index.html"))
  ? path.join(__dirname, "public")
  : __dirname;
const SITE_FILES = new Set(["index.html", "app.html", "sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"]);
if (PUBLIC_DIR === __dirname) {
  // Flat upload fallback: only these website files are ever served, never server.js or package.json.
  app.use((req, res, next) => {
    const name = req.path === "/" ? "index.html" : req.path.replace(/^\//, "");
    if (!SITE_FILES.has(name)) return next();
    if (name === "sw.js" || name.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(__dirname, name));
  });
} else {
  app.use(express.static(PUBLIC_DIR, {
    maxAge: "1h",
    setHeaders: (res, file) => {
      if (file.endsWith("sw.js") || file.endsWith("index.html") || file.endsWith("app.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  }));
}

function availableProviders() {
  return { openai: Boolean(OPENAI_API_KEY), claude: Boolean(ANTHROPIC_API_KEY) };
}
function providerName(value) {
  const v = String(value || "auto").toLowerCase();
  return ["auto", "openai", "claude"].includes(v) ? v : "auto";
}
function extractOpenAIText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of (data.output || [])) {
    for (const content of (item.content || [])) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

async function callOpenAI(messages, system, maxTokens) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: system,
      input: messages,
      max_output_tokens: maxTokens
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data.error && data.error.message) || "OpenAI request failed (" + response.status + ").");
  const answer = extractOpenAIText(data);
  if (!answer) throw new Error("OpenAI returned an empty response.");
  return answer;
}

async function callClaude(messages, system, maxTokens) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data.error && data.error.message) || "Claude request failed (" + response.status + ").");
  const answer = (data.content || []).filter(x => x.type === "text").map(x => x.text).join("\n").trim();
  if (!answer) throw new Error("Claude returned an empty response.");
  return answer;
}

async function generateAI({ messages, system, maxTokens = 900, provider = "auto" }) {
  const available = availableProviders();
  const requested = providerName(provider);
  const preferred = requested === "auto"
    ? (AI_DEFAULT_PROVIDER === "claude" ? "claude" : "openai")
    : requested;
  const other = preferred === "openai" ? "claude" : "openai";
  const order = [preferred];
  if (FALLBACK_ENABLED) order.push(other);

  let lastError;
  for (const name of order) {
    if (!available[name]) {
      lastError = new Error(name + " is not configured on this StudyBuddy server.");
      continue;
    }
    try {
      const answer = name === "openai"
        ? await callOpenAI(messages, system, maxTokens)
        : await callClaude(messages, system, maxTokens);
      return { answer, provider: name, model: name === "openai" ? OPENAI_MODEL : ANTHROPIC_MODEL };
    } catch (e) {
      lastError = e;
      console.error(name + " AI error:", e.message);
    }
  }
  throw lastError || new Error("No AI provider is currently available.");
}

async function paystack(method, endpoint, body) {
  if (!PAYSTACK_SECRET_KEY) throw new Error("Paystack is not configured on this server.");
  const response = await fetch("https://api.paystack.co" + endpoint, {
    method,
    headers: { Authorization: "Bearer " + PAYSTACK_SECRET_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.status) throw new Error(data.message || "Paystack error " + response.status);
  return data.data;
}

function applyTransaction(record, transaction) {
  if (transaction.status === "success") {
    if (transaction.currency === CURRENCY && Number(transaction.amount) === PRICE * 100) {
      if (record.status !== "paid") { record.status = "paid"; record.paidAt = Date.now(); }
    } else {
      record.status = "failed";
    }
  } else if (transaction.status === "failed") {
    record.status = "failed";
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, price: PRICE, currency: CURRENCY });
});
app.get("/api/ai/status", (_req, res) => {
  const providers = availableProviders();
  res.json({
    providers,
    defaultProvider: AI_DEFAULT_PROVIDER,
    fallbackEnabled: FALLBACK_ENABLED,
    ready: providers.openai || providers.claude
  });
});

/* Start Paystack checkout. Use TEST keys until the complete flow is verified. */
app.post("/api/pay", async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    const reference = "sb_" + crypto.randomBytes(12).toString("hex");
    const data = await paystack("POST", "/transaction/initialize", {
      email,
      amount: PRICE * 100,
      currency: CURRENCY,
      reference,
      callback_url: PUBLIC_BASE_URL.replace(/\/$/, "") + "/app.html",
      metadata: { product: "assignment-help", app: "StudyBuddy" }
    });
    payments[reference] = { status: "pending", email, createdAt: Date.now(), used: false };
    savePayments();
    res.json({ reference, authorizationUrl: data.authorization_url });
  } catch (e) {
    console.error("Payment initialization:", e.message);
    res.status(502).json({ error: "Could not start the payment. Please try again." });
  }
});

/* Verify Paystack's signature against the exact raw request bytes. */
app.post("/api/paystack/webhook", (req, res) => {
  const signature = String(req.get("x-paystack-signature") || "");
  const expected = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(req.rawBody || Buffer.alloc(0)).digest("hex");
  const valid = signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return res.sendStatus(401);
  try {
    const event = req.body;
    if (event && event.event === "charge.success" && event.data) {
      const record = payments[event.data.reference];
      if (record) { applyTransaction(record, event.data); savePayments(); }
    }
  } catch (e) { console.error("Webhook error:", e.message); }
  res.sendStatus(200);
});

app.get("/api/pay/:reference", async (req, res) => {
  const record = payments[req.params.reference];
  if (!record) return res.status(404).json({ error: "Unknown payment." });
  if (record.status === "pending") {
    try {
      const transaction = await paystack("GET", "/transaction/verify/" + encodeURIComponent(req.params.reference));
      applyTransaction(record, transaction);
      savePayments();
    } catch (_) { /* keep pending while Paystack processes the payment */ }
  }
  res.json({ status: record.status, used: record.used });
});

/* One confirmed payment unlocks one assignment response. */
app.post("/api/assignment", async (req, res) => {
  const body = req.body || {};
  const record = payments[String(body.reference || "")];
  if (!record || record.status !== "paid") return res.status(402).json({ error: "Payment not confirmed yet." });
  if (record.used) return res.status(409).json({ error: "This payment has already been used. Please pay again for a new assignment." });
  const question = String(body.question || "").trim().slice(0, 6000);
  if (!question) return res.status(400).json({ error: "Please enter the assignment question." });

  record.used = true;
  savePayments();
  try {
    const prompt = [
      "Subject: " + String(body.subject || "General").slice(0, 60),
      "Level: " + String(body.level || "University").slice(0, 30),
      "Reply in: " + String(body.language || "English").slice(0, 30),
      "",
      "Assignment question:",
      question,
      "",
      "Give: (1) what the question is asking, (2) a step-by-step worked solution or a well-structured outline with reasoning, (3) key points to remember, and (4) one practice question to check understanding."
    ].join("\n");
    const result = await generateAI({
      messages: [{ role: "user", content: prompt }],
      system: "You are StudyBuddy, a patient and accurate tutor. Teach rather than merely provide answers. Explain clearly with worked steps, simple examples and short summaries. Encourage academic honesty. If unsure, say so.",
      maxTokens: 2200,
      provider: body.provider
    });
    record.answeredAt = Date.now();
    record.aiProvider = result.provider;
    savePayments();
    res.json({ answer: result.answer, provider: result.provider, model: result.model });
  } catch (e) {
    console.error("Assignment AI:", e.message);
    record.used = false;
    savePayments();
    res.status(502).json({ error: "The tutor is busy. Your payment is safe. Please try again." });
  }
});

/* Basic in-memory free-tier limits. For production scale, move these to a shared database. */
const FREE_PER_DAY = Math.max(1, Number(process.env.FREE_QUESTIONS_PER_DAY || 5));
const AI_DAILY_CAP = Math.max(1, Number(process.env.AI_DAILY_CAP || 300));
const askCounts = new Map();
let capDay = "";
let capUsed = 0;

app.post("/api/ask", async (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  if (capDay !== day) { capDay = day; capUsed = 0; askCounts.clear(); }
  if (capUsed >= AI_DAILY_CAP) {
    return res.status(429).json({ error: "The free tutor is very busy today. Please try again tomorrow." });
  }
  const used = askCounts.get(req.ip) || 0;
  if (used >= FREE_PER_DAY) {
    return res.status(429).json({ error: "You have used today's free questions. Pay KSh " + PRICE + " for full assignment help, or come back tomorrow." });
  }
  const raw = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
  const messages = raw.slice(-8)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 1800) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "Please type a question." });
  }

  askCounts.set(req.ip, used + 1);
  capUsed++;
  try {
    const result = await generateAI({
      messages,
      system: "You are StudyBuddy, a friendly tutor for students. Answer clearly and briefly with simple examples, in the language the student writes in. Encourage learning and academic honesty. If the student wants a full worked solution to a graded assignment, explain the concept and point them to the paid Assignment Help service. If unsure, say so.",
      maxTokens: 900,
      provider: req.body && req.body.provider
    });
    res.json({
      answer: result.answer,
      provider: result.provider,
      model: result.model,
      remaining: Math.max(0, FREE_PER_DAY - (used + 1))
    });
  } catch (e) {
    console.error("Free tutor AI:", e.message);
    askCounts.set(req.ip, used);
    capUsed--;
    res.status(502).json({ error: "Both AI engines are temporarily unavailable. Please try again." });
  }
});

app.listen(PORT, () => console.log("StudyBuddy server running on port " + PORT));
