@C:\Users\domin\.codex\RTK.md

# CashQuote Agent Notes

- Read `REPO_BRIEF.md` first for durable repo context.
- Keep changes scoped to the npm workspace monorepo: `client`, `server`, `packages/db`, `packages/shared`, `tests`, `scripts`, and docs.
- Preserve tenant isolation, production env fail-closed behavior, Prisma migrations, and private-pilot boundaries.
- Do not edit generated output, dependency folders, local secrets, or Serena/Obsidian cache/state unless the task is specifically about tooling setup.
