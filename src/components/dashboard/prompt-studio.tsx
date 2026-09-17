"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CLARIFYING_QUESTIONS,
  GENERATING_REPLIES,
  MODELS,
  QUICK_STARTS,
  RATIOS,
  type Ratio,
} from "@/lib/mock-generations";

type Stage = "idle" | "thinking" | "clarifying" | "sending";

export function PromptStudio({
  onGenerate,
}: {
  onGenerate: (prompt: string, ratio: Ratio) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [stage, setStage] = useState<Stage>("idle");
  const [clarifyingQuestion, setClarifyingQuestion] = useState("");
  const [clarifyingAnswer, setClarifyingAnswer] = useState("");
  const [note, setNote] = useState("");

  const reset = () => {
    setPrompt("");
    setClarifyingAnswer("");
    setClarifyingQuestion("");
    setNote("");
    setStage("idle");
  };

  const submitPrompt = () => {
    if (!prompt.trim() || stage !== "idle") return;
    setStage("thinking");
    setTimeout(() => {
      setClarifyingQuestion(
        CLARIFYING_QUESTIONS[
          Math.floor(Math.random() * CLARIFYING_QUESTIONS.length)
        ]
      );
      setStage("clarifying");
    }, 700);
  };

  const submitClarification = () => {
    if (!clarifyingAnswer.trim()) return;
    setStage("thinking");
    setTimeout(() => {
      setNote(
        GENERATING_REPLIES[
          Math.floor(Math.random() * GENERATING_REPLIES.length)
        ]
      );
      onGenerate(`${prompt} — ${clarifyingAnswer}`, ratio);
      setStage("sending");
      setTimeout(reset, 1600);
    }, 700);
  };

  const busy = stage !== "idle";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pt-16 pb-10 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Bring your idea to life with Thunder
      </h1>

      <div className="mt-8 rounded-2xl border border-border bg-card p-4 text-left">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video you want to make..."
          rows={2}
          disabled={busy}
          className="resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
        />

        {busy && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {clarifyingQuestion && (
              <p className="text-sm text-muted-foreground">
                {clarifyingQuestion}
              </p>
            )}
            {stage === "clarifying" ? (
              <div className="flex gap-2">
                <Textarea
                  value={clarifyingAnswer}
                  onChange={(e) => setClarifyingAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitClarification();
                    }
                  }}
                  placeholder="Answer..."
                  rows={1}
                  className="min-h-9 flex-1 resize-none bg-transparent"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={submitClarification}
                  disabled={!clarifyingAnswer.trim()}
                >
                  <Send className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-foreground" />
                {note || "Thinking…"}
              </div>
            )}
          </div>
        )}

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
                  disabled={busy}
                  className={`rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-40 ${
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
          <Button
            size="sm"
            className="rounded-full px-4"
            onClick={submitPrompt}
            disabled={!prompt.trim() || busy}
          >
            Generate
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {QUICK_STARTS.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setPrompt(q.prompt)}
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
