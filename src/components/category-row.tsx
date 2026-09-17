"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

export interface CategoryItem {
  src: string;
  title: string;
}

const CARD_WIDTH = 288;

export function CategoryRow({
  title,
  items,
}: {
  title: string;
  items: CategoryItem[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({
      left: dir * (CARD_WIDTH + 20),
      behavior: "smooth",
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x gap-5 overflow-x-auto pb-1"
      >
        {items.map((item, i) => (
          <div
            key={`${item.src}-${i}`}
            className="w-64 shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-card sm:w-72"
          >
            <div className="aspect-video w-full overflow-hidden">
              <video
                className="size-full object-cover"
                src={item.src}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Sparkles className="size-3" />
              </span>
              <span className="truncate text-sm">{item.title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
