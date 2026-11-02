import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const enc = new TextEncoder();
const b32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32(bytes: Uint8Array) {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += b32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += b32[(value << (5 - bits)) & 31];
  return out;
}
function decode32(value: string) {
  let bits = 0, buffer = 0; const out: number[] = [];
  for (const char of value.replace(/=+$/g, "").toUpperCase()) {
    const n = b32.indexOf(char); if (n < 0) throw new Error("Invalid authenticator secret");
    buffer = (buffer << 5) | n; bits += 5;
    if (bits >= 8) { out.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
function toB64(bytes: Uint8Array) {
  let binary = ""; bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
function fromB64(value: string) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
async function encryptionKey() {
  const raw = Deno.env.get("TOTP_ENCRYPTION_KEY");
  if (!raw) throw new Error("Server TOTP_ENCRYPTION_KEY is not configured");
  const bytes = fromB64(raw);
  if (bytes.length !== 32) throw new Error("TOTP_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), enc.encode(secret));
  return `v1.${toB64(iv)}.${toB64(new Uint8Array(cipher))}`;
}
async function decryptSecret(value: string) {
  const [version, iv, cipher] = value.split(".");
  if (version !== "v1" || !iv || !cipher) throw new Error("Unsupported encrypted secret");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, await encryptionKey(), fromB64(cipher));
  return new TextDecoder().decode(plain);
}
async function totp(secret: string, step: number) {
  const key = await crypto.subtle.importKey("raw", decode32(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const counter = new Uint8Array(8); let n = BigInt(step);
  for (let i = 7; i >= 0; i--) { counter[i] = Number(n & 255n); n >>= 8n; }
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}
async function verifyTotp(secret: string, code: string) {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(Date.now() / 30_000);
  for (const step of [current - 1, current, current + 1]) {
    if (await totp(secret, step) === code) return step;
  }
  return null;
}
function makeSecret() { return base32(crypto.getRandomValues(new Uint8Array(20))); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Sign-in required" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Sign-in required" }, 401);
    const actorId = authData.user.id;
    const { data: actor, error: actorError } = await admin.from("user_profiles")
      .select("id,org_id,role").eq("id", actorId).maybeSingle();
    if (actorError || !actor?.org_id) return json({ error: "Company account not found" }, 403);

    const body = await req.json();
    const action = String(body.action || "");
    const normalizeRole = (value: unknown) => String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
    const isPlatformRole = (value: unknown) => ["super admin", "platform super admin"].includes(normalizeRole(value));
    const isAdmin = normalizeRole(actor.role) === "administrator";

    if (action === "start_enrollment" || action === "verify_enrollment" || action === "list_enrollments" || action === "revoke_enrollment") {
      if (!isAdmin) return json({ error: "Administrator access required" }, 403);
      if (action === "list_enrollments") {
        const { data, error } = await admin.from("workforceiq_kiosk_totp")
          .select("employee_id,enrolled_at").eq("org_id", actor.org_id).not("enrolled_at", "is", null);
        if (error) throw error;
        return json({ enrollments: data || [] });
      }
      const employeeId = String(body.employee_id || "");
      const { data: employee, error: employeeError } = await admin.from("user_profiles")
        .select("id,full_name,org_id,role").eq("id", employeeId).eq("org_id", actor.org_id).maybeSingle();
      if (employeeError || !employee) return json({ error: "Employee is not in your company" }, 404);
      if (isPlatformRole(employee.role)) return json({ error: "Platform administrator accounts cannot be enrolled for tenant attendance." }, 403);

      if (action === "start_enrollment") {
        const secret = makeSecret();
        const encrypted = await encryptSecret(secret);
        const { error } = await admin.from("workforceiq_kiosk_totp").upsert({
          employee_id: employeeId, org_id: actor.org_id, pending_encrypted_secret: encrypted,
          pending_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString(),
        }, { onConflict: "employee_id" });
        if (error) throw error;
        const label = encodeURIComponent(`WorkforceIQ:${employee.full_name || employeeId}`);
        const issuer = encodeURIComponent("WorkforceIQ");
        const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
        await admin.from("workforceiq_kiosk_audit").insert({ org_id: actor.org_id, employee_id: employeeId, actor_id: actorId, event_type: "ENROLLMENT_STARTED" });
        return json({ secret, otpauth_uri: uri, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
      }

      if (action === "verify_enrollment") {
        const { data: row, error } = await admin.from("workforceiq_kiosk_totp")
          .select("pending_encrypted_secret,pending_expires_at,failed_attempts,locked_until").eq("employee_id", employeeId).eq("org_id", actor.org_id).maybeSingle();
        if (error || !row?.pending_encrypted_secret || !row.pending_expires_at || new Date(row.pending_expires_at).getTime() < Date.now()) {
          return json({ error: "Enrollment expired. Start enrollment again." }, 400);
        }
        if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
          return json({ error: "Too many incorrect codes. Wait five minutes or ask your administrator to restart setup." }, 429);
        }
        const secret = await decryptSecret(row.pending_encrypted_secret);
        const step = await verifyTotp(secret, String(body.code || ""));
        if (step === null) {
          const { data: locked, error: lockError } = await admin.rpc("workforceiq_register_kiosk_totp_failure", {
            p_employee_id: employeeId, p_org_id: actor.org_id,
          });
          if (lockError) throw lockError;
          await admin.from("workforceiq_kiosk_audit").insert({ org_id: actor.org_id, employee_id: employeeId, actor_id: actorId, event_type: "ENROLLMENT_VERIFICATION_FAILED" });
          return json({ error: locked ? "Too many incorrect codes. Wait five minutes or ask your administrator to restart setup." : "Code not accepted. Check the current six-digit code and try again." }, locked ? 429 : 400);
        }
        const { error: saveError } = await admin.from("workforceiq_kiosk_totp").update({
          encrypted_secret: row.pending_encrypted_secret, pending_encrypted_secret: null,
          pending_expires_at: null, enrolled_at: new Date().toISOString(), last_used_step: step,
          failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString(),
        }).eq("employee_id", employeeId).eq("org_id", actor.org_id);
        if (saveError) throw saveError;
        await admin.from("workforceiq_kiosk_audit").insert({ org_id: actor.org_id, employee_id: employeeId, actor_id: actorId, event_type: "ENROLLMENT_COMPLETED" });
        return json({ success: true });
      }

      if (action === "revoke_enrollment") {
        const { error } = await admin.from("workforceiq_kiosk_totp").delete().eq("employee_id", employeeId).eq("org_id", actor.org_id);
        if (error) throw error;
        await admin.from("workforceiq_kiosk_audit").insert({ org_id: actor.org_id, employee_id: employeeId, actor_id: actorId, event_type: "ENROLLMENT_REVOKED" });
        return json({ success: true });
      }
    }

    if (action === "self_clock") {
      if (isPlatformRole(actor.role)) return json({ error: "Platform administrator accounts do not use tenant employee attendance." }, 403);
      const employeeId = actorId;
      const { data: row, error } = await admin.from("workforceiq_kiosk_totp")
        .select("encrypted_secret,failed_attempts,locked_until").eq("employee_id", employeeId)
        .eq("org_id", actor.org_id).not("enrolled_at", "is", null).maybeSingle();
      if (error || !row?.encrypted_secret) return json({ error: "Authenticator enrollment is required." }, 403);
      if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) return json({ error: "Too many attempts. Wait five minutes." }, 429);
      const step = await verifyTotp(await decryptSecret(row.encrypted_secret), String(body.code || ""));
      if (step === null) {
        const { data: locked, error: lockError } = await admin.rpc("workforceiq_register_kiosk_totp_failure", {
          p_employee_id: employeeId, p_org_id: actor.org_id,
        });
        if (lockError) throw lockError;
        await admin.from("workforceiq_kiosk_audit").insert({
          org_id: actor.org_id, employee_id: employeeId, actor_id: actorId,
          event_type: "AUTHENTICATION_FAILED", details: { method: "SELF_SERVICE_TOTP" },
        });
        return json({ error: locked ? "Too many attempts. Wait five minutes." : "Code not accepted." }, locked ? 429 : 401);
      }
      const { data: consumed, error: consumeError } = await admin.rpc("workforceiq_consume_kiosk_totp_step", {
        p_employee_id: employeeId, p_org_id: actor.org_id, p_step: step,
      });
      if (consumeError || consumed !== true) return json({ error: "Code already used. Wait for the next code." }, 409);
      const { data: punch, error: punchError } = await admin.rpc("workforceiq_kiosk_record_self_punch", {
        p_employee_id: employeeId, p_org_id: actor.org_id,
        p_latitude: body.latitude ?? null, p_longitude: body.longitude ?? null,
        p_accuracy_m: body.accuracy_m ?? null, p_site_id: null, p_distance_m: null,
        p_geofence_status: null,
      });
      if (punchError) return json({ error: "Attendance could not be recorded. Check your GPS location and work-site geofence, then try again." }, 403);
      if (punch?.error) return json({ error: punch.error }, 403);
      await admin.from("workforceiq_kiosk_audit").insert({
        org_id: actor.org_id, employee_id: employeeId, actor_id: actorId,
        event_type: punch.action, details: { event_time: punch.event_time, method: "SELF_SERVICE_TOTP" },
      });
      return json(punch);
    }

    if (action === "kiosk_list") {
      if (!isAdmin) return json({ error: "Company kiosk administrator sign-in required" }, 403);
      const { data: enrolled, error } = await admin.from("workforceiq_kiosk_totp")
        .select("employee_id").eq("org_id", actor.org_id).not("enrolled_at", "is", null);
      if (error) throw error;
      const ids = (enrolled || []).map((r: any) => r.employee_id);
      if (!ids.length) return json({ employees: [] });
      const { data: people, error: peopleError } = await admin.from("user_profiles")
        .select("id,full_name,role").eq("org_id", actor.org_id).in("id", ids).order("full_name");
      if (peopleError) throw peopleError;
      return json({ employees: (people || []).filter((p: any) => !isPlatformRole(p.role)).map((p: any) => ({ id: p.id, name: p.full_name || "Employee" })) });
    }

    if (action === "clock") {
      if (!isAdmin) return json({ error: "Company kiosk administrator sign-in required" }, 403);
      const employeeId = String(body.employee_id || "");
      const { data: selectedEmployee, error: selectedEmployeeError } = await admin.from("user_profiles")
        .select("id,role").eq("id", employeeId).eq("org_id", actor.org_id).maybeSingle();
      if (selectedEmployeeError || !selectedEmployee || isPlatformRole(selectedEmployee.role)) return json({ error: "Employee is not eligible for tenant attendance." }, 403);
      const { data: row, error } = await admin.from("workforceiq_kiosk_totp")
        .select("encrypted_secret,failed_attempts,locked_until,last_used_step")
        .eq("employee_id", employeeId).eq("org_id", actor.org_id).not("enrolled_at", "is", null).maybeSingle();
      const genericError = () => json({ error: "Code not accepted. Check your authenticator and try again." }, 401);
      if (error || !row?.encrypted_secret) return genericError();
      if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) return json({ error: "Too many attempts. Ask your administrator for help." }, 429);
      const secret = await decryptSecret(row.encrypted_secret);
      const step = await verifyTotp(secret, String(body.code || ""));
      if (step === null) {
        const { data: locked, error: lockError } = await admin.rpc("workforceiq_register_kiosk_totp_failure", {
          p_employee_id: employeeId, p_org_id: actor.org_id,
        });
        if (lockError) throw lockError;
        await admin.from("workforceiq_kiosk_audit").insert({ org_id: actor.org_id, employee_id: employeeId, actor_id: actorId, event_type: "AUTHENTICATION_FAILED" });
        return json({ error: locked ? "Too many attempts. Ask your administrator for help." : "Code not accepted. Check your authenticator and try again." }, locked ? 429 : 401);
      }
      const { data: consumed, error: consumeError } = await admin.rpc("workforceiq_consume_kiosk_totp_step", {
        p_employee_id: employeeId, p_org_id: actor.org_id, p_step: step,
      });
      if (consumeError || consumed !== true) return json({ error: "This code has already been used. Wait for the next code." }, 409);
      const { data: punch, error: punchError } = await admin.rpc("workforceiq_kiosk_record_self_punch", {
        p_employee_id: employeeId, p_org_id: actor.org_id,
        p_latitude: typeof body.latitude === "number" ? body.latitude : null,
        p_longitude: typeof body.longitude === "number" ? body.longitude : null,
        p_accuracy_m: typeof body.accuracy_m === "number" ? body.accuracy_m : null,
        p_site_id: null, p_distance_m: null, p_geofence_status: null,
      });
      if (punchError) return json({ error: "Attendance could not be recorded. Check the GPS location and work-site geofence, then try again." }, 403);
      if (punch?.error) return json({ error: punch.error }, 403);
      await admin.from("workforceiq_kiosk_audit").insert({
        org_id: actor.org_id, employee_id: employeeId, actor_id: actorId,
        event_type: punch.action, details: { event_time: punch.event_time },
      });
      return json(punch);
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("totp-kiosk error", error instanceof Error ? error.message : "unknown");
    return json({ error: "The kiosk service could not complete this request." }, 500);
  }
});
