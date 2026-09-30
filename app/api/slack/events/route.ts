import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLACK_API = "https://slack.com/api";

function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;
  if (!timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const expected = "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function slackApi(method: string, body: Record<string, unknown>) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not configured");

  const response = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Slack API error: ${response.status}`);
  }
  return data;
}

async function askWorkforceIQ(question: string, slackUserId: string, teamId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "I'm connected to WorkforceIQ, but my AI key hasn't been configured yet. Add OPENAI_API_KEY to the Vercel environment variables and I'll be ready.";
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
  const instructions = [
    "You are WorkforceIQ AI, the workplace assistant for WorkforceIQ Enterprise.",
    "Be concise, practical, professional and friendly.",
    "You can explain WorkforceIQ features, help managers interpret workforce-management information, draft messages, summarize operational issues, and guide users through the system.",
    "Never invent WorkforceIQ data. If live data is not supplied to you, say that you don't have that live data yet.",
    "Never claim to have performed an action unless the application actually confirms it.",
    "Respect tenant and role boundaries. Do not ask users to reveal passwords, API keys, or secrets.",
    `Slack workspace/team id: ${teamId}`,
    `Slack user id: ${slackUserId}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions,
      input: question.slice(0, 12000),
      store: false,
      max_output_tokens: 700,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("OpenAI error:", detail);
    return "I couldn't reach the AI service right now. Please try again in a moment.";
  }

  const data = await response.json();
  return (
    data.output_text ||
    data.output?.flatMap((item: any) => item.content || [])
      ?.map((part: any) => part.text)
      ?.filter(Boolean)
      ?.join("\n") ||
    "I didn't receive a usable AI response."
  );
}

function cleanMention(text: string) {
  return text.replace(/<@[^>]+>/g, "").trim();
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const verification = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");

  if (!verifySlackSignature(rawBody, timestamp, verification)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event || {};

  if (event.bot_id || event.subtype === "bot_message") {
    return NextResponse.json({ ok: true });
  }

  if (event.type === "app_home_opened") {
    try {
      await slackApi("views.publish", {
        user_id: event.user,
        view: {
          type: "home",
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "🤖 WorkforceIQ AI" },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Your AI workforce assistant is ready. Ask questions about WorkforceIQ, workforce operations, reports, schedules, attendance, tickets and more.",
              },
            },
            { type: "divider" },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*Try asking:*\n• “What can WorkforceIQ do?”\n• “Explain today's attendance report”\n• “Help me plan my team's day”\n• “How do I handle an HR case?”",
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "WorkforceIQ AI • Secure server-side AI • Tenant-aware architecture",
                },
              ],
            },
          ],
        },
      });
    } catch (error) {
      console.error("WorkforceIQ Slack Home error:", error);
    }
    return NextResponse.json({ ok: true });
  }

  if (event.type === "app_mention" || (event.type === "message" && event.channel_type === "im")) {
    const text = cleanMention(event.text || "");
    if (!text) {
      await slackApi("chat.postMessage", {
        channel: event.channel,
        text: "Hi 👋 I'm WorkforceIQ AI. Ask me something like *“What can WorkforceIQ do?”* or *“Help me understand today's attendance.”*",
      });
      return NextResponse.json({ ok: true });
    }

    try {
      await slackApi("chat.postMessage", {
        channel: event.channel,
        text: "🤖 I'm on it…",
        thread_ts: event.ts,
      });

      const answer = await askWorkforceIQ(text, event.user || "unknown", payload.team_id || "unknown");

      await slackApi("chat.postMessage", {
        channel: event.channel,
        text: answer,
        thread_ts: event.ts,
      });
    } catch (error) {
      console.error("WorkforceIQ Slack bot error:", error);
      await slackApi("chat.postMessage", {
        channel: event.channel,
        text: "I hit a connection problem while processing that. Please try again.",
        thread_ts: event.ts,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
