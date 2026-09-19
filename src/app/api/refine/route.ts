import { NextResponse } from "next/server";
import { refine, type AgentMessage } from "@/lib/agent";

function isValidMessages(body: unknown): body is { messages: AgentMessage[] } {
  if (typeof body !== "object" || body === null) return false;
  const messages = (body as { messages?: unknown }).messages;
  return (
    Array.isArray(messages) &&
    messages.every(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidMessages(body) || body.messages.length === 0) {
    return NextResponse.json(
      { error: "Expected { messages: { role, content }[] }" },
      { status: 400 }
    );
  }

  const canvasContext =
    typeof (body as { canvasContext?: unknown }).canvasContext === "string"
      ? (body as { canvasContext?: string }).canvasContext
      : undefined;

  const rawMode = (body as { mediaMode?: unknown }).mediaMode;
  const mediaMode = rawMode === "video" || rawMode === "image" ? rawMode : undefined;

  const result = await refine(body.messages, canvasContext, mediaMode);
  return NextResponse.json(result);
}
