"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { Edge, Node } from "reactflow";
import { ChatRail } from "@/components/project/chat-rail";
import { Canvas } from "@/components/project/canvas";
import { makeId, runMockGeneration, type Ratio } from "@/lib/mock-generations";

const CHAIN_STEP_X = 300;

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

  const addNode = (type: "prompt" | "video", data: Record<string, unknown>) => {
    const id = makeId("node");
    const position = { x: depth.current * CHAIN_STEP_X, y: 120 };
    depth.current += 1;

    setNodes((prev) => [...prev, { id, type, position, data }]);
    if (lastNodeId.current) {
      const source = lastNodeId.current;
      setEdges((prev) => [...prev, { id: `e-${source}-${id}`, source, target: id }]);
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

  const handleGenerate = (prompt: string, ratio: Ratio) => {
    const id = addNode("video", { status: "queued", progress: 0, prompt, ratio });
    runMockGeneration(id, (patch) => updateNodeData(id, patch));
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <ChatRail
        initialMessage={initialMessage}
        onBrief={handleBrief}
        onFinalPrompt={handleFinalPrompt}
        onGenerateRequest={handleGenerate}
      />
      <Canvas nodes={nodes} edges={edges} />
    </div>
  );
}
