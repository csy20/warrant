# Agent notes for Warrant

This repository is a public hackathon submission. Coding agents may implement and open pull requests. **Humans merge.**

## Source of truth

If `HACKATHON.md` exists at the repo root, treat it as the constraint source for submission rules, TrueForge must-haves, and the Qodo review loop. That file is gitignored on purpose. Do not copy it into the public tree.

## Merge policy

- Never push commits to `main`.
- Every substantive change is a feature branch and a pull request.
- Wait for Qodo review on the PR. If it does not trigger, comment `/agentic_review`.
- Fix every valid High-severity finding. If a High finding is wrong, deferred, or intentional, dismiss it **in the Qodo thread with a stated reason**.
- Push the resolved state so Qodo can re-review the final code.
- A human merges after that loop. Agents must not merge, squash-merge over unresolved Highs, or force-push after review has started unless a human asks for a rebase.

## Product constraints

Warrant is a TrueForge agent. A stranger watching the demo must see:

1. A real MCP tool call against `warrant-catalog`.
2. Generated analysis running in the TrueForge sandbox.
3. A human Allow/Deny pause before `apply_change`, `rollback_change`, or `page_oncall`.

The catalog is fake Northline data. Do not connect real production systems or commit secrets.

## PR hygiene

- Title says what changed.
- Description says what and why, and links the issue.
- Keep the diff small enough to review in one sitting.
- Commit messages are imperative and specific (`feat: annotate apply_change as destructive`, not `updates`).
