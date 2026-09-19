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
const CHILD_STEP_Y = 260;
const POLL_INTERVAL_MS = 5_000;
// ponytail: fixed cap rather than reading execution_expires_after from the
// task — good enough until a real "still rendering" state is needed.
const POLL_MAX_ATTEMPTS = 60; // ~5 minutes

function toFlowNode(row: GenerationTaskRow): Node {
  const referenceUrls = row.reference_urls ?? [];
  const data =
    row.type === "prompt"
      ? { label: row.label, text: row.prompt, referenceUrls }
      : row.type === "video"
        ? {
            status: row.status,
            prompt: row.prompt,
            ratio: row.ratio,
            videoSrc: row.media_url,
            referenceUrls,
          }
        : { status: row.status, prompt: row.prompt, src: row.media_url, referenceUrls };
  return {
    id: row.id,
    type: row.type,
    position: { x: row.position_x, y: row.position_y },
    data,
  };
}

type VideoRef = { type: "video_url" | "image_url"; url: string; mode?: "extend" | "reference" };

/** An image reference is just another reference image (role reference_image),
 * so fold it into the image list, de-duplicated and first; only a video
 * reference stays separate (it needs role reference_video / extend). */
function splitReference(reference: VideoRef | undefined, urls: string[]) {
  const all = reference?.type === "image_url" ? [reference.url, ...urls] : urls;
  return {
    reference: reference?.type === "video_url" ? reference : undefined,
    urls: [...new Set(all)],
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
  // The rail's "x" on the selected-node chip: ignore that selection until the
  // user selects something else (or clears the selection).
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const selectedNode =
    selectedNodeId && selectedNodeId !== dismissedId
      ? nodes.find((n) => n.id === selectedNodeId)
      : undefined;
  // A selected node that was sent along with a chat message stays the reference
  // (even if you click away) until you generate or pick a different node.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const activeRefNode = selectedNode ?? (pinnedId ? nodes.find((n) => n.id === pinnedId) : undefined);
  // Where nodes sit and how many children each has, so a new node lands next
  // to the node it comes from instead of at the far end of the canvas.
  const positions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const childCounts = useRef<Map<string, number>>(new Map());
  // Manual node-to-node references (canvas connect-two-existing-nodes) —
  // targetId -> source node ids it should use as a reference, on top of
  // generation_tasks.parent_id's single-parent lineage.
  const referencesByTarget = useRef<Map<string, string[]>>(new Map());
  // Node inserts run one after another: a node whose parent_id points at a
  // node created a moment earlier (auto-generate after a refined prompt)
  // would otherwise hit the parent FK before that parent row exists (409).
  const insertQueue = useRef<Promise<unknown>>(Promise.resolve());
  // The one "Refined prompt" node that further agent revisions update in place,
  // until something is generated from it (then the next refinement starts a
  // fresh node). Without this every agent reply piled up another node.
  const refinedNodeId = useRef<string | null>(null);

  useEffect(() => {
    loadConversation(conversationId)
      .then((c) => setTitle(c.title))
      .catch(() => {});
    Promise.all([loadMessages(conversationId), loadGenerationTasks(conversationId)])
      .then(async ([msgs, tasks]) => {
        setMessages(msgs);
        setNodes(
          tasks.map(toFlowNode).map((n) =>
            n.type === "video" || n.type === "image"
              ? { ...n, data: { ...n.data, onRetry: () => retryFnRef.current(n.id) } }
              : n.type === "prompt" && n.data.label === "Refined prompt"
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      editable: true,
                      onTextChange: (t: string) => retryFnRef.current(n.id, "text", t),
                      onTextCommit: (t: string) => retryFnRef.current(n.id, "commit", t),
                    },
                  }
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
          type: "deletable",
          style: { stroke: "rgba(147,197,253,0.6)", strokeWidth: 1.5, strokeDasharray: "4 3" },
          data: { kind: "reference" },
        }));
        references.forEach((r) => {
          const list = referencesByTarget.current.get(r.generation_task_id) ?? [];
          list.push(r.reference_task_id);
          referencesByTarget.current.set(r.generation_task_id, list);
        });

        tasks.forEach((t) => {
          positions.current.set(t.id, { x: t.position_x, y: t.position_y });
          if (t.parent_id) {
            childCounts.current.set(t.parent_id, (childCounts.current.get(t.parent_id) ?? 0) + 1);
          }
        });

        setEdges([...lineageEdges, ...refEdges]);
        if (tasks.length > 0) {
          const last = tasks[tasks.length - 1];
          lastNodeId.current = last.id;
          depth.current = tasks.length;
          if (last.type === "prompt" && last.label === "Refined prompt") {
            refinedNodeId.current = last.id;
          }
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
  // Also carries edits to an editable Refined-prompt node ("text" while typing,
  // "commit" to persist on blur) so those callbacks stay stable too.
  const retryFnRef = useRef<(id: string, action?: "retry" | "text" | "commit", text?: string) => void>(
    () => {}
  );

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
    // Deleting the latest node must not orphan the next one: fall back to its parent.
    if (lastNodeId.current === id) {
      lastNodeId.current = edges.find((e) => e.target === id && e.data?.kind !== "reference")?.source ?? null;
    }
    if (refinedNodeId.current === id) refinedNodeId.current = null;
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
    const from = sourceId ? positions.current.get(sourceId) : undefined;
    const position =
      opts?.position ??
      (from
        ? { x: from.x + CHAIN_STEP_X, y: from.y + (childCounts.current.get(sourceId!) ?? 0) * CHILD_STEP_Y }
        : { x: depth.current * CHAIN_STEP_X, y: 120 });
    if (!opts?.position) depth.current += 1;
    positions.current.set(id, position);
    if (sourceId) childCounts.current.set(sourceId, (childCounts.current.get(sourceId) ?? 0) + 1);
    // Something is being generated from the refined node: it's final now.
    if (sourceId && sourceId === refinedNodeId.current) refinedNodeId.current = null;

    const nodeData =
      type === "video" || type === "image"
        ? { ...data, onRetry: () => retryFnRef.current(id) }
        : type === "prompt" && data.editable
          ? {
              ...data,
              onTextChange: (t: string) => retryFnRef.current(id, "text", t),
              onTextCommit: (t: string) => retryFnRef.current(id, "commit", t),
            }
          : data;
    setNodes((prev) => [...prev, { id, type, position, data: nodeData }]);
    if (sourceId) {
      setEdges((prev) => [...prev, { id: `e-${sourceId}-${id}`, source: sourceId, target: id }]);
    }
    lastNodeId.current = id;

    insertQueue.current = insertQueue.current.then(() =>
      insertGenerationTask(conversationId, {
        id,
        parentId: sourceId ?? null,
        type,
        status: (data.status as GenerationTaskRow["status"]) ?? "completed",
        label: data.label as string | undefined,
        prompt: (data.prompt ?? data.text) as string | undefined,
        ratio: data.ratio as string | undefined,
        referenceUrls: data.referenceUrls as string[] | undefined,
        mediaUrl: (data.src ?? data.videoSrc) as string | undefined,
        position,
      }).catch(() => {})
    );

    return id;
  };

  const updateNodeData = (id: string, patch: Record<string, unknown>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
    if (typeof patch.text === "string") {
      updateGenerationTask(id, { prompt: patch.text }).catch(() => {});
    }
    if (patch.status || patch.videoSrc || patch.src) {
      updateGenerationTask(id, {
        status: patch.status as GenerationTaskRow["status"] | undefined,
        media_url: (patch.videoSrc ?? patch.src) as string | undefined,
        // Not part of the node's visual data — the original, expiring
        // BytePlus link, kept for reference alongside the permanent one.
        byteplus_url: patch.byteplusUrl as string | undefined,
      }).catch(() => {});
    }
  };

  const handleFinalPrompt = (text: string) => {
    const existing = refinedNodeId.current;
    if (existing) {
      updateNodeData(existing, { text });
    } else {
      refinedNodeId.current = addNode(
        "prompt",
        { label: "Refined prompt", text, editable: true },
        { sourceId: activeRefNode?.id ?? lastNodeId.current }
      );
    }
  };

  const generateVideoForNode = async (
    nodeId: string,
    prompt: string,
    ratio: Ratio,
    reference?: { type: "video_url" | "image_url"; url: string; mode?: "extend" | "reference" },
    referenceUrls: string[] = [],
    duration: number | null = null
  ) => {
    const submitRes = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        ratio,
        reference,
        referenceImages: referenceUrls,
        duration,
      }),
    }).catch(() => null);
    const submitData = await submitRes?.json().catch(() => null);

    if (!submitData?.taskId) {
      // Only a reference-image rejection carries a specific reason to show.
      updateNodeData(nodeId, {
        status: "error",
        errorMessage: submitData?.referenceError ? submitData.error : undefined,
      });
      return;
    }
    updateNodeData(nodeId, { status: "generating", startedAt: Date.now(), errorMessage: undefined });
    pollVideoTask(submitData.taskId, nodeId);
  };

  // Synchronous — Seedream returns the image directly, no submit-then-poll
  // task cycle like video.
  const generateImageForNode = async (
    nodeId: string,
    prompt: string,
    referenceUrls: string[] = []
  ) => {
    updateNodeData(nodeId, { status: "generating", startedAt: Date.now(), errorMessage: undefined });
    const res = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, referenceImages: referenceUrls }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);

    if (!data?.imageUrl) {
      updateNodeData(nodeId, {
        status: "error",
        errorMessage: data?.referenceError ? data.error : undefined,
      });
      return;
    }
    updateNodeData(nodeId, { status: "completed", src: data.imageUrl });
    insertUsageLog({
      conversationId,
      generationTaskId: nodeId,
      source: "byteplus",
      model: data.model ?? "unknown",
      rawUsage: data.usage,
    }).catch(() => {});
  };

  const handleRetryNode = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    if (node.type === "image") {
      generateImageForNode(id, node.data.prompt, node.data.referenceUrls ?? []);
      return;
    }
    if (node.type !== "video") return;
    const lineageEdge = edges.find((e) => e.target === id && e.data?.kind !== "reference");
    const { reference, urls } = splitReference(
      resolveReference(lineageEdge?.source ?? null),
      node.data.referenceUrls ?? []
    );
    updateNodeData(id, { status: "queued" });
    generateVideoForNode(
      id,
      node.data.prompt,
      (node.data.ratio ?? "16:9") as Ratio,
      reference,
      urls,
      // In-memory only: not persisted, so a retry after a reload uses the model default.
      node.data.duration ?? null
    );
  };
  useEffect(() => {
    retryFnRef.current = (id, action = "retry", text = "") => {
      if (action === "text") {
        setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)));
      } else if (action === "commit") {
        updateGenerationTask(id, { prompt: text }).catch(() => {});
      } else {
        handleRetryNode(id);
      }
    };
  });

  /** The open Refined-prompt node (its text may have been edited) is replaced
   * by whatever gets generated from it: same place, same parent. */
  const consumeRefinedNode = () => {
    const id = refinedNodeId.current;
    const node = id ? nodes.find((n) => n.id === id) : undefined;
    if (!id || !node) return null;
    return {
      id,
      text: String(node.data.text ?? "").trim(),
      parentId: edges.find((e) => e.target === id && e.data?.kind !== "reference")?.source ?? null,
      position: positions.current.get(id) ?? node.position,
      carried: [...(referencesByTarget.current.get(id) ?? [])],
    };
  };

  const removeNodeQuietly = (id: string, parentId: string | null) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    referencesByTarget.current.delete(id);
    positions.current.delete(id);
    if (parentId) {
      childCounts.current.set(parentId, Math.max(0, (childCounts.current.get(parentId) ?? 1) - 1));
    }
    if (refinedNodeId.current === id) refinedNodeId.current = null;
    // Queued behind the node's own insert so a just-created row is really removed.
    insertQueue.current = insertQueue.current
      .then(() => deleteGenerationTask(id))
      .catch(() => {});
  };

  const handleGenerate = async (
    prompt: string,
    ratio: Ratio,
    referenceUrls: string[],
    duration: number | null
  ) => {
    const refined = consumeRefinedNode();
    setPinnedId(null);
    const finalPrompt = refined?.text || prompt;
    // Only an explicitly selected node (shown as a chip in the rail) or a
    // reference wired into the refined node is used as a visual reference.
    // A selected image joins the reference images; a selected video is continued.
    const { reference, urls } = splitReference(
      resolveReference(activeRefNode?.id ?? null) ??
        (refined ? resolveReference(refined.id) : undefined),
      referenceUrls
    );
    let sourceId: string | null;
    let position: { x: number; y: number } | undefined;
    if (refined) {
      // Making something "from" a node you picked (chip in the rail) branches
      // from that node, even when the open refined node hung off another one
      // (e.g. one left over from an earlier session). Otherwise it takes the
      // refined node's own place and parent.
      const picked = activeRefNode && activeRefNode.id !== refined.id ? activeRefNode.id : null;
      if (picked && picked !== refined.parentId) {
        sourceId = picked;
        position = undefined;
      } else {
        sourceId = refined.parentId;
        position = refined.position;
      }
      removeNodeQuietly(refined.id, refined.parentId);
    } else {
      sourceId = activeRefNode?.id ?? lastNodeId.current;
    }
    const id = addNode(
      "video",
      { status: "queued", prompt: finalPrompt, ratio, referenceUrls: urls, duration },
      { sourceId, position }
    );
    refined?.carried.forEach((refId) => handleReferenceConnect(refId, id));
    generateVideoForNode(id, finalPrompt, ratio, reference, urls, duration);
  };

  const handleGenerateImage = async (prompt: string, referenceUrls: string[]) => {
    const refined = consumeRefinedNode();
    setPinnedId(null);
    const finalPrompt = refined?.text || prompt;
    // A selected image node is sent to Seedream as a reference image too (a
    // selected video is not - Seedream only takes images).
    const selectedRef =
      resolveReference(activeRefNode?.id ?? null) ??
      (refined ? resolveReference(refined.id) : undefined);
    const urls = [
      ...new Set([...(selectedRef?.type === "image_url" ? [selectedRef.url] : []), ...referenceUrls]),
    ];
    let sourceId: string | null;
    let position: { x: number; y: number } | undefined;
    if (refined) {
      // Making something "from" a node you picked (chip in the rail) branches
      // from that node, even when the open refined node hung off another one
      // (e.g. one left over from an earlier session). Otherwise it takes the
      // refined node's own place and parent.
      const picked = activeRefNode && activeRefNode.id !== refined.id ? activeRefNode.id : null;
      if (picked && picked !== refined.parentId) {
        sourceId = picked;
        position = undefined;
      } else {
        sourceId = refined.parentId;
        position = refined.position;
      }
      removeNodeQuietly(refined.id, refined.parentId);
    } else {
      sourceId = activeRefNode?.id ?? lastNodeId.current;
    }
    const id = addNode(
      "image",
      { status: "queued", prompt: finalPrompt, referenceUrls: urls },
      { sourceId, position }
    );
    refined?.carried.forEach((refId) => handleReferenceConnect(refId, id));
    generateImageForNode(id, finalPrompt, urls);
  };

  // References attached on the dashboard ride along on the Brief (prompt)
  // node. Seed them into the rail only while nothing has been generated yet;
  // once a video/image node exists they've already been used.
  const hasGenerated = nodes.some((n) => n.type === "video" || n.type === "image");
  const briefReferences = hasGenerated
    ? undefined
    : [...nodes].reverse().find((n) => n.type === "prompt" && n.data.referenceUrls?.length)?.data
        .referenceUrls;

  const canvasContext = activeRefNode
    ? activeRefNode.type === "prompt"
      ? `A "${activeRefNode.data.label ?? "prompt"}" node — text: "${activeRefNode.data.text}"`
      : activeRefNode.type === "video"
        ? `A video node — status: ${activeRefNode.data.status}, prompt used: "${activeRefNode.data.prompt}"`
        : `An image node — prompt used: "${activeRefNode.data.prompt}"`
    : undefined;

  // An image dropped/pasted onto the canvas: a finished image node with no
  // parent, ready to select (reference chip in the rail) or drag out of.
  const handleAddImageNode = (url: string, position: { x: number; y: number }) => {
    addNode(
      "image",
      { status: "completed", prompt: "Uploaded image", src: url },
      { sourceId: null, position }
    );
  };

  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id);
    // A different (or cleared) selection re-arms the chip.
    setDismissedId((d) => (d === id ? d : null));
    // Picking another node replaces the pinned reference.
    if (id && id !== pinnedId) setPinnedId(null);
  };

  const mediaOf = (n?: Node) =>
    n?.type === "image" && n.data.src
      ? { kind: "image" as const, src: n.data.src as string }
      : n?.type === "video" && n.data.videoSrc
        ? { kind: "video" as const, src: n.data.videoSrc as string }
        : undefined;
  // The chip shows only a selection that hasn't been sent yet; a pinned one
  // already sits in the chat bubble.
  const selectedMedia = selectedNode && selectedNode.id !== pinnedId ? mediaOf(selectedNode) : undefined;
  const pinnedMedia = pinnedId ? mediaOf(nodes.find((n) => n.id === pinnedId)) : undefined;

  const handleAddNode = ({
    sourceId,
    type,
    prompt,
    position,
    extraReferenceIds,
    referenceUrls: pastedUrls,
  }: AddNodeRequest) => {
    if (type === "video") {
      // Prefer a node dragged into the draft as an extra reference over the
      // plain chain source, since that was an explicit choice made while
      // composing this node — fall back through both.
      let found: ReturnType<typeof resolveReference>;
      for (const candidateId of [...extraReferenceIds].reverse().concat(sourceId)) {
        found = resolveReference(candidateId);
        if (found) break;
      }
      const { reference, urls } = splitReference(found, pastedUrls);

      const id = addNode(
        "video",
        { status: "queued", prompt, ratio: "16:9" as Ratio, referenceUrls: urls },
        { sourceId, position }
      );
      extraReferenceIds.forEach((refId) => handleReferenceConnect(refId, id));
      generateVideoForNode(id, prompt, "16:9", reference, urls);
    } else if (type === "image") {
      // Dragging out of an image node into a new image: it becomes the reference.
      const urls: string[] = [...pastedUrls];
      for (const candidateId of [...extraReferenceIds].reverse().concat(sourceId)) {
        const r = resolveReference(candidateId);
        if (r?.type === "image_url") {
          urls.unshift(r.url);
          break;
        }
      }
      const id = addNode(
        "image",
        { status: "queued", prompt, referenceUrls: urls },
        { sourceId, position }
      );
      extraReferenceIds.forEach((refId) => handleReferenceConnect(refId, id));
      generateImageForNode(id, prompt, urls);
    } else if (type === "prompt") {
      // AI-continued prompt ("Ask AI to continue") — lands as a prompt
      // node, same shape as a chat-refined prompt, so it can itself be
      // dragged from to generate a video or continue again.
      const id = addNode("prompt", { label: "Continued", text: prompt }, { sourceId, position });
      extraReferenceIds.forEach((refId) => handleReferenceConnect(refId, id));
    }
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
        updateNodeData(nodeId, {
          status: "completed",
          videoSrc: data.videoUrl,
          byteplusUrl: data.byteplusUrl,
        });
        insertUsageLog({
          conversationId,
          generationTaskId: nodeId,
          source: "byteplus",
          model: data.model ?? "unknown",
          rawUsage: data.usage,
        }).catch(() => {});
      } else if (data?.status === "error") {
        updateNodeData(nodeId, {
          status: "error",
          errorMessage: data.referenceError ? data.error : undefined,
        });
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
        initialReferences={briefReferences}
        selectedMedia={selectedMedia}
        pinnedMedia={pinnedMedia}
        onPinSelected={() => setPinnedId(selectedNode?.id ?? null)}
        onDismissSelected={() => setDismissedId(selectedNodeId)}
        onFinalPrompt={handleFinalPrompt}
        onGenerateRequest={handleGenerate}
        onGenerateImageRequest={handleGenerateImage}
      />
      <Canvas
        conversationId={conversationId}
        nodes={nodes}
        edges={edges}
        onAddNode={handleAddNode}
        onReferenceConnect={handleReferenceConnect}
        onDeleteNode={handleDeleteNode}
        onDisconnectEdge={handleDisconnectEdge}
        onSelectNode={handleSelectNode}
        onAddImageNode={handleAddImageNode}
      />
    </div>
  );
}
