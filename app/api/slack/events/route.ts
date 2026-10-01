import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getWorkforceContext, resolveWorkforceUser } from "@/lib/slack-workforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const expected = "v0=" + createHmac("sha256", secret).update(base).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function askWorkforceIQ(question: string, slackUserId: string, teamId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "I'm connected to WorkforceIQ, but OPENAI_API_KEY hasn't been configured yet.";

  const user = await resolveWorkforceUser(slackUserId, teamId);
  if (!user) return "I couldn't securely link your Slack account to a WorkforceIQ account. Your Slack account is not linked to a WorkforceIQ user yet. An administrator must link this Slack user to the correct WorkforceIQ tenant before live data can be shown.";

  const context = await getWorkforceContext(question, user);
  const instructions = [
    "You are Ask IQ, the secure workplace assistant for WorkforceIQ Enterprise.",
    "Use the supplied live WorkforceIQ context for factual answers.",
    "Never invent missing data.",
    "Never expose another tenant's data.",
    "Employees can only see their own workforce records. Administrators, Supervisors and Team Leaders can see tenant-level operational data supplied in context.",
    "Do not reveal internal IDs, secrets, credentials, or database details.",
    "This bot is read-only. Never claim an action was performed.",
    "Keep responses concise and Slack-friendly.",
    "",
    "LIVE WORKFORCEIQ CONTEXT:",
    JSON.stringify(context),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      instructions,
      input: question.slice(0, 12000),
      store: false,
      max_output_tokens: 900,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("OpenAI error:", await response.text());
    return "I couldn't reach the AI service right now. Please try again in a moment.";
  }

  const data = await response.json();
  return data.output_text || "I didn't receive a usable AI response.";
}

function cleanMention(text: string) {
  return text.replace(/<@[^>]+>/g, "").trim();
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySlackSignature(rawBody, request.headers.get("x-slack-request-timestamp"), request.headers.get("x-slack-signature"))) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (payload.type === "url_verification") return NextResponse.json({ challenge: payload.challenge });
  if (payload.type !== "event_callback") return NextResponse.json({ ok: true });

  const event = payload.event || {};
  if (event.bot_id || event.subtype === "bot_message") return NextResponse.json({ ok: true });

  if (event.type === "app_home_opened") {
    try {
      await slackApi("views.publish", {
        user_id: event.user,
        view: {
          type: "home",
          blocks: [
            { type: "header", text: { type: "plain_text", text: "🤖 Ask IQ" } },
            { type: "section", text: { type: "mrkdwn", text: "Connected to live, tenant-aware WorkforceIQ data. Ask about attendance, late staff, schedules, tickets, people or field operations." } },
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: "*Try asking:*\n• “Who is working right now?”\n• “Who is late today?”\n• “Show today's schedule”\n• “What tickets are open?”\n• “Which technicians are online?”" } },
            { type: "context", elements: [{ type: "mrkdwn", text: "Tenant-aware • Role-aware • Read-only" }] },
          ],
        },
      });
    } catch (error) {
      console.error("Slack Home error:", error);
    }
    return NextResponse.json({ ok: true });
  }

  if (event.type === "app_mention" || (event.type === "message" && event.channel_type === "im")) {
    const question = cleanMention(event.text || "");
    if (!question) {
      await slackApi("chat.postMessage", { channel: event.channel, text: "Hi 👋 I'm Ask IQ. Ask me about attendance, schedules, tickets, people or field operations." });
      return NextResponse.json({ ok: true });
    }

    try {
      await slackApi("chat.postMessage", { channel: event.channel, text: "🤖 Ask IQ is checking WorkforceIQ…", thread_ts: event.ts });
      const answer = await askWorkforceIQ(question, event.user || "unknown", payload.team_id || "unknown");
      await slackApi("chat.postMessage", { channel: event.channel, text: answer, thread_ts: event.ts });
    } catch (error) {
      console.error("WorkforceIQ Slack error:", error);
      await slackApi("chat.postMessage", { channel: event.channel, text: "I hit a connection problem while checking WorkforceIQ. Please try again.", thread_ts: event.ts });
    }
  }

  return NextResponse.json({ ok: true });
}
