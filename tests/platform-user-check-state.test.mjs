import assert from "node:assert/strict";
import test from "node:test";
import { getPlatformUserCheckState } from "../src/lib/platform-user-check-state.ts";

test("reports an active platform user", () => {
  assert.equal(
    getPlatformUserCheckState({ role: "owner", status: "active" }),
    "active",
  );
});

test("reports a missing platform user", () => {
  assert.equal(getPlatformUserCheckState(null), "missing");
});

test("reports a non-active platform user", () => {
  assert.equal(
    getPlatformUserCheckState({ role: "admin", status: "invited" }),
    "inactive",
  );
});
