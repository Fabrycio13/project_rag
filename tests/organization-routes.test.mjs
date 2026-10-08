import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("organization routes use active access, scoped queries and same-origin writes", () => {
 const route = source("src/app/api/organizations/route.ts");
 assert.match(route, /getOrganizationAccess/);
 assert.match(route, /isSameOriginRequest/);
 assert.match(route, /listOrganizations/);
 assert.match(route, /insertOrganization\(access.supabase, access.userId, name\)/);
 const access = source("src/lib/organization-access.ts");
 assert.match(access, /canManageOrganizations/);
 assert.match(access, /createServerSupabaseClient/);
 assert.doesNotMatch(access, /service/);
 const detail = source("src/app/organizations/[id]/page.tsx");
 assert.match(detail, /findOrganization\(access.supabase, access.userId, id\)/);
 assert.match(detail, /notFound/);
});
test("new migration keeps creator-only scope for active owner and admin", () => {
 const sql = source("supabase/migrations/20261008000200_owner_organizations.sql");
 for (const action of ["select", "insert", "update"]) assert.match(sql, new RegExp(`create policy organizations_${action}_own`));
 assert.equal((sql.match(/role in \('owner', 'admin'\)/g) ?? []).length, 4);
 assert.equal((sql.match(/owner_clerk_user_id = \(select auth.jwt\(\) ->> 'sub'\)/g) ?? []).length, 4);
 assert.equal((sql.match(/platform_user.status = 'active'/g) ?? []).length, 4);
});
