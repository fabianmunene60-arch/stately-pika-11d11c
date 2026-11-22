const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { statusCode: 503, body: "Webhook not configured" };
    const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
    const supplied = event.headers["x-paystack-signature"] || event.headers["X-Paystack-Signature"] || "";
    const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");
    const a = Buffer.from(supplied, "hex"), b = Buffer.from(expected, "hex");
    if (!supplied || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { statusCode: 401, body: "Invalid signature" };
    const payload = JSON.parse(raw);
    if (payload.event !== "charge.success") return { statusCode: 200, body: "Event ignored" };
    const tx = payload.data || {};
    const userId = tx.metadata?.user_id;
    if (tx.status !== "success" || Number(tx.amount) !== 5000 || tx.currency !== "KES" || tx.metadata?.product !== "StudyBuddy Premium" || !userId || !tx.reference) return { statusCode: 200, body: "Not a StudyBuddy Premium payment" };
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing } = await admin.from("payments").select("user_id,status,premium_until").eq("reference", tx.reference).maybeSingle();
    if (existing) {
      if (existing.user_id !== userId || existing.status !== "success") return { statusCode: 409, body: "Reference conflict" };
      await admin.from("profiles").upsert({ id: userId, premium_until: existing.premium_until }, { onConflict: "id" });
      return { statusCode: 200, body: "Already processed" };
    }
    const now = new Date();
    const { data: profile } = await admin.from("profiles").select("premium_until").eq("id", userId).maybeSingle();
    const current = profile?.premium_until && new Date(profile.premium_until) > now ? new Date(profile.premium_until) : now;
    const until = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: paymentError } = await admin.from("payments").insert({ reference: tx.reference, user_id: userId, amount: 5000, currency: "KES", status: "success", premium_until: until });
    if (paymentError) {
      const { data: raced } = await admin.from("payments").select("user_id,status,premium_until").eq("reference", tx.reference).maybeSingle();
      if (raced?.user_id === userId && raced.status === "success") {
        await admin.from("profiles").upsert({ id: userId, premium_until: raced.premium_until }, { onConflict: "id" });
        return { statusCode: 200, body: "Already processed" };
      }
      throw paymentError;
    }
    const { error: profileError } = await admin.from("profiles").upsert({ id: userId, premium_until: until }, { onConflict: "id" });
    if (profileError) throw profileError;
    return { statusCode: 200, body: "Premium activated" };
  } catch (error) {
    return { statusCode: 500, body: "Webhook processing failed" };
  }
};
