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
  type Edge,
  type Node,
  type OnConnectStart,
  type OnConnectEnd,
} from "reactflow";
import "reactflow/dist/style.css";
import { PromptNode, VideoNode, ImageNode } from "./nodes";
import { NodeAddMenu } from "./node-add-menu";

const nodeTypes = { prompt: PromptNode, video: VideoNode, image: ImageNode };

export interface AddNodeRequest {
  sourceId: string;
  type: "video" | "image";
  prompt: string;
  position: { x: number; y: number };
}

function FlowCanvas({
  nodes,
  edges,
  onAddNode,
}: {
  nodes: Node[];
  edges: Edge[];
  onAddNode: (request: AddNodeRequest) => void;
}) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const connectingNodeId = useRef<string | null>(null);
  const [pendingMenu, setPendingMenu] = useState<{
    sourceId: string;
    screenPosition: { x: number; y: number };
    flowPosition: { x: number; y: number };
  } | null>(null);

  // Nodes are controlled from the parent (new nodes/status updates), but
  // draggable locally — merge by id so live edits (status/progress) come
  // through without resetting a position the user dragged.
  useEffect(() => {
    setRfNodes((current) => {
      const byId = new Map(current.map((n) => [n.id, n]));
      return nodes.map((n) => {
        const existing = byId.get(n.id);
        return existing ? { ...existing, data: n.data } : n;
      });
    });
  }, [nodes, setRfNodes]);

  useEffect(() => {
    setRfEdges(edges);
  }, [edges, setRfEdges]);

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
      const bounds = wrapperRef.current.getBoundingClientRect();

      setPendingMenu({
        sourceId,
        screenPosition: { x: clientX - bounds.left, y: clientY - bounds.top },
        flowPosition: screenToFlowPosition({ x: clientX, y: clientY }),
      });
    },
    [screenToFlowPosition]
  );

  return (
    <div ref={wrapperRef} className="relative h-full flex-1 bg-black">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
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
          className="[&_button]:!border-border [&_button]:!bg-card [&_button]:!text-foreground [&_button:hover]:!bg-secondary"
        />
      </ReactFlow>

      {pendingMenu && (
        <NodeAddMenu
          screenPosition={pendingMenu.screenPosition}
          onClose={() => setPendingMenu(null)}
          onSubmit={(type, prompt) => {
            onAddNode({
              sourceId: pendingMenu.sourceId,
              type,
              prompt,
              position: pendingMenu.flowPosition,
            });
            setPendingMenu(null);
          }}
        />
      )}
    </div>
  );
}

export function Canvas(props: {
  nodes: Node[];
  edges: Edge[];
  onAddNode: (request: AddNodeRequest) => void;
}) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
