"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RATIOS, type Ratio } from "@/lib/mock-generations";
import { insertMessage, insertUsageLog } from "@/lib/db";
import { videoPoster } from "@/lib/references";
import { MODEL, type AgentMessage, type AgentResult } from "@/lib/agent";
import {
  BriefForm,
  DEFAULT_CHOICES,
  summarizeChoices,
  type BriefChoices,
} from "./brief-form";
import {
  ReferenceChips,
  ReferencePicker,
  useReferenceImages,
} from "./reference-attachments";

export function ChatRail({
  conversationId,
  title,
  initialMessages,
  canvasContext,
  initialReferences,
  selectedMedia,
  pinnedMedia,
  onPinSelected,
  onDismissSelected,
  onFinalPrompt,
  onGenerateRequest,
  onGenerateImageRequest,
}: {
  conversationId: string;
  title: string | null;
  initialMessages: AgentMessage[];
  canvasContext?: string;
  // Reference images attached on the dashboard, carried over via the Brief node.
  initialReferences?: string[];
  // The image/video node selected on the canvas: shown as a chip and used as
  // a reference (a selected image also goes to the agent so it can see it).
  selectedMedia?: { kind: "image" | "video"; src: string };
  // A selected node that was already sent with a message: no longer shown as a
  // chip (it's in the chat bubble) but still the reference until you generate.
  pinnedMedia?: { kind: "image" | "video"; src: string };
  onPinSelected: () => void;
  onDismissSelected: () => void;
  onFinalPrompt: (text: string) => void;
  onGenerateRequest: (
    prompt: string,
    ratio: Ratio,
    referenceUrls: string[],
    duration: number | null
  ) => void;
  onGenerateImageRequest: (prompt: string, referenceUrls: string[]) => void;
}) {
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [finalPrompt, setFinalPrompt] = useState<string | null>(null);
  // The dashboard hands its Video/Image choice over via ?mode=. The rail only
  // renders after the project loads client-side, so window is always defined.
  const [mode, setMode] = useState<"video" | "image">(() =>
    new URLSearchParams(window.location.search).get("mode") === "image" ? "image" : "video"
  );
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<BriefChoices>(DEFAULT_CHOICES);
  // A brand-new conversation (no assistant reply yet) starts with the
  // click-to-choose form instead of the agent's open-ended questions.
  const [formOpen, setFormOpen] = useState(
    () => initialMessages.length > 0 && !initialMessages.some((m) => m.role === "assistant")
  );
  const [busy, setBusy] = useState(false);
  const refs = useReferenceImages();
  // Images sent with a message, keyed by that message's index — session only
  // (they're persisted on the generated node, not on the chat message).
  type Media = { kind: "image" | "video"; src: string };
  const [mediaByMsg, setMediaByMsg] = useState<Record<number, Media[]>>({});
  const attachToMessage = (index: number) => {
    const items: Media[] = refs.takePending().map((src) => ({ kind: "image", src }));
    // The node selected on the canvas travels with the message too.
    if (selectedMedia) {
      items.unshift(selectedMedia);
      onPinSelected();
    }
    if (items.length) setMediaByMsg((m) => ({ ...m, [index]: items }));
  };
  const startedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const generateNow = (prompt: string, type: "video" | "image") => {
    if (type === "image") {
      onGenerateImageRequest(prompt, refs.urls);
    } else {
      onGenerateRequest(prompt, choices.ratio, refs.urls, choices.duration);
    }
    // The references now live on the generated node.
    refs.clear();
    setFinalPrompt(null);
  };

  // What each image sent to the agent is, so it doesn't have to guess.
  const agentImages = (uploadedUrls: string[]) => {
    const out = new Map<string, string>();
    for (const m of [selectedMedia, pinnedMedia]) {
      if (!m) continue;
      out.set(
        m.kind === "image" ? m.src : videoPoster(m.src),
        m.kind === "image"
          ? "the IMAGE node the user has selected on their canvas"
          : "a single still frame (about 1 second in) taken from the VIDEO node the user has selected on their canvas"
      );
    }
    for (const url of uploadedUrls) {
      if (!out.has(url)) out.set(url, "a reference image the user attached or uploaded");
    }
    return [...out].map(([url, label]) => ({ url, label }));
  };

  const refine = async (
    next: AgentMessage[],
    referenceUrls = refs.urls
  ) => {
    setBusy(true);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          canvasContext,
          mediaMode: mode,
          referenceImages: agentImages(referenceUrls),
        }),
      });
      const result: AgentResult = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: result.reply }]);
      insertMessage(conversationId, "assistant", result.reply).catch(() => {});
      insertUsageLog({
        conversationId,
        source: "gemma",
        model: MODEL,
        rawUsage: result.usage,
      }).catch(() => {});
      if (result.status === "ready" && result.finalPrompt) {
        // Only differs from the toggle when the user explicitly asked for the other type.
        setMode(result.mediaType);
        onFinalPrompt(result.finalPrompt);
        // Review step: the prompt lands on an editable node; Generate is a click away.
        setFinalPrompt(result.finalPrompt);
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

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || refs.uploading) return;

    attachToMessage(messages.length);
    const next: AgentMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    insertMessage(conversationId, "user", trimmed).catch(() => {});
    // The very first message opens the option form instead of a Q&A round.
    if (messages.length === 0) {
      setFormOpen(true);
      return;
    }
    setFormOpen(false);
    await refine(next);
  };

  const submitForm = () => {
    if (busy || refs.uploading) return;
    setFormOpen(false);
    const text = summarizeChoices(mode, choices);
    attachToMessage(messages.length);
    const next: AgentMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    insertMessage(conversationId, "user", text).catch(() => {});
    refine(next, refs.urls);
  };

  // A conversation that ends on a user message (just created, or interrupted
  // before the assistant replied) needs to auto-continue once on load.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (initialReferences?.length) refs.seed(initialReferences);
    const last = initialMessages[initialMessages.length - 1];
    if (last?.role === "user" && !formOpen) refine(initialMessages, initialReferences ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, formOpen]);

  const generate = () => {
    if (!finalPrompt || refs.uploading) return;
    generateNow(finalPrompt, mode);
  };

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-r border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Link
          href="/app/projects"
          title="Back to projects"
          aria-label="Back to projects"
          className="-ml-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <Link href="/app" className="shrink-0 text-sm font-medium tracking-tight">
          Thunder
        </Link>
        {title && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="truncate text-sm text-muted-foreground">{title}</span>
          </>
        )}
      </div>

      {canvasContext && !selectedMedia && (
        <div className="mx-4 mt-3 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
          Referencing selected node
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Describe the {mode} you want to make.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground"
              }`}
            >
              {mediaByMsg[i] && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {mediaByMsg[i].map((m) =>
                    m.kind === "video" ? (
                      <video
                        key={m.src}
                        src={m.src}
                        className="size-16 rounded-md object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={m.src} src={m.src} alt="Attached" className="size-16 rounded-md object-cover" />
                    )
                  )}
                </div>
              )}
              <p>{m.content}</p>
            </div>
          </div>
        ))}
        {formOpen && (
          <BriefForm
            mode={mode}
            value={choices}
            onChange={setChoices}
            onSubmit={submitForm}
            disabled={busy || refs.uploading}
          />
        )}
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
            Prompt ready. Edit it on the canvas if you like, then generate{" "}
            {mode === "image" ? "the image" : "the video"}.
          </p>
          <Button
            size="sm"
            className="shrink-0 rounded-full"
            onClick={generate}
            disabled={refs.uploading}
          >
            {refs.uploading ? "Uploading…" : "Generate"}
          </Button>
        </div>
      )}

      <div
        {...refs.dropProps}
        className={`border-t border-border p-4 transition-colors ${
          refs.dragging ? "bg-secondary/60 outline-2 -outline-offset-4 outline-dashed outline-white/30" : ""
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {(["video", "image"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                mode === m
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
          {mode === "video" && (
            <>
              <span className="mx-1 h-4 w-px bg-border" />
              {RATIOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setChoices((c) => ({ ...c, ratio: r }));
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    choices.ratio === r
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </>
          )}
        </div>
        {selectedMedia && (
          <div className="mb-2 flex items-center gap-2.5">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-white/40 bg-secondary">
              {selectedMedia.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedMedia.src} alt="Selected" className="size-full object-cover" />
              ) : (
                <video
                  src={selectedMedia.src}
                  className="size-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              )}
              <button
                type="button"
                title="Stop referencing this node"
                onClick={onDismissSelected}
                className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
              >
                <X className="size-2.5" />
              </button>
            </div>
            <p className="text-xs leading-snug text-muted-foreground">
              {selectedMedia.kind === "image"
                ? "Selected image is used as a reference"
                : "Selected video is used as a reference. Say \"continue\" in your prompt to extend it."}
            </p>
          </div>
        )}
        <ReferenceChips refs={refs} />
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={refs.onPaste}
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
                  ? `Describe the ${mode} you want to make...`
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
            disabled={!input.trim() || busy || refs.uploading}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
        <div className="mt-2">
          <ReferencePicker refs={refs} />
        </div>
      </div>
    </aside>
  );
}
