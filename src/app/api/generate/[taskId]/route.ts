import { NextResponse } from "next/server";
import { getVideoTask, VIDEO_MODEL } from "@/lib/byteplus";
import { persistVideo } from "@/lib/cloudinary";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const result = await getVideoTask(taskId);

  if (result.status !== "completed" || !result.videoUrl) {
    return NextResponse.json({ ...result, model: VIDEO_MODEL });
  }

  // Re-host on Cloudinary before ever reporting "completed" — the raw
  // BytePlus video_url expires in ~24h and must never be the value the
  // frontend (or generation_tasks.media_url) ends up persisting.
  const permanentUrl = await persistVideo(result.videoUrl, taskId);
  if (!permanentUrl) {
    return NextResponse.json({
      status: "error",
      videoUrl: null,
      error: "The video generated, but saving it permanently failed — mind retrying?",
      model: VIDEO_MODEL,
    });
  }

  return NextResponse.json({
    ...result,
    videoUrl: permanentUrl,
    // Kept for reference/debugging even though it'll be dead in ~24h —
    // media_url (permanentUrl above) is the one everything else reads.
    byteplusUrl: result.videoUrl,
    model: VIDEO_MODEL,
  });
}
