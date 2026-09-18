"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { Edge, Node } from "reactflow";
import { ChatRail } from "@/components/project/chat-rail";
import { Canvas, type AddNodeRequest } from "@/components/project/canvas";
import type { Ratio } from "@/lib/mock-generations";
import {
  deleteGenerationReference,
  deleteGenerationTask,
  insertGenerationReference,
  insertGenerationTask,
  insertUsageLog,
  loadConversation,
  loadGenerationReferences,
  loadGenerationTasks,
  loadMessages,
  updateGenerationTask,
  type GenerationTaskRow,
} from "@/lib/db";
import type { AgentMessage } from "@/lib/agent";

const CHAIN_STEP_X = 300;
const POLL_INTERVAL_MS = 5_000;
// ponytail: fixed cap rather than reading execution_expires_after from the
// task — good enough until a real "still rendering" state is needed.
const POLL_MAX_ATTEMPTS = 60; // ~5 minutes

function toFlowNode(row: GenerationTaskRow): Node {
  const data =
    row.type === "prompt"
      ? { label: row.label, text: row.prompt }
      : { status: row.status, prompt: row.prompt, ratio: row.ratio, videoSrc: row.media_url };
  return {
    id: row.id,
    type: row.type,
    position: { x: row.position_x, y: row.position_y },
    data,
  };
}

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const conversationId = params.projectId;
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[] | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const lastNodeId = useRef<string | null>(null);
  const depth = useRef(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Manual node-to-node references (canvas connect-two-existing-nodes) —
  // targetId -> source node ids it should use as a reference, on top of
  // generation_tasks.parent_id's single-parent lineage.
  const referencesByTarget = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    loadConversation(conversationId)
      .then((c) => setTitle(c.title))
      .catch(() => {});
    Promise.all([loadMessages(conversationId), loadGenerationTasks(conversationId)])
      .then(async ([msgs, tasks]) => {
        setMessages(msgs);
        setNodes(
          tasks.map(toFlowNode).map((n) =>
            n.type === "video"
              ? { ...n, data: { ...n.data, onRetry: () => retryFnRef.current(n.id) } }
              : n
          )
        );

        const lineageEdges = tasks
          .filter((t) => t.parent_id)
          .map((t) => ({ id: `e-${t.parent_id}-${t.id}`, source: t.parent_id!, target: t.id }));

        const references = await loadGenerationReferences(tasks.map((t) => t.id)).catch(
          () => []
        );
        const refEdges: Edge[] = references.map((r) => ({
          id: `ref-${r.reference_task_id}-${r.generation_task_id}`,
          source: r.reference_task_id,
          target: r.generation_task_id,
          type: "smoothstep",
          style: { stroke: "rgba(147,197,253,0.6)", strokeWidth: 1.5, strokeDasharray: "4 3" },
          data: { kind: "reference" },
        }));
        references.forEach((r) => {
          const list = referencesByTarget.current.get(r.generation_task_id) ?? [];
          list.push(r.reference_task_id);
          referencesByTarget.current.set(r.generation_task_id, list);
        });

        setEdges([...lineageEdges, ...refEdges]);
        if (tasks.length > 0) {
          const last = tasks[tasks.length - 1];
          lastNodeId.current = last.id;
          depth.current = tasks.length;
        }
      })
      .catch(() => setMessages([]));
  }, [conversationId]);

  /** A node to generate FROM might itself be a video/image (direct visual
   * continuation), or might have had another node manually connected into
   * it as a reference (canvas connect-two-existing-nodes) — check both.
   * Dragging straight out of a video node is a literal same-shot
   * continuation ("extend"); everything else is a looser cross-scene
   * style/character reference ("reference", the default). */
  const resolveReference = (
    nodeId: string | null
  ): { type: "video_url" | "image_url"; url: string; mode?: "extend" | "reference" } | undefined => {
    if (!nodeId) return undefined;
    const direct = nodes.find((n) => n.id === nodeId);
    if (direct?.type === "video" && direct.data.videoSrc) {
      return { type: "video_url", url: direct.data.videoSrc, mode: "extend" };
    }
    if (direct?.type === "image" && direct.data.src) {
      return { type: "image_url", url: direct.data.src };
    }
    const refIds = referencesByTarget.current.get(nodeId);
    const refId = refIds?.[refIds.length - 1];
    const refNode = refId ? nodes.find((n) => n.id === refId) : undefined;
    if (refNode?.type === "video" && refNode.data.videoSrc) {
      return { type: "video_url", url: refNode.data.videoSrc };
    }
    if (refNode?.type === "image" && refNode.data.src) {
      return { type: "image_url", url: refNode.data.src };
    }
    return undefined;
  };

  // Always holds the latest handleRetryNode closure (refreshed every render
  // below) — lets a node's data carry a stable `() => retryFnRef.current(id)`
  // callback created once at node-creation time without going stale.
  const retryFnRef = useRef<(id: string) => void>(() => {});

  const handleReferenceConnect = (sourceId: string, targetId: string) => {
    const list = referencesByTarget.current.get(targetId) ?? [];
    if (!list.includes(sourceId)) {
      list.push(sourceId);
      referencesByTarget.current.set(targetId, list);
    }
    insertGenerationReference(targetId, sourceId).catch(() => {});
  };

  const handleDeleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    referencesByTarget.current.delete(id);
    referencesByTarget.current.forEach((list, targetId) => {
      referencesByTarget.current.set(
        targetId,
        list.filter((refId) => refId !== id)
      );
    });
    if (lastNodeId.current === id) lastNodeId.current = null;
    deleteGenerationTask(id).catch(() => {});
  };

  const handleDisconnectEdge = (edge: Edge) => {
    setEdges((prev) => prev.filter((e) => e.id !== edge.id));
    if (edge.data?.kind === "reference") {
      // edge.source = the referenced node, edge.target = the node that
      // gains it — matches generation_references' (generation_task_id,
      // reference_task_id) columns in that order.
      const list = referencesByTarget.current.get(edge.target) ?? [];
      referencesByTarget.current.set(
        edge.target,
        list.filter((refId) => refId !== edge.source)
      );
      deleteGenerationReference(edge.target, edge.source).catch(() => {});
    } else {
      // Lineage edge — disconnect without deleting either node.
      updateGenerationTask(edge.target, { parent_id: null }).catch(() => {});
    }
  };

  const addNode = (
    type: "prompt" | "video" | "image",
    data: Record<string, unknown>,
    opts?: { sourceId?: string | null; position?: { x: number; y: number } }
  ) => {
    const id = crypto.randomUUID();
    const sourceId = opts?.sourceId !== undefined ? opts.sourceId : lastNodeId.current;
    const position = opts?.position ?? { x: depth.current * CHAIN_STEP_X, y: 120 };
    if (!opts?.position) depth.current += 1;

    const nodeData =
      type === "video" ? { ...data, onRetry: () => retryFnRef.current(id) } : data;
    setNodes((prev) => [...prev, { id, type, position, data: nodeData }]);
    if (sourceId) {
      setEdges((prev) => [...prev, { id: `e-${sourceId}-${id}`, source: sourceId, target: id }]);
    }
    lastNodeId.current = id;

    insertGenerationTask(conversationId, {
      id,
      parentId: sourceId ?? null,
      type,
      status: (data.status as GenerationTaskRow["status"]) ?? "completed",
      label: data.label as string | undefined,
      prompt: (data.prompt ?? data.text) as string | undefined,
      ratio: data.ratio as string | undefined,
      position,
    }).catch(() => {});

    return id;
  };

  const updateNodeData = (id: string, patch: Record<string, unknown>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
    if (patch.status || patch.videoSrc) {
      updateGenerationTask(id, {
        status: patch.status as GenerationTaskRow["status"] | undefined,
        media_url: patch.videoSrc as string | undefined,
      }).catch(() => {});
    }
  };

  const handleFinalPrompt = (text: string) => {
    addNode("prompt", { label: "Refined prompt", text });
  };

  const generateVideoForNode = async (
    nodeId: string,
    prompt: string,
    ratio: Ratio,
    reference?: { type: "video_url" | "image_url"; url: string; mode?: "extend" | "reference" }
  ) => {
    const submitRes = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ratio, reference }),
    }).catch(() => null);
    const submitData = await submitRes?.json().catch(() => null);

    if (!submitData?.taskId) {
      updateNodeData(nodeId, { status: "error" });
      return;
    }
    updateNodeData(nodeId, { status: "generating" });
    pollVideoTask(submitData.taskId, nodeId);
  };

  const handleRetryNode = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node || node.type !== "video") return;
    const lineageEdge = edges.find((e) => e.target === id && e.data?.kind !== "reference");
    const reference = resolveReference(lineageEdge?.source ?? null);
    updateNodeData(id, { status: "queued" });
    generateVideoForNode(id, node.data.prompt, (node.data.ratio ?? "16:9") as Ratio, reference);
  };
  useEffect(() => {
    retryFnRef.current = handleRetryNode;
  });

  const handleGenerate = async (prompt: string, ratio: Ratio) => {
    // A node selected on the canvas takes precedence over the plain chat
    // chain — matches the same "explicit choice wins" rule used elsewhere.
    const reference = resolveReference(selectedNodeId ?? lastNodeId.current);
    const id = addNode("video", { status: "queued", prompt, ratio });
    generateVideoForNode(id, prompt, ratio, reference);
  };

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined;
  const canvasContext = selectedNode
    ? selectedNode.type === "prompt"
      ? `A "${selectedNode.data.label ?? "prompt"}" node — text: "${selectedNode.data.text}"`
      : selectedNode.type === "video"
        ? `A video node — status: ${selectedNode.data.status}, prompt used: "${selectedNode.data.prompt}"`
        : `An image node — prompt used: "${selectedNode.data.prompt}"`
    : undefined;

  const handleAddNode = ({
    sourceId,
    type,
    prompt,
    position,
    extraReferenceIds,
  }: AddNodeRequest) => {
    if (type === "video") {
      // Prefer a node dragged into the draft as an extra reference over the
      // plain chain source, since that was an explicit choice made while
      // composing this node — fall back through both.
      let reference: ReturnType<typeof resolveReference>;
      for (const candidateId of [...extraReferenceIds].reverse().concat(sourceId)) {
        reference = resolveReference(candidateId);
        if (reference) break;
      }

      const id = addNode(
        "video",
        { status: "queued", prompt, ratio: "16:9" as Ratio },
        { sourceId, position }
      );
      extraReferenceIds.forEach((refId) => handleReferenceConnect(refId, id));
      generateVideoForNode(id, prompt, "16:9", reference);
    } else if (type === "prompt") {
      // AI-continued prompt ("Ask AI to continue") — lands as a prompt
      // node, same shape as a chat-refined prompt, so it can itself be
      // dragged from to generate a video or continue again.
      const id = addNode("prompt", { label: "Continued", text: prompt }, { sourceId, position });
      extraReferenceIds.forEach((refId) => handleReferenceConnect(refId, id));
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
        insertUsageLog(nodeId, data.model ?? "unknown", data.usage).catch(() => {});
      } else if (data?.status === "error") {
        updateNodeData(nodeId, { status: "error" });
      } else {
        pollVideoTask(taskId, nodeId, attempt + 1);
      }
    }, POLL_INTERVAL_MS);
  };

  if (messages === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <ChatRail
        conversationId={conversationId}
        title={title}
        initialMessages={messages}
        canvasContext={canvasContext}
        onFinalPrompt={handleFinalPrompt}
        onGenerateRequest={handleGenerate}
      />
      <Canvas
        nodes={nodes}
        edges={edges}
        onAddNode={handleAddNode}
        onReferenceConnect={handleReferenceConnect}
        onDeleteNode={handleDeleteNode}
        onDisconnectEdge={handleDisconnectEdge}
        onSelectNode={setSelectedNodeId}
      />
    </div>
  );
}
