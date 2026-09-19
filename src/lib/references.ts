// Shared limits for user-attached reference images (prompt box). The cap of 5
// is a UI choice, well under BytePlus's own (Seedance 2.5: 30 images,
// Seedream 4.5: 14). Formats/size/dimensions follow the tighter Seedance
// input-image rules from the live Create-a-video-task docs.
export const MAX_REFERENCE_IMAGES = 5;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
export const MIN_REFERENCE_PX = 300;
export const MAX_REFERENCE_PX = 6000;
export const MIN_ASPECT = 0.4;
export const MAX_ASPECT = 2.5;

/** Returns a user-facing error, or null when the file type/size is fine.
 * Runs client- and server-side. */
export function checkReferenceFile(file: { type: string; size: number; name?: string }) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name ?? "That file"} isn't supported — use JPG, PNG or WebP.`;
  }
  if (file.size > MAX_REFERENCE_BYTES) {
    return `${file.name ?? "That image"} is over 10 MB.`;
  }
  return null;
}

export function checkReferenceDimensions(width: number, height: number, name?: string) {
  const label = name ?? "That image";
  if (Math.min(width, height) < MIN_REFERENCE_PX || Math.max(width, height) > MAX_REFERENCE_PX) {
    return `${label} must be between ${MIN_REFERENCE_PX} and ${MAX_REFERENCE_PX}px per side.`;
  }
  const aspect = width / height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    return `${label} is too narrow/wide — aspect ratio must be between 2:5 and 5:2.`;
  }
  return null;
}

/** An image handed to the agent together with a plain-English description of
 * what it is (a video frame, the selected node, an upload...). */
export interface AgentImage {
  url: string;
  label: string;
}

/** Server-side: accepts `{ url, label }[]` (or bare https URLs), max `limit`. */
export function parseAgentImages(value: unknown, limit = 5): AgentImage[] {
  if (!Array.isArray(value)) return [];
  const out: AgentImage[] = [];
  for (const v of value) {
    const url = typeof v === "string" ? v : v?.url;
    if (typeof url !== "string" || !url.startsWith("https://")) continue;
    const label = typeof v?.label === "string" ? v.label.slice(0, 200) : "an image the user attached";
    out.push({ url, label });
  }
  return out.slice(0, limit);
}

/** A JPEG frame (1s in, max 1024px wide) of a Cloudinary-hosted video, so the
 * agent can see a clip. Non-Cloudinary URLs are returned unchanged. */
export function videoPoster(url: string): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/upload/")) return url;
  return url
    .replace("/video/upload/", "/video/upload/so_1,c_limit,w_1024/")
    .replace(/\.[a-z0-9]+(\?.*)?$/i, ".jpg");
}

/** Server-side: pull a sane `referenceImages` (https URLs, capped) out of a request body. */
export function parseReferenceImages(value: unknown, limit = 14): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((u): u is string => typeof u === "string" && u.startsWith("https://"))
    .slice(0, limit);
}
