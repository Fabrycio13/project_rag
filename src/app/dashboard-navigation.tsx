"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";

type NavigationItem = {
  href: string;
  label: string;
  icon: "overview" | "organizations" | "invitations";
};

function getItems(isOwner: boolean): NavigationItem[] {
  return [
    { href: "/", label: "Visão geral", icon: "overview" },
    { href: "/organizations", label: "Organizações", icon: "organizations" },
    ...(isOwner ? [{ href: "/admin/invitations", label: "Convites", icon: "invitations" as const }] : []),
  ];
}

function isCurrentPath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationIcon({ icon }: { icon: NavigationItem["icon"] }) {
  if (icon === "overview") {
    return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></svg>;
  }

  if (icon === "organizations") {
    return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M4 20V7.5L12 4l8 3.5V20M2.5 20h19M8 9h.01M12 9h.01M16 9h.01M8 12.5h.01M12 12.5h.01M16 12.5h.01M10 20v-4h4v4" /></svg>;
  }

  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><rect x="3.5" y="5" width="17" height="14" rx="3" /><path strokeLinecap="round" d="M7.5 9h9M7.5 13h5" /></svg>;
}

function NavigationLinks({ items, pathname, onNavigate }: { items: NavigationItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="space-y-1.5">
      {items.map(item => {
        const active = isCurrentPath(pathname, item.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`group flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${active ? "bg-[var(--primary-soft)] text-[color:var(--primary)]" : "text-[color:var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[color:var(--foreground)]"}`}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            <NavigationIcon icon={item.icon} />
            <span>{item.label}</span>
            {active ? <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--primary)]" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function DesktopDashboardNavigation({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  return <NavigationLinks items={getItems(isOwner)} pathname={pathname} />;
}

export function MobileDashboardNavigation({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <div className="relative">
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={open ? "Fechar navegação" : "Abrir navegação"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[var(--surface)] text-[color:var(--foreground)] shadow-sm backdrop-blur-xl transition hover:bg-[var(--surface-strong)] focus:outline-none focus:ring-4 focus:ring-blue-500/20"
        onClick={() => setOpen(value => !value)}
        type="button"
      >
        {open ? (
          <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
        ) : (
          <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>
        )}
      </button>
      {open ? (
        <div className="absolute left-0 top-12 z-50 w-60 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-strong)] p-2 shadow-2xl backdrop-blur-2xl" id={menuId}>
          <NavigationLinks items={getItems(isOwner)} pathname={pathname} onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
