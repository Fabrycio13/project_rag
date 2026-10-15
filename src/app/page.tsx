import Link from "next/link";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAdminInvitationReference } from "@/lib/admin-invitation-acceptance";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DASHBOARD_UNAVAILABLE_MESSAGE, getDashboardData } from "@/lib/dashboard-data";
import { DashboardView } from "./dashboard-view";
import { SignOutButton } from "./sign-out-button";

export default async function Home() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 dark:bg-black">
        <section className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Plataforma de agentes</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">Entre para continuar</h1>
          <Link className="mt-5 inline-flex h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700" href="/sign-in">
            Entrar
          </Link>
        </section>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: platformUser, error } = await supabase
    .from("platform_users")
    .select("role, status")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 dark:bg-black">
        <p className="max-w-lg rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-800 dark:text-red-300">
          Não foi possível validar seu acesso à plataforma. Tente atualizar a página.
        </p>
        <div className="ml-3">
          <SignOutButton label="Sair e entrar com outra conta" />
        </div>
      </main>
    );
  }

  const isOwner = platformUser?.role === "owner";
  const isAdministrator = platformUser?.role === "admin";

  if (!platformUser || platformUser.status !== "active" || (!isOwner && !isAdministrator)) {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    if (getAdminInvitationReference(user.publicMetadata)) {
      redirect("/accept-invitation");
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 dark:bg-black">
        <section className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Acesso ainda não liberado</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">Sua conta não tem acesso à plataforma</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            É necessário um convite válido de administrador para acessar o sistema.
          </p>
          <div className="mt-5">
            <SignOutButton label="Sair e entrar com outra conta" />
          </div>
        </section>
      </main>
    );
  }

  let dashboardData;
  try {
    dashboardData = await getDashboardData(supabase, userId, isOwner ? "owner" : "admin");
  } catch {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 dark:bg-black">
        <section aria-labelledby="dashboard-unavailable-title" className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-white p-7 shadow-sm dark:bg-zinc-950">
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-white" id="dashboard-unavailable-title">Dashboard indisponível</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{DASHBOARD_UNAVAILABLE_MESSAGE}</p>
          <div className="mt-5"><SignOutButton /></div>
        </section>
      </main>
    );
  }

  return <DashboardView data={dashboardData} isOwner={isOwner} />;
}
