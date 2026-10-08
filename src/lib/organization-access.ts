import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageOrganizations } from "@/lib/organizations";
import { ORGANIZATION_READINESS_MESSAGE } from "@/lib/organization-data";

export async function getOrganizationAccess() {
  const { userId } = await auth();
  if (!userId) return { error: "Entre na sua conta para continuar.", status: 401 } as const;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("platform_users").select("role, status").eq("clerk_user_id", userId).maybeSingle();
    if (error) return { error: ORGANIZATION_READINESS_MESSAGE, status: 503 } as const;
    if (!canManageOrganizations(data)) return { error: "Somente owners e administradores ativos podem acessar organizações.", status: 403 } as const;
    return { supabase, userId } as const;
  } catch {
    return { error: ORGANIZATION_READINESS_MESSAGE, status: 503 } as const;
  }
}
