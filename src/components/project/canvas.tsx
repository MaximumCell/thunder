"use client";

import { useEffect } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { PromptNode, VideoNode, ImageNode } from "./nodes";

const nodeTypes = { prompt: PromptNode, video: VideoNode, image: ImageNode };

export function Canvas({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);

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

  return (
    <div className="h-full flex-1 bg-black">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
    </div>
  );
}
