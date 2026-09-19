import { useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Check, Copy, Download, Link2, Maximize2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GenerationStatus } from "@/lib/mock-generations";
import { insertUsageLog } from "@/lib/db";
import { MODEL as CONTINUE_MODEL } from "@/lib/agent";
import { VideoLightbox } from "./video-lightbox";
import { ReferenceChips, ReferencePicker, useReferenceImages } from "./reference-attachments";

function NodeShell({
  children,
  className = "",
  hasSource = true,
}: {
  children: React.ReactNode;
  className?: string;
  hasSource?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${className}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !border-0 !bg-white/40"
      />
      {children}
      {hasSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2 !border-0 !bg-white/40"
        />
      )}
    </div>
  );
}

// The user-attached reference images a node was generated with (persisted on
// generation_tasks.reference_urls), so a reloaded project still shows them.
function ReferenceThumbs({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="flex items-center gap-1 px-2.5 pb-2">
      <span className="text-[9px] text-muted-foreground/60">Refs</span>
      {urls.map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt="Reference"
          className="size-5 rounded border border-border object-cover"
        />
      ))}
    </div>
  );
}

export function PromptNode({
  data,
}: NodeProps<{
  label: string;
  text: string;
  referenceUrls?: string[];
  // The open "Refined prompt" node can be edited in place; generating from it
  // replaces it with the output node.
  editable?: boolean;
  onTextChange?: (text: string) => void;
  onTextCommit?: (text: string) => void;
}>) {
  const [copied, setCopied] = useState(false);
  // Local copy so typing stays snappy; re-synced when the text changes from
  // outside (e.g. the agent revises the prompt).
  const [text, setText] = useState(data.text);
  const [seenText, setSeenText] = useState(data.text);
  if (data.text !== seenText) {
    setSeenText(data.text);
    setText(data.text);
  }

  const copyText = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <NodeShell className="w-64 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {data.label}
        </p>
        <button
          type="button"
          title="Copy prompt"
          onClick={copyText}
          className="nodrag flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </button>
      </div>
      {data.editable ? (
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            data.onTextChange?.(e.target.value);
          }}
          onBlur={() => data.onTextCommit?.(text)}
          spellCheck={false}
          className="nodrag nowheel thin-scrollbar h-36 w-full resize-none rounded-md border border-border bg-secondary/40 p-2 text-xs leading-relaxed text-foreground/90 outline-none focus:border-white/30"
        />
      ) : (
        <div className="nodrag nowheel thin-scrollbar max-h-32 overflow-y-auto pr-1 text-xs leading-relaxed text-foreground/90">
          {data.text}
        </div>
      )}
      {data.referenceUrls?.length ? (
        <div className="-mx-2.5 mt-2 -mb-2">
          <ReferenceThumbs urls={data.referenceUrls} />
        </div>
      ) : null}
    </NodeShell>
  );
}

// Flavor text only, not a claim of real progress — BytePlus's task status
// has no progress field (confirmed earlier), so this never implies a
// percentage. Just something more alive than a static "Generating…".
const GENERATING_MESSAGES = [
  "Sending your prompt to Seedance…",
  "Rendering frames…",
  "Adding motion and lighting…",
  "Fine-tuning the shot…",
  "Almost there…",
];

function useElapsedSeconds(active: boolean, startedAt?: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || !startedAt) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, startedAt]);
  return elapsed;
}

function downloadVideo(src: string) {
  fetch(src)
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "thunder-video.mp4";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => window.open(src, "_blank"));
}

export function VideoNode({
  data,
}: NodeProps<{
  status: GenerationStatus;
  videoSrc?: string;
  prompt: string;
  onRetry?: () => void;
  startedAt?: number;
  referenceUrls?: string[];
  errorMessage?: string;
}>) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const elapsed = useElapsedSeconds(data.status === "generating", data.startedAt);
  const message = GENERATING_MESSAGES[Math.floor(elapsed / 6) % GENERATING_MESSAGES.length];

  const copyLink = () => {
    if (!data.videoSrc) return;
    navigator.clipboard.writeText(data.videoSrc).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <NodeShell className="w-56 overflow-hidden p-0">
      <div className="group relative aspect-video w-full bg-black">
        {data.status === "completed" && data.videoSrc && (
          <>
            <video
              className="size-full object-cover"
              src={data.videoSrc}
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="nodrag absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                title="Full view"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                }}
                className="flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <Maximize2 className="size-3" />
              </button>
              <button
                type="button"
                title="Copy link"
                onClick={(e) => {
                  e.stopPropagation();
                  copyLink();
                }}
                className="flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                {copied ? <Check className="size-3" /> : <Link2 className="size-3" />}
              </button>
              <button
                type="button"
                title="Download"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadVideo(data.videoSrc!);
                }}
                className="flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <Download className="size-3" />
              </button>
            </div>
            {expanded && (
              <VideoLightbox src={data.videoSrc} onClose={() => setExpanded(false)} />
            )}
          </>
        )}
        {(data.status === "queued" || data.status === "generating") && (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center">
            <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <p className="text-[10px] text-muted-foreground">
              {data.status === "queued" ? "Queued…" : message}
            </p>
            {data.status === "generating" && elapsed > 0 && (
              <p className="text-[9px] text-muted-foreground/60">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} elapsed
              </p>
            )}
            {data.status === "generating" && (
              <div className="mt-1 h-0.5 w-20 overflow-hidden rounded-full bg-white/10">
                <div className="indeterminate-bar h-full w-2/5 rounded-full bg-white/50" />
              </div>
            )}
          </div>
        )}
        {data.status === "error" && (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            <p className="text-[10px] text-destructive">Failed</p>
            {data.errorMessage && (
              <p
                title={data.errorMessage}
                className="nowheel thin-scrollbar max-h-20 w-full overflow-y-auto px-1 text-[9px] leading-snug break-words text-muted-foreground"
              >
                {data.errorMessage}
              </p>
            )}
            {data.onRetry && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onRetry?.();
                }}
                className="nodrag rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary/70"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
      <p className="line-clamp-1 px-2.5 py-2 text-[10px] text-muted-foreground">
        {data.prompt}
      </p>
      <ReferenceThumbs urls={data.referenceUrls} />
    </NodeShell>
  );
}

// A real reactflow node (not a floating HTML overlay) so it can receive its
// own connections while being composed — drag another node into it to add
// a reference before submitting, same as connecting two existing nodes.
export function DraftNode({
  data,
}: NodeProps<{
  conversationId: string;
  initialPrompt?: string;
  sourcePreview?: { kind: "image" | "video"; src: string };
  onSubmit: (type: "video" | "image" | "prompt", prompt: string, referenceUrls?: string[]) => void;
  onCancel: () => void;
}>) {
  // Images pasted/dropped/attached here go to the new node as references.
  const refs = useReferenceImages();
  const [type, setType] = useState<"video" | "image" | "continue" | null>(null);
  const [prompt, setPrompt] = useState(data.initialPrompt ?? "");
  const [instruction, setInstruction] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!type || type === "continue" || !prompt.trim() || refs.uploading) return;
    data.onSubmit(type, prompt.trim(), refs.urls);
  };

  const askContinue = async () => {
    if (!instruction.trim() || asking) return;
    setAsking(true);
    setError(null);
    try {
      const res = await fetch("/api/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: data.initialPrompt ?? "",
          instruction: instruction.trim(),
        }),
      });
      const result = await res.json();
      if (!result.prompt) {
        setError(result.error ?? "Something went wrong — mind trying again?");
        return;
      }
      insertUsageLog({
        conversationId: data.conversationId,
        source: "gemma",
        model: CONTINUE_MODEL,
        rawUsage: result.usage,
      }).catch(() => {});
      data.onSubmit("prompt", result.prompt);
    } catch {
      setError("Something went wrong — mind trying again?");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div
      {...refs.dropProps}
      className={`nodrag w-64 rounded-xl border bg-card p-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${
        refs.dragging ? "border-dashed border-white/50" : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-white/40" />

      {data.sourcePreview && (
        <div className="mb-2.5 flex items-center gap-2.5 rounded-lg bg-secondary/60 p-1.5">
          <div className="size-12 shrink-0 overflow-hidden rounded-md bg-black">
            {data.sourcePreview.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.sourcePreview.src} alt="Reference" className="size-full object-cover" />
            ) : (
              <video
                src={data.sourcePreview.src}
                className="size-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
            )}
          </div>
          <p className="text-[10px] leading-snug text-muted-foreground">
            {data.sourcePreview.kind === "image"
              ? "This image will be used as the reference"
              : "This clip is used as the reference (say \"continue\" to extend it)"}
          </p>
        </div>
      )}

      {!type ? (
        <div className="flex flex-col gap-1">
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              New node
            </p>
            <button
              type="button"
              onClick={data.onCancel}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setType("video")}
            className="rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
          >
            Video generation
          </button>
          <button
            type="button"
            onClick={() => setType("image")}
            className="rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
          >
            Image generation
          </button>
          <button
            type="button"
            onClick={() => setType("continue")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
          >
            <Sparkles className="size-3.5" />
            Ask AI to continue
          </button>
          <p className="mt-1 px-1 text-[10px] text-muted-foreground/60">
            Tip: drag another node in here to add it as a reference.
          </p>
        </div>
      ) : type === "continue" ? (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            What happens next?
          </p>
          <div className="flex items-end gap-2">
            <Textarea
              autoFocus
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  askContinue();
                }
              }}
              placeholder="e.g. now the puppy jumps into a pile of leaves..."
              rows={2}
              disabled={asking}
              className="nowheel thin-scrollbar max-h-40 resize-none overflow-y-auto bg-transparent text-sm"
            />
            <Button
              size="sm"
              className="shrink-0 rounded-full"
              onClick={askContinue}
              disabled={!instruction.trim() || asking}
            >
              <Sparkles className="size-3.5" />
            </Button>
          </div>
          {asking && <p className="px-1 text-xs text-muted-foreground">Thinking…</p>}
          {error && <p className="px-1 text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {type === "image" ? "Image prompt" : "Video prompt"}
          </p>
          <ReferenceChips refs={refs} />
          <div className="flex items-end gap-2">
            <Textarea
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={refs.onPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={type === "image" ? "Describe this image..." : "Describe this video..."}
              rows={2}
              className="nowheel thin-scrollbar max-h-40 resize-none overflow-y-auto bg-transparent text-sm"
            />
            <Button
              size="sm"
              className="shrink-0 rounded-full"
              onClick={submit}
              disabled={!prompt.trim() || refs.uploading}
            >
              <Send className="size-3.5" />
            </Button>
          </div>
          <ReferencePicker refs={refs} compact />
        </div>
      )}
    </div>
  );
}

const IMAGE_GENERATING_MESSAGES = [
  "Sending your prompt to Seedream…",
  "Composing the image…",
  "Refining details…",
  "Almost there…",
];

function downloadImage(src: string) {
  fetch(src)
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "thunder-image.png";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => window.open(src, "_blank"));
}

export function ImageNode({
  data,
}: NodeProps<{
  status: GenerationStatus;
  src?: string;
  prompt: string;
  onRetry?: () => void;
  startedAt?: number;
  referenceUrls?: string[];
  errorMessage?: string;
}>) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const elapsed = useElapsedSeconds(data.status === "generating", data.startedAt);
  const message = IMAGE_GENERATING_MESSAGES[Math.floor(elapsed / 4) % IMAGE_GENERATING_MESSAGES.length];

  const copyLink = () => {
    if (!data.src) return;
    navigator.clipboard.writeText(data.src).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <NodeShell className="w-56 overflow-hidden p-0">
      <div className="group relative aspect-square w-full bg-black">
        {data.status === "completed" && data.src && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="size-full object-cover" src={data.src} alt={data.prompt} />
            <div className="nodrag absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                title="Full view"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                }}
                className="flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <Maximize2 className="size-3" />
              </button>
              <button
                type="button"
                title="Copy link"
                onClick={(e) => {
                  e.stopPropagation();
                  copyLink();
                }}
                className="flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                {copied ? <Check className="size-3" /> : <Link2 className="size-3" />}
              </button>
              <button
                type="button"
                title="Download"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(data.src!);
                }}
                className="flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <Download className="size-3" />
              </button>
            </div>
            {expanded && (
              <VideoLightbox src={data.src} kind="image" onClose={() => setExpanded(false)} />
            )}
          </>
        )}
        {(data.status === "queued" || data.status === "generating") && (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center">
            <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <p className="text-[10px] text-muted-foreground">
              {data.status === "queued" ? "Queued…" : message}
            </p>
            {data.status === "generating" && (
              <div className="mt-1 h-0.5 w-20 overflow-hidden rounded-full bg-white/10">
                <div className="indeterminate-bar h-full w-2/5 rounded-full bg-white/50" />
              </div>
            )}
          </div>
        )}
        {data.status === "error" && (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            <p className="text-[10px] text-destructive">Failed</p>
            {data.errorMessage && (
              <p
                title={data.errorMessage}
                className="nowheel thin-scrollbar max-h-20 w-full overflow-y-auto px-1 text-[9px] leading-snug break-words text-muted-foreground"
              >
                {data.errorMessage}
              </p>
            )}
            {data.onRetry && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onRetry?.();
                }}
                className="nodrag rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary/70"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
      <p className="line-clamp-1 px-2.5 py-2 text-[10px] text-muted-foreground">
        {data.prompt}
      </p>
      <ReferenceThumbs urls={data.referenceUrls} />
    </NodeShell>
  );
}
