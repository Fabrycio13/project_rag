"use client";
import Link from "next/link";
export default function AgentsError({ reset }: { reset: () => void }) {
  return <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 dark:bg-black dark:text-white"><section className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"><h1 className="text-xl font-semibold">Agentes indisponíveis</h1><p role="alert" className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Não foi possível carregar os agentes. Tente novamente.</p><button onClick={reset} className="mt-5 h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Tentar novamente</button><Link href="/organizations" className="ml-4 text-sm text-blue-600 hover:underline dark:text-blue-400">Organizações</Link></section></main>;
}
