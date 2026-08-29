import assert from "node:assert/strict";
import { test } from "node:test";

import { CatalogError, loadCatalog } from "../mcp/src/catalog.ts";
import { CatalogStore } from "../mcp/src/store.ts";

test("apply_change mutates the flag and refuses a second apply", () => {
  const store = new CatalogStore(loadCatalog());
  assert.equal(store.getFlag("checkout-v2", "prod").enabled, false);

  const applied = store.applyChange("CHG-1042", "demo clearance");
  assert.equal(applied.status, "applied");
  assert.equal(store.getFlag("checkout-v2", "prod").enabled, true);
  assert.equal(store.getFlag("checkout-v2", "prod").rollout_pct, 100);

  assert.throws(
    () => store.applyChange("CHG-1042", "again"),
    /only pending changes can be applied/,
  );
});

test("rollback restores captured state", () => {
  const store = new CatalogStore(loadCatalog());
  store.applyChange("CHG-1044", "scale for campaign");
  assert.equal(store.getService("inventory-service").replicas, 12);

  const rolled = store.rollbackChange("CHG-1044", "campaign postponed");
  assert.equal(rolled.status, "rolled_back");
  assert.equal(store.getService("inventory-service").replicas, 4);

  assert.throws(
    () => store.rollbackChange("CHG-1044", "again"),
    /only applied changes can be rolled back/,
  );
});

test("apply and rollback require justification", () => {
  const store = new CatalogStore(loadCatalog());
  assert.throws(() => store.applyChange("CHG-1043", "  "), CatalogError);
  store.applyChange("CHG-1043", "roll 2.4.1");
  assert.equal(store.getService("payments-gateway").version, "2.4.1");
  assert.throws(() => store.rollbackChange("CHG-1043", ""), CatalogError);
  store.rollbackChange("CHG-1043", "SLO still under target");
  assert.equal(store.getService("payments-gateway").version, "2.3.8");
});

test("page_oncall records a page against a known service", () => {
  const store = new CatalogStore(loadCatalog());
  const page = store.pageOncall({
    service: "checkout-api",
    severity: "sev2",
    message: "checkout-v2 latency after apply",
  });
  assert.equal(page.id, "PAGE-001");
  assert.equal(store.snapshot().pages.length, 1);
  assert.throws(
    () =>
      store.pageOncall({
        service: "not-a-service",
        severity: "sev1",
        message: "nope",
      }),
    CatalogError,
  );
});
