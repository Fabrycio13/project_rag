"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type InvitationStatus = "pending" | "accepted" | "revoked" | "expired" | "failed";

type InvitationRow = {
  id: string;
  email_address: string;
  status: InvitationStatus;
  created_at: string;
  expires_at: string;
};

function readErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const error = Object.getOwnPropertyDescriptor(value, "error")?.value;
  return typeof error === "string" ? error : null;
}

function invitationStatusLabel(status: InvitationStatus): string {
  switch (status) {
    case "pending":
      return "Pendente";
    case "accepted":
      return "Aceito";
    case "revoked":
      return "Cancelado";
    case "expired":
      return "Expirado";
    case "failed":
      return "Falha no envio";
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function InvitationManager({ invitations }: { invitations: InvitationRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyInvitation, setBusyInvitation] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setBusy(true);

    try {
      const response = await fetch("/api/admin-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setNotice({
          kind: "error",
          text: readErrorMessage(result) ?? "Não foi possível enviar o convite. Tente novamente.",
        });
        return;
      }

      setEmail("");
      setNotice({ kind: "success", text: "Convite enviado por e-mail. O link expira em 30 dias." });
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "Falha de conexão. Confira sua internet e tente novamente." });
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvitation(invitationRef: string) {
    setNotice(null);
    setBusyInvitation(invitationRef);

    try {
      const response = await fetch("/api/admin-invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationRef }),
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setNotice({
          kind: "error",
          text: readErrorMessage(result) ?? "Não foi possível cancelar o convite.",
        });
        return;
      }

      setNotice({ kind: "success", text: "Convite cancelado." });
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "Falha de conexão. Tente cancelar novamente." });
    } finally {
      setBusyInvitation(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-7">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Acesso à plataforma</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
            Convidar administrador
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Envie um convite para alguém administrar organizações. O acesso só será ativado depois que a pessoa concluir o cadastro pelo link recebido.
          </p>
        </div>

        <form onSubmit={sendInvitation} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            E-mail da pessoa
            <input
              autoComplete="email"
              className="mt-2 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@empresa.com"
              required
              type="email"
              value={email}
            />
          </label>
          <button
            className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "Enviando…" : "Enviar convite"}
          </button>
        </form>
        <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          O cadastro oferecerá os métodos habilitados na autenticação, como e-mail e senha ou Google.
        </p>

        {notice ? (
          <p
            aria-live="polite"
            className={`mt-4 rounded-xl border p-3 text-sm ${
              notice.kind === "success"
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                : "border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300"
            }`}
          >
            {notice.text}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Convites</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Acompanhe os envios e aceite dos administradores.</p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            {invitations.length}
          </span>
        </div>

        {invitations.length === 0 ? (
          <div className="px-5 py-10 text-center sm:px-6">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Nenhum convite enviado ainda</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Os próximos convites aparecerão aqui.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{invitation.email_address}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Enviado em {formatDate(invitation.created_at)} · expira em {formatDate(invitation.expires_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${invitation.status === "pending" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : invitation.status === "accepted" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"}`}>
                    {invitationStatusLabel(invitation.status)}
                  </span>
                  {invitation.status === "pending" ? (
                    <button
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-red-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-red-300"
                      disabled={busyInvitation === invitation.id}
                      onClick={() => cancelInvitation(invitation.id)}
                      type="button"
                    >
                      {busyInvitation === invitation.id ? "Cancelando…" : "Cancelar"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
