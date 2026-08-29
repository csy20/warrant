#!/usr/bin/env python3
"""Reference clearance analysis. The agent may copy this pattern in the sandbox.

Reads a JSON object from a file path (argv[1]) or stdin with keys:
  change, service, slos, incidents, flag (optional)

Prints a text brief. This catalog is synthetic demo data.
"""

from __future__ import annotations

import json
import sys
from typing import Any


def headroom(slo: dict[str, Any]) -> float:
    return float(slo["current_pct"]) - float(slo["target_pct"])


def main() -> int:
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding="utf-8") as handle:
            data = json.load(handle)
    else:
        data = json.load(sys.stdin)

    change = data["change"]
    service = data["service"]
    slos = data.get("slos") or []
    incidents = data.get("incidents") or []
    flag = data.get("flag")

    traffic = float(service.get("traffic_pct") or 0)
    worst_slo = min(slos, key=headroom) if slos else None
    open_incidents = [i for i in incidents if i.get("resolved_at") is None]
    risk = change.get("risk", "unknown")

    nogo_reasons: list[str] = []
    if risk == "high" and traffic >= 30:
        nogo_reasons.append(
            f"high-risk change on a service that carries {traffic:.0f}% of Northline traffic"
        )
    if worst_slo is not None and headroom(worst_slo) < 0:
        nogo_reasons.append(
            f"SLO {worst_slo['name']} is {headroom(worst_slo):.2f}pt under target"
        )
    if open_incidents:
        nogo_reasons.append("unresolved incidents on this service")

    related = [
        i
        for i in incidents
        if "checkout-v2" in (i.get("summary") or "")
        or change.get("id", "") in (i.get("summary") or "")
    ]
    if change.get("id") == "CHG-1042" and any(i.get("id") == "INC-441" for i in incidents):
        nogo_reasons.append("prior prod canary INC-441 was rolled back")

    verdict = "NO-GO until a human accepts the residual risk" if nogo_reasons else "GO with rollback ready"

    print(f"# Clearance brief {change.get('id')}")
    print()
    print(f"Title: {change.get('title')}")
    print(f"Service: {service.get('name')} ({traffic:.0f}% of traffic, version {service.get('version')})")
    print(f"Environment: {change.get('environment')}  Risk: {risk}  Status: {change.get('status')}")
    if flag is not None:
        print(
            f"Flag {flag.get('name')} in {flag.get('environment')}: "
            f"enabled={flag.get('enabled')} rollout={flag.get('rollout_pct')}%"
        )
    print()
    print("SLO headroom:")
    for slo in slos:
        print(f"  - {slo['name']}: {headroom(slo):+.2f}pt ({slo['current_pct']} vs {slo['target_pct']}, {slo['window']})")
    if not slos:
        print("  - none returned")
    print()
    print("Incidents:")
    for incident in incidents:
        print(f"  - {incident['id']} {incident['severity']}: {incident['summary']}")
    if not incidents:
        print("  - none returned")
    if related:
        print(f"Related to this change: {', '.join(i['id'] for i in related)}")
    print()
    print(f"Rollback: {change.get('rollback')}")
    print(f"Verdict: {verdict}")
    if nogo_reasons:
        print("Reasons:")
        for reason in nogo_reasons:
            print(f"  - {reason}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
