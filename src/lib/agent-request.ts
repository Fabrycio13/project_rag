import type { SupabaseClient } from "@supabase/supabase-js";
import { isSameOriginRequest } from "./same-origin-request.ts";
import { isUuid, validateAgentInput, AGENT_INPUT_MESSAGE, AGENT_READINESS_MESSAGE } from "./agents.ts";

type Result<T> = PromiseLike<{ data: T | null; error: unknown }>;
type Agent = { id: string; name: string };
type Dependencies = {
  getAccess: () => Promise<{ supabase: SupabaseClient; userId: string } | { error: string; status: number }>;
  findOrganization: (db: SupabaseClient, userId: string, id: string) => Result<{ id: string }>;
  listAgents: (db: SupabaseClient, id: string) => Result<Agent[]>;
  insertAgent: (db: SupabaseClient, id: string, input: unknown) => Result<Agent>;
};
export async function handleAgentRequest(request: Request, organizationId: string, deps: Dependencies) {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (request.method !== "GET" && request.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  if (request.method === "POST" && !isSameOriginRequest(request.headers.get("origin"), request.headers.get("host"), request.headers.get("x-forwarded-host"), request.headers.get("x-forwarded-proto"), request.url)) return reply({ error: "Solicitação inválida." }, 403);
  try {
    const access = await deps.getAccess();
    if ("error" in access) return reply({ error: access.error }, access.status);
    if (!isUuid(organizationId)) return reply({ error: "Organização não encontrada." }, 404);
    const organization = await deps.findOrganization(access.supabase, access.userId, organizationId);
    if (organization.error) return reply({ error: AGENT_READINESS_MESSAGE }, 503);
    if (!organization.data) return reply({ error: "Organização não encontrada." }, 404);
    if (request.method === "GET") {
      const { data, error } = await deps.listAgents(access.supabase, organizationId);
      return error ? reply({ error: AGENT_READINESS_MESSAGE }, 503) : reply({ agents: (data ?? []).map(({ id, name }) => ({ id, name })) });
    }
    let body: unknown;
    try { body = await request.json(); } catch { return reply({ error: AGENT_INPUT_MESSAGE }, 400); }
    const input = validateAgentInput(body);
    if (!input) return reply({ error: AGENT_INPUT_MESSAGE }, 400);
    const { data, error } = await deps.insertAgent(access.supabase, organizationId, input);
    return error || !data ? reply({ error: AGENT_READINESS_MESSAGE }, 503) : reply({ agent: { id: data.id, name: data.name } }, 201);
  } catch {
    return reply({ error: AGENT_READINESS_MESSAGE }, 503);
  }
}
