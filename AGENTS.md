# Repository Guidelines

## Project Structure & Module Organization
- `src/index.ts` is the CLI entry (commander + interactive menu).
- `src/cli-commands/` wires CLI flags to command handlers; `src/commands/` contains the interactive workflows.
- `src/utils/` holds shared helpers (SSH config edits, storage, logging).
- `src/transfer/` implements the Synergy web server; static assets live in `src/transfer/public/`.
- `tests/` contains unit tests using `bun:test`.
- `scripts/` provides install/uninstall helpers; `assets/` hosts README imagery; `dist/` is build output.

## Build, Test, and Development Commands
- `bun install` installs dependencies for development.
- `bun run build` bundles `src/index.ts` to `dist/` and copies `src/transfer/public/*` to `dist/public/`.
- `bun test` runs the `bun:test` suite in `tests/`.
- `bun run src/index.ts` runs the CLI directly in dev; after building, `node dist/index.js` mirrors the published binary.

## Coding Style & Naming Conventions
- TypeScript + ES modules (`type: module`). Keep imports explicit and ordered by module locality.
- Indentation is 4 spaces in existing sources; keep it consistent.
- Use camelCase for functions/variables, PascalCase for types/interfaces, and kebab-case for directories like `cli-commands/`.
- Prettier is available (`bunx prettier -w <file>`). No lint config is currently enforced.

## Testing Guidelines
- Tests use `bun:test` with `describe/test/expect` and `mock` utilities.
- Name tests as `tests/*.test.ts` (for example, `tests/sshConfig.test.ts`).
- There is no explicit coverage gate; focus on core utilities and filesystem/SSH config logic.

## Commit & Pull Request Guidelines
- Recent history favors Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Follow that style for new work.
- PRs should include a short summary, test steps (`bun test`, `bun run build`), and note any SSH config or filesystem impacts.
- If the Synergy UI changes, include screenshots or a short GIF.

## Security & Configuration Tips
- The app reads `~/.ssh/config` and stores metadata in `~/.sship/servers.json` with logs under `~/.sship/logs`.
- Never commit real keys or private host data; update docs/tests when behavior touches these paths.
