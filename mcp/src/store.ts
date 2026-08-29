import {
  CatalogError,
  getChange,
  getFlag,
  getService,
  getSlo,
  listPendingChanges,
  listRecentIncidents,
  loadCatalog,
} from "./catalog.ts";
import type {
  Catalog,
  Change,
  Flag,
  Incident,
  Page,
  Service,
  Severity,
  SLO,
} from "./types.ts";

type PreviousState = Record<string, unknown>;

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new CatalogError(`expected ${field} to be a non-empty string`);
  }
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CatalogError(`expected ${field} to be a number`);
  }
  return value;
}

function asNonNegativeInt(value: unknown, field: string): number {
  const n = asNumber(value, field);
  if (!Number.isInteger(n) || n < 0) {
    throw new CatalogError(`expected ${field} to be a non-negative integer`);
  }
  return n;
}

const SEVERITIES: readonly Severity[] = ["sev1", "sev2", "sev3"];

function asSeverity(value: string): Severity {
  if ((SEVERITIES as readonly string[]).includes(value)) {
    return value as Severity;
  }
  throw new CatalogError(`unknown severity: ${value}`);
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new CatalogError(`expected ${field} to be a boolean`);
  }
  return value;
}

export class CatalogStore {
  private catalog: Catalog;
  private previous = new Map<string, PreviousState>();
  private pageSeq = 0;

  constructor(catalog: Catalog = loadCatalog()) {
    this.catalog = catalog;
  }

  snapshot(): Catalog {
    return this.catalog;
  }

  listPendingChanges(): Change[] {
    return listPendingChanges(this.catalog);
  }

  getChange(id: string): Change {
    return getChange(this.catalog, id);
  }

  getService(name: string): Service {
    return getService(this.catalog, name);
  }

  getFlag(name: string, environment: string): Flag {
    return getFlag(this.catalog, name, environment);
  }

  getSlo(service: string): SLO[] {
    return getSlo(this.catalog, service);
  }

  listRecentIncidents(service: string): Incident[] {
    return listRecentIncidents(this.catalog, service);
  }

  applyChange(id: string, justification: string): Change {
    const change = getChange(this.catalog, id);
    if (change.status !== "pending") {
      throw new CatalogError(
        `change ${id} is ${change.status}; only pending changes can be applied`,
      );
    }
    if (!justification.trim()) {
      throw new CatalogError("justification is required to apply a change");
    }
    this.previous.set(id, this.capture(change));
    this.applyPayload(change);
    change.status = "applied";
    change.applied_justification = justification.trim();
    return change;
  }

  rollbackChange(id: string, justification: string): Change {
    const change = getChange(this.catalog, id);
    if (change.status !== "applied") {
      throw new CatalogError(
        `change ${id} is ${change.status}; only applied changes can be rolled back`,
      );
    }
    if (!justification.trim()) {
      throw new CatalogError("justification is required to roll back a change");
    }
    const previous = this.previous.get(id);
    if (!previous) {
      throw new CatalogError(`no captured previous state for ${id}`);
    }
    this.restore(change, previous);
    change.status = "rolled_back";
    change.rollback_justification = justification.trim();
    return change;
  }

  pageOncall(input: {
    service: string;
    severity: string;
    message: string;
  }): Page {
    getService(this.catalog, input.service);
    const severity = asSeverity(input.severity);
    if (!input.message.trim()) {
      throw new CatalogError("page message is required");
    }
    this.pageSeq += 1;
    const page: Page = {
      id: `PAGE-${String(this.pageSeq).padStart(3, "0")}`,
      service: input.service,
      severity,
      message: input.message.trim(),
      created_at: new Date().toISOString(),
    };
    this.catalog.pages.push(page);
    return page;
  }

  private capture(change: Change): PreviousState {
    if (change.kind === "feature_flag") {
      const flagName = asString(change.payload.flag, "payload.flag");
      const flag = getFlag(this.catalog, flagName, change.environment);
      return { enabled: flag.enabled, rollout_pct: flag.rollout_pct };
    }
    const service = getService(this.catalog, change.service);
    if (change.kind === "deploy") {
      return { version: service.version };
    }
    return { replicas: service.replicas };
  }

  private applyPayload(change: Change): void {
    if (change.kind === "feature_flag") {
      const flagName = asString(change.payload.flag, "payload.flag");
      const flag = getFlag(this.catalog, flagName, change.environment);
      flag.enabled = asBoolean(change.payload.enabled, "payload.enabled");
      flag.rollout_pct = asNonNegativeInt(
        change.payload.rollout_pct,
        "payload.rollout_pct",
      );
      if (flag.rollout_pct > 100) {
        throw new CatalogError("payload.rollout_pct must be 0-100");
      }
      return;
    }
    const service = getService(this.catalog, change.service);
    if (change.kind === "deploy") {
      service.version = asString(change.payload.version, "payload.version");
      return;
    }
    service.replicas = asNonNegativeInt(
      change.payload.replicas,
      "payload.replicas",
    );
  }

  private restore(change: Change, previous: PreviousState): void {
    if (change.kind === "feature_flag") {
      const flagName = asString(change.payload.flag, "payload.flag");
      const flag = getFlag(this.catalog, flagName, change.environment);
      flag.enabled = asBoolean(previous.enabled, "previous.enabled");
      flag.rollout_pct = asNonNegativeInt(
        previous.rollout_pct,
        "previous.rollout_pct",
      );
      return;
    }
    const service = getService(this.catalog, change.service);
    if (change.kind === "deploy") {
      service.version = asString(previous.version, "previous.version");
      return;
    }
    service.replicas = asNonNegativeInt(
      previous.replicas,
      "previous.replicas",
    );
  }
}
