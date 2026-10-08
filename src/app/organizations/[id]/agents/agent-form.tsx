"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AgentForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/organizations/${organizationId}/agents`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fields.get("name"), instructions: fields.get("instructions") }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Não foi possível criar o agente."); return; }
      form.reset();
      router.push(`/organizations/${organizationId}/agents/${result.agent.id}`);
      router.refresh();
    } catch { setError("Não foi possível confirmar a criação. Confira a lista antes de tentar novamente."); }
    finally { busy.current = false; setPending(false); }
  }
  const fieldClass = "mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-zinc-700";
  return <form onSubmit={create} aria-busy={pending} className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
    <h2 className="mb-4 text-base font-semibold">Criar agente</h2>
    <label htmlFor="agent-name" className="text-sm font-medium">Nome</label>
    <input id="agent-name" name="name" required disabled={pending} aria-describedby="agent-hint agent-error" className={fieldClass} />
    <label htmlFor="agent-instructions" className="mt-4 block text-sm font-medium">Instruções</label>
    <textarea id="agent-instructions" name="instructions" required rows={5} disabled={pending} aria-describedby="agent-hint agent-error" className={fieldClass} />
    <p id="agent-hint" className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Nome: 1 a 120 caracteres. Instruções: 1 a 20.000 caracteres. As instruções são armazenadas, mas não exibidas após a criação.</p>
    <p id="agent-error" role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
    <button disabled={pending} className="mt-3 h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{pending ? "Criando…" : "Criar agente"}</button>
  </form>;
}
