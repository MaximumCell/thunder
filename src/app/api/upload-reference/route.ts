import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { persistImage } from "@/lib/cloudinary";
import { checkReferenceFile } from "@/lib/references";

// Uploads one reference image to Cloudinary straight away (Step 6's
// persistImage) so BytePlus later gets a stable, publicly fetchable URL.
export async function POST(request: Request) {
  // Signed-in users only — this route spends Cloudinary storage/bandwidth.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Expected a multipart `file`" }, { status: 400 });
  }
  const invalid = checkReferenceFile(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const dataUri = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  const url = await persistImage(dataUri, `ref-${crypto.randomUUID()}`);
  if (!url) {
    return NextResponse.json(
      { error: "Couldn't upload that image — mind trying again?" },
      { status: 502 }
    );
  }
  return NextResponse.json({ url });
}
