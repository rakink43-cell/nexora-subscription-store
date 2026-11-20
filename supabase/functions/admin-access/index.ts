import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = "https://nexora-subscription-store.pages.dev";

const allowedOrigins = new Set([SITE_URL, "http://localhost:5173"]);
function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      (host === "nexora-subscription-store.pages.dev" ||
       host.endsWith(".nexora-subscription-store.pages.dev"));
  } catch {
    return false;
  }
}
const encoder = new TextEncoder();

function headers(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? SITE_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}port "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = "https://nexora-subscription-store.pages.dev";

const allowedOrigins = new Set([SITE_URL, "http://localhost:5173"]);
function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      (host === "nexora-subscription-store.pages.dev" ||
       host.endsWith(".nexora-subscription-store.pages.dev"));
  } catch {
    return false;
  }
}
const encoder = new TextEncoder();

function headers(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : SITE_URL;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers(origin), "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publicAuth = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getAdmin(username: string) {
  const { data: credential, error } = await service
    .from("admin_login_credentials")
    .select("user_id, username")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (error || !credential) return null;

  const { data: role } = await service
    .from("user_roles")
    .select("user_id")
    .eq("user_id", credential.user_id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return null;

  const { data: userData, error: userError } = await service.auth.admin.getUserById(credential.user_id);
  if (userError || !userData.user?.email || !userData.user.email_confirmed_at) return null;

  return { userId: credential.user_id, email: userData.user.email };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (!isAllowedOrigin(origin)) return json({ error: "Origin not allowed." }, 403, origin);

  try {
    const body = await req.json();
    const action = String(body?.action ?? "");

    if (action === "setup") {
      const token = String(body?.token ?? "");
      const password = String(body?.password ?? "");
      if (!token || password.length < 12) {
        return json({ error: "Use the valid setup link and a password of at least 12 characters." }, 400, origin);
      }

      const tokenHash = await sha256(token);
      const { data: consumed, error: consumeError } = await service
        .from("admin_password_setup_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token_hash", tokenHash)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("user_id")
        .maybeSingle();

      if (consumeError || !consumed?.user_id) {
        return json({ error: "This setup link is invalid, expired, or already used." }, 400, origin);
      }

      const { data: role } = await service
        .from("user_roles")
        .select("user_id")
        .eq("user_id", consumed.user_id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) return json({ error: "Administrator account not found." }, 403, origin);

      const { error: updateError } = await service.auth.admin.updateUserById(consumed.user_id, { password });
      if (updateError) return json({ error: "Could not set the admin password. Request a new setup link." }, 500, origin);
      return json({ ok: true, message: "Admin password created. Sign in with your username." }, 200, origin);
    }

    const username = String(body?.username ?? "").trim().toLowerCase();
    if (!username || username.length > 40) {
      return json({ error: "Enter your admin username." }, 400, origin);
    }

    const admin = await getAdmin(username);
    if (!admin) {
      // Keep responses generic so usernames and account existence cannot be enumerated.
      return action === "forgot"
        ? json({ ok: true, message: "If the admin username exists, a reset link will be sent to its registered recovery email." }, 200, origin)
        : json({ error: "Invalid username or password." }, 401, origin);
    }

    if (action === "login") {
      const password = String(body?.password ?? "");
      if (!password) return json({ error: "Enter your password." }, 400, origin);
      const { data, error } = await publicAuth.auth.signInWithPassword({ email: admin.email, password });
      if (error || !data.session || data.user?.id !== admin.userId) {
        return json({ error: "Invalid username or password." }, 401, origin);
      }
      return json({ session: data.session }, 200, origin);
    }

    if (action === "forgot") {
      const { error } = await publicAuth.auth.resetPasswordForEmail(admin.email, {
        redirectTo: `${SITE_URL}/admin/login?reset=1`,
      });
      if (error) return json({ error: "The recovery email could not be sent right now. Please try again later." }, 429, origin);
      return json({ ok: true, message: "A password reset link has been sent to the registered recovery email." }, 200, origin);
    }

    return json({ error: "Unsupported action." }, 400, origin);
  } catch {
    return json({ error: "The request could not be completed. Please try again." }, 400, origin);
  }
});
