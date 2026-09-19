"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MODELS, QUICK_STARTS } from "@/lib/mock-generations";
import {
  ReferenceChips,
  ReferencePicker,
  useReferenceImages,
} from "@/components/project/reference-attachments";
import {
  createConversation,
  deleteConversation,
  insertGenerationTask,
  insertMessage,
  insertUsageLog,
  listConversations,
  loadProjectPreview,
  updateGenerationTask,
} from "@/lib/db";
import { ProjectCard, type ProjectCardData } from "./project-card";

export function NewProject() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"video" | "image">("video");
  const [starting, setStarting] = useState(false);
  const refs = useReferenceImages();
  const [startError, setStartError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectCardData[] | null>(null);

  useEffect(() => {
    listConversations()
      .then(async (rows) => {
        const previews = await Promise.all(
          rows.map((r) => loadProjectPreview(r.id).catch(() => null))
        );
        setProjects(rows.map((r, i) => ({ ...r, preview: previews[i] })));
      })
      .catch(() => setProjects([]));
  }, []);

  const start = async () => {
    const text = input.trim();
    if (!text || starting || refs.uploading) return;
    setStarting(true);
    setStartError(null);
    const referenceUrls = refs.urls;

    try {
      const id = await createConversation(text);
      await insertMessage(id, "user", text);

      if (mode === "image") {
        // No chat refinement for images yet (same as the canvas node path)
        // — direct prompt straight to Seedream. Awaited here, before
        // navigating, so the project page's generic on-load fetch always
        // sees a finished (completed/error) row, never a stale "generating"
        // one it has no live connection back to.
        const imgId = crypto.randomUUID();
        await insertGenerationTask(id, {
          id: imgId,
          parentId: null,
          type: "image",
          status: "generating",
          prompt: text,
          referenceUrls,
          position: { x: 0, y: 120 },
        });
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, referenceImages: referenceUrls }),
        }).catch(() => null);
        const data = await res?.json().catch(() => null);
        if (data?.imageUrl) {
          await updateGenerationTask(imgId, { status: "completed", media_url: data.imageUrl });
          insertUsageLog({
            conversationId: id,
            generationTaskId: imgId,
            source: "byteplus",
            model: data.model ?? "unknown",
            rawUsage: data.usage,
          }).catch(() => {});
        } else if (data?.referenceError) {
          // A rejected reference image is explainable — keep the user here
          // with BytePlus's reason instead of dropping them onto a failed node.
          await deleteConversation(id).catch(() => {});
          setStartError(data.error);
          setStarting(false);
          return;
        } else {
          await updateGenerationTask(imgId, { status: "error" });
        }
      } else {
        await insertGenerationTask(id, {
          id: crypto.randomUUID(),
          parentId: null,
          type: "prompt",
          status: "completed",
          label: "Brief",
          prompt: text,
          // Carried into the project's chat rail, which passes them on at Generate.
          referenceUrls,
          position: { x: 0, y: 120 },
        });
      }

      router.push(`/app/${id}?mode=${mode}`);
    } catch {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pt-12 pb-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Bring your idea to life with Thunder
      </h1>

      <div
        {...refs.dropProps}
        className={`mt-8 rounded-2xl border bg-card p-5 text-left transition-colors ${
          refs.dragging ? "border-dashed border-white/40 bg-secondary/60" : "border-border"
        }`}
      >
        <ReferenceChips refs={refs} disabled={starting} />
        {startError && <p className="mb-2 text-xs text-destructive">{startError}</p>}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={refs.onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                start();
              }
            }}
            placeholder={
              mode === "image"
                ? "Describe the image you want to make..."
                : "Describe the video you want to make..."
            }
            rows={2}
            disabled={starting}
            className="resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          />
          <Button
            size="sm"
            className="size-9 shrink-0 rounded-full p-0"
            onClick={start}
            disabled={!input.trim() || starting || refs.uploading}
          >
            {starting ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-background/40 border-t-background" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>

        <div className="mt-3">
          <ReferencePicker refs={refs} disabled={starting} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setMode("video")}
            disabled={starting}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              mode === "video"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Video
          </button>
          <button
            type="button"
            onClick={() => setMode("image")}
            disabled={starting}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              mode === "image"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Image
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {QUICK_STARTS.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setInput(q.prompt)}
            disabled={starting}
            className="rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground disabled:opacity-40"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="mt-14 text-left">
        <p className="mb-3 text-sm text-muted-foreground">Models</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODELS.map((model) => (
            <div
              key={model.id}
              className="flex items-start gap-3 rounded-xl border border-border p-4 transition-colors hover:border-white/25"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold">
                {model.mode[0]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{model.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      model.status === "Available"
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {model.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {model.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {projects && projects.length > 0 && (
        <div className="mt-14 text-left">
          <p className="mb-3 text-sm text-muted-foreground">Your projects</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDeleted={(id) => setProjects((list) => list?.filter((x) => x.id !== id) ?? list)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
