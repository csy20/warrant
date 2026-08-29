# Demo prompts

Start the MCP server (`npm start` or `./scripts/dev.sh`), then TrueForge (`npx @truefoundry/trueforge@latest`). Use the saved `warrant` agent.

## Headline (CHG-1042)

```
Clear CHG-1042 for production. Investigate first. Do not apply until I approve.
```

What a judge should see:

1. Read-only MCP calls (`get_change`, `get_service`, `get_flag`, `get_slo`, `list_recent_incidents`).
2. A sandbox script that prints blast radius / SLO headroom / INC-441.
3. A clearance brief that is cautious (prior canary rollback).
4. `apply_change` paused on Allow / Deny.
5. After Allow: `checkout-v2` in prod is enabled. After Deny: still off.

## Secondary

```
Should we deploy CHG-1043 given the payments SLO?
```

```
Clear CHG-1044. It is a scale-only change.
```
