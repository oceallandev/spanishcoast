// Supabase Edge Function: send-newsletter
// - Called from the admin dashboard (account.html) via supabase-js `functions.invoke`.
// - Requires env vars:
//   - RESEND_API_KEY
//   - NEWSLETTER_FROM (e.g. "Spanish Coast Properties <updates@yourdomain.com>")
//
// Notes:
// - This function uses the caller JWT to verify `public.profiles.role = 'admin'`.
// - Recipients are selected from `public.profiles.email` (admin-only read via RLS).
//
// Deploy (example):
//   supabase functions deploy send-newsletter
//   supabase secrets set RESEND_API_KEY=... NEWSLETTER_FROM="Spanish Coast Properties <...>"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Audience =
  | { type: "all" }
  | { type: "role"; role: string }
  | { type: "emails"; emails: string[] };

type Payload = {
  audience: Audience;
  subject: string;
  body: string;
  language?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeEmail = (raw: string) => String(raw || "").trim().toLowerCase();
const looksLikeEmail = (raw: string) => {
  const e = normalizeEmail(raw);
  // Basic sanity check; provider will validate strictly.
  return e.includes("@") && e.includes(".") && e.length <= 320;
};

const uniqueEmails = (emails: string[]) => {
  const set = new Set<string>();
  for (const e of emails) {
    const v = normalizeEmail(e);
    if (!looksLikeEmail(v)) continue;
    set.add(v);
  }
  return Array.from(set);
};

const buildHtml = (subject: string, body: string) => {
  const bodyHtml = escapeHtml(body).replace(/\n/g, "<br>");
  const safeSubject = escapeHtml(subject);
  return `
    <div style="background:#f8fafc;padding:24px 12px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <div style="padding:22px 22px 10px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;">
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:700;">
            Spanish Coast Properties
          </div>
          <div style="margin-top:10px;font-size:20px;line-height:1.25;color:#0f172a;font-weight:800;">
            ${safeSubject}
          </div>
        </div>
        <div style="padding:0 22px 22px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;font-size:15px;line-height:1.65;">
          ${bodyHtml}
          <div style="margin-top:22px;border-top:1px solid #e2e8f0;padding-top:14px;color:#64748b;font-size:12px;">
            You're receiving this because you have an account at Spanish Coast Properties.
          </div>
        </div>
      </div>
    </div>
  `.trim();
};

const sendViaResend = async ({
  apiKey,
  from,
  to,
  subject,
  html,
  text,
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Resend error (${res.status}): ${msg || res.statusText}`);
  }
  return await res.json().catch(() => ({}));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return json(500, { error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // 1) Verify caller is signed in and admin.
  const { data: userOut, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userOut.user) return json(401, { error: "Not authenticated" });
  const userId = userOut.user.id;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role,email")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileErr) return json(403, { error: "Admin check failed" });
  if (!profile || String(profile.role || "") !== "admin") {
    return json(403, { error: "Admin only" });
  }

  // 2) Parse request payload.
  let payload: Payload | null = null;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    payload = null;
  }
  if (!payload) return json(400, { error: "Invalid JSON" });

  const subject = String(payload.subject || "").trim();
  const body = String(payload.body || "").trim();
  const audience = payload.audience as Audience;
  if (!subject || !body) return json(400, { error: "Missing subject/body" });
  if (!audience || !audience.type) return json(400, { error: "Missing audience" });

  // 3) Resolve recipients.
  let recipients: string[] = [];
  if (audience.type === "emails") {
    recipients = uniqueEmails(Array.isArray(audience.emails) ? audience.emails : []);
  } else if (audience.type === "role") {
    const role = String((audience as any).role || "").trim().toLowerCase();
    if (!role) return json(400, { error: "Missing role" });
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", role)
      .not("email", "is", null)
      .neq("email", "");
    if (error) return json(500, { error: `Failed to load recipients: ${error.message}` });
    recipients = uniqueEmails((data || []).map((r: any) => String(r.email || "")));
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .not("email", "is", null)
      .neq("email", "");
    if (error) return json(500, { error: `Failed to load recipients: ${error.message}` });
    recipients = uniqueEmails((data || []).map((r: any) => String(r.email || "")));
  }

  const MAX_RECIPIENTS = 250;
  if (!recipients.length) return json(200, { ok: true, sent: 0, failed: 0 });
  if (recipients.length > MAX_RECIPIENTS) {
    return json(400, { error: `Too many recipients (${recipients.length}). Max ${MAX_RECIPIENTS} per send.` });
  }

  // 4) Provider config.
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("NEWSLETTER_FROM") || "";
  if (!resendKey || !from) {
    return json(500, {
      error:
        "Missing RESEND_API_KEY / NEWSLETTER_FROM secrets. Set them in Supabase Edge Function secrets.",
    });
  }

  // 5) Log campaign (best-effort).
  let campaignId: string | null = null;
  try {
    const { data: inserted } = await supabase
      .from("newsletter_campaigns")
      .insert({
        created_by: userId,
        audience_type: audience.type,
        audience_role: audience.type === "role" ? String((audience as any).role || "") : null,
        audience_emails: audience.type === "emails" ? recipients : null,
        subject,
        body,
        language: payload.language || "en",
        status: "queued",
      })
      .select("id")
      .maybeSingle();
    campaignId = inserted && inserted.id ? String(inserted.id) : null;
  } catch {
    campaignId = null;
  }

  // 6) Send emails.
  const html = buildHtml(subject, body);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  const CONCURRENCY = 5;
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const chunk = recipients.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (to) => {
        try {
          await sendViaResend({
            apiKey: resendKey,
            from,
            to,
            subject,
            html,
            text: body,
          });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
    for (const r of results) {
      if (r.ok) sent += 1;
      else {
        failed += 1;
        if (r.error) errors.push(r.error);
      }
    }
  }

  const status =
    failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";

  // 7) Update campaign log (best-effort).
  if (campaignId) {
    try {
      await supabase
        .from("newsletter_campaigns")
        .update({
          status,
          sent_count: sent,
          failed_count: failed,
          error: errors.length ? errors.slice(0, 3).join(" | ") : null,
        })
        .eq("id", campaignId);
    } catch {
      // ignore
    }
  }

  return json(200, { ok: true, sent, failed, status });
});

