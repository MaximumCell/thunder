"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NodeAddMenu({
  screenPosition,
  onSubmit,
  onClose,
}: {
  screenPosition: { x: number; y: number };
  onSubmit: (type: "video" | "image", prompt: string) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<"video" | "image" | null>(null);
  const [prompt, setPrompt] = useState("");

  const submit = () => {
    if (!type || !prompt.trim()) return;
    onSubmit(type, prompt.trim());
  };

  return (
    <>
      <div className="absolute inset-0 z-10" onClick={onClose} />
      <div
        className="absolute z-20 w-64 rounded-xl border border-border bg-card p-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        style={{ left: screenPosition.x, top: screenPosition.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {!type ? (
          <div className="flex flex-col gap-1">
            <p className="mb-1 px-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              New node
            </p>
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
                className="resize-none bg-transparent text-sm"
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
    </>
  );
}
