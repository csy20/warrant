import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Server } from "node:http";

import { loadCatalog } from "../mcp/src/catalog.ts";
import { createApp } from "../mcp/src/server.ts";
import { CatalogStore } from "../mcp/src/store.ts";
import {
  ALL_TOOL_NAMES,
  annotationsFor,
  DESTRUCTIVE_TOOL_NAMES,
  READ_TOOL_NAMES,
} from "../mcp/src/tools.ts";

test("annotation map marks writes as destructive", () => {
  for (const name of READ_TOOL_NAMES) {
    assert.deepEqual(annotationsFor(name), {
      readOnlyHint: true,
      destructiveHint: false,
    });
  }
  for (const name of DESTRUCTIVE_TOOL_NAMES) {
    assert.deepEqual(annotationsFor(name), {
      readOnlyHint: false,
      destructiveHint: true,
    });
  }
  assert.throws(() => annotationsFor("not_a_tool"));
});

test("streamable HTTP advertises annotations and health", async () => {
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

  const health = await fetch(`${base}/health`).then(
    (r) => r.json() as Promise<{ ok: boolean; tools: number }>,
  );
  assert.equal(health.ok, true);
  assert.equal(health.tools, ALL_TOOL_NAMES.length);

  const client = new Client({ name: "warrant-tests", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`));
  await client.connect(transport);
  after(async () => {
    await client.close();
  });

  const listed = await client.listTools();
  const names = listed.tools.map((t) => t.name).sort();
  assert.deepEqual(names, [...ALL_TOOL_NAMES].sort());

  for (const tool of listed.tools) {
    const expected = annotationsFor(tool.name);
    assert.equal(tool.annotations?.readOnlyHint, expected.readOnlyHint);
    assert.equal(tool.annotations?.destructiveHint, expected.destructiveHint);
  }

  const apply = listed.tools.find((t) => t.name === "apply_change");
  assert.equal(apply?.annotations?.destructiveHint, true);
  assert.equal(apply?.annotations?.readOnlyHint, false);
});
