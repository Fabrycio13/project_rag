import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { listOrganizations } from "./organization-data.ts";

export const DASHBOARD_UNAVAILABLE_MESSAGE =
  "Não foi possível carregar os dados do dashboard. Atualize a página ou tente novamente.";

type DashboardRole = "owner" | "admin";
type DashboardOrganization = { id: string; name: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDashboardOrganization(value: unknown): value is DashboardOrganization {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

export type DashboardData = {
  organizationCount: number;
  agentCount: number;
  documentCount: number;
  pendingInvitationCount: number | null;
  recentOrganizations: DashboardOrganization[];
};

async function readExactCount(
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  const { count, error } = await query;
  if (error || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
    throw new Error(DASHBOARD_UNAVAILABLE_MESSAGE);
  }
  return count;
}

// Caller verifies the active platform role. RLS and explicit owner/org filters
// constrain every query; this DTO never includes document or invitation details.
export async function getDashboardData(
  db: SupabaseClient,
  userId: string,
  role: DashboardRole,
): Promise<DashboardData> {
  const { data: organizations, error } = await listOrganizations(db, userId);
  const organizationRows: unknown = organizations;
  if (error || !Array.isArray(organizationRows) || !organizationRows.every(isDashboardOrganization)) {
    throw new Error(DASHBOARD_UNAVAILABLE_MESSAGE);
  }

  const organizationIds = organizationRows.map(organization => organization.id);
  let agentCount = 0;
  let documentCount = 0;

  if (organizationIds.length > 0) {
    [agentCount, documentCount] = await Promise.all([
      readExactCount(
        db.from("agents").select("id", { count: "exact", head: true })
          .in("organization_id", organizationIds),
      ),
      readExactCount(
        db.from("agent_documents").select("id", { count: "exact", head: true })
          .in("organization_id", organizationIds)
          .eq("upload_state", "stored"),
      ),
    ]);
  }

  const pendingInvitationCount = role === "owner"
    ? await readExactCount(
      db.from("admin_invitations").select("id", { count: "exact", head: true })
        .eq("invited_by_clerk_user_id", userId)
        .eq("status", "pending"),
    )
    : null;

  return {
    organizationCount: organizationRows.length,
    agentCount,
    documentCount,
    pendingInvitationCount,
    recentOrganizations: organizationRows.slice(0, 3),
  };
}
