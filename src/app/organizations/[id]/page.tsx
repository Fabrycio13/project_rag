import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getOrganizationAccess } from "@/lib/organization-access";
import { findOrganization, ORGANIZATION_READINESS_MESSAGE } from "@/lib/organization-data";
import { OrganizationShell, OrganizationNotice } from "../organization-shell";

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getOrganizationAccess();
  if ("error" in access) {
    if (access.status === 401) redirect("/sign-in");
    return <OrganizationNotice message={access.error ?? ORGANIZATION_READINESS_MESSAGE} />;
  }
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { data, error } = await findOrganization(access.supabase, access.userId, id);
  if (error) return <OrganizationNotice message={ORGANIZATION_READINESS_MESSAGE} />;
  if (!data) notFound();
  return <OrganizationShell><p className="text-sm font-medium text-blue-600 dark:text-blue-400">Organização</p><h1 className="mt-2 break-words text-2xl font-semibold tracking-tight">{data.name}</h1><Link href={`/organizations/${id}/agents`} className="mt-6 flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"><span>Agentes</span><span className="text-blue-600 dark:text-blue-400">Abrir →</span></Link><Link href="/organizations" className="mt-6 inline-flex h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">← Voltar às organizações</Link></OrganizationShell>;
}
