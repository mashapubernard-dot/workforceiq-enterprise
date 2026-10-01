import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown, max = 12000) {
  return JSON.stringify(value).slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    const context = body?.context;

    if (!question) {
      return NextResponse.json({ error: "Ask IQ needs a question." }, { status: 400 });
    }

    if (question.length > 1000) {
      return NextResponse.json({ error: "Question is too long." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Ask IQ is not connected yet. Add OPENAI_API_KEY to the server environment." },
        { status: 503 }
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";

    const system = [
      "You are Ask IQ, the WorkforceIQ operational AI assistant.",
      "Answer only from the WorkforceIQ data supplied in the context below.",
      "Never invent names, counts, statuses, schedules, tickets, locations, or other operational facts.",
      "If the supplied context does not contain enough information, say exactly what is missing.",
      "Keep answers concise and useful for an operations manager. Use bullets when helpful.",
      "Treat the supplied data as tenant-scoped. Never ask for or reveal secrets, credentials, internal IDs, or data outside the supplied context.",
      "This is an observation and explanation layer. Do not claim that you changed records or performed an action.",
      "The timestamp is the client session's current time; use it only to interpret the supplied snapshot.",
    ].join(" ");

    const input = [
      system,
      "",
      "USER QUESTION:",
      question,
      "",
      "CURRENT WORKFORCEIQ SESSION DATA:",
      clean(context),
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 500,
        input,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message =
        data?.error?.message ||
        "The Ask IQ AI service returned an error.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const answer =
      typeof data?.output_text === "string"
        ? data.output_text.trim()
        : Array.isArray(data?.output)
          ? data.output
              .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
              .map((item: any) => item?.text)
              .filter((text: unknown): text is string => typeof text === "string")
              .join("\n")
              .trim()
          : "";

    if (!answer) {
      return NextResponse.json(
        { error: "Ask IQ did not return an answer." },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Ask IQ request failed", error);
    return NextResponse.json(
      { error: "Ask IQ could not process that request." },
      { status: 500 }
    );
  }
}
