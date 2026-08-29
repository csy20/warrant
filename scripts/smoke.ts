import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Server } from "node:http";

import { loadCatalog } from "../mcp/src/catalog.ts";
import { createApp } from "../mcp/src/server.ts";
import { CatalogStore } from "../mcp/src/store.ts";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const analyzer = join(
  root,
  "skills/change-clearance/scripts/analyze_change.py",
);

function textOf(result: unknown): string {
  if (!result || typeof result !== "object" || !("content" in result)) {
    throw new Error("tool returned no content");
  }
  const content = (result as { content: Array<{ type: string; text?: string }> })
    .content;
  const block = content.find((c) => c.type === "text");
  if (!block?.text) {
    throw new Error("tool returned no text");
  }
  return block.text;
}

function isToolError(result: unknown): boolean {
  return Boolean(
    result && typeof result === "object" && "isError" in result && result.isError,
  );
}

async function main(): Promise<void> {
  const store = new CatalogStore(loadCatalog());
  const app = createApp(store);
  const http: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const address = http.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind smoke server");
  }
  const base = `http://127.0.0.1:${address.port}`;
  const client = new Client({ name: "warrant-smoke", version: "0.1.0" });

  try {
    const health = await fetch(`${base}/health`).then((r) => r.json());
    console.log("health", health);

    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
    const change = JSON.parse(
      textOf(
        await client.callTool({
          name: "get_change",
          arguments: { id: "CHG-1042" },
        }),
      ),
    );
    const service = JSON.parse(
      textOf(
        await client.callTool({
          name: "get_service",
          arguments: { name: "checkout-api" },
        }),
      ),
    );
    const slos = JSON.parse(
      textOf(
        await client.callTool({
          name: "get_slo",
          arguments: { service: "checkout-api" },
        }),
      ),
    );
    const incidents = JSON.parse(
      textOf(
        await client.callTool({
          name: "list_recent_incidents",
          arguments: { service: "checkout-api" },
        }),
      ),
    );
    const flag = JSON.parse(
      textOf(
        await client.callTool({
          name: "get_flag",
          arguments: { name: "checkout-v2", environment: "prod" },
        }),
      ),
    );

    const analysis = spawnSync(
      "python3",
      [analyzer],
      {
        input: JSON.stringify({ change, service, slos, incidents, flag }),
        encoding: "utf8",
      },
    );
    if (analysis.status !== 0) {
      throw new Error(analysis.stderr || "analyzer failed");
    }
    console.log(analysis.stdout);
    if (!analysis.stdout.includes("NO-GO")) {
      throw new Error("expected CHG-1042 to be NO-GO");
    }

    const applied = await client.callTool({
      name: "apply_change",
      arguments: {
        id: "CHG-1042",
        justification: "smoke: human accepted residual risk",
      },
    });
    if (isToolError(applied)) {
      throw new Error(textOf(applied));
    }
    const flagOn = JSON.parse(
      textOf(
        await client.callTool({
          name: "get_flag",
          arguments: { name: "checkout-v2", environment: "prod" },
        }),
      ),
    );
    if (flagOn.enabled !== true) {
      throw new Error("apply_change did not enable checkout-v2");
    }
    console.log("apply_change -> checkout-v2 enabled=true (would be Allow in TrueForge)");

    await client.callTool({
      name: "rollback_change",
      arguments: { id: "CHG-1042", justification: "smoke: restore catalog" },
    });
    console.log("rollback_change -> catalog restored");
    console.log("SMOKE_OK");
  } finally {
    await client.close().catch(() => undefined);
    await new Promise<void>((resolve, reject) => {
      http.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
