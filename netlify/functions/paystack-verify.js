const { createClient } = require("@supabase/supabase-js");
exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method not allowed" };
  try {
    if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Payment verification is not fully configured.");
    const token = (event.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Log in to verify your payment." }) };
    const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error } = await auth.auth.getUser(token);
    if (error || !user) return { statusCode: 401, body: JSON.stringify({ error: "Invalid session." }) };
    const ref = event.queryStringParameters?.reference;
    if (!ref) return { statusCode: 400, body: JSON.stringify({ error: "Missing payment reference." }) };
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing } = await admin.from("payments").select("user_id,status,premium_until").eq("reference", ref).maybeSingle();
    if (existing) {
      if (existing.user_id !== user.id || existing.status !== "success") return { statusCode: 400, body: JSON.stringify({ error: "This payment reference cannot be used for this account." }) };
      await admin.from("profiles").upsert({ id: user.id, email: user.email, premium_until: existing.premium_until }, { onConflict: "id" });
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "This payment was already verified. Your Premium access remains active.", premium_until: existing.premium_until }) };
    }
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, { headers: { "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } });
    const result = await response.json();
    if (!response.ok || !result.status || result.data.status !== "success" || Number(result.data.amount) !== 5000 || result.data.currency !== "KES" || result.data.metadata?.user_id !== user.id || result.data.metadata?.product !== "StudyBuddy Premium") {
      return { statusCode: 400, body: JSON.stringify({ error: "Payment could not be verified for this account. Please contact support with your receipt." }) };
    }
    const now = new Date();
    const { data: profile } = await admin.from("profiles").select("premium_until").eq("id", user.id).maybeSingle();
    const current = profile?.premium_until && new Date(profile.premium_until) > now ? new Date(profile.premium_until) : now;
    const until = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: paymentError } = await admin.from("payments").insert({ reference: ref, user_id: user.id, amount: 5000, currency: "KES", status: "success", premium_until: until });
    if (paymentError) throw paymentError;
    const { error: profileError } = await admin.from("profiles").upsert({ id: user.id, email: user.email, premium_until: until }, { onConflict: "id" });
    if (profileError) throw profileError;
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Payment verified. StudyBuddy Premium is active for 7 days.", premium_until: until }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Could not verify payment. Contact support with your Paystack receipt." }) };
  }
};
