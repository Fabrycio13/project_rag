import assert from "node:assert/strict";
import test from "node:test";
import { isSameOriginRequest } from "../src/lib/same-origin-request.ts";

test("compares the browser origin with the external host header", () => {
  assert.equal(
    isSameOriginRequest(
      "http://127.0.0.1:3000",
      "127.0.0.1:3000",
      null,
      null,
      "http://localhost:3000/api/admin-invitations",
    ),
    true,
  );
});

test("rejects a cross-origin mutation", () => {
  assert.equal(
    isSameOriginRequest(
      "https://attacker.example",
      "127.0.0.1:3000",
      null,
      null,
      "http://127.0.0.1:3000/api/admin-invitations",
    ),
    false,
  );
});

test("uses the forwarded host and protocol behind a trusted proxy", () => {
  assert.equal(
    isSameOriginRequest(
      "https://app.example.com",
      "internal:3000",
      "app.example.com",
      "https",
      "http://internal:3000/api/admin-invitations",
    ),
    true,
  );
});
