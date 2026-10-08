import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/app/sign-out-button";
import { InvitationManager } from "./invitation-manager";

export default async function AdminInvitationsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = await createServerSupabaseClient();
  const { data: platformUser, error: accessError } = await supabase
    .from("platform_users")
    .select("role, status")
    .maybeSingle();

  if (accessError) {
    return (
      <main className="min-h-screen bg-zinc-50 px-5 py-10 dark:bg-black sm:px-8">
        <p className="mx-auto max-w-4xl rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-800 dark:text-red-300">
          Não foi possível validar seu acesso. Atualize a página ou tente novamente.
        </p>
      </main>
    );
  }

  if (platformUser?.role !== "owner" || platformUser.status !== "active") {
    return (
      <main className="min-h-screen bg-zinc-50 px-5 py-10 dark:bg-black sm:px-8">
        <section className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-white">Acesso restrito</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Somente o owner ativo da plataforma pode convidar administradores.
          </p>
          <Link className="mt-5 inline-flex text-sm font-medium text-blue-600 hover:underline dark:text-blue-400" href="/">
            Voltar ao início
          </Link>
        </section>
      </main>
    );
  }

  const { data, error: invitationsError } = await supabase
    .from("admin_invitations")
    .select("id, email_address, status, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const invitations = data ?? [];

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 dark:bg-black sm:px-8 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link className="inline-flex text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white" href="/">
            ← Início
          </Link>
          <SignOutButton />
        </div>
        {invitationsError ? (
          <p className="mb-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-800 dark:text-red-300">
            Não foi possível carregar os convites. A migration de convites pode ainda não ter sido aplicada no Supabase.
          </p>
        ) : null}
        <InvitationManager invitations={invitations} />
      </div>
    </main>
  );
}
