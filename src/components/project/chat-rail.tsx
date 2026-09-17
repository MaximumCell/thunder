"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RATIOS, type Ratio } from "@/lib/mock-generations";
import type { AgentMessage, AgentResult } from "@/lib/agent";

export function ChatRail({
  initialMessage,
  onBrief,
  onFinalPrompt,
  onGenerateRequest,
}: {
  initialMessage?: string;
  onBrief: (text: string) => void;
  onFinalPrompt: (text: string) => void;
  onGenerateRequest: (prompt: string, ratio: Ratio) => void;
}) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [finalPrompt, setFinalPrompt] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (messages.length === 0) onBrief(trimmed);

    const next: AgentMessage[] = [...messages, { role: "user", content: trimmed }];
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
      if (result.status === "ready" && result.finalPrompt) {
        setFinalPrompt(result.finalPrompt);
        onFinalPrompt(result.finalPrompt);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Something went wrong — mind trying again?" },
      ]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialMessage && !startedRef.current) {
      startedRef.current = true;
      send(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const generate = () => {
    if (!finalPrompt) return;
    onGenerateRequest(finalPrompt, ratio);
    setFinalPrompt(null);
  };

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-r border-border">
      <div className="flex items-center border-b border-border px-4 py-4">
        <Link href="/app" className="text-sm font-medium tracking-tight">
          Thunder
        </Link>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Describe the video you want to make.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <p
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground"
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

      {finalPrompt && (
        <div className="mx-4 mb-3 flex items-start justify-between gap-3 rounded-lg bg-secondary px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Ready — refine further or generate.
          </p>
          <Button size="sm" className="shrink-0 rounded-full" onClick={generate}>
            Generate
          </Button>
        </div>
      )}

      <div className="border-t border-border p-4">
        <div className="mb-2 flex gap-1">
          {RATIOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRatio(r)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                ratio === r
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={
              finalPrompt
                ? "Ask for a change, or click Generate…"
                : messages.length === 0
                  ? "Describe the video you want to make..."
                  : "Reply..."
            }
            rows={2}
            disabled={busy}
            className="resize-none bg-card"
          />
          <Button
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => send(input)}
            disabled={!input.trim() || busy}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
