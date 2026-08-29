import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Server } from "node:http";

import { loadCatalog } from "../mcp/src/catalog.ts";
import { createApp } from "../mcp/src/server.ts";
import { CatalogStore } from "../mcp/src/store.ts";

function toolText(result: unknown): string {
  assert.ok(result && typeof result === "object" && "content" in result);
  const content = (result as { content: Array<{ type: string; text?: string }> })
    .content;
  const block = content.find((c) => c.type === "text");
  assert.ok(block?.text);
  return block.text;
}

test("MCP round-trip applies and rolls back CHG-1042", async () => {
  const store = new CatalogStore(loadCatalog());
  const app = createApp(store);
  const httpServer: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  after(() => {
    httpServer.close();
  });
  const address = httpServer.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  const before = await fetch(`${base}/health`).then(
    (r) =>
      r.json() as Promise<{ pending: number; applied: number; pages: number }>,
  );
  assert.equal(before.pending, 3);
  assert.equal(before.applied, 0);

  const client = new Client({ name: "warrant-roundtrip", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  after(async () => {
    await client.close();
  });

  const listed = await client.callTool({
    name: "list_pending_changes",
    arguments: {},
  });
  assert.ok(!listed.isError);
  assert.match(toolText(listed), /CHG-1042/);

  const empty = await client.callTool({
    name: "apply_change",
    arguments: { id: "CHG-1042", justification: "" },
  });
  assert.equal(empty.isError, true);

  const applied = await client.callTool({
    name: "apply_change",
    arguments: {
      id: "CHG-1042",
      justification: "human accepted residual risk after INC-441",
    },
  });
  assert.ok(!applied.isError);
  assert.match(toolText(applied), /"status": "applied"/);

  const flagOn = await client.callTool({
    name: "get_flag",
    arguments: { name: "checkout-v2", environment: "prod" },
  });
  assert.match(toolText(flagOn), /"enabled": true/);

  const mid = await fetch(`${base}/health`).then(
    (r) => r.json() as Promise<{ pending: number; applied: number }>,
  );
  assert.equal(mid.pending, 2);
  assert.equal(mid.applied, 1);

  const rolled = await client.callTool({
    name: "rollback_change",
    arguments: { id: "CHG-1042", justification: "rehearse deny path" },
  });
  assert.ok(!rolled.isError);
  const flagOff = await client.callTool({
    name: "get_flag",
    arguments: { name: "checkout-v2", environment: "prod" },
  });
  assert.match(toolText(flagOff), /"enabled": false/);
});
