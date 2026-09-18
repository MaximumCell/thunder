// BytePlus ModelArk — Dreamina Seedance 2.5 video generation (Step 4b).
// Confirmed against the live ModelArk console + docs (ap-southeast-1
// region), not assumed from memory. See PROGRESS.md for the research notes.
const BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";
const VIDEO_MODEL = "dreamina-seedance-2-5-260628";

export interface SubmitVideoResult {
  taskId: string | null;
  error: string | null;
}

export type VideoTaskStatus = "generating" | "completed" | "error";

export interface VideoTaskResult {
  status: VideoTaskStatus;
  videoUrl: string | null;
  error: string | null;
}

function authHeaders() {
  const apiKey = process.env.BYTEPLUS_API_KEY;
  if (!apiKey) throw new Error("BYTEPLUS_API_KEY is not set");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

async function submitOnce(prompt: string, ratio: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/contents/generations/tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: VIDEO_MODEL,
      content: [{ type: "text", text: prompt }],
      ratio,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`BytePlus submit returned ${res.status}`);
  const data = await res.json();
  if (typeof data.id !== "string") {
    throw new Error("BytePlus submit returned no task id");
  }
  return data.id;
}

/** Same retry-once-then-friendly-error contract as agent.ts's refine(). */
export async function submitVideoTask(
  prompt: string,
  ratio: string
): Promise<SubmitVideoResult> {
  try {
    return { taskId: await submitOnce(prompt, ratio), error: null };
  } catch {
    try {
      return { taskId: await submitOnce(prompt, ratio), error: null };
    } catch {
      return {
        taskId: null,
        error: "Couldn't start the video generation — mind trying again?",
      };
    }
  }
}

/** Single poll attempt. On a transient failure this reports "generating"
 * rather than erroring outright — the client already re-polls every few
 * seconds, so that loop is the retry; only a real terminal status from
 * BytePlus (succeeded/failed) should end the poll. */
export async function getVideoTask(taskId: string): Promise<VideoTaskResult> {
  try {
    const res = await fetch(`${BASE_URL}/contents/generations/tasks/${taskId}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`BytePlus retrieve returned ${res.status}`);
    const data = await res.json();

    if (data.status === "succeeded") {
      return {
        status: "completed",
        videoUrl: data.content?.video_url ?? null,
        error: null,
      };
    }
    if (data.status === "failed" || data.status === "cancelled" || data.error) {
      return {
        status: "error",
        videoUrl: null,
        error: data.error?.message ?? "Generation failed",
      };
    }
    return { status: "generating", videoUrl: null, error: null };
  } catch {
    return { status: "generating", videoUrl: null, error: null };
  }
}
