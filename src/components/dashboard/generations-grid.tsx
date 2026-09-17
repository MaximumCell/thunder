"use client";

import { Button } from "@/components/ui/button";
import type { Generation, Ratio } from "@/lib/mock-generations";

const ASPECT: Record<Ratio, string> = {
  "16:9": "aspect-video",
  "1:1": "aspect-square",
  "9:16": "aspect-[9/16]",
};

export function GenerationsGrid({
  generations,
  onRetry,
}: {
  generations: Generation[];
  onRetry: (id: string) => void;
}) {
  if (generations.length === 0) {
    return (
      <p className="px-6 py-16 text-center text-sm text-muted-foreground">
        Describe what you want above and your first generation will show up
        here.
      </p>
    );
  }

  return (
    <div className="columns-2 gap-4 px-6 pb-16 sm:columns-3 lg:columns-4">
      {generations.map((gen) => (
        <div key={gen.id} className="mb-4 break-inside-avoid">
          <GenerationCard gen={gen} onRetry={onRetry} />
        </div>
      ))}
    </div>
  );
}

function GenerationCard({
  gen,
  onRetry,
}: {
  gen: Generation;
  onRetry: (id: string) => void;
}) {
  return (
    <div
      className={`group relative w-full overflow-hidden rounded-xl border border-border bg-card ${ASPECT[gen.ratio]}`}
    >
      {gen.status === "completed" && gen.videoSrc && (
        <video
          className="size-full object-cover"
          src={gen.videoSrc}
          autoPlay
          muted
          loop
          playsInline
        />
      )}

      {(gen.status === "queued" || gen.status === "generating") && (
        <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
          <span className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="text-xs text-muted-foreground">
            {gen.status === "queued"
              ? "Queued…"
              : `Generating… ${gen.progress}%`}
          </p>
        </div>
      )}

      {gen.status === "error" && (
        <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="text-xs text-destructive">Generation failed</p>
          <Button size="sm" variant="outline" onClick={() => onRetry(gen.id)}>
            Retry
          </Button>
        </div>
      )}

      <div
        className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden="true"
      />
      <p className="absolute inset-x-3 bottom-2 line-clamp-1 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {gen.prompt}
      </p>
    </div>
  );
}
