import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getOrganizationAccess } from "@/lib/organization-access";
import { findOrganization } from "@/lib/organization-data";
import { listAgents } from "@/lib/agent-data";
import { isUuid, AGENT_READINESS_MESSAGE } from "@/lib/agents";
import { OrganizationShell } from "../../organization-shell";
import { AgentForm } from "./agent-form";

export default async function AgentsPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getOrganizationAccess();
  const { id } = await params;
  if ("error" in access) {
    if (access.status === 401) redirect("/sign-in");
    return <OrganizationShell><p role="alert">{access.error}</p></OrganizationShell>;
  }
  if (!isUuid(id)) notFound();
  const organization = await findOrganization(access.supabase, access.userId, id);
  if (organization.error) return <OrganizationShell><p role="alert">{AGENT_READINESS_MESSAGE}</p></OrganizationShell>;
  if (!organization.data) notFound();
  const { data, error } = await listAgents(access.supabase, id);
  return <OrganizationShell>
    <Link href={`/organizations/${id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">← {organization.data.name}</Link>
    <h1 className="mt-3 text-2xl font-semibold tracking-tight">Agentes</h1>
    {error ? <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{AGENT_READINESS_MESSAGE}</p> : <>
      <AgentForm organizationId={id} />
      <h2 className="mt-8 text-base font-semibold">Agentes da organização</h2>
      {data?.length ? <ul className="mt-3 space-y-2">{data.map(agent => <li key={agent.id}><Link href={`/organizations/${id}/agents/${agent.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"><span className="min-w-0 break-words font-medium">{agent.name}</span><span className="shrink-0 text-blue-600 dark:text-blue-400">Abrir →</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Nenhum agente nesta organização. Crie o primeiro acima.</p>}
    </>}
  </OrganizationShell>;
}
