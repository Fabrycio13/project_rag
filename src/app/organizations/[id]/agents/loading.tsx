import { OrganizationShell } from "../../organization-shell";
export default function LoadingAgents() {
  return <OrganizationShell><p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">Carregando agentes…</p></OrganizationShell>;
}
