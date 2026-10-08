import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
const url = new URL("../src/lib/agent-data.ts", import.meta.url);
function client() {
 const calls = [];
 const query = new Proxy({}, { get(_, key) { if (key === "then") return resolve => resolve({ data: [], error: null }); return (...args) => { calls.push([key, ...args]); return query; }; } });
 return { calls, from: (...args) => { calls.push(["from", ...args]); return query; } };
}
test("agent queries scope every row to organization and never select instructions", async () => {
 assert.ok(existsSync(url), "scoped agent persistence missing");
 const { listAgents, findAgent, insertAgent } = await import(url);
 const db = client();
 await listAgents(db, "org-a");
 await findAgent(db, "org-a", "agent-b");
 await insertAgent(db, "org-a", { name: " Test ", instructions: " Private ", organization_id: "org-b", owner_clerk_user_id: "other" });
 assert.equal(db.calls.filter(c => c[0] === "eq" && c[1] === "organization_id" && c[2] === "org-a").length, 2);
 assert.ok(db.calls.some(c => c[0] === "eq" && c[1] === "id" && c[2] === "agent-b"));
 assert.deepEqual(db.calls.find(c => c[0] === "insert")[1], { organization_id: "org-a", name: "Test", instructions: "Private" });
 for (const c of db.calls.filter(c => c[0] === "select")) assert.equal(c[1], "id, name");
 await assert.rejects(() => insertAgent(db, "org-a", { name: "Test", instructions: "" }));
});
