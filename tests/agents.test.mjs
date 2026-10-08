import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
const moduleUrl = new URL("../src/lib/agents.ts", import.meta.url);
test("agent input accepts only bounded name and required instructions", async () => {
  assert.ok(existsSync(moduleUrl), "agent validation is not implemented");
  const { validateAgentInput } = await import(moduleUrl);
  assert.deepEqual(validateAgentInput({ name: "  Ajuda  ", instructions: "  Seja claro.  ", organization_id: "other" }), { name: "Ajuda", instructions: "Seja claro." });
  for (const value of [null, [], {}, { name: "a", instructions: " " }, { name: "a".repeat(121), instructions: "ok" }, { name: "a", instructions: "x".repeat(20001) }]) assert.equal(validateAgentInput(value), null);
  assert.ok(validateAgentInput({ name: "😀".repeat(120), instructions: "x".repeat(20000) }));
});
