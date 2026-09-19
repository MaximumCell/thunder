"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteConversation, type ConversationRow, type ProjectPreview } from "@/lib/db";

export interface ProjectCardData extends ConversationRow {
  preview: ProjectPreview | null;
}

/** A project tile linking to its canvas, with a hover trash button that asks
 * for confirmation before deleting. Deleting cascades in the database to the
 * project's messages, nodes and usage rows; the generated files stay on
 * Cloudinary. */
export function ProjectCard({
  project: p,
  onDeleted,
}: {
  project: ProjectCardData;
  onDeleted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);

  const remove = async () => {
    setDeleting(true);
    setError(false);
    try {
      await deleteConversation(p.id);
      onDeleted(p.id);
    } catch {
      setDeleting(false);
      setError(true);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-white/25">
      <Link href={`/app/${p.id}`} className="block">
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
          <p className="line-clamp-1 text-sm font-medium">{p.title || "Untitled"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(p.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </Link>

      {!confirming && (
        <button
          type="button"
          title="Delete project"
          aria-label="Delete project"
          onClick={() => setConfirming(true)}
          className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}

      {confirming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center">
          <p className="text-sm font-medium">Delete this project?</p>
          <p className="text-xs text-muted-foreground">
            All its chat and nodes will be removed. This can&apos;t be undone.
          </p>
          {error && <p className="text-xs text-destructive">Couldn&apos;t delete — try again.</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirming(false)}
              className="rounded-full border border-border px-3.5 py-1.5 text-xs transition-colors hover:bg-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={remove}
              className="rounded-full bg-destructive px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
