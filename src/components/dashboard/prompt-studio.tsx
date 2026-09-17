"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MODELS, QUICK_STARTS, RATIOS, type Ratio } from "@/lib/mock-generations";
import type { AgentMessage, AgentResult } from "@/lib/agent";

export function PromptStudio({
  onGenerate,
}: {
  onGenerate: (prompt: string, ratio: Ratio) => void;
}) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [finalPrompt, setFinalPrompt] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const next: AgentMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const result: AgentResult = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: result.reply }]);
      setFinalPrompt(result.status === "ready" ? result.finalPrompt : finalPrompt);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Something went wrong — mind trying again?",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const generate = () => {
    if (!finalPrompt) return;
    onGenerate(finalPrompt, ratio);
    setMessages([]);
    setFinalPrompt(null);
    setInput("");
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pt-16 pb-10 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Bring your idea to life with Thunder
      </h1>

      <div className="mt-8 rounded-2xl border border-border bg-card p-4 text-left">
        {messages.length > 0 && (
          <div className="mb-3 max-h-72 space-y-2 overflow-y-auto border-b border-border pb-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {m.content}
                </p>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-1.5 px-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {finalPrompt && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg bg-secondary px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Ready — refine further or generate.
            </p>
            <Button size="sm" className="shrink-0 rounded-full" onClick={generate}>
              Generate video
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              finalPrompt
                ? "Ask for a change, or click Generate…"
                : "Describe the video you want to make..."
            }
            rows={2}
            disabled={busy}
            className="resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          />
          <Button
            size="sm"
            className="shrink-0 rounded-full"
            onClick={send}
            disabled={!input.trim() || busy}
          >
            <Send className="size-3.5" />
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
              Video
            </span>
            <span className="rounded-full px-3 py-1 text-xs text-muted-foreground/50">
              Image · Soon
            </span>
            <div className="ml-1 flex items-center gap-1">
              {RATIOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRatio(r)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    ratio === r
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {QUICK_STARTS.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setInput(q.prompt)}
            disabled={busy}
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
