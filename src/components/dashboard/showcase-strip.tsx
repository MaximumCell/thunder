"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CLIPS = [
  "/videos/1.mp4",
  "/videos/2.mp4",
  "/videos/3.mp4",
  "/videos/4.mp4",
  "/videos/5.mp4",
  "/videos/6.mp4",
  "/videos/7.mp4",
  "/videos/8.mp4",
];

const CARD_WIDTH = 340;

export function ShowcaseStrip() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * (CARD_WIDTH + 16), behavior: "smooth" });
  };

  return (
    <div className="relative border-b border-border">
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-6 py-6 sm:px-8"
      >
        {CLIPS.map((src, i) => (
          <div
            key={src}
            className="relative aspect-video w-[280px] shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-card sm:w-[340px]"
          >
            <video
              className="size-full object-cover"
              src={src}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent p-4">
              <p className="text-sm font-medium text-white">
                Made with Seedance 2.5
              </p>
              <p className="text-xs text-white/60">Example generation</p>
            </div>
            <span className="sr-only">Example clip {i + 1}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="Scroll left"
        className="absolute top-1/2 left-2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur transition-colors hover:border-white/25 sm:flex"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="Scroll right"
        className="absolute top-1/2 right-2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur transition-colors hover:border-white/25 sm:flex"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
