import { createClient } from "@/lib/supabase/client";
import type { AgentMessage } from "@/lib/agent";

export interface ConversationRow {
  id: string;
  title: string | null;
  created_at: string;
}

export interface GenerationTaskRow {
  id: string;
  parent_id: string | null;
  type: "prompt" | "image" | "video";
  status: "queued" | "generating" | "completed" | "error";
  label: string | null;
  prompt: string | null;
  media_url: string | null;
  // The original, expiring BytePlus video_url — kept for reference even
  // after media_url gets re-hosted on Cloudinary (Step 6).
  byteplus_url: string | null;
  ratio: string | null;
  position_x: number;
  position_y: number;
}

export async function listConversations(): Promise<ConversationRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadProjectPreview(conversationId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("generation_tasks")
    .select("media_url")
    .eq("conversation_id", conversationId)
    .eq("status", "completed")
    .not("media_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.media_url ?? null;
}

export async function loadConversation(id: string): Promise<ConversationRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createConversation(title: string): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, title: title.slice(0, 80) })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function loadMessages(conversationId: string): Promise<AgentMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AgentMessage[];
}

export async function insertMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role, content });
  if (error) throw error;
}

export async function loadGenerationTasks(
  conversationId: string
): Promise<GenerationTaskRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("generation_tasks")
    .select(
      "id, parent_id, type, status, label, prompt, media_url, byteplus_url, ratio, position_x, position_y"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertGenerationTask(
  conversationId: string,
  task: {
    id: string;
    parentId: string | null;
    type: "prompt" | "image" | "video";
    status: GenerationTaskRow["status"];
    label?: string;
    prompt?: string;
    ratio?: string;
    position: { x: number; y: number };
  }
) {
  const supabase = createClient();
  const { error } = await supabase.from("generation_tasks").insert({
    id: task.id,
    conversation_id: conversationId,
    parent_id: task.parentId,
    type: task.type,
    status: task.status,
    label: task.label ?? null,
    prompt: task.prompt ?? null,
    ratio: task.ratio ?? null,
    position_x: task.position.x,
    position_y: task.position.y,
  });
  if (error) throw error;
}

export async function updateGenerationTask(
  id: string,
  patch: Partial<{
    status: GenerationTaskRow["status"];
    media_url: string;
    byteplus_url: string;
    parent_id: string | null;
  }>
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("generation_tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Children keep their own row (parent_id FK is ON DELETE SET NULL, not
 * cascade) — deleting a node only removes that node, never its downstream
 * generations. Any generation_references rows involving this node cascade
 * automatically (both FK columns are ON DELETE CASCADE). */
export async function deleteGenerationTask(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("generation_tasks").delete().eq("id", id);
  if (error) throw error;
}

export interface GenerationReferenceRow {
  generation_task_id: string;
  reference_task_id: string;
}

/** Pass the conversation's own generation_tasks ids (already loaded via
 * loadGenerationTasks) — simpler and avoids ambiguous-embed issues from
 * generation_references having two FKs into generation_tasks. */
export async function loadGenerationReferences(
  taskIds: string[]
): Promise<GenerationReferenceRow[]> {
  if (taskIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("generation_references")
    .select("generation_task_id, reference_task_id")
    .in("generation_task_id", taskIds);
  if (error) throw error;
  return data ?? [];
}

export async function insertGenerationReference(
  generationTaskId: string,
  referenceTaskId: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("generation_references")
    .upsert(
      { generation_task_id: generationTaskId, reference_task_id: referenceTaskId },
      { onConflict: "generation_task_id,reference_task_id" }
    );
  if (error) throw error;
}

export async function deleteGenerationReference(
  generationTaskId: string,
  referenceTaskId: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("generation_references")
    .delete()
    .eq("generation_task_id", generationTaskId)
    .eq("reference_task_id", referenceTaskId);
  if (error) throw error;
}

export async function loadProfileName(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();
  return data?.name ?? null;
}

// BytePlus's task-status response includes a `usage` object of unconfirmed
// shape (never live-verified — see PROGRESS.md). Pull out a token count if
// one is present under a plausible key; otherwise just log the generation
// itself (still real: a real BytePlus call happened, just no token figure).
function extractTokens(raw: unknown): number | null {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["total_tokens", "completion_tokens", "tokens"]) {
      if (typeof obj[key] === "number") return obj[key] as number;
    }
  }
  return null;
}

export async function insertUsageLog(
  generationTaskId: string,
  model: string,
  rawUsage: unknown
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("usage_logs").insert({
    user_id: user.id,
    generation_task_id: generationTaskId,
    model,
    tokens: extractTokens(rawUsage),
  });
  if (error) throw error;
}

export interface UsageSummary {
  generations: number;
  tokens: number;
}

export async function loadUsageSummary(): Promise<UsageSummary> {
  const supabase = createClient();
  const { data, error } = await supabase.from("usage_logs").select("tokens");
  if (error) throw error;
  const rows = data ?? [];
  return {
    generations: rows.length,
    tokens: rows.reduce((sum, r) => sum + (r.tokens ?? 0), 0),
  };
}
