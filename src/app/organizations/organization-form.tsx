"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function OrganizationForm() {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const form = event.currentTarget;
    const name = new FormData(form).get("name");
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/organizations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Não foi possível criar a organização."); return; }
      form.reset();
      router.push(`/organizations/${result.organization.id}`);
      router.refresh();
    } catch { setError("Não foi possível conectar. Tente novamente."); }
    finally { busy.current = false; setPending(false); }
  }
  return <form onSubmit={create} className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><label htmlFor="organization-name" className="text-sm font-medium">Nome da organização</label><div className="mt-2 flex flex-col gap-3 sm:flex-row"><input id="organization-name" name="name" required disabled={pending} aria-describedby="organization-name-hint organization-error" className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-zinc-700" /><button disabled={pending} className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{pending ? "Criando…" : "Criar organização"}</button></div><p id="organization-name-hint" className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">De 1 a 120 caracteres.</p><p id="organization-error" role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p></form>;
}
