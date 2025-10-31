# Repository Guidelines

## Project Overview & Architecture
- Avelero is a SaaS monorepo managed by Turborepo on Bun 1.2.21 with strict TypeScript configuration and Biome for lint/format. Core apps live in `apps/`: `api` (Hono + tRPC server), `app` (Next.js 15 SaaS UI), `web` (marketing site). Shared domain logic sits in `packages/` (analytics, db, email, jobs, kv, location, logger, supabase, ui, utils) and global types in `types/`. Cross-workspace configs live in `tooling/`.
- Frontend stack: Next.js 15 with Server Components by default, TailwindCSS theming, Shadcn UI, nuqs for type-safe search params, next-themes, next-international. Backend integrations: Supabase Auth/DB/Storage, Upstash Redis, Trigger.dev, React Email + Resend, OpenPanel analytics, Dub link sharing.
- Place pure logic in `lib/`, data access in `services/`, UI pieces under `components/`. Maintain local assets within each app’s `public/` or package-specific directories. `.taskmaster/` stores Taskmaster metadata; `.cursor/` and `.claude/` contain agent guidance and must be kept synchronized.

## Environment & Configuration
- Each app owns its `.env` (`apps/api/.env`, `apps/app/.env`, `apps/web/.env`); mirror required GitHub Action secrets (Supabase URL/anon key, etc.). Never commit secrets. Supabase migrations/config live within `packages/db`.
- Model and provider configuration for Taskmaster resides in `.taskmaster/config.json`; API keys belong in project `.env` or `.cursor/mcp.json` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `PERPLEXITY_API_KEY`, `AZURE_OPENAI_API_KEY` + endpoint, `OPENROUTER_API_KEY`, `XAI_API_KEY`, `OLLAMA_API_KEY` + base URL).
- Docker support exists via `.dockerignore`; Vercel handles deployment. Maintain health endpoint `/health` and ensure environment parity via `npm ci` or `bun install`.

## Development Workflow & Commands
- Primary scripts (`package.json`): `bun dev`, `bun dev:app`, `bun dev:web`, `bun dev:api`, `bun dev:jobs`, `bun build`, `bun build:app`, `bun test`, `bun lint`, `bun format`, `bun typecheck`, `bun migrate`, `bun seed`. Prefer `rg` for search; avoid `git reset --hard`/destructive commands.
- Follow the documented Taskmaster cycle: `task-master list` → `next` → `show <id>` → `expand` → implement → `update-subtask` → `set-status`. Tagged contexts (`task-master add-tag --from-branch`, `use-tag`, `copy-tag`, `delete-tag`) isolate parallel efforts. Always log detailed implementation plans before coding and append updates capturing what worked/failed.
- Utilize Taskmaster workflows (`workflows/smart-flow`, `workflows/pipeline`, `workflows/auto-implement`) when helpful. After completion, sync changes, update task statuses, and document new patterns in Cursor rules.

## Coding Standards & Naming Conventions
- TypeScript strictness is mandatory: forbid `any`, prefer `unknown` + type guards, supply explicit return types for exported/public functions, avoid non-null assertions, handle null/undefined/empty arrays, and import types with `import type`. Keep functions single-responsibility, limit parameters via object args, eliminate deep nesting via early returns, and prioritize clarity over cleverness.
- React hooks rules (critical for CI): import every hook used, declare dependencies completely, wrap arrays/objects in `useMemo`, define functions before referencing them in dependency arrays to avoid hoisting errors, and only apply `eslint-disable` with justification when a reference is proven stable. Keep components focused and reuse custom hooks for shared logic.
- Enforce KISS/DRY/YAGNI: reuse existing packages, utilities, and components before adding new ones. Maintain descriptive naming (boolean prefixes `is/has/should`, consistent function/component names) and stable logging via structured utilities—never `console.log` or emojis in code/comments/UI strings. Store business logic in tRPC procedures with Zod validation; place side-effect-free helpers in shared packages.
- Performance: favor memoization for expensive computations, guard asynchronous flows with typed errors, and document side effects. Keep server/client component boundaries explicit; default to Server Components and add `'use client'` only when required.

## Documentation, Rule Maintenance & Collaboration
- JSDoc is required for exported functions, classes, components, hooks, context providers, APIs, complex types, and business-critical utilities. Lead with a one-line summary, explain intent, detail parameters/returns/side effects, and include examples for non-trivial behavior. Avoid redundant or obvious documentation.
- Keep `claude.md`, `.claude/commands`, `.claude/IMPROVEMENTS_SUMMARY.md`, and `.cursor/rules/*.mdc` synchronized with evolving patterns. Cursor rule formatting: front matter (`description`, `globs`, `alwaysApply`), bolded main points, code samples, file references (`[file](mdc:path)`), and actionable guidance. Update or deprecate rules when patterns change, add references to actual code, and remove outdated instructions.
- When new patterns emerge (≥3 occurrences, repeated review feedback, recurring bugs), add or refine rules per `.cursor/rules/self_improve.mdc`. Cross-reference related rules to avoid duplication. Sync Taskmaster documentation and log new best practices after significant features.

## Testing Strategy & Coverage
- Tests run with Jest via Bun. Co-locate `*.test.ts` / `*.test.tsx` alongside source files; integration-style tests are encouraged for stateful logic. Maintain ≥90 % coverage for new features and ensure Supabase or external service mocks align with fixtures under `packages/*/tests`.
- Validate RBAC, middleware, and security-sensitive flows thoroughly. Document complex scenarios with concise comments and update tests when business rules shift. Run `bun test` (or scoped scripts) locally before pushing.

## Quality Gates & CI/CD Expectations
- Mandatory pre-commit suite: `npm run type-check`, `npm run lint`, `npm run format:check`, `npm run security-audit`, `npm run check-deps`, plus relevant `npm run test:unit`. CI enforces zero TypeScript errors, zero ESLint warnings (`--max-warnings 0`), Prettier compliance, no vulnerabilities (moderate+), and zero circular dependencies.
- Auto-fix workflow: `npm run lint:fix`, `npm run format`, `npm audit fix` ( escalate with `--force` only when necessary and retest), then rerun the full suite. Report status using the standardized success (`✅ PRE-COMMIT CHECKS PASSED` / `✅ AUTO-FIX COMPLETE`) or failure (`❌ PRE-COMMIT CHECKS FAILED` / `⚠️ AUTO-FIX PARTIAL`) templates, listing file-specific issues and next steps.
- Troubleshoot CI with GitHub CLI (`gh run list`, `gh run view --log-failed`, `gh run rerun`). Reproduce failures locally, fix root causes (hook deps, missing imports, hoisting errors, formatting, security), and verify with combined command execution. For persistent issues, create a clean branch (`git checkout -b fix/ci-issues`), run cleanup scripts, and recommit.
- Prevention checklist (from `.claude/IMPROVEMENTS_SUMMARY.md`): run the full suite before any commit, resolve warnings immediately, align with documented React hook practices, update dependencies regularly, and use `/pre-commit`, `/fix-quality`, `/pro-mode`, `/ci-troubleshoot` Taskmaster shortcuts when collaborating via agents.

## Taskmaster & Agent Operations
- Apply the default loop (list → next → show → expand → implement → update-subtask → set-status) within the active tag (`master` by default). Create tags matching Git branches for multi-context work (`add-tag --from-branch`, `use-tag`, `copy-tag`, `rename-tag`, `delete-tag`) to prevent merge conflicts in `tasks.json`.
- When expanding tasks, provide detailed implementation plans summarizing files, diffs, risks, and follow-up questions. Update subtasks iteratively, capturing what worked and failed, code references, and decisions. Review existing logs before appending new updates to avoid redundancy.
- Use command families in `.claude/commands/tm/*` for listing, showing, expanding, adding/removing tasks/subtasks/dependencies, analyzing complexity, syncing README, and managing workflows. Always keep Taskmaster state aligned with actual progress and document any deviations or new insights in subtasks and rules.

## Commit & Pull Request Process
- Follow conventional commit prefixes (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`, etc.) scoped to a single concern. Include rule updates or documentation changes in the same commit when directly related.
- Before raising a PR, confirm the full pre-commit suite passes and note commands executed. PR descriptions must cover intent, implementation summary, risk areas, screenshots for UI changes, linked issues or Taskmaster task IDs, and any follow-up tasks. Call out architectural implications or required environment updates explicitly.
- Reviewers expect strict adherence to project checklists (no `any`, explicit returns, single responsibility, reused utilities). Highlight testing gaps or residual risks when merging.

## Deployment & Operational Notes
- Deploy Next.js apps through Vercel; maintain `.vercel` configs as needed. Ensure Docker builds respect `.dockerignore`. Keep Supabase migrations synchronized with production; run `bun migrate` before deploying backend changes.
- Monitor trigger jobs (Trigger.dev), Redis usage (Upstash), and Resend email templates within `packages/jobs` and `packages/email`. Verify analytics integration (OpenPanel) and link sharing (Dub) remain configured during environment updates.
- Health checks (`/health`) and structured logging are required for observability. Keep security audits clean and dependencies patched; escalate critical vulnerabilities immediately.

## Reference Directory
- `claude.md` – comprehensive project background, architecture, tech stack, coding standards, testing, deployment, and current focus areas.
- `.claude/IMPROVEMENTS_SUMMARY.md` – CI remediation lessons, prevention checklist, and documentation updates.
- `.claude/commands/*` – operational guides for quality checks, auto-fixes, CI troubleshooting, Taskmaster slash commands, pre-commit workflow, professional mode expectations, and TypeScript strict mode assistance.
- `.cursor/rules/*.mdc` – rule authoring standards (`cursor_rules.mdc`), continuous improvement guidance (`self_improve.mdc`), Taskmaster workflows (`taskmaster/*.mdc`), and TypeScript coding mandates (`typescript.mdc`). Consult and update these files whenever new patterns emerge.
