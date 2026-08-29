import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_CHANGE_IDS,
  type Catalog,
  type Change,
  type Flag,
  type Incident,
  type Service,
  type SLO,
} from "./types.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DEFAULT_CATALOG_PATH = join(
  repoRoot,
  "fixtures",
  "northline",
  "catalog.json",
);

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new CatalogError(`${field} must be an array`);
  }
  return value;
}

export function loadCatalog(path: string = DEFAULT_CATALOG_PATH): Catalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new CatalogError(`invalid catalog JSON at ${path}: ${detail}`);
  }
  const catalog = asCatalog(parsed);
  validateCatalog(catalog);
  return structuredClone(catalog);
}

export function asCatalog(value: unknown): Catalog {
  if (!isObject(value)) {
    throw new CatalogError("catalog must be an object");
  }
  if (typeof value.company !== "string") {
    throw new CatalogError("catalog.company must be a string");
  }
  requireArray(value.services, "catalog.services");
  requireArray(value.flags, "catalog.flags");
  requireArray(value.slos, "catalog.slos");
  requireArray(value.incidents, "catalog.incidents");
  requireArray(value.changes, "catalog.changes");
  requireArray(value.pages, "catalog.pages");
  return value as unknown as Catalog;
}

export function validateCatalog(catalog: Catalog): void {
  if (catalog.company !== "Northline") {
    throw new CatalogError("catalog.company must be Northline");
  }
  if (!Array.isArray(catalog.services) || catalog.services.length === 0) {
    throw new CatalogError("catalog must list at least one service");
  }
  if (!Array.isArray(catalog.changes)) {
    throw new CatalogError("catalog.changes must be an array");
  }
  if (!Array.isArray(catalog.flags)) {
    throw new CatalogError("catalog.flags must be an array");
  }

  const serviceNames = new Set(catalog.services.map((s) => s.name));
  for (const id of REQUIRED_CHANGE_IDS) {
    const change = catalog.changes.find((c) => c.id === id);
    if (!change) {
      throw new CatalogError(`missing required change ${id}`);
    }
    if (!serviceNames.has(change.service)) {
      throw new CatalogError(
        `change ${id} references unknown service ${change.service}`,
      );
    }
  }

  for (const flag of catalog.flags) {
    if (!serviceNames.has(flag.service)) {
      throw new CatalogError(
        `flag ${flag.name} references unknown service ${flag.service}`,
      );
    }
  }
}

export function getService(catalog: Catalog, name: string): Service {
  const service = catalog.services.find((s) => s.name === name);
  if (!service) {
    throw new CatalogError(`unknown service: ${name}`);
  }
  return service;
}

export function getChange(catalog: Catalog, id: string): Change {
  const change = catalog.changes.find((c) => c.id === id);
  if (!change) {
    throw new CatalogError(`unknown change: ${id}`);
  }
  return change;
}

export function getFlag(
  catalog: Catalog,
  name: string,
  environment: string,
): Flag {
  const flag = catalog.flags.find(
    (f) => f.name === name && f.environment === environment,
  );
  if (!flag) {
    throw new CatalogError(`unknown flag: ${name} in ${environment}`);
  }
  return flag;
}

export function listPendingChanges(catalog: Catalog): Change[] {
  return catalog.changes.filter((c) => c.status === "pending");
}

export function getSlo(catalog: Catalog, service: string): SLO[] {
  getService(catalog, service);
  return catalog.slos.filter((s) => s.service === service);
}

export function listRecentIncidents(
  catalog: Catalog,
  service: string,
): Incident[] {
  getService(catalog, service);
  return catalog.incidents.filter((i) => i.service === service);
}
