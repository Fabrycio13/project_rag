import type { SupabaseClient } from "@supabase/supabase-js";
import { validateAgentInput, AGENT_INPUT_MESSAGE } from "./agents.ts";

// Caller verifies owned, non-archived organization; JWT RLS enforces it again.
// Instructions are write-only in this MVP, never selected or serialized to clients.
export function listAgents(db: SupabaseClient, organizationId: string) {
  return db.from("agents").select("id, name").eq("organization_id", organizationId).order("created_at", { ascending: false });
}
export function findAgent(db: SupabaseClient, organizationId: string, agentId: string) {
  return db.from("agents").select("id, name").eq("organization_id", organizationId).eq("id", agentId).maybeSingle();
}
export async function insertAgent(db: SupabaseClient, organizationId: string, value: unknown) {
  const input = validateAgentInput(value);
  if (!input) throw new Error(AGENT_INPUT_MESSAGE);
  return await db.from("agents").insert({ organization_id: organizationId, ...input }).select("id, name").single();
}
