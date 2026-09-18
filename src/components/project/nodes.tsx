import { useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Check, Copy, Download, Link2, Maximize2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GenerationStatus } from "@/lib/mock-generations";
import { insertUsageLog } from "@/lib/db";
import { MODEL as CONTINUE_MODEL } from "@/lib/agent";
import { VideoLightbox } from "./video-lightbox";

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

export function PromptNode({
  data,
}: NodeProps<{ label: string; text: string }>) {
  const [copied, setCopied] = useState(false);

  const copyText = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(data.text).then(() => {
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
      <div className="nodrag nowheel thin-scrollbar max-h-32 overflow-y-auto pr-1 text-xs leading-relaxed text-foreground/90">
        {data.text}
      </div>
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
          <div className="flex size-full flex-col items-center justify-center gap-1.5">
            <p className="text-[10px] text-destructive">Failed</p>
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
  onSubmit: (type: "video" | "image" | "prompt", prompt: string) => void;
  onCancel: () => void;
}>) {
  const [type, setType] = useState<"video" | "image" | "continue" | null>(null);
  const [prompt, setPrompt] = useState(data.initialPrompt ?? "");
  const [instruction, setInstruction] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!type || type === "continue" || !prompt.trim()) return;
    data.onSubmit(type, prompt.trim());
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
    <div className="nodrag w-64 rounded-xl border border-border bg-card p-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-white/40" />

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
            disabled
            className="cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm text-muted-foreground/50"
          >
            Image generation
            <span className="ml-1.5 text-[10px]">Soon</span>
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
            Video prompt
          </p>
          <div className="flex items-end gap-2">
            <Textarea
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Describe this video..."
              rows={2}
              className="nowheel thin-scrollbar max-h-40 resize-none overflow-y-auto bg-transparent text-sm"
            />
            <Button
              size="sm"
              className="shrink-0 rounded-full"
              onClick={submit}
              disabled={!prompt.trim()}
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Not reachable yet (Seedream is "Coming soon" — see mock-generations.ts
// MODELS), but built now alongside the other two node types since the
// canvas node-type set is fixed for this step.
export function ImageNode({
  data,
}: NodeProps<{ src?: string; prompt: string }>) {
  return (
    <NodeShell className="w-56 overflow-hidden p-0">
      <div className="relative aspect-square w-full bg-black">
        {data.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="size-full object-cover"
            src={data.src}
            alt={data.prompt}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
            Image
          </div>
        )}
      </div>
      <p className="line-clamp-1 px-2.5 py-2 text-[10px] text-muted-foreground">
        {data.prompt}
      </p>
    </NodeShell>
  );
}
