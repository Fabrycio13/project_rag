import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export async function createServerSupabaseClient() {
  const { userId, getToken } = await auth.protect();

  if (!userId) {
    throw new Error("Sua sessão não foi encontrada. Entre novamente.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Configuração do Supabase ausente. Verifique as variáveis locais do projeto.",
    );
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
    accessToken: async () => getToken(),
  });
}
