import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardData } from "../src/lib/dashboard-data.ts";

function client(results) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, operations: [] };
      calls.push(call);
      const query = new Proxy({}, {
        get(_, key) {
          if (key === "then") return (resolve, reject) => Promise.resolve(results[table]).then(resolve, reject);
          return (...args) => {
            call.operations.push([key, ...args]);
            return query;
          };
        },
      });
      return query;
    },
  };
}

test("dashboard counts only the authenticated user's active organizations and stored documents", async () => {
  const organizations = [
    { id: "org-a", name: "Alpha" },
    { id: "org-b", name: "Beta" },
    { id: "org-c", name: "Gamma" },
    { id: "org-d", name: "Delta" },
  ];
  const db = client({
    organizations: { data: organizations, error: null },
    agents: { count: 7, error: null },
    agent_documents: { count: 4, error: null },
    admin_invitations: { count: 2, error: null },
  });

  const result = await getDashboardData(db, "user-owner", "owner");

  assert.equal(result.organizationCount, 4);
  assert.equal(result.agentCount, 7);
  assert.equal(result.documentCount, 4);
  assert.equal(result.pendingInvitationCount, 2);
  assert.deepEqual(result.recentOrganizations, organizations.slice(0, 3));

  const organizationQuery = db.calls.find(call => call.table === "organizations");
  assert.ok(organizationQuery.operations.some(([method, column, value]) => method === "eq" && column === "owner_clerk_user_id" && value === "user-owner"));
  assert.ok(organizationQuery.operations.some(([method, column, value]) => method === "is" && column === "archived_at" && value === null));

  const agentQuery = db.calls.find(call => call.table === "agents");
  assert.ok(agentQuery.operations.some(([method, column, values]) => method === "in" && column === "organization_id" && values.join(",") === "org-a,org-b,org-c,org-d"));
  assert.ok(agentQuery.operations.some(([method, columns, options]) => method === "select" && columns === "id" && options?.head === true && options?.count === "exact"));

  const documentQuery = db.calls.find(call => call.table === "agent_documents");
  assert.ok(documentQuery.operations.some(([method, column, values]) => method === "in" && column === "organization_id" && values.join(",") === "org-a,org-b,org-c,org-d"));
  assert.ok(documentQuery.operations.some(([method, column, value]) => method === "eq" && column === "upload_state" && value === "stored"));

  const invitationQuery = db.calls.find(call => call.table === "admin_invitations");
  assert.ok(invitationQuery.operations.some(([method, column, value]) => method === "eq" && column === "status" && value === "pending"));
  assert.ok(invitationQuery.operations.some(([method, column, value]) => method === "eq" && column === "invited_by_clerk_user_id" && value === "user-owner"));
});

test("admin dashboard omits owner invitations", async () => {
  const db = client({
    organizations: { data: [{ id: "org-a", name: "Alpha" }], error: null },
    agents: { count: 0, error: null },
    agent_documents: { count: 0, error: null },
  });

  const result = await getDashboardData(db, "user-admin", "admin");

  assert.equal(result.pendingInvitationCount, null);
  assert.equal(db.calls.some(call => call.table === "admin_invitations"), false);
});

test("empty organization list returns zero resource counts without querying child tables", async () => {
  const db = client({
    organizations: { data: [], error: null },
    admin_invitations: { count: 0, error: null },
  });

  const result = await getDashboardData(db, "user-owner", "owner");

  assert.equal(result.organizationCount, 0);
  assert.equal(result.agentCount, 0);
  assert.equal(result.documentCount, 0);
  assert.equal(result.pendingInvitationCount, 0);
  assert.deepEqual(result.recentOrganizations, []);
  assert.deepEqual(db.calls.map(call => call.table), ["organizations", "admin_invitations"]);
});

test("database errors are reported as unavailable instead of zero counts", async () => {
  const db = client({
    organizations: { data: [{ id: "org-a", name: "Alpha" }], error: null },
    agents: { count: null, error: { message: "database unavailable" } },
    agent_documents: { count: 0, error: null },
  });

  await assert.rejects(
    () => getDashboardData(db, "user-admin", "admin"),
    /Não foi possível carregar os dados do dashboard/,
  );
});
