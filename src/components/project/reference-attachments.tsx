"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Paperclip, X } from "lucide-react";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_REFERENCE_IMAGES,
  checkReferenceDimensions,
  checkReferenceFile,
} from "@/lib/references";

interface AttachedImage {
  id: string;
  preview: string; // local object URL, so the chip shows instantly
  url: string | null; // Cloudinary URL once uploaded
  // Already shown in a sent chat bubble: still counts toward the cap and is
  // still sent at Generate, but no longer listed as a chip in the composer.
  sent?: boolean;
}

/** Type/size/dimension check shared by every place an image can be added.
 * Returns a user-facing error, or null when the file is fine. */
export async function checkImageFile(file: File): Promise<string | null> {
  const typeError = checkReferenceFile(file);
  if (typeError) return typeError;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    return checkReferenceDimensions(width, height, file.name);
  } catch {
    return `${file.name} couldn't be read as an image.`;
  }
}

export async function upload(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload-reference", { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) throw new Error(data?.error ?? "Upload failed");
  return data.url;
}

/** State + file/drop/paste handling for reference images. Each image is
 * uploaded to Cloudinary the moment it's attached. */
export function useReferenceImages() {
  const [items, setItems] = useState<AttachedImage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Mirrors `items` synchronously so a multi-file drop can't overshoot the cap.
  const itemsRef = useRef<AttachedImage[]>([]);
  const commit = (next: AttachedImage[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  useEffect(
    () => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)),
    []
  );

  const addFiles = async (files: File[]) => {
    setNotice(null);
    for (const file of files) {
      if (itemsRef.current.length >= MAX_REFERENCE_IMAGES) {
        setNotice(`Up to ${MAX_REFERENCE_IMAGES} reference images`);
        return;
      }
      const fileError = await checkImageFile(file);
      if (fileError) {
        setNotice(fileError);
        continue;
      }
      // Re-check after the await — another file may have taken the last slot.
      if (itemsRef.current.length >= MAX_REFERENCE_IMAGES) {
        setNotice(`Up to ${MAX_REFERENCE_IMAGES} reference images`);
        return;
      }

      const id = crypto.randomUUID();
      commit([...itemsRef.current, { id, preview: URL.createObjectURL(file), url: null }]);
      upload(file)
        .then((url) => commit(itemsRef.current.map((i) => (i.id === id ? { ...i, url } : i))))
        .catch((err: Error) => {
          setNotice(err.message);
          remove(id);
        });
    }
  };

  const remove = (id: string) => {
    const gone = itemsRef.current.find((i) => i.id === id);
    if (gone) URL.revokeObjectURL(gone.preview);
    commit(itemsRef.current.filter((i) => i.id !== id));
  };

  const clear = () => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
    commit([]);
    setNotice(null);
  };

  /** Move the staged images into the chat: returns their URLs (for the
   * message bubble) and hides their composer chips. */
  const takePending = () => {
    const pending = itemsRef.current.filter((i) => !i.sent && i.url);
    commit(itemsRef.current.map((i) => (i.url ? { ...i, sent: true } : i)));
    return pending.map((i) => i.url as string);
  };

  /** Pre-fill with already-uploaded URLs (e.g. handed over from the dashboard). */
  const seed = (urls: string[]) =>
    commit(urls.slice(0, MAX_REFERENCE_IMAGES).map((url) => ({ id: crypto.randomUUID(), preview: url, url })));

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return {
    items,
    notice,
    dragging,
    full: items.length >= MAX_REFERENCE_IMAGES,
    uploading: items.some((i) => !i.url),
    /** Uploaded Cloudinary URLs, ready to send to BytePlus. */
    urls: items.flatMap((i) => (i.url ? [i.url] : [])),
    addFiles,
    remove,
    clear,
    seed,
    takePending,
    /** Spread onto the prompt box container. */
    dropProps: {
      onDragOver: (e: React.DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      },
      onDrop: (e: React.DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
      },
    },
    /** Attach to the textarea: Ctrl/Cmd+V of an image adds it; plain text pastes as normal. */
    onPaste: (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      addFiles(files);
    },
  };
}

export type ReferenceImages = ReturnType<typeof useReferenceImages>;

/** Thumbnail chips (with a per-image upload spinner and remove button) + any inline error. */
export function ReferenceChips({ refs, disabled }: { refs: ReferenceImages; disabled?: boolean }) {
  const pending = refs.items.filter((i) => !i.sent);
  if (pending.length === 0 && !refs.notice) return null;
  return (
    <div className="mb-2">
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending.map((i) => (
            <div
              key={i.id}
              className="relative size-14 overflow-hidden rounded-lg border border-border bg-secondary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.preview} alt="Reference" className="size-full object-cover" />
              {!i.url && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                </div>
              )}
              <button
                type="button"
                title="Remove"
                disabled={disabled}
                onClick={() => refs.remove(i.id)}
                className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {refs.notice && <p className="mt-1.5 text-xs text-destructive">{refs.notice}</p>}
    </div>
  );
}

/** Paperclip button + the always-visible face-restriction notice. */
export function ReferencePicker({
  refs,
  disabled,
  compact,
}: {
  refs: ReferenceImages;
  disabled?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          refs.addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <p className="flex items-center gap-1 text-[10px] leading-snug text-muted-foreground/70">
        <Info className="size-3 shrink-0" />
        <span>
          {refs.items.length}/{MAX_REFERENCE_IMAGES}
          {!compact && " · JPG, PNG or WebP"}
        </span>
      </p>
      {/* Right-aligned: the bottom-left corner is covered by the Next.js dev badge. */}
      <button
        type="button"
        title={refs.full ? `Up to ${MAX_REFERENCE_IMAGES} reference images` : "Attach reference images"}
        disabled={disabled || refs.full}
        onClick={() => inputRef.current?.click()}
        className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Paperclip className="size-3.5" />
        Attach image
      </button>
    </div>
  );
}
