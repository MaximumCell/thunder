import { NextResponse } from "next/server";
import { getVideoTask, VIDEO_MODEL } from "@/lib/byteplus";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const result = await getVideoTask(taskId);
  return NextResponse.json({ ...result, model: VIDEO_MODEL });
}
