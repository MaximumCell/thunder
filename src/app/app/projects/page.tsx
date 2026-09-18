"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/dashboard/topbar";
import {
  listConversations,
  loadProjectPreview,
  type ConversationRow,
  type ProjectPreview,
} from "@/lib/db";

interface ProjectCard extends ConversationRow {
  preview: ProjectPreview | null;
}

// Sample cards to preview the grid layout while your real project history is
// thin — clearly badged, not linked anywhere, never written to the database.
const SAMPLE_PROJECTS = [
  { title: "A neon-lit city street at night, rain reflecting signage", src: "/videos/2.mp4" },
  { title: "Time-lapse of clouds rolling over a mountain ridge", src: "/videos/4.mp4" },
  { title: "Close-up of coffee being poured into a ceramic cup", src: "/videos/6.mp4" },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectCard[] | null>(null);

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

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Topbar />
      <div className="flex-1 overflow-y-auto px-6 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>

          {projects === null && (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          )}

          {projects?.length === 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              No projects yet —{" "}
              <Link href="/app" className="text-foreground underline underline-offset-4">
                start one
              </Link>
              .
            </p>
          )}

          {projects && projects.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/app/${p.id}`}
                  className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-white/25"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-secondary">
                    {p.preview?.type === "video" ? (
                      <video
                        className="size-full object-cover"
                        src={p.preview.url}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                      />
                    ) : p.preview?.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="size-full object-cover"
                        src={p.preview.url}
                        alt={p.title || "Project preview"}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-foreground/10 text-sm font-semibold text-muted-foreground">
                          {(p.title || "?")[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-medium">
                      {p.title || "Untitled"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </Link>
              ))}

              {SAMPLE_PROJECTS.map((s) => (
                <div
                  key={s.title}
                  title="Sample only — not a real project"
                  className="cursor-default overflow-hidden rounded-xl border border-dashed border-border bg-card opacity-70"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-secondary">
                    <video
                      className="size-full object-cover"
                      src={s.src}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="auto"
                    />
                    <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                      Sample
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-medium">{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Not a real project</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
