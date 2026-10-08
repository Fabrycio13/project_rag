import { getOrganizationAccess } from "@/lib/organization-access";
import { listOrganizations, insertOrganization, ORGANIZATION_READINESS_MESSAGE } from "@/lib/organization-data";
import { normalizeOrganizationName } from "@/lib/organizations";
import { isSameOriginRequest } from "@/lib/same-origin-request";

export async function GET() {
  const access = await getOrganizationAccess();
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  const { data, error } = await listOrganizations(access.supabase, access.userId);
  return error ? Response.json({ error: ORGANIZATION_READINESS_MESSAGE }, { status: 503 }) : Response.json({ organizations: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers.get("origin"), request.headers.get("host"), request.headers.get("x-forwarded-host"), request.headers.get("x-forwarded-proto"), request.url)) {
    return Response.json({ error: "Solicitação inválida." }, { status: 403 });
  }
  const access = await getOrganizationAccess();
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Informe um nome válido." }, { status: 400 }); }
  const name = normalizeOrganizationName(body && typeof body === "object" && !Array.isArray(body) ? Object.getOwnPropertyDescriptor(body, "name")?.value : null);
  if (!name) return Response.json({ error: "Informe um nome de 1 a 120 caracteres." }, { status: 400 });
  const { data, error } = await insertOrganization(access.supabase, access.userId, name);
  return error ? Response.json({ error: ORGANIZATION_READINESS_MESSAGE }, { status: 503 }) : Response.json({ organization: data }, { status: 201 });
}
