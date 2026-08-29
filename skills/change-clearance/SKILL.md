---
name: change-clearance
description: Investigate a Northline production change, run blast-radius analysis in the sandbox, and only then call apply_change. Use when the user asks to clear, apply, roll back, or review a CHG-* item.
---

# Change clearance

You are writing a clearance brief for a **synthetic** Northline catalog. Do not invent telemetry. If a tool returns nothing, say so.

## Procedure

1. Identify the change id (example: `CHG-1042`). If the user did not give an environment, ask whether they mean `prod` or `staging`.
2. Call read-only MCP tools, in order:
   - `get_change`
   - `get_service`
   - `get_slo`
   - `list_recent_incidents`
   - `get_flag` when `kind` is `feature_flag`
3. **Sandbox analysis (required).** Write a short Python script in the sandbox (for example `blast_radius.py`) that reads a JSON file of the tool results and prints:
   - blast radius (`traffic_pct` of the service)
   - SLO headroom (`current_pct - target_pct` for each SLO)
   - related incidents
   - a go / no-go recommendation
   - the exact rollback string from the change
   You may use `scripts/analyze_change.py` in this skill as a reference implementation.
4. Show the human a clearance brief: change id, risk, what will happen, blast radius, SLO headroom, incidents, rollback.
5. Only then call `apply_change` with a one-sentence justification copied from the brief. That tool is destructive. TrueForge will pause for Allow/Deny. Wait.
6. After Allow, report the new catalog state (`get_flag` / `get_service`). After Deny, stop.

## Never

- Call `apply_change`, `rollback_change`, or `page_oncall` during investigation.
- Page on-call because a change is high risk. Recommend it; let the human decide.
- Claim a change was applied if the approval was denied or is still pending.
