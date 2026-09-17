"use client";

import { useEffect, useRef, useState } from "react";

const SOURCES = [
  "/videos/1.mp4",
  "/videos/2.mp4",
  "/videos/3.mp4",
  "/videos/4.mp4",
  "/videos/5.mp4",
];

const CROSSFADE_MS = 600;

export function HeroReel() {
  const [active, setActive] = useState(0);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videos.current.forEach((video, i) => {
      if (!video) return;
      if (i === active) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [active]);

  const advance = () => setActive((i) => (i + 1) % SOURCES.length);

  return (
    <div className="absolute inset-0">
      {SOURCES.map((src, i) => (
        <video
          key={src}
          ref={(el) => {
            videos.current[i] = el;
          }}
          className="absolute inset-0 size-full object-cover transition-opacity ease-in-out"
          style={{ opacity: i === active ? 1 : 0, transitionDuration: `${CROSSFADE_MS}ms` }}
          src={src}
          muted
          playsInline
          preload="auto"
          onEnded={advance}
        />
      ))}

      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_35%,rgba(0,0,0,0.35)_100%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/40 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent"
        aria-hidden="true"
      />

      <div className="absolute right-6 bottom-6 z-10 hidden items-center gap-3 sm:right-10 sm:bottom-8 sm:flex">
        <span className="text-xs text-white/40">Preview reel</span>
        <div className="flex gap-1.5">
          {SOURCES.map((src, i) => (
            <span
              key={src}
              className={`h-1 w-4 rounded-full transition-colors duration-300 ${
                i === active ? "bg-white" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
