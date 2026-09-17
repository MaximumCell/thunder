"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { PromptStudio } from "@/components/dashboard/prompt-studio";
import { GenerationsGrid } from "@/components/dashboard/generations-grid";
import {
  makeId,
  runMockGeneration,
  seedGenerations,
  type Generation,
  type Ratio,
} from "@/lib/mock-generations";

export default function Dashboard() {
  const [generations, setGenerations] = useState<Generation[]>(seedGenerations);

  const updateGeneration = (id: string, patch: Partial<Generation>) => {
    setGenerations((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
    );
  };

  const startGeneration = (prompt: string, ratio: Ratio) => {
    const id = makeId("gen");
    setGenerations((prev) => [
      { id, prompt, status: "queued", progress: 0, ratio },
      ...prev,
    ]);
    runMockGeneration(id, (patch) => updateGeneration(id, patch));
  };

  const retryGeneration = (id: string) => {
    updateGeneration(id, { status: "queued", progress: 0 });
    runMockGeneration(id, (patch) => updateGeneration(id, patch));
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <PromptStudio onGenerate={startGeneration} />
        <GenerationsGrid generations={generations} onRetry={retryGeneration} />
      </div>
    </div>
  );
}
