import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPlatformUserCheckState } from "@/lib/platform-user-check-state";

export default async function AccountCheckPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("platform_users")
    .select("role, status")
    .maybeSingle();

  const state = error ? "error" : getPlatformUserCheckState(data);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <section className="w-full max-w-xl rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/15 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Clerk → Supabase
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Verificação da conta
        </h1>

        {state === "error" ? (
          <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
            Não foi possível consultar seu acesso no Supabase. Verifique a
            integração Clerk–Supabase e as políticas de acesso.
          </p>
        ) : state === "missing" ? (
          <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-200">
            O login Clerk está ativo, mas seu usuário não foi encontrado em
            platform_users.
          </p>
        ) : state === "inactive" ? (
          <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-200">
            Seu usuário foi encontrado, mas não está ativo na plataforma.
          </p>
        ) : (
          <p className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-800 dark:text-emerald-200">
            Conexão validada. Seu acesso está ativo como {data?.role}.
          </p>
        )}
      </section>
    </main>
  );
}
