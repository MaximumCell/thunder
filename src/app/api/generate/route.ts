import { NextResponse } from "next/server";
import { submitVideoTask, type VideoReference } from "@/lib/byteplus";
import { parseReferenceImages } from "@/lib/references";

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

  // Seedance 2.5 accepts 4-30 seconds; anything else falls back to the model default.
  const duration =
    Number.isInteger(body?.duration) && body.duration >= 4 && body.duration <= 30
      ? (body.duration as number)
      : undefined;

  const result = await submitVideoTask(
    prompt,
    ratio,
    reference,
    parseReferenceImages(body?.referenceImages),
    duration
  );
  if (!result.taskId) {
    return NextResponse.json(
      { error: result.error, referenceError: result.referenceError },
      { status: result.referenceError ? 422 : 502 }
    );
  }
  return NextResponse.json({ taskId: result.taskId });
}
