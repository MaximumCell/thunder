// BytePlus ModelArk — Dreamina Seedance 2.5 video generation (Step 4b).
// Confirmed against the live ModelArk console + docs (ap-southeast-1
// region), not assumed from memory. See PROGRESS.md for the research notes.
const BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";
export const VIDEO_MODEL = "dreamina-seedance-2-5-260628";

export interface SubmitVideoResult {
  taskId: string | null;
  error: string | null;
}

export type VideoTaskStatus = "generating" | "completed" | "error";

export interface VideoTaskResult {
  status: VideoTaskStatus;
  videoUrl: string | null;
  error: string | null;
  usage?: unknown;
}

function authHeaders() {
  const apiKey = process.env.BYTEPLUS_API_KEY;
  if (!apiKey) throw new Error("BYTEPLUS_API_KEY is not set");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export interface VideoReference {
  type: "video_url" | "image_url";
  url: string;
  // "extend" = continue this same shot forward (BytePlus's purpose-built
  // continuation mode). "reference" (default) = loose style/character
  // consistency for a new, different scene. See PROGRESS.md — the
  // "extend"/omni_reference_task_type field is not confirmed against
  // BytePlus's own docs (SPA, unreadable); inferred from a third-party API
  // wrapper of the same underlying model. Verify via this call's real
  // response.
  mode?: "extend" | "reference";
}

function buildContent(prompt: string, reference?: VideoReference) {
  if (!reference) return [{ type: "text", text: prompt }];
  // Confirmed live (BytePlus 400 body): video reference role must be
  // "reference_video", not "reference". Image role assumed to follow the
  // same "reference_<kind>" pattern — not yet live-verified, since only a
  // video reference has been exercised so far.
  const role = reference.type === "video_url" ? "reference_video" : "reference_image";
  return [
    { [reference.type]: { url: reference.url }, type: reference.type, role },
    { type: "text", text: prompt },
  ];
}

async function submitOnce(
  prompt: string,
  ratio: string,
  reference?: VideoReference
): Promise<string> {
  const body: Record<string, unknown> = {
    model: VIDEO_MODEL,
    content: buildContent(prompt, reference),
    ratio,
  };
  if (reference?.mode === "extend") {
    body.omni_reference_task_type = "extend";
  }

  const res = await fetch(`${BASE_URL}/contents/generations/tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`BytePlus submit ${res.status}:`, body);
    throw new Error(`BytePlus submit returned ${res.status}`);
  }
  const data = await res.json();
  if (typeof data.id !== "string") {
    console.error("BytePlus submit returned no task id:", data);
    throw new Error("BytePlus submit returned no task id");
  }
  return data.id;
}

/** Same retry-once-then-friendly-error contract as agent.ts's refine(). */
export async function submitVideoTask(
  prompt: string,
  ratio: string,
  reference?: VideoReference
): Promise<SubmitVideoResult> {
  try {
    return { taskId: await submitOnce(prompt, ratio, reference), error: null };
  } catch {
    try {
      return { taskId: await submitOnce(prompt, ratio, reference), error: null };
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
        usage: data.usage,
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
