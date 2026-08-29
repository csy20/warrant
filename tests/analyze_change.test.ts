import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog } from "../mcp/src/catalog.ts";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const script = join(root, "skills/change-clearance/scripts/analyze_change.py");

test("reference analyzer flags CHG-1042 as no-go", () => {
  const catalog = loadCatalog();
  const change = catalog.changes.find((c) => c.id === "CHG-1042");
  const service = catalog.services.find((s) => s.name === "checkout-api");
  assert.ok(change && service);
  const payload = {
    change,
    service,
    slos: catalog.slos.filter((s) => s.service === "checkout-api"),
    incidents: catalog.incidents.filter((i) => i.service === "checkout-api"),
    flag: catalog.flags.find(
      (f) => f.name === "checkout-v2" && f.environment === "prod",
    ),
  };
  const result = spawnSync("python3", [script], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CHG-1042/);
  assert.match(result.stdout, /NO-GO/);
  assert.match(result.stdout, /INC-441/);
});
