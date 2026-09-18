import { NextResponse } from "next/server";
import { submitVideoTask, type VideoReference } from "@/lib/byteplus";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const prompt = body?.prompt;
  const ratio = body?.ratio;
  if (typeof prompt !== "string" || !prompt.trim() || typeof ratio !== "string") {
    return NextResponse.json(
      { error: "Expected { prompt: string, ratio: string }" },
      { status: 400 }
    );
  }
  const reference: VideoReference | undefined =
    (body?.reference?.type === "video_url" || body?.reference?.type === "image_url") &&
    typeof body.reference.url === "string"
      ? {
          type: body.reference.type,
          url: body.reference.url,
          mode: body.reference.mode === "extend" ? "extend" : "reference",
        }
      : undefined;

  const result = await submitVideoTask(prompt, ratio, reference);
  if (!result.taskId) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ taskId: result.taskId });
}
