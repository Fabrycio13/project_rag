import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOrganizationName, canManageOrganizations } from "../src/lib/organizations.ts";

test("accepts only trimmed names of 1–120 Unicode characters", () => {
  assert.equal(normalizeOrganizationName("  Minha organização  "), "Minha organização");
  for (const value of [null, 1, {}, "", "   ", "a".repeat(121)]) assert.equal(normalizeOrganizationName(value), null);
  assert.equal(normalizeOrganizationName("a".repeat(120)), "a".repeat(120));
  assert.equal(normalizeOrganizationName("😀".repeat(120)), "😀".repeat(120));
});

test("only active owners and admins can manage organizations", () => {
  for (const role of ["owner", "admin"]) assert.equal(canManageOrganizations({ role, status: "active" }), true);
  for (const user of [null, { role: "owner", status: "blocked" }, { role: "admin", status: "invited" }, { role: "member", status: "active" }]) assert.equal(canManageOrganizations(user), false);
});
