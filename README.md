# Warrant

Warrant is a **production change-control agent** that runs on [TrueForge](https://trueforge.dev). A human asks it to clear a pending change on a synthetic checkout company (**Northline**). The agent looks the change up through a real MCP server, writes blast-radius analysis in the TrueForge sandbox, and **stops on Allow/Deny** before `apply_change`, `rollback_change`, or `page_oncall`.

Nothing in this catalog is a real production system. There are no API keys in the repo.

Built for [The Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge) (Q Branch: code-quality process).

## What the judge should see

Prompt:

```
Clear CHG-1042 for production. Investigate first. Do not apply until I approve.
```

1. **Real tools** — MCP calls to `warrant-catalog` (`get_change`, `get_service`, `get_flag`, `get_slo`, `list_recent_incidents`).
2. **Sandboxed code** — the `change-clearance` skill makes the agent write/run a blast-radius script. CHG-1042 should come back **NO-GO** until a human accepts residual risk (prior canary `INC-441`).
3. **Approval pause** — `apply_change` is annotated destructive and listed in `require_approval_for_tools`. TrueForge must show Allow / Deny. Deny leaves `checkout-v2` off.

## Prerequisites

- Node.js 22.14 or newer
- A model API key you will paste **only** into TrueForge Settings → Models (never into this repo)
- Optional but required for the skill/sandbox path: a [Daytona](https://www.daytona.io) API key (TrueForge's documented sandbox provider)

## Run it

Until the stacked PRs are merged to `main` (Qodo first), the GitHub default branch is the working tip (`fix/harden-mcp`). Clone as usual:

```bash
git clone https://github.com/csy20/warrant.git
cd warrant
npm install
npm test
npm run smoke
npm start
```

`npm run smoke` drives the MCP the way TrueForge will: read CHG-1042, run the sandbox analyzer (expects **NO-GO**), apply, confirm `checkout-v2` flipped, roll back. No model key required.

Health check: `http://127.0.0.1:8765/health`  
MCP: `http://127.0.0.1:8765/mcp`

### 2. TrueForge

In another terminal:

```bash
npx @truefoundry/trueforge@latest
```

Open [http://localhost:8790](http://localhost:8790).

### 3. Wire the harness

1. **Settings → Models** — configure any provider and paste your key.
2. **Settings → Connectors → Add MCP Server**
   - Name: `warrant-catalog` (must match `agent.json`)
   - Transport: streamable HTTP
   - URL: `http://127.0.0.1:8765/mcp`
   - Auth: none
3. **Settings → Skills → Import from GitHub**
   - Repository: `https://github.com/csy20/warrant`
   - Path: `skills/change-clearance`
   - Ref: `fix/harden-mcp` (use `main` after those PRs merge)
   - Name: `change-clearance`
4. **Settings → Sandbox providers** — configure Daytona, then enable sandbox on the agent.
5. Create the agent from [`agent.json`](./agent.json):
   - Replace `REPLACE_WITH_YOUR_MODEL` with a model FQN from Settings → Models (example: `openai/gpt-4.1`).
   - Paste the spec in the UI, or `POST /api/v1/agents` with `{ "name": "warrant", "manifest": <agent.json> }`.

### 4. Demo

Use the prompts in [`docs/demo.md`](./docs/demo.md). Headline change is **CHG-1042**.

## How it uses TrueForge

| Must-have | Where it lives |
|---|---|
| Real tool calls | Custom MCP `warrant-catalog` (`mcp/`). Read tools are `readOnlyHint`. |
| Sandboxed generated code | Skill `skills/change-clearance` (git-backed `SKILL.md`). Requires `config.sandbox.enabled`. |
| Human approval | MCP annotations `destructiveHint: true` on write tools **and** `require_approval_for_tools` in `agent.json`. |

TrueForge owns the agent loop, model, sandbox, and Allow/Deny UI. This repo ships the catalog, the MCP, the skill, and the review trail.

Destructive tools (must pause):

- `apply_change`
- `rollback_change`
- `page_oncall`

Demo catalog (all fake):

| Change | Risk | What it would do |
|---|---|---|
| CHG-1042 | high | Enable `checkout-v2` in prod at 100% |
| CHG-1043 | medium | Deploy `payments-gateway` 2.4.1 |
| CHG-1044 | low | Scale `inventory-service` to 12 replicas |

State lives in the MCP process memory. Restarting `npm start` resets the catalog.

## Tests

```bash
npm test
npm run typecheck
npm run smoke
```

CI runs both on every pull request (Node 22, Python 3.12 for the reference analyzer).

## Engineering process

No direct pushes to `main`. Every substantive change is a pull request. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`AGENTS.md`](./AGENTS.md).

Stacked work:

1. [#1](https://github.com/csy20/warrant/pull/1) repo hygiene
2. [#7](https://github.com/csy20/warrant/pull/7) Northline fixtures
3. [#8](https://github.com/csy20/warrant/pull/8) MCP server (representative product PR)
4. [#9](https://github.com/csy20/warrant/pull/9) agent spec + skill
5. [#10](https://github.com/csy20/warrant/pull/10) CI
6. [#11](https://github.com/csy20/warrant/pull/11) README
7. [#13](https://github.com/csy20/warrant/pull/13) hardening + `npm run smoke`

## Qodo Code Review Evidence

Install Qodo on this repo before merging (GitHub App via [app.qodo.ai](https://app.qodo.ai/signin) → Integrations → SaaS → GitHub). If a PR is silent, comment `/agentic_review`.

**Representative PR:** [feat: warrant-catalog MCP with annotated destructive tools](https://github.com/csy20/warrant/pull/8)

This section is completed **after** Qodo reviews that PR and we either fix High-severity findings or dismiss them in the Qodo thread with a stated reason, then push so Qodo re-reviews the final code. Until that loop runs, do not merge `#8`.

After the loop:

- What Qodo flagged: _fill in_
- What we did (fixed vs dismissed + why): _fill in_
- Follow-up review on the final commit of `#8`: _link_

## AI assistance

Implementation was pair-programmed with Grok (xAI) under [`AGENTS.md`](./AGENTS.md): feature branches, Qodo before merge, humans merge. Catalog copy, tool annotations, tests, and the skill procedure were specified and checked by the author.

## License

MIT. See [`LICENSE`](./LICENSE).
