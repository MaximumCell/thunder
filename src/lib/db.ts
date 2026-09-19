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
  // Cloudinary URLs of the user-attached reference images this node used.
  reference_urls: string[];
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

export interface ProjectPreview {
  url: string;
  type: "video" | "image";
}

export async function loadProjectPreview(
  conversationId: string
): Promise<ProjectPreview | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("generation_tasks")
    .select("media_url, type")
    .eq("conversation_id", conversationId)
    .eq("status", "completed")
    .not("media_url", "is", null)
    .in("type", ["video", "image"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { url: data.media_url, type: data.type } : null;
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

/** Cascades to messages/generation_tasks. Used to back out a project whose
 * very first generation was rejected before it produced anything. */
export async function deleteConversation(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw error;
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
      "id, parent_id, type, status, label, prompt, media_url, byteplus_url, reference_urls, ratio, position_x, position_y"
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
    referenceUrls?: string[];
    mediaUrl?: string;
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
    reference_urls: task.referenceUrls ?? [],
    media_url: task.mediaUrl ?? null,
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
    prompt: string;
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

// BytePlus's task-status response and Gemini's usageMetadata are both of
// not-fully-confirmed shape — pull out a token count if one is present
// under a plausible key for either; otherwise just log the call itself
// (still real: a real API call happened, just no token figure).
function extractTokens(raw: unknown): number | null {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["totalTokenCount", "total_tokens", "completion_tokens", "tokens"]) {
      if (typeof obj[key] === "number") return obj[key] as number;
    }
  }
  return null;
}

export async function insertUsageLog(params: {
  conversationId: string | null;
  generationTaskId?: string | null;
  source: "gemma" | "byteplus";
  model: string;
  rawUsage: unknown;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("usage_logs").insert({
    user_id: user.id,
    conversation_id: params.conversationId,
    generation_task_id: params.generationTaskId ?? null,
    source: params.source,
    model: params.model,
    tokens: extractTokens(params.rawUsage),
  });
  if (error) throw error;
}

export interface UsageSourceSummary {
  count: number;
  tokens: number;
}

export interface UsageSummary {
  byteplus: UsageSourceSummary;
  gemma: UsageSourceSummary;
}

// RLS (usage_logs: owner all, auth.uid() = user_id) already scopes this to
// the signed-in user's own rows — no explicit .eq("user_id", ...) needed,
// same pattern as every other table read in this file.
export async function loadUsageSummary(): Promise<UsageSummary> {
  const supabase = createClient();
  const { data, error } = await supabase.from("usage_logs").select("source, tokens");
  if (error) throw error;
  const rows = data ?? [];
  const summarize = (source: "byteplus" | "gemma"): UsageSourceSummary => {
    const matched = rows.filter((r) => r.source === source);
    return {
      count: matched.length,
      tokens: matched.reduce((sum, r) => sum + (r.tokens ?? 0), 0),
    };
  };
  return { byteplus: summarize("byteplus"), gemma: summarize("gemma") };
}

export interface UsageLogEntry {
  id: string;
  source: "gemma" | "byteplus";
  model: string | null;
  tokens: number | null;
  cost_usd: number | null;
  created_at: string;
  conversation_title: string | null;
  generation_label: string | null;
}

export async function loadUsageDetail(limit = 50): Promise<UsageLogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("usage_logs")
    .select(
      "id, source, model, tokens, cost_usd, created_at, conversations(title), generation_tasks(label, prompt)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      source: "gemma" | "byteplus";
      model: string | null;
      tokens: number | null;
      cost_usd: number | null;
      created_at: string;
      conversations: { title: string | null } | null;
      generation_tasks: { label: string | null; prompt: string | null } | null;
    };
    return {
      id: row.id,
      source: row.source,
      model: row.model,
      tokens: row.tokens,
      cost_usd: row.cost_usd,
      created_at: row.created_at,
      conversation_title: row.conversations?.title ?? null,
      generation_label: row.generation_tasks?.label ?? row.generation_tasks?.prompt ?? null,
    };
  });
}
