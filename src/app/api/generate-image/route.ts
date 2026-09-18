import { NextResponse } from "next/server";
import { generateImage, IMAGE_MODEL } from "@/lib/byteplus";
import { persistImage } from "@/lib/cloudinary";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const prompt = body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Expected { prompt: string }" }, { status: 400 });
  }

  const result = await generateImage(prompt);
  if (!result.imageUrl) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Same treatment as video (Step 6) — re-host before ever reporting done.
  const permanentUrl = await persistImage(result.imageUrl, crypto.randomUUID());
  if (!permanentUrl) {
    return NextResponse.json({
      error: "The image generated, but saving it permanently failed — mind retrying?",
    }, { status: 502 });
  }

  return NextResponse.json({ imageUrl: permanentUrl, model: IMAGE_MODEL, usage: result.usage });
}
