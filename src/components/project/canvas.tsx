"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnectStart,
  type OnConnectEnd,
} from "reactflow";
import "reactflow/dist/style.css";
import { PromptNode, VideoNode, ImageNode, DraftNode } from "./nodes";

const nodeTypes = { prompt: PromptNode, video: VideoNode, image: ImageNode, draft: DraftNode };
const DRAFT_ID = "__draft__";
const REFERENCE_EDGE_STYLE = {
  stroke: "rgba(147,197,253,0.6)",
  strokeWidth: 1.5,
  strokeDasharray: "4 3",
};

export interface AddNodeRequest {
  sourceId: string;
  type: "video" | "image" | "prompt";
  prompt: string;
  position: { x: number; y: number };
  extraReferenceIds: string[];
}

function FlowCanvas({
  conversationId,
  nodes,
  edges,
  onAddNode,
  onReferenceConnect,
  onDeleteNode,
  onDisconnectEdge,
  onSelectNode,
}: {
  conversationId: string;
  nodes: Node[];
  edges: Edge[];
  onAddNode: (request: AddNodeRequest) => void;
  onReferenceConnect: (sourceId: string, targetId: string) => void;
  onDeleteNode: (id: string) => void;
  onDisconnectEdge: (edge: Edge) => void;
  onSelectNode: (id: string | null) => void;
}) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const connectingNodeId = useRef<string | null>(null);
  const draftRefIds = useRef<string[]>([]);
  const draftSourceId = useRef<string | null>(null);

  // Nodes are controlled from the parent (new nodes/status updates), but
  // draggable locally — merge by id so live edits (status/progress) come
  // through without resetting a position the user dragged. The draft node
  // (mid-composition, not yet a real node) is local-only — keep it through
  // the merge instead of letting it get wiped whenever `nodes` changes.
  useEffect(() => {
    setRfNodes((current) => {
      const byId = new Map(current.map((n) => [n.id, n]));
      const merged = nodes.map((n) => {
        const existing = byId.get(n.id);
        return existing ? { ...existing, data: n.data } : n;
      });
      const draft = current.find((n) => n.id === DRAFT_ID);
      return draft ? [...merged, draft] : merged;
    });
  }, [nodes, setRfNodes]);

  // Reference edges (from manually connecting two existing nodes, or from
  // connecting into an in-progress draft node) live only in local canvas
  // state until the next full reload — merge them back in whenever the
  // parent-controlled lineage `edges` prop changes, instead of overwriting
  // rfEdges wholesale and losing them.
  useEffect(() => {
    setRfEdges((current) => {
      const localOnly = current.filter(
        (e) =>
          (e.data?.kind === "reference" || e.target === DRAFT_ID) &&
          !edges.some((incoming) => incoming.id === e.id)
      );
      return [...edges, ...localOnly];
    });
  }, [edges, setRfEdges]);

  const cleanupDraft = useCallback(() => {
    setRfNodes((cur) => cur.filter((n) => n.id !== DRAFT_ID));
    setRfEdges((cur) => cur.filter((e) => e.target !== DRAFT_ID));
    draftRefIds.current = [];
    draftSourceId.current = null;
  }, [setRfNodes, setRfEdges]);

  const finalizeDraft = useCallback(
    (position: { x: number; y: number }) => (type: "video" | "image" | "prompt", prompt: string) => {
      if (!draftSourceId.current) return;
      onAddNode({
        sourceId: draftSourceId.current,
        type,
        prompt,
        position,
        extraReferenceIds: [...draftRefIds.current],
      });
      cleanupDraft();
    },
    [onAddNode, cleanupDraft]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) return;

      if (params.target === DRAFT_ID) {
        if (!draftRefIds.current.includes(params.source)) {
          draftRefIds.current.push(params.source);
        }
        const id = `draftref-${params.source}`;
        setRfEdges((current) =>
          current.some((e) => e.id === id)
            ? current
            : [
                ...current,
                {
                  id,
                  source: params.source!,
                  target: DRAFT_ID,
                  type: "smoothstep",
                  style: REFERENCE_EDGE_STYLE,
                  data: { kind: "reference" },
                },
              ]
        );
        return;
      }

      const id = `ref-${params.source}-${params.target}`;
      setRfEdges((current) =>
        current.some((e) => e.id === id)
          ? current
          : [
              ...current,
              {
                id,
                source: params.source!,
                target: params.target!,
                type: "smoothstep",
                style: REFERENCE_EDGE_STYLE,
                data: { kind: "reference" },
              },
            ]
      );
      onReferenceConnect(params.source, params.target);
    },
    [setRfEdges, onReferenceConnect]
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      deleted.filter((n) => n.id !== DRAFT_ID).forEach((n) => onDeleteNode(n.id));
    },
    [onDeleteNode]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      deleted
        .filter((e) => e.target !== DRAFT_ID && e.source !== DRAFT_ID)
        .forEach((e) => onDisconnectEdge(e));
    },
    [onDisconnectEdge]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      const first = selected.find((n) => n.id !== DRAFT_ID);
      onSelectNode(first?.id ?? null);
    },
    [onSelectNode]
  );

  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    connectingNodeId.current = nodeId;
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const sourceId = connectingNodeId.current;
      connectingNodeId.current = null;
      if (!sourceId) return;

      const target = event.target as HTMLElement;
      const droppedOnPane = target?.classList?.contains("react-flow__pane");
      if (!droppedOnPane || !wrapperRef.current) return;

      const clientX = "changedTouches" in event ? event.changedTouches[0].clientX : event.clientX;
      const clientY = "changedTouches" in event ? event.changedTouches[0].clientY : event.clientY;
      const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });

      const sourceNode = rfNodes.find((n) => n.id === sourceId);
      const initialPrompt =
        sourceNode?.type === "prompt"
          ? sourceNode.data.text
          : sourceNode?.type === "video" || sourceNode?.type === "image"
            ? sourceNode.data.prompt
            : undefined;

      draftSourceId.current = sourceId;
      draftRefIds.current = [];
      setRfNodes((cur) => [
        ...cur.filter((n) => n.id !== DRAFT_ID),
        {
          id: DRAFT_ID,
          type: "draft",
          position: flowPosition,
          data: {
            conversationId,
            initialPrompt,
            onSubmit: finalizeDraft(flowPosition),
            onCancel: cleanupDraft,
          },
        },
      ]);
      setRfEdges((cur) => [
        ...cur,
        {
          id: `e-${sourceId}-${DRAFT_ID}`,
          source: sourceId,
          target: DRAFT_ID,
          type: "smoothstep",
        },
      ]);
    },
    [
      screenToFlowPosition,
      rfNodes,
      setRfNodes,
      setRfEdges,
      finalizeDraft,
      cleanupDraft,
      conversationId,
    ]
  );

  return (
    <div ref={wrapperRef} className="relative h-full flex-1 bg-black">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={onSelectionChange}
        deleteKeyCode={["Delete", "Backspace"]}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "rgba(255,255,255,0.25)", strokeWidth: 1.5 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(255,255,255,0.15)"
          gap={24}
          size={1}
        />
        <Controls
          showInteractive={false}
          className="overflow-hidden rounded-lg border border-border [&_button]:!border-b-border [&_button]:!bg-card [&_button:hover]:!bg-secondary [&_button_svg]:!fill-foreground"
        />
      </ReactFlow>
    </div>
  );
}

export function Canvas(props: {
  conversationId: string;
  nodes: Node[];
  edges: Edge[];
  onAddNode: (request: AddNodeRequest) => void;
  onReferenceConnect: (sourceId: string, targetId: string) => void;
  onDeleteNode: (id: string) => void;
  onDisconnectEdge: (edge: Edge) => void;
  onSelectNode: (id: string | null) => void;
}) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
