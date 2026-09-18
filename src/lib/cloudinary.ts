// Cloudinary asset persistence (Step 6). BytePlus's own video_url expires
// in ~24h (confirmed in the ModelArk task-retrieve response docs — see
// PROGRESS.md), so every completed generation must be re-hosted permanently
// before the frontend (or the DB) ever sees it as the final media_url.
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary fetches the remote URL server-side and stores its own copy —
// this is the SDK's documented "upload by remote URL" path, equivalent to
// downloading + re-uploading ourselves but without proxying the bytes
// through this app's own server.
async function uploadOnce(
  sourceUrl: string,
  publicId: string,
  resourceType: "video" | "image"
): Promise<string> {
  const result = await cloudinary.uploader.upload(sourceUrl, {
    resource_type: resourceType,
    public_id: publicId,
    folder: "thunder",
    overwrite: true,
  });
  return result.secure_url;
}

/** Same retry-once-then-null contract as byteplus.ts/agent.ts — one silent
 * retry, then give up and let the caller decide how to surface it. */
export async function persistVideo(
  sourceUrl: string,
  publicId: string
): Promise<string | null> {
  try {
    return await uploadOnce(sourceUrl, publicId, "video");
  } catch {
    try {
      return await uploadOnce(sourceUrl, publicId, "video");
    } catch (err) {
      console.error(`Cloudinary upload failed for ${publicId}:`, err);
      return null;
    }
  }
}

// Seedream's images/generations response URL isn't documented as expiring
// (unlike video_url's confirmed ~24h window), but re-hosting anyway keeps
// this consistent/safe rather than trusting an unconfirmed lifetime.
export async function persistImage(
  sourceUrl: string,
  publicId: string
): Promise<string | null> {
  try {
    return await uploadOnce(sourceUrl, publicId, "image");
  } catch {
    try {
      return await uploadOnce(sourceUrl, publicId, "image");
    } catch (err) {
      console.error(`Cloudinary upload failed for ${publicId}:`, err);
      return null;
    }
  }
}
