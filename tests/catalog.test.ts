import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CatalogError,
  getChange,
  getFlag,
  getService,
  getSlo,
  listPendingChanges,
  listRecentIncidents,
  loadCatalog,
  validateCatalog,
} from "../mcp/src/catalog.ts";
import { REQUIRED_CHANGE_IDS, type Catalog } from "../mcp/src/types.ts";

test("loadCatalog returns a cloned Northline snapshot", () => {
  const a = loadCatalog();
  const b = loadCatalog();
  assert.equal(a.company, "Northline");
  a.changes[0]!.status = "applied";
  assert.equal(b.changes[0]!.status, "pending");
});

test("required demo changes exist and start pending", () => {
  const catalog = loadCatalog();
  for (const id of REQUIRED_CHANGE_IDS) {
    const change = getChange(catalog, id);
    assert.equal(change.status, "pending");
    assert.ok(change.rollback.length > 0);
  }
  assert.equal(getChange(catalog, "CHG-1042").risk, "high");
  assert.equal(getChange(catalog, "CHG-1043").risk, "medium");
  assert.equal(getChange(catalog, "CHG-1044").risk, "low");
});

test("CHG-1042 is a prod checkout-v2 flag flip with a prior incident", () => {
  const catalog = loadCatalog();
  const change = getChange(catalog, "CHG-1042");
  assert.equal(change.kind, "feature_flag");
  assert.equal(change.service, "checkout-api");
  assert.equal(change.environment, "prod");
  assert.equal(change.payload.flag, "checkout-v2");
  assert.equal(getFlag(catalog, "checkout-v2", "prod").enabled, false);
  assert.equal(getFlag(catalog, "checkout-v2", "staging").enabled, true);
  const incidents = listRecentIncidents(catalog, "checkout-api");
  assert.ok(incidents.some((i) => i.id === "INC-441"));
});

test("getters reject unknown ids", () => {
  const catalog = loadCatalog();
  assert.throws(() => getService(catalog, "nope"), CatalogError);
  assert.throws(() => getChange(catalog, "CHG-0000"), CatalogError);
  assert.throws(() => getFlag(catalog, "nope", "prod"), CatalogError);
});

test("listPendingChanges and getSlo are scoped", () => {
  const catalog = loadCatalog();
  const pending = listPendingChanges(catalog);
  assert.equal(pending.length, 3);
  const slos = getSlo(catalog, "payments-gateway");
  assert.ok(slos.every((s) => s.service === "payments-gateway"));
  assert.throws(() => getSlo(catalog, "missing"), CatalogError);
});

test("validateCatalog rejects a missing required change", () => {
  const catalog = loadCatalog();
  const broken = structuredClone(catalog) as Catalog;
  broken.changes = broken.changes.filter((c) => c.id !== "CHG-1042");
  assert.throws(() => validateCatalog(broken), /CHG-1042/);
});
