import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminInvitationReference,
  isValidInvitationEmail,
  isVerifiedInvitationEmailMatch,
  normalizeInvitationEmail,
} from "../src/lib/admin-invitation-acceptance.ts";

test("normalizes invitation emails for matching", () => {
  assert.equal(normalizeInvitationEmail("  Admin@Example.com "), "admin@example.com");
});

test("validates a single invitation email", () => {
  assert.equal(isValidInvitationEmail("admin@example.com"), true);
  assert.equal(isValidInvitationEmail("admin@example"), false);
  assert.equal(isValidInvitationEmail("admin @example.com"), false);
  assert.equal(isValidInvitationEmail("a".repeat(250) + "@example.com"), false);
});

test("accepts only a verified account matching the invited email", () => {
  assert.equal(
    isVerifiedInvitationEmailMatch("Admin@example.com", "admin@example.com", "verified"),
    true,
  );
  assert.equal(
    isVerifiedInvitationEmailMatch("admin@example.com", "other@example.com", "verified"),
    false,
  );
  assert.equal(
    isVerifiedInvitationEmailMatch("admin@example.com", "admin@example.com", "unverified"),
    false,
  );
});

test("returns an invitation reference only for server-issued admin metadata", () => {
  const reference = "7a4bc62d-50ad-4e15-8f8b-51935d8fd40d";
  assert.equal(
    getAdminInvitationReference({ platformRole: "admin", invitationRef: reference }),
    reference,
  );
  assert.equal(
    getAdminInvitationReference({ platformRole: "owner", invitationRef: reference }),
    null,
  );
  assert.equal(
    getAdminInvitationReference({ platformRole: "admin", invitationRef: "not-a-uuid" }),
    null,
  );
  assert.equal(getAdminInvitationReference(null), null);
});
