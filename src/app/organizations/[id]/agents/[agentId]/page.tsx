import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getOrganizationAccess } from "@/lib/organization-access";
import { findOrganization } from "@/lib/organization-data";
import { findAgent } from "@/lib/agent-data";
import { isUuid, AGENT_READINESS_MESSAGE } from "@/lib/agents";
import { OrganizationShell } from "../../../organization-shell";

export default async function AgentPage({ params }: { params: Promise<{ id: string; agentId: string }> }) {
  const access = await getOrganizationAccess();
  if ("error" in access) {
    if (access.status === 401) redirect("/sign-in");
    return <OrganizationShell><p role="alert">{access.error}</p></OrganizationShell>;
  }
  const { id, agentId } = await params;
  if (!isUuid(id) || !isUuid(agentId)) notFound();
  const organization = await findOrganization(access.supabase, access.userId, id);
  if (organization.error) return <OrganizationShell><p role="alert">{AGENT_READINESS_MESSAGE}</p></OrganizationShell>;
  if (!organization.data) notFound();
  const { data, error } = await findAgent(access.supabase, id, agentId);
  if (error) return <OrganizationShell><p role="alert">{AGENT_READINESS_MESSAGE}</p></OrganizationShell>;
  if (!data) notFound();
  return <OrganizationShell>
    <Link href={`/organizations/${id}/agents`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">← Agentes de {organization.data.name}</Link>
    <p className="mt-6 text-sm font-medium text-blue-600 dark:text-blue-400">Agente</p>
    <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight">{data.name}</h1>
    <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Agente cadastrado. As instruções foram armazenadas de forma privada e não são exibidas nesta página.</p>
  </OrganizationShell>;
}
