import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrganizationAccess } from "@/lib/organization-access";
import { listOrganizations, ORGANIZATION_READINESS_MESSAGE } from "@/lib/organization-data";
import { OrganizationShell, OrganizationNotice } from "./organization-shell";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationsPage() {
  const access = await getOrganizationAccess();
  if ("error" in access) {
    if (access.status === 401) redirect("/sign-in");
    return <OrganizationNotice message={access.error ?? ORGANIZATION_READINESS_MESSAGE} />;
  }
  const { data, error } = await listOrganizations(access.supabase, access.userId);
  if (error) return <OrganizationNotice message={ORGANIZATION_READINESS_MESSAGE} />;
  return <OrganizationShell><h1 className="text-2xl font-semibold tracking-tight">Organizações</h1><p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Crie e acesse suas organizações. Cada organização fica visível apenas para quem a criou.</p><OrganizationForm /><h2 className="mt-8 text-base font-semibold">Suas organizações</h2>{data?.length ? <ul className="mt-3 space-y-2">{data.map(organization => <li key={organization.id}><Link href={`/organizations/${organization.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4 text-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"><span className="min-w-0 break-words font-medium">{organization.name}</span><span className="shrink-0 text-blue-600 dark:text-blue-400">Abrir →</span></Link></li>)}</ul> : <p className="mt-3 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">Você ainda não criou nenhuma organização.</p>}</OrganizationShell>;
}
