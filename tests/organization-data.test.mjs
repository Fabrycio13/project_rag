import assert from "node:assert/strict";
import test from "node:test";
import { listOrganizations, findOrganization, insertOrganization } from "../src/lib/organization-data.ts";
function client(result) {
 const calls = [];
 const query = new Proxy({}, { get(_, key) { if (key === "then") return (resolve) => resolve(result); return (...args) => { calls.push([key, ...args]); return query; }; } });
 return { calls, from: (...args) => { calls.push(["from", ...args]); return query; } };
}
test("list and detail scope to authenticated creator and non-archived rows", async () => {
 const db = client({ data: [], error: null });
 await listOrganizations(db, "user_owner");
 assert.ok(db.calls.some(c => c[0] === "eq" && c[1] === "owner_clerk_user_id" && c[2] === "user_owner"));
 assert.ok(db.calls.some(c => c[0] === "is" && c[1] === "archived_at" && c[2] === null));
 await findOrganization(db, "user_owner", "c447e3bc-70aa-4a69-b176-d322c6ab42d8");
 assert.ok(db.calls.some(c => c[0] === "eq" && c[1] === "id"));
});
test("create validates and inserts only name and authenticated creator", async () => {
 const db = client({ data: { id: "id", name: "Teste" }, error: null });
 await insertOrganization(db, "user_owner", "  Teste  ");
 assert.deepEqual(db.calls.find(c => c[0] === "insert")[1], { name: "Teste", owner_clerk_user_id: "user_owner" });
 await assert.rejects(() => insertOrganization(db, "user_owner", " "));
});
