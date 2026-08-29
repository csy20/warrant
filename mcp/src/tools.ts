import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { CatalogError } from "./catalog.ts";
import type { CatalogStore } from "./store.ts";
import type { Severity } from "./types.ts";

export const READ_TOOL_NAMES = [
  "list_pending_changes",
  "get_change",
  "get_service",
  "get_flag",
  "get_slo",
  "list_recent_incidents",
] as const;

export const DESTRUCTIVE_TOOL_NAMES = [
  "apply_change",
  "rollback_change",
  "page_oncall",
] as const;

export const ALL_TOOL_NAMES = [
  ...READ_TOOL_NAMES,
  ...DESTRUCTIVE_TOOL_NAMES,
] as const;

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const destructiveAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export function annotationsFor(name: string): {
  readOnlyHint: boolean;
  destructiveHint: boolean;
} {
  if ((DESTRUCTIVE_TOOL_NAMES as readonly string[]).includes(name)) {
    return { readOnlyHint: false, destructiveHint: true };
  }
  if ((READ_TOOL_NAMES as readonly string[]).includes(name)) {
    return { readOnlyHint: true, destructiveHint: false };
  }
  throw new Error(`unknown tool: ${name}`);
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

function run<T>(fn: () => T) {
  try {
    return jsonResult(fn());
  } catch (err) {
    if (err instanceof CatalogError) {
      return errorResult(err);
    }
    throw err;
  }
}

const severitySchema = z.enum(["sev1", "sev2", "sev3"]);

export function registerCatalogTools(
  server: McpServer,
  store: CatalogStore,
): void {
  server.registerTool(
    "list_pending_changes",
    {
      title: "List pending changes",
      description:
        "List Northline changes that are still pending clearance. Read-only.",
      annotations: readAnnotations,
    },
    () => run(() => store.listPendingChanges()),
  );

  server.registerTool(
    "get_change",
    {
      title: "Get a change",
      description:
        "Fetch one change by id (for example CHG-1042). Read-only. Do not invent fields that are not in the catalog.",
      inputSchema: { id: z.string().min(1) },
      annotations: readAnnotations,
    },
    ({ id }) => run(() => store.getChange(id)),
  );

  server.registerTool(
    "get_service",
    {
      title: "Get a service",
      description:
        "Fetch a Northline service by name, including version, replicas, and traffic share. Read-only.",
      inputSchema: { name: z.string().min(1) },
      annotations: readAnnotations,
    },
    ({ name }) => run(() => store.getService(name)),
  );

  server.registerTool(
    "get_flag",
    {
      title: "Get a feature flag",
      description:
        "Fetch a feature flag by name and environment (prod or staging). Read-only.",
      inputSchema: {
        name: z.string().min(1),
        environment: z.enum(["prod", "staging"]),
      },
      annotations: readAnnotations,
    },
    ({ name, environment }) => run(() => store.getFlag(name, environment)),
  );

  server.registerTool(
    "get_slo",
    {
      title: "Get SLOs for a service",
      description:
        "Fetch current SLO headroom for a service. Read-only. Use this before recommending apply.",
      inputSchema: { service: z.string().min(1) },
      annotations: readAnnotations,
    },
    ({ service }) => run(() => store.getSlo(service)),
  );

  server.registerTool(
    "list_recent_incidents",
    {
      title: "List recent incidents",
      description:
        "List recent incidents for a service. Read-only. Check these before applying a related change.",
      inputSchema: { service: z.string().min(1) },
      annotations: readAnnotations,
    },
    ({ service }) => run(() => store.listRecentIncidents(service)),
  );

  server.registerTool(
    "apply_change",
    {
      title: "Apply a change",
      description:
        "IRREVERSIBLE without a later rollback. Applies a pending change to the demo catalog (flag, deploy, or scale). Requires a justification. TrueForge must pause for human Allow/Deny before this runs.",
      inputSchema: {
        id: z.string().min(1),
        justification: z.string().min(1),
      },
      annotations: destructiveAnnotations,
    },
    ({ id, justification }) => run(() => store.applyChange(id, justification)),
  );

  server.registerTool(
    "rollback_change",
    {
      title: "Roll back a change",
      description:
        "IRREVERSIBLE relative to the applied state. Restores the catalog to the snapshot captured at apply time. Only works for changes with status=applied.",
      inputSchema: {
        id: z.string().min(1),
        justification: z.string().min(1),
      },
      annotations: destructiveAnnotations,
    },
    ({ id, justification }) =>
      run(() => store.rollbackChange(id, justification)),
  );

  server.registerTool(
    "page_oncall",
    {
      title: "Page on-call",
      description:
        "IRREVERSIBLE demo page. Records an on-call page for a service. Do not use for investigation.",
      inputSchema: {
        service: z.string().min(1),
        severity: severitySchema,
        message: z.string().min(1),
      },
      annotations: destructiveAnnotations,
    },
    ({ service, severity, message }) =>
      run(() =>
        store.pageOncall({
          service,
          severity: severity as Severity,
          message,
        }),
      ),
  );
}
