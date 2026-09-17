import { Handle, Position, type NodeProps } from "reactflow";
import type { GenerationStatus } from "@/lib/mock-generations";

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
  return (
    <NodeShell className="w-64 p-3">
      <p className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {data.label}
      </p>
      <p className="line-clamp-5 text-xs leading-relaxed text-foreground/90">
        {data.text}
      </p>
    </NodeShell>
  );
}

export function VideoNode({
  data,
}: NodeProps<{
  status: GenerationStatus;
  progress: number;
  videoSrc?: string;
  prompt: string;
}>) {
  return (
    <NodeShell className="w-56 overflow-hidden p-0">
      <div className="relative aspect-video w-full bg-black">
        {data.status === "completed" && data.videoSrc && (
          <video
            className="size-full object-cover"
            src={data.videoSrc}
            autoPlay
            muted
            loop
            playsInline
          />
        )}
        {(data.status === "queued" || data.status === "generating") && (
          <div className="flex size-full flex-col items-center justify-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <p className="text-[10px] text-muted-foreground">
              {data.status === "queued" ? "Queued…" : `${data.progress}%`}
            </p>
          </div>
        )}
        {data.status === "error" && (
          <div className="flex size-full items-center justify-center">
            <p className="text-[10px] text-destructive">Failed</p>
          </div>
        )}
      </div>
      <p className="line-clamp-1 px-2.5 py-2 text-[10px] text-muted-foreground">
        {data.prompt}
      </p>
    </NodeShell>
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
