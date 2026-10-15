import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("root keeps authentication and invitation acceptance checks before dashboard rendering", () => {
  const page = source("src/app/page.tsx");

  assert.match(page, /if \(!userId\)/);
  assert.match(page, /getAdminInvitationReference\(user\.publicMetadata\)/);
  assert.match(page, /redirect\("\/accept-invitation"\)/);
  assert.match(page, /\.eq\("clerk_user_id", userId\)/);
  assert.match(page, /platformUser\.status !== "active" \|\| \(!isOwner && !isAdministrator\)/);
  assert.match(page, /getDashboardData\(supabase, userId, isOwner \? "owner" : "admin"\)/);
  assert.match(page, /return <DashboardView data=\{dashboardData\} isOwner=\{isOwner\} \/>;/);
});

test("global navigation exposes invitations only to the owner", () => {
  const navigation = source("src/app/dashboard-navigation.tsx");
  assert.match(navigation, /\.\.\.\(isOwner \? \[\{ href: "\/admin\/invitations"/);
});
