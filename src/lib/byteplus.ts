// BytePlus ModelArk — Dreamina Seedance 2.5 video generation (Step 4b) and
// ByteDance-Seedream-4.5 image generation (Step 8). Confirmed against the
// live ModelArk console + docs (ap-southeast-1 region), not assumed from
// memory. See PROGRESS.md for the research notes.
const BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";
export const VIDEO_MODEL = "dreamina-seedance-2-5-260628";
// Override with BYTEPLUS_IMAGE_MODEL (e.g. seedream-5-0-260128 = Seedream 5.0 lite,
// which the docs list as a trusted face source for Seedance). Not activated on
// this account as of writing - a call returns ModelNotOpen until it is.
export const IMAGE_MODEL = process.env.BYTEPLUS_IMAGE_MODEL || "seedream-4-5-251128";

export interface SubmitVideoResult {
  taskId: string | null;
  error: string | null;
  // True when BytePlus rejected the request because of an attached reference
  // image (real person detected, unreadable image, ...) — a known, explainable
  // failure, so `error` carries the specific reason instead of the generic one.
  referenceError?: boolean;
}

export type VideoTaskStatus = "generating" | "completed" | "error";

export interface VideoTaskResult {
  status: VideoTaskStatus;
  videoUrl: string | null;
  error: string | null;
  referenceError?: boolean;
  usage?: unknown;
}

/** A non-2xx BytePlus response. `code`/`detail` come from its
 * `{ error: { code, message } }` body. */
export class BytePlusApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string
  ) {
    super(`BytePlus returned ${status} ${code}`);
  }
}

async function toApiError(res: Response, what: string) {
  const text = await res.text().catch(() => "");
  console.error(`BytePlus ${what} ${res.status}:`, text);
  let code = "";
  let detail = "";
  try {
    const err = JSON.parse(text)?.error;
    code = typeof err?.code === "string" ? err.code : "";
    detail = typeof err?.message === "string" ? err.message : "";
  } catch {}
  return new BytePlusApiError(res.status, code, detail);
}

// Codes verified against the ModelArk error-codes page (Sept 2026):
// InputImageSensitiveContentDetected[.PrivacyInformation] ("input image may
// contain real person") and InvalidImageURL.*. The message match covers
// task-level failures, which may report only a message string.
const REFERENCE_CODE = /^(InputImageSensitiveContentDetected|InvalidImageURL)/;
const REFERENCE_MESSAGE = /input image|real person|reference image|error while downloading/i;

function isReferenceError(code?: string, message?: string) {
  return REFERENCE_CODE.test(code ?? "") || REFERENCE_MESSAGE.test(message ?? "");
}

function referenceReason(detail: string) {
  // Drop BytePlus's trailing "Request id: ..." (noise for the user) and any final period.
  const reason = detail.replace(/\s*Request id:.*$/i, "").replace(/\.\s*$/, "");
  return `BytePlus rejected a reference image: ${reason}. Replace or remove it and try again.`;
}

// "InvalidParameter.TaskTypeConstraint / TaskTypeMismatch": the model classified
// the request as a task type (video extension/editing, ...) whose rules our
// parameters break. BytePlus's message says exactly what, so show it.
const TASK_TYPE_CODE = /^InvalidParameter\.TaskType/;

/** A user-facing reason for failures BytePlus explains well (bad reference
 * image, task-type rule); null for everything else (kept generic). */
function explainReason(code?: string, message?: string): string | null {
  if (isReferenceError(code, message)) return referenceReason(message || code || "");
  if (TASK_TYPE_CODE.test(code ?? "")) {
    const reason = (message ?? "").replace(/\s*Request id:.*$/i, "").replace(/\.\s*$/, "");
    return `BytePlus couldn't run this request: ${reason}. Adjust the prompt or options and try again.`;
  }
  return null;
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
  // Informational only. We no longer send omni_reference_task_type: per the
  // Seedance 2.5 docs, when it is omitted the model infers the task from the
  // prompt ("continue ..." -> video extension, otherwise plain
  // reference-to-video), and forcing "extend" 400'd on prompts like "make a
  // variation of this".
  mode?: "extend" | "reference";
}

// Multiple reference images = one `image_url` content item each, every one
// with role "reference_image" (Seedance 2.5: 1–30 images; role confirmed in
// the live Create-a-video-task docs). Mixes with a reference video/image.
function buildContent(
  prompt: string,
  reference?: VideoReference,
  referenceImages: string[] = []
) {
  const items: Record<string, unknown>[] = [];
  if (reference) {
    // Confirmed live (BytePlus 400 body): video reference role must be
    // "reference_video", not "reference".
    const role = reference.type === "video_url" ? "reference_video" : "reference_image";
    items.push({ [reference.type]: { url: reference.url }, type: reference.type, role });
  }
  for (const url of referenceImages) {
    items.push({ type: "image_url", image_url: { url }, role: "reference_image" });
  }
  items.push({ type: "text", text: prompt });
  return items;
}

async function submitOnce(
  prompt: string,
  ratio: string,
  reference?: VideoReference,
  referenceImages: string[] = [],
  duration?: number
): Promise<string> {
  const body: Record<string, unknown> = {
    model: VIDEO_MODEL,
    content: buildContent(prompt, reference, referenceImages),
  };
  // With a reference VIDEO the model may treat the task as an extension or an
  // edit, and for those the ratio must be "adaptive" (it follows the input
  // video) - sending any ratio is a 400 (live: InvalidParameter.TaskTypeConstraint).
  // Omitting it means adaptive, so only send a ratio when there is no video.
  if (reference?.type !== "video_url") body.ratio = ratio;
  // Seedance 2.5: integer in [4, 30], or -1 (model chooses). Omitted = default (-1).
  if (duration) body.duration = duration;

  const res = await fetch(`${BASE_URL}/contents/generations/tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw await toApiError(res, "submit");
  const data = await res.json();
  if (typeof data.id !== "string") {
    console.error("BytePlus submit returned no task id:", data);
    throw new Error("BytePlus submit returned no task id");
  }
  return data.id;
}

/** Same retry-once-then-friendly-error contract as agent.ts's refine(),
 * except a 4xx isn't retried (it would fail identically) and a rejected
 * reference image surfaces BytePlus's own reason. */
export async function submitVideoTask(
  prompt: string,
  ratio: string,
  reference?: VideoReference,
  referenceImages: string[] = [],
  duration?: number
): Promise<SubmitVideoResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return {
        taskId: await submitOnce(prompt, ratio, reference, referenceImages, duration),
        error: null,
      };
    } catch (err) {
      lastErr = err;
      if (err instanceof BytePlusApiError && err.status < 500) break;
    }
  }
  const explained =
    lastErr instanceof BytePlusApiError ? explainReason(lastErr.code, lastErr.detail) : null;
  if (explained) return { taskId: null, error: explained, referenceError: true };
  return { taskId: null, error: "Couldn't start the video generation — mind trying again?" };
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
      const message: string | undefined = data.error?.message;
      const explained = explainReason(data.error?.code, message);
      return {
        status: "error",
        videoUrl: null,
        // Only failures BytePlus explains well are shown verbatim; anything
        // else stays the generic message.
        error: explained ?? "Generation failed",
        referenceError: explained !== null,
      };
    }
    return { status: "generating", videoUrl: null, error: null };
  } catch {
    return { status: "generating", videoUrl: null, error: null };
  }
}

export interface ImageResult {
  imageUrl: string | null;
  error: string | null;
  referenceError?: boolean;
  usage?: unknown;
}

// Confirmed live via the ModelArk console's "Quick API access" sample code
// for the activated ByteDance-Seedream-4.5 model — not guessed. Synchronous
// (returns the image directly), unlike video's submit-then-poll flow.
async function generateImageOnce(
  prompt: string,
  referenceImages: string[]
): Promise<{ url: string; usage: unknown }> {
  const res = await fetch(`${BASE_URL}/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      // Multi-reference input: `image` is string | string[] (up to 14 for
      // Seedream 4.5, per the Image generation API docs). Omitted entirely
      // for plain text-to-image.
      ...(referenceImages.length > 0 && { image: referenceImages }),
      sequential_image_generation: "disabled",
      response_format: "url",
      size: "2K",
      stream: false,
      watermark: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw await toApiError(res, "image generation");
  const data = await res.json();
  const url = data?.data?.[0]?.url;
  if (typeof url !== "string") {
    console.error("BytePlus image generation returned no url:", data);
    throw new Error("BytePlus image generation returned no url");
  }
  return { url, usage: data.usage };
}

/** Same retry-once-then-friendly-error contract as submitVideoTask(). */
export async function generateImage(
  prompt: string,
  referenceImages: string[] = []
): Promise<ImageResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { url, usage } = await generateImageOnce(prompt, referenceImages);
      return { imageUrl: url, error: null, usage };
    } catch (err) {
      lastErr = err;
      if (err instanceof BytePlusApiError && err.status < 500) break;
    }
  }
  if (lastErr instanceof BytePlusApiError && isReferenceError(lastErr.code, lastErr.detail)) {
    return {
      imageUrl: null,
      error: referenceReason(lastErr.detail || lastErr.code),
      referenceError: true,
    };
  }
  return { imageUrl: null, error: "Couldn't generate the image — mind trying again?" };
}
