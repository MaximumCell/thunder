"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { Edge, Node } from "reactflow";
import { ChatRail } from "@/components/project/chat-rail";
import { Canvas, type AddNodeRequest } from "@/components/project/canvas";
import { makeId, type Ratio } from "@/lib/mock-generations";

const CHAIN_STEP_X = 300;
const POLL_INTERVAL_MS = 5_000;
// ponytail: fixed cap rather than reading execution_expires_after from the
// task — good enough until a real "still rendering" state is needed.
const POLL_MAX_ATTEMPTS = 60; // ~5 minutes

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const [initialMessage, setInitialMessage] = useState<string | undefined>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const lastNodeId = useRef<string | null>(null);
  const depth = useRef(0);

  useEffect(() => {
    const key = `thunder:init:${params.projectId}`;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      sessionStorage.removeItem(key);
      setInitialMessage(stored);
    }
  }, [params.projectId]);

  const addNode = (
    type: "prompt" | "video" | "image",
    data: Record<string, unknown>,
    opts?: { sourceId?: string | null; position?: { x: number; y: number } }
  ) => {
    const id = makeId("node");
    const sourceId = opts?.sourceId !== undefined ? opts.sourceId : lastNodeId.current;
    const position = opts?.position ?? { x: depth.current * CHAIN_STEP_X, y: 120 };
    if (!opts?.position) depth.current += 1;

    setNodes((prev) => [...prev, { id, type, position, data }]);
    if (sourceId) {
      setEdges((prev) => [...prev, { id: `e-${sourceId}-${id}`, source: sourceId, target: id }]);
    }
    lastNodeId.current = id;
    return id;
  };

  const updateNodeData = (id: string, patch: Record<string, unknown>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  };

  const handleBrief = (text: string) => {
    addNode("prompt", { label: "Brief", text });
  };

  const handleFinalPrompt = (text: string) => {
    addNode("prompt", { label: "Refined prompt", text });
  };

  const generateVideoForNode = async (
    nodeId: string,
    prompt: string,
    ratio: Ratio
  ) => {
    const submitRes = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ratio }),
    }).catch(() => null);
    const submitData = await submitRes?.json().catch(() => null);

    if (!submitData?.taskId) {
      updateNodeData(nodeId, { status: "error" });
      return;
    }
    updateNodeData(nodeId, { status: "generating" });
    pollVideoTask(submitData.taskId, nodeId);
  };

  const handleGenerate = async (prompt: string, ratio: Ratio) => {
    const id = addNode("video", { status: "queued", prompt, ratio });
    generateVideoForNode(id, prompt, ratio);
  };

  const handleAddNode = ({ sourceId, type, prompt, position }: AddNodeRequest) => {
    if (type === "video") {
      const id = addNode(
        "video",
        { status: "queued", prompt, ratio: "16:9" as Ratio },
        { sourceId, position }
      );
      generateVideoForNode(id, prompt, "16:9");
    }
    // image: no generation path yet — Seedream isn't wired in (see MODELS
    // in mock-generations.ts, still "Coming soon"). The add-node menu
    // already disables this option, so type is always "video" for now.
  };

  const pollVideoTask = (taskId: string, nodeId: string, attempt = 0) => {
    if (attempt >= POLL_MAX_ATTEMPTS) {
      updateNodeData(nodeId, { status: "error" });
      return;
    }
    setTimeout(async () => {
      const res = await fetch(`/api/generate/${taskId}`).catch(() => null);
      const data = await res?.json().catch(() => null);

      if (data?.status === "completed") {
        updateNodeData(nodeId, { status: "completed", videoSrc: data.videoUrl });
      } else if (data?.status === "error") {
        updateNodeData(nodeId, { status: "error" });
      } else {
        pollVideoTask(taskId, nodeId, attempt + 1);
      }
    }, POLL_INTERVAL_MS);
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <ChatRail
        initialMessage={initialMessage}
        onBrief={handleBrief}
        onFinalPrompt={handleFinalPrompt}
        onGenerateRequest={handleGenerate}
      />
      <Canvas nodes={nodes} edges={edges} onAddNode={handleAddNode} />
    </div>
  );
}
