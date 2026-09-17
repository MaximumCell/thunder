"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MODELS, QUICK_STARTS } from "@/lib/mock-generations";

export function NewProject() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);

  const start = () => {
    const text = input.trim();
    if (!text || starting) return;
    setStarting(true);

    const id = crypto.randomUUID();
    sessionStorage.setItem(`thunder:init:${id}`, text);
    router.push(`/app/${id}`);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pt-16 pb-10 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Bring your idea to life with Thunder
      </h1>

      <div className="mt-8 rounded-2xl border border-border bg-card p-4 text-left">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                start();
              }
            }}
            placeholder="Describe the video you want to make..."
            rows={2}
            disabled={starting}
            className="resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          />
          <Button
            size="sm"
            className="shrink-0 rounded-full"
            onClick={start}
            disabled={!input.trim() || starting}
          >
            <Send className="size-3.5" />
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            Video
          </span>
          <span className="rounded-full px-3 py-1 text-xs text-muted-foreground/50">
            Image · Soon
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {QUICK_STARTS.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setInput(q.prompt)}
            disabled={starting}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground disabled:opacity-40"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="mt-12 grid gap-3 text-left sm:grid-cols-2">
        {MODELS.map((model) => (
          <div
            key={model.id}
            className="flex items-start gap-3 rounded-xl border border-border p-4"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold">
              {model.mode[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{model.name}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    model.status === "Available"
                      ? "bg-foreground text-background"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {model.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {model.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
