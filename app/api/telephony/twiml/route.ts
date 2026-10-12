import twilio from "twilio";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const callerId = process.env.TWILIO_CALLER_ID;
  if (!authToken || !callerId) {
    return new NextResponse("Telephony is not configured.", { status: 503 });
  }

  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });

  const signature = request.headers.get("x-twilio-signature") || "";
  const valid = twilio.validateRequest(authToken, signature, request.url, params);
  if (!valid) return new NextResponse("Invalid Twilio signature.", { status: 403 });

  const to = (params.To || "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(to)) {
    const response = new twilio.twiml.VoiceResponse();
    response.say("Please provide a valid phone number in international format.");
    response.hangup();
    return new NextResponse(response.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const response = new twilio.twiml.VoiceResponse();
  const dial = response.dial({ callerId, answerOnBridge: true, timeout: 30 });
  dial.number(to);
  return new NextResponse(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}
