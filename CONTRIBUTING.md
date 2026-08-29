# Contributing

Warrant is built the way the Q Branch track is judged: feature branches, pull requests, Qodo review, then a human merge. Direct pushes to `main` do not count as reviewed work.

## Workflow

1. Open or pick a GitHub issue.
2. Branch from the latest `main` (`feat/…`, `fix/…`, `chore/…`, `docs/…`, `ci/…`).
3. Keep the change scoped to that issue.
4. Open a pull request. Title = what changed. Description = what + why, with `Fixes #N` or `Refs #N`.
5. Wait for Qodo. Comment `/agentic_review` if it does not start.
6. Address High-severity findings, or dismiss them in the Qodo thread with a reason.
7. Push so the PR shows the resolved code and Qodo can review again.
8. A human merges.

## Local checks

```bash
npm test
npm run typecheck
```

Run those before you open the PR once `package.json` exists (PR 2 onward).

## What not to commit

- `HACKATHON.md` (local brief, gitignored)
- API keys, `.env` files, personal data
- TrueForge SQLite databases

## License

Contributions ship under the MIT license in `LICENSE`.
