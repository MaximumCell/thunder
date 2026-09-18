import { NextResponse } from "next/server";
import { continuePrompt } from "@/lib/agent";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const context = body?.context;
  const instruction = body?.instruction;
  if (typeof instruction !== "string" || !instruction.trim()) {
    return NextResponse.json(
      { error: "Expected { context?: string, instruction: string }" },
      { status: 400 }
    );
  }

  const result = await continuePrompt(typeof context === "string" ? context : "", instruction);
  if (!result.prompt) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ prompt: result.prompt, usage: result.usage });
}
