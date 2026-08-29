import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { CatalogStore } from "./store.ts";
import { ALL_TOOL_NAMES, registerCatalogTools } from "./tools.ts";

export const DEFAULT_PORT = 8765;
export const SERVER_NAME = "warrant-catalog";

export function createStore(): CatalogStore {
  return new CatalogStore();
}

function buildMcpServer(store: CatalogStore): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  registerCatalogTools(server, store);
  return server;
}

export function createApp(store: CatalogStore = createStore()) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_req, res) => {
    res
      .type("text/plain")
      .send(
        `${SERVER_NAME} MCP. POST MCP requests to /mcp. GET /health for liveness.`,
      );
  });

  app.get("/health", (_req, res) => {
    const snap = store.snapshot();
    res.json({
      ok: true,
      name: SERVER_NAME,
      tools: ALL_TOOL_NAMES.length,
      pending: snap.changes.filter((c) => c.status === "pending").length,
      applied: snap.changes.filter((c) => c.status === "applied").length,
      pages: snap.pages.length,
    });
  });

  const handleMcp: express.RequestHandler = async (req, res) => {
    try {
      const server = buildMcpServer(store);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(
        req,
        res,
        req.method === "POST" ? req.body : undefined,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${SERVER_NAME}] request failed:`, message);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };

  app.post("/mcp", handleMcp);
  app.get("/mcp", handleMcp);
  app.delete("/mcp", handleMcp);

  return app;
}

export function start(
  port: number = Number(process.env.WARRANT_MCP_PORT) || DEFAULT_PORT,
  store: CatalogStore = createStore(),
) {
  const app = createApp(store);
  const server = app.listen(port, "127.0.0.1", () => {
    console.log(
      `[${SERVER_NAME}] listening on http://127.0.0.1:${port}/mcp`,
    );
  });
  return server;
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") ||
    process.argv[1].endsWith("server.js"));

if (isMain) {
  start();
}
