import assert from "node:assert/strict";
import test from "node:test";
import { getAdminInvitationSignUpUrl } from "../src/lib/admin-invitation-redirect.ts";

test("builds the sign-up redirect from the configured public app URL", () => {
  assert.equal(
    getAdminInvitationSignUpUrl("https://agents.example.com"),
    "https://agents.example.com/sign-up",
  );
});

test("allows a localhost redirect only when development mode enables it", () => {
  assert.equal(
    getAdminInvitationSignUpUrl("http://localhost:3000", true),
    "http://localhost:3000/sign-up",
  );
});

test("rejects missing, insecure, and local invitation URLs", () => {
  assert.equal(getAdminInvitationSignUpUrl(undefined), null);
  assert.equal(getAdminInvitationSignUpUrl("not-a-url"), null);
  assert.equal(getAdminInvitationSignUpUrl("http://agents.example.com"), null);
  assert.equal(getAdminInvitationSignUpUrl("http://localhost:3000"), null);
  assert.equal(getAdminInvitationSignUpUrl("https://127.0.0.1"), null);
  assert.equal(getAdminInvitationSignUpUrl("https://app.localhost"), null);
});
