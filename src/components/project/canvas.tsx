"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import ReactFlow, {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  type EdgeProps,
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
import { checkImageFile, upload as uploadImage } from "./reference-attachments";

const nodeTypes = { prompt: PromptNode, video: VideoNode, image: ImageNode, draft: DraftNode };
const DRAFT_ID = "__draft__";

// A wire with a small x at its midpoint (on hover or when selected) that
// disconnects it. The action comes from the canvas via context because edge
// components can't take callbacks as props.
const EdgeActions = createContext<(edgeId: string) => void>(() => {});

function DeletableEdge({
  id,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
}: EdgeProps) {
  const remove = useContext(EdgeActions);
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = () => {
    clearTimeout(timer.current);
    setHover(true);
  };
  // Short grace period so the pointer can travel from the wire to the button.
  const hide = () => {
    timer.current = setTimeout(() => setHover(false), 250);
  };
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <g onMouseEnter={show} onMouseLeave={hide}>
        <BaseEdge id={id} path={path} style={style} interactionWidth={24} />
      </g>
      {(hover || selected) && target !== DRAFT_ID && (
        <EdgeLabelRenderer>
          <button
            type="button"
            title="Disconnect"
            onMouseEnter={show}
            onMouseLeave={hide}
            onClick={() => remove(id)}
            className="nodrag nopan absolute flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow transition-colors hover:bg-destructive hover:text-white"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            <X className="size-3" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = { deletable: DeletableEdge };
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
  referenceUrls: string[]; // images pasted/attached in the draft node
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
  onAddImageNode,
}: {
  conversationId: string;
  nodes: Node[];
  edges: Edge[];
  onAddNode: (request: AddNodeRequest) => void;
  onReferenceConnect: (sourceId: string, targetId: string) => void;
  onDeleteNode: (id: string) => void;
  onDisconnectEdge: (edge: Edge) => void;
  onSelectNode: (id: string | null) => void;
  onAddImageNode: (url: string, position: { x: number; y: number }) => void;
}) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const connectingNodeId = useRef<string | null>(null);
  const draftRefIds = useRef<string[]>([]);
  const draftSourceId = useRef<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadNote) return;
    const t = setTimeout(() => setUploadNote(null), 6000);
    return () => clearTimeout(t);
  }, [uploadNote]);

  // Dropped/pasted image files become image nodes on the canvas: validated,
  // uploaded to Cloudinary, then added at `at` (side by side if several).
  const addImageFiles = useCallback(
    async (files: File[], at: { x: number; y: number }) => {
      setUploadNote(null);
      let placed = 0;
      for (const file of files.slice(0, 5)) {
        const problem = await checkImageFile(file);
        if (problem) {
          setUploadNote(problem);
          continue;
        }
        setUploading((n) => n + 1);
        try {
          const url = await uploadImage(file);
          onAddImageNode(url, { x: at.x + placed * 260, y: at.y });
          placed += 1;
        } catch (err) {
          setUploadNote((err as Error).message);
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [onAddImageNode]
  );

  // Ctrl/Cmd+V with the canvas (not a text box) focused: paste an image as a node.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      const r = wrapperRef.current?.getBoundingClientRect();
      const center = screenToFlowPosition({
        x: r ? r.left + r.width / 2 : 400,
        y: r ? r.top + r.height / 2 : 300,
      });
      addImageFiles(files, { x: center.x - 112, y: center.y - 112 });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addImageFiles, screenToFlowPosition]);

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
    (position: { x: number; y: number }) => (type: "video" | "image" | "prompt", prompt: string, referenceUrls: string[] = []) => {
      if (!draftSourceId.current) return;
      onAddNode({
        sourceId: draftSourceId.current,
        type,
        prompt,
        position,
        extraReferenceIds: [...draftRefIds.current],
        referenceUrls,
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
                  type: "deletable",
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
                type: "deletable",
                style: REFERENCE_EDGE_STYLE,
                data: { kind: "reference" },
              },
            ]
      );
      onReferenceConnect(params.source, params.target);
    },
    [setRfEdges, onReferenceConnect]
  );

  const removeEdge = useCallback(
    (edgeId: string) => {
      const edge = rfEdges.find((e) => e.id === edgeId);
      if (!edge) return;
      setRfEdges((cur) => cur.filter((e) => e.id !== edgeId));
      // The draft's own wires are local-only; real ones must be persisted.
      if (edge.target !== DRAFT_ID && edge.source !== DRAFT_ID) onDisconnectEdge(edge);
    },
    [rfEdges, setRfEdges, onDisconnectEdge]
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

      // What the new node will use as its visual reference, shown as a preview.
      const sourcePreview =
        sourceNode?.type === "image" && sourceNode.data.src
          ? { kind: "image", src: sourceNode.data.src }
          : sourceNode?.type === "video" && sourceNode.data.videoSrc
            ? { kind: "video", src: sourceNode.data.videoSrc }
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
            sourcePreview,
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
          type: "deletable",
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
    <div
      ref={wrapperRef}
      className="relative h-full flex-1 bg-black"
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setDropActive(false);
      }}
      onDrop={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setDropActive(false);
        addImageFiles(
          Array.from(e.dataTransfer.files),
          screenToFlowPosition({ x: e.clientX, y: e.clientY })
        );
      }}
    >
      {dropActive && (
        <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-white/40 bg-white/5 text-sm text-foreground">
          Drop an image to add it to the canvas
        </div>
      )}
      {(uploading > 0 || uploadNote) && (
        <div
          className={`pointer-events-none absolute top-4 left-1/2 z-10 max-w-[80%] -translate-x-1/2 rounded-full border border-border bg-card px-4 py-1.5 text-xs ${
            uploading > 0 ? "text-muted-foreground" : "text-destructive"
          }`}
        >
          {uploading > 0 ? "Uploading image…" : uploadNote}
        </div>
      )}
      <EdgeActions.Provider value={removeEdge}>
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
        // Trackpad: two-finger swipe pans in any direction; pinch (or Ctrl+wheel)
        // zooms. Nodes with the `nowheel` class (scrollable text) still scroll.
        panOnScroll
        zoomOnScroll={false}
        deleteKeyCode={["Delete", "Backspace"]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "deletable",
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
      </EdgeActions.Provider>
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
  onAddImageNode: (url: string, position: { x: number; y: number }) => void;
}) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
