import { createClient } from "@supabase/supabase-js";

export type WorkforceUser = {
  id: string;
  full_name: string;
  role: string;
  email: string | null;
  org_id: string | null;
  organization_id: string | null;
  tenant_id: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function slackApi(method: string, body: Record<string, unknown>) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not configured");
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || `Slack API error: ${response.status}`);
  return data;
}

export async function resolveWorkforceUser(slackUserId: string, teamId: string): Promise<WorkforceUser | null> {
  const supabase = getSupabaseAdmin();

  const { data: link, error: linkError } = await supabase
    .from("workforce_slack_identity")
    .select("workforce_user,org_id,enabled")
    .eq("slack_team", teamId)
    .eq("slack_user", slackUserId)
    .eq("enabled", true)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!link) return null;

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("id,full_name,role,email,org_id,organization_id,tenant_id")
    .eq("id", link.workforce_user)
    .maybeSingle();

  if (error) throw error;
  if (!profile) return null;

  const profileOrg = profile.org_id || profile.organization_id || profile.tenant_id;
  if (profileOrg !== link.org_id) return null;

  return profile as WorkforceUser;
}

function orgIdFor(user: WorkforceUser) {
  return user.org_id || user.organization_id || user.tenant_id;
}

function localDate(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function localTime(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
}

function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

const has = (q: string, words: string[]) => words.some((w) => q.toLowerCase().includes(w));

export async function getWorkforceContext(question: string, user: WorkforceUser) {
  const supabase = getSupabaseAdmin();
  const orgId = orgIdFor(user);
  if (!orgId) return { access: "no_tenant", message: "No tenant is assigned. Never expose cross-tenant data." };

  const { data: org, error: orgError } = await supabase.from("organizations").select("id,name,timezone").eq("id", orgId).maybeSingle();
  if (orgError) throw orgError;

  const timeZone = org?.timezone || "Africa/Johannesburg";
  const today = localDate(new Date(), timeZone);
  const q = question.toLowerCase();

  const attendanceQ = has(q, ["attendance","late","clock","working","break","lunch","aux","status"]);
  const scheduleQ = has(q, ["schedule","scheduled","shift","today","tomorrow"]) || has(q, ["late"]);
  const ticketQ = has(q, ["ticket","incident","case","service hub","hr case"]);
  const peopleQ = has(q, ["people","employees","staff","team","agents","who"]);
  const fieldQ = has(q, ["technician","tech","field","gps","location","device","online"]);

  const includeAttendance = attendanceQ || (!scheduleQ && !ticketQ && !peopleQ && !fieldQ);
  const includeSchedule = scheduleQ;
  const includePeople = peopleQ || includeAttendance || includeSchedule;

  const context: Record<string, unknown> = {
    tenant: { id: orgId, name: org?.name || "Unknown tenant", timezone: timeZone, today },
    requesting_user: { name: user.full_name, role: user.role },
    visibility: user.role === "Employee" ? "employee_self_only" : "tenant_manager_scope",
  };

  if (includePeople) {
    const { data, error } = await supabase.from("user_profiles").select("id,full_name,role").eq("org_id", orgId).order("full_name").limit(500);
    if (error) throw error;
    context.people = data || [];
  }

  if (includeAttendance) {
    const { data, error } = await supabase.from("attendance")
      .select("user_id,clock_in,clock_out,status,status_started_at,org_id")
      .eq("org_id", orgId).order("clock_in", { ascending: false }).limit(500);
    if (error) throw error;

    const rows = (data || []).filter((r) => localDate(r.clock_in, timeZone) === today && (user.role !== "Employee" || r.user_id === user.id));
    context.attendance = rows;
    context.currently_working = rows.filter((r) => !r.clock_out);
  }

  if (includeSchedule) {
    const { data, error } = await supabase.from("schedules")
      .select("user_id,schedule_date,start_time,end_time,break_minutes,shift_type,notes,org_id")
      .eq("org_id", orgId).eq("schedule_date", today).order("start_time").limit(500);
    if (error) throw error;

    const rows = (data || []).filter((r) => user.role !== "Employee" || r.user_id === user.id);
    context.schedules_today = rows;

    const attendance = (context.attendance as any[]) || [];
    const byUser = new Map(attendance.map((r) => [r.user_id, r]));
    const now = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    const nowMinutes = minutes(now);
    context.late_today = rows.filter((shift) => {
      const a = byUser.get(shift.user_id);
      if (a?.clock_in) return minutes(localTime(a.clock_in, timeZone)) > minutes(shift.start_time) + 5;
      return nowMinutes > minutes(shift.start_time) + 5;
    }).map((shift) => ({ user_id: shift.user_id, scheduled_start: shift.start_time, clock_in: byUser.get(shift.user_id)?.clock_in || null }));
  }

  if (ticketQ) {
    const { data, error } = await supabase.from("tickets")
      .select("id,title,status,priority,ticket_type,requester,assignee,branch,incident_number,created_at,notes,org_id")
      .eq("org_id", orgId).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;

    const rows = (data || []).filter((r) =>
      user.role !== "Employee" ||
      String(r.requester || "").toLowerCase() === user.full_name.toLowerCase()
    );
    context.tickets = rows;
    context.open_tickets = rows.filter((r) => !["closed","resolved","complete","completed"].includes(String(r.status || "").toLowerCase()));
  }

  if (fieldQ) {
    const { data, error } = await supabase.from("mobile_workforce_sessions")
      .select("user_id,device_id,platform,last_seen_at,last_latitude,last_longitude,status,battery_percent")
      .eq("org_id", orgId).order("last_seen_at", { ascending: false }).limit(200);
    if (error) throw error;
    context.field_sessions = (data || []).filter((r) => user.role !== "Employee" || r.user_id === user.id);
  }

  return context;
}
