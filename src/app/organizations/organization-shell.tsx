import Link from "next/link";
import { SignOutButton } from "@/app/sign-out-button";

export function OrganizationShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 dark:bg-black dark:text-white sm:px-8"><div className="mx-auto max-w-3xl"><nav className="mb-5 flex items-center justify-between gap-4"><Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">← Início</Link><SignOutButton /></nav><section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">{children}</section></div></main>;
}

export function OrganizationNotice({ message }: { message: string }) {
  return <OrganizationShell><h1 className="text-xl font-semibold">Organizações indisponíveis</h1><p role="alert" className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{message}</p><Link href="/organizations" className="mt-5 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">Tentar novamente</Link></OrganizationShell>;
}
