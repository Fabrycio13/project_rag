import { getOrganizationAccess } from "@/lib/organization-access";
import { findOrganization } from "@/lib/organization-data";
import { listAgents, insertAgent } from "@/lib/agent-data";
import { handleAgentRequest } from "@/lib/agent-request";

const dependencies = { getAccess: getOrganizationAccess, findOrganization, listAgents, insertAgent };
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleAgentRequest(request, (await params).id, dependencies);
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleAgentRequest(request, (await params).id, dependencies);
}
