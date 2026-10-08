import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeOrganizationName } from "./organizations.ts";

export const ORGANIZATION_READINESS_MESSAGE = "A área de organizações está indisponível. Peça ao responsável pela plataforma para revisar a conexão com o banco e aplicar a atualização de permissões de organizações para owner e administrador.";

export function listOrganizations(db: SupabaseClient, userId: string) {
  return db.from("organizations").select("id, name").eq("owner_clerk_user_id", userId).is("archived_at", null).order("created_at", { ascending: false });
}

export function findOrganization(db: SupabaseClient, userId: string, id: string) {
  return db.from("organizations").select("id, name").eq("owner_clerk_user_id", userId).eq("id", id).is("archived_at", null).maybeSingle();
}

export async function insertOrganization(db: SupabaseClient, userId: string, value: unknown) {
  const name = normalizeOrganizationName(value);
  if (!name) throw new Error("Informe um nome de 1 a 120 caracteres.");
  return await db.from("organizations").insert({ name, owner_clerk_user_id: userId }).select("id, name").single();
}
