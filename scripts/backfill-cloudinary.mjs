// One-time migration (Step 6, Part 2) — moves any generation_tasks row
// still pointing at a raw (expiring) BytePlus video_url over to a
// permanent Cloudinary URL. Not part of the app's normal request path;
// run manually, once, after deploying the Part 1 re-upload-on-completion
// change.
//
// Usage:
//   node --env-file=.env scripts/backfill-cloudinary.mjs
//
// Uses the Supabase service role key (bypasses RLS — this is an admin
// migration touching every user's rows, not a per-user request).

import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function main() {
  // "Not yet migrated" = doesn't already point at Cloudinary. Domain-
  // agnostic to exactly which BytePlus CDN host issued the URL.
  const { data: rows, error } = await supabase
    .from("generation_tasks")
    .select("id, media_url")
    .in("type", ["video", "image"])
    .eq("status", "completed")
    .not("media_url", "is", null)
    .not("media_url", "ilike", "%cloudinary%");

  if (error) {
    console.error("Failed to load generation_tasks:", error.message);
    process.exit(1);
  }

  console.log(`Found ${rows.length} row(s) still on a BytePlus URL.\n`);

  let migrated = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await cloudinary.uploader.upload(row.media_url, {
        resource_type: "video",
        public_id: row.id,
        folder: "thunder",
        overwrite: true,
      });

      const { error: updateError } = await supabase
        .from("generation_tasks")
        .update({ media_url: result.secure_url, byteplus_url: row.media_url })
        .eq("id", row.id);
      if (updateError) throw updateError;

      migrated++;
      console.log(`OK   ${row.id} — migrated`);
    } catch (err) {
      failed++;
      const reason = err?.message ?? String(err);
      console.log(`FAIL ${row.id} — ${reason}`);

      // Mark it visibly dead rather than silently broken — reuses the
      // existing "error" status the UI already renders as Failed + Retry.
      const { error: markError } = await supabase
        .from("generation_tasks")
        .update({ status: "error" })
        .eq("id", row.id);
      if (markError) {
        console.log(`     (also failed to mark ${row.id} as error: ${markError.message})`);
      }
    }
  }

  console.log(
    `\nDone. Checked ${rows.length}, migrated ${migrated}, failed/dead ${failed}.`
  );
}

main();
