import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard-data";
import { SignOutButton } from "./sign-out-button";
import { DesktopDashboardNavigation, MobileDashboardNavigation } from "./dashboard-navigation";
import { ThemeToggle } from "./theme-provider";

type MetricIcon = "organizations" | "agents" | "documents" | "invitations";

type MetricCardProps = {
  description: string;
  href: string;
  icon: MetricIcon;
  label: string;
  value: number;
};

function MetricIconView({ icon }: { icon: MetricIcon }) {
  if (icon === "organizations") {
    return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M4 20V7.5L12 4l8 3.5V20M2.5 20h19M8 9h.01M12 9h.01M16 9h.01M8 12.5h.01M12 12.5h.01M16 12.5h.01M10 20v-4h4v4" /></svg>;
  }

  if (icon === "agents") {
    return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5v3m0 11v3M3.5 12h3m11 0h3M6 6l2.1 2.1m7.8 7.8L18 18m0-12-2.1 2.1m-7.8 7.8L6 18" /><circle cx="12" cy="12" r="4.5" /></svg>;
  }

  if (icon === "documents") {
    return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 3.5V8h4M9 12h6m-6 3.5h6" /></svg>;
  }

  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><rect x="3.5" y="5" width="17" height="14" rx="3" /><path strokeLinecap="round" d="M7.5 9h9M7.5 13h5" /></svg>;
}

function MetricCard({ description, href, icon, label, value }: MetricCardProps) {
  return (
    <Link
      className="group relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[var(--glass-surface)] p-5 shadow-[var(--card-shadow)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--primary)]/40 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20"
      href={href}
    >
      <span aria-hidden="true" className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-[var(--primary-soft)] blur-2xl transition group-hover:scale-125" />
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[color:var(--primary)]">
        <MetricIconView icon={icon} />
      </span>
      <span className="relative mt-5 block text-sm font-medium text-[color:var(--muted)]">{label}</span>
      <span className="relative mt-1 block text-3xl font-semibold tracking-tight text-[color:var(--foreground)] tabular-nums">{value.toLocaleString("pt-BR")}</span>
      <span className="relative mt-2 block text-xs leading-5 text-[color:var(--muted)]">{description}</span>
      <span aria-hidden="true" className="absolute right-5 top-5 text-[color:var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--primary)]">↗</span>
    </Link>
  );
}

function InvitationMetric({ count }: { count: number }) {
  return (
    <MetricCard
      description="Convites aguardando aceite"
      href="/admin/invitations"
      icon="invitations"
      label="Convites pendentes"
      value={count}
    />
  );
}

function RecentOrganizations({ organizations }: { organizations: DashboardData["recentOrganizations"] }) {
  return (
    <section aria-labelledby="recent-organizations-title" className="rounded-2xl border border-[color:var(--border)] bg-[var(--glass-surface)] p-5 shadow-[var(--card-shadow)] backdrop-blur-xl sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--foreground)]" id="recent-organizations-title">Organizações recentes</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">As últimas organizações criadas por você.</p>
        </div>
        <Link className="rounded-lg px-2 py-1 text-sm font-semibold text-[color:var(--primary)] transition hover:bg-[var(--primary-soft)] focus:outline-none focus:ring-4 focus:ring-blue-500/20" href="/organizations">
          Ver todas <span aria-hidden="true">→</span>
        </Link>
      </div>

      <ul className="mt-5 space-y-2">
        {organizations.map(organization => (
          <li key={organization.id}>
            <Link
              className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3 text-sm transition hover:border-[color:var(--primary)]/35 hover:bg-[var(--surface-strong)] focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              href={`/organizations/${organization.id}`}
            >
              <span className="min-w-0 break-words font-medium text-[color:var(--foreground)]">{organization.name}</span>
              <span className="shrink-0 text-xs font-medium text-[color:var(--primary)]">Abrir <span aria-hidden="true">→</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyOrganizations({ isOwner, pendingInvitationCount }: { isOwner: boolean; pendingInvitationCount: number | null }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,0.62fr)]">
      <section aria-labelledby="empty-organizations-title" className="relative isolate overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[var(--glass-surface)] p-7 shadow-[var(--card-shadow)] backdrop-blur-xl sm:p-10">
        <span aria-hidden="true" className="absolute -right-14 -top-16 -z-10 h-64 w-64 rounded-full bg-[var(--primary-soft)] blur-3xl" />
        <span className="inline-flex rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--primary)]">Comece por aqui</span>
        <h2 className="mt-5 max-w-xl text-2xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-3xl" id="empty-organizations-title">Crie sua primeira organização</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--muted)]">Organize seus agentes e documentos em um espaço privado. Você poderá criar agentes e adicionar PDFs depois.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-4 focus:ring-blue-500/25" href="/organizations">
          Criar organização <span aria-hidden="true">→</span>
        </Link>
      </section>
      {isOwner && pendingInvitationCount !== null ? <InvitationMetric count={pendingInvitationCount} /> : null}
    </div>
  );
}

export function DashboardView({ data, isOwner }: { data: DashboardData; isOwner: boolean }) {
  const roleLabel = isOwner ? "Owner da plataforma" : "Administrador";
  const hasOrganizations = data.organizationCount > 0;
  const metrics = [
    { label: "Organizações", value: data.organizationCount, description: "Espaços ativos no seu acesso", icon: "organizations" as const },
    { label: "Agentes", value: data.agentCount, description: "Agentes nas suas organizações", icon: "agents" as const },
    { label: "Documentos", value: data.documentCount, description: "PDFs armazenados com sucesso", icon: "documents" as const },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <span aria-hidden="true" className="pointer-events-none absolute -left-40 top-16 h-80 w-80 rounded-full bg-[var(--ambient-glow)] blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-5 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sticky top-6 hidden h-[calc(100dvh-3rem)] flex-col rounded-3xl border border-[color:var(--border)] bg-[var(--glass-surface)] p-4 shadow-[var(--card-shadow)] backdrop-blur-2xl md:flex">
          <Link aria-label="Project RAG — visão geral" className="flex items-center gap-3 rounded-2xl px-2 py-2" href="/">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold tracking-tight text-white shadow-lg shadow-blue-900/20">PR</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-[color:var(--foreground)]">Project RAG</span>
              <span className="mt-0.5 block text-xs text-[color:var(--muted)]">Plataforma de agentes</span>
            </span>
          </Link>

          <div className="mt-9">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Workspace</p>
            <DesktopDashboardNavigation isOwner={isOwner} />
          </div>

          <div className="mt-auto rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-3">
            <p className="text-xs font-medium text-[color:var(--muted)]">Acesso ativo</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">{roleLabel}</p>
            <div className="mt-3"><SignOutButton /></div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="md:hidden"><MobileDashboardNavigation isOwner={isOwner} /></div>
              <div className="md:hidden">
                <Link className="text-sm font-semibold tracking-tight text-[color:var(--foreground)]" href="/">Project RAG</Link>
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{roleLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="md:hidden"><SignOutButton /></div>
              <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-4 focus:ring-blue-500/25 sm:px-4" href="/organizations">
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                <span className="hidden sm:inline">Criar organização</span>
                <span className="sm:hidden">Criar</span>
              </Link>
            </div>
          </header>

          <section aria-labelledby="dashboard-title">
            <div className="mb-6">
              <p className="text-sm font-medium text-[color:var(--primary)]">Sua plataforma, organizada</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-4xl" id="dashboard-title">Visão geral</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">Acompanhe suas organizações, agentes e documentos privados em um só lugar.</p>
            </div>

            {hasOrganizations ? (
              <>
                <div className={`grid gap-4 sm:grid-cols-2 ${isOwner ? "2xl:grid-cols-4" : "xl:grid-cols-3"}`}>
                  {metrics.map(metric => (
                    <MetricCard
                      description={metric.description}
                      href="/organizations"
                      icon={metric.icon}
                      key={metric.label}
                      label={metric.label}
                      value={metric.value}
                    />
                  ))}
                  {isOwner && data.pendingInvitationCount !== null ? <InvitationMetric count={data.pendingInvitationCount} /> : null}
                </div>
                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
                  <RecentOrganizations organizations={data.recentOrganizations} />
                  <section aria-labelledby="next-step-title" className="rounded-2xl border border-[color:var(--border)] bg-[var(--glass-surface)] p-5 shadow-[var(--card-shadow)] backdrop-blur-xl sm:p-6">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[color:var(--primary)]"><MetricIconView icon="agents" /></span>
                    <h2 className="mt-5 text-base font-semibold text-[color:var(--foreground)]" id="next-step-title">Acesse seus recursos</h2>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Agentes e documentos ficam dentro da organização correspondente.</p>
                    <Link className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[color:var(--primary)] transition hover:bg-[var(--primary-soft)] focus:outline-none focus:ring-4 focus:ring-blue-500/20" href="/organizations">
                      Ver organizações <span aria-hidden="true">→</span>
                    </Link>
                  </section>
                </div>
              </>
            ) : (
              <EmptyOrganizations isOwner={isOwner} pendingInvitationCount={data.pendingInvitationCount} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
