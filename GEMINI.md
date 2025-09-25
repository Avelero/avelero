# Task Master AI - Agent Integration Guide
=======
# Gemini AI - Strict Project Guidelines and Integration Guide

## Strict Adherence Requirements

**CRITICAL:** As Gemini AI, you MUST strictly follow ALL guidelines in this document. Any deviation from the established coding style, architecture patterns, UI conventions, and processing methodologies is prohibited. Always reference this file before making any changes or suggestions.

- **Coding Style:** Adhere exactly to the TypeScript, JavaScript, and framework conventions outlined below. No exceptions.
- **Architecture:** Follow the monorepo structure, package boundaries, and design patterns precisely.
- **UI Style:** Use only the specified UI components, Tailwind classes, and design system elements.
- **Processing:** Implement data flow, API calls, and business logic according to the defined patterns.
- **Validation:** Before implementing, verify against existing codebase examples. If uncertain, ask for clarification rather than assume.

## Essential Commands

### Core Workflow Commands

```bash
# Project Setup
task-master init                                    # Initialize Task Master in current project
task-master parse-prd .taskmaster/docs/prd.txt      # Generate tasks from PRD document
task-master models --setup                        # Configure AI models interactively

# Daily Development Workflow
task-master list                                   # Show all tasks with status
task-master next                                   # Get next available task to work on
task-master show <id>                             # View detailed task information (e.g., task-master show 1.2)
task-master set-status --id=<id> --status=done    # Mark task complete

# Task Management
task-master add-task --prompt="description" --research        # Add new task with AI assistance
task-master expand --id=<id> --research --force              # Break task into subtasks
task-master update-task --id=<id> --prompt="changes"         # Update specific task
task-master update --from=<id> --prompt="changes"            # Update multiple tasks from ID onwards
task-master update-subtask --id=<id> --prompt="notes"        # Add implementation notes to subtask

# Analysis & Planning
task-master analyze-complexity --research          # Analyze task complexity
task-master complexity-report                      # View complexity analysis
task-master expand --all --research               # Expand all eligible tasks

# Dependencies & Organization
task-master add-dependency --id=<id> --depends-on=<id>       # Add task dependency
task-master move --from=<id> --to=<id>                       # Reorganize task hierarchy
task-master validate-dependencies                            # Check for dependency issues
task-master generate                                         # Update task markdown files (usually auto-called)
```

## Key Files & Project Structure

### Core Files

- `.taskmaster/tasks/tasks.json` - Main task data file (auto-managed)
- `.taskmaster/config.json` - AI model configuration (use `task-master models` to modify)
- `.taskmaster/docs/prd.txt` - Product Requirements Document for parsing
- `.taskmaster/tasks/*.txt` - Individual task files (auto-generated from tasks.json)
- `.env` - API keys for CLI usage

### Gemini CLI Integration Files

- `GEMINI.md` - Auto-loaded context for Gemini CLI (this file)
- `.gemini/settings.json` - Gemini CLI tool allowlist and preferences
- `.gemini/commands/` - Custom slash commands for repeated workflows
- `.mcp.json` - MCP server configuration (project-specific)

### Directory Structure

```
project/
├── .taskmaster/
│   ├── tasks/              # Task files directory
│   │   ├── tasks.json      # Main task database
│   │   ├── task-1.md      # Individual task files
│   │   └── task-2.md
│   ├── docs/              # Documentation directory
│   │   ├── prd.txt        # Product requirements
│   ├── reports/           # Analysis reports directory
│   │   └── task-complexity-report.json
│   ├── templates/         # Template files
│   │   └── example_prd.txt  # Example PRD template
│   └── config.json        # AI models & settings
├── .gemini/
│   ├── settings.json      # Gemini CLI configuration
│   └── commands/         # Custom slash commands
├── .env                  # API keys
├── .mcp.json            # MCP configuration
└── GEMINI.md            # This file - auto-loaded by Gemini CLI
```

## MCP Integration

Task Master provides an MCP server that Gemini CLI can connect to. Configure in `.mcp.json`:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "your_key_here",
        "PERPLEXITY_API_KEY": "your_key_here",
        "OPENAI_API_KEY": "OPENAI_API_KEY_HERE",
        "GOOGLE_API_KEY": "GOOGLE_API_KEY_HERE",
        "XAI_API_KEY": "XAI_API_KEY_HERE",
        "OPENROUTER_API_KEY": "OPENROUTER_API_KEY_HERE",
        "MISTRAL_API_KEY": "MISTRAL_API_KEY_HERE",
        "AZURE_OPENAI_API_KEY": "AZURE_OPENAI_API_KEY_HERE",
        "OLLAMA_API_KEY": "OLLAMA_API_KEY_HERE"
      }
    }
  }
}
```

### Essential MCP Tools

```javascript
help; // = shows available taskmaster commands
// Project setup
initialize_project; // = task-master init
parse_prd; // = task-master parse-prd

// Daily workflow
get_tasks; // = task-master list
next_task; // = task-master next
get_task; // = task-master show <id>
set_task_status; // = task-master set-status

// Task management
add_task; // = task-master add-task
expand_task; // = task-master expand
update_task; // = task-master update-task
update_subtask; // = task-master update-subtask
update; // = task-master update

// Analysis
analyze_project_complexity; // = task-master analyze-complexity
complexity_report; // = task-master complexity-report

// Playwright Testing Tools
run_e2e_tests; // = npx playwright test
run_e2e_tests --headed; // = npx playwright test --headed (run tests in browser)
run_e2e_tests --debug; // = npx playwright test --debug (debug mode)
run_e2e_tests --grep "test name"; // = npx playwright test --grep "test name"
generate_e2e_test; // = npx playwright codegen (generate test from browser actions)
show_test_report; // = npx playwright show-report (view test results)
install_browsers; // = npx playwright install (install browser binaries)
```

## Gemini CLI Workflow Integration

### Standard Development Workflow

#### 1. Project Initialization

```bash
# Initialize Task Master
task-master init

# Create or obtain PRD, then parse it
task-master parse-prd .taskmaster/docs/prd.txt

# Analyze complexity and expand tasks
task-master analyze-complexity --research
task-master expand --all --research
```

If tasks already exist, another PRD can be parsed (with new information only!) using parse-prd with --append flag. This will add the generated tasks to the existing list of tasks..

#### 2. Daily Development Loop

```bash
# Start each session
task-master next                           # Find next available task
task-master show <id>                     # Review task details

# During implementation, check in code context into the tasks and subtasks
task-master update-subtask --id=<id> --prompt="implementation notes..."

# Complete tasks
task-master set-status --id=<id> --status=done
```

#### 3. Multi-Gemini Workflows

For complex projects, use multiple Gemini CLI sessions:

```bash
# Terminal 1: Main implementation
cd project && gemini

# Terminal 2: Testing and validation
cd project-test-worktree && gemini

# Terminal 3: Documentation updates
cd project-docs-worktree && gemini
```

### Custom Slash Commands

Create `.gemini/commands/taskmaster-next.md`:

```markdown
Find the next available Task Master task and show its details.

Steps:

1. Run `task-master next` to get the next task
2. If a task is available, run `task-master show <id>` for full details
3. Provide a summary of what needs to be implemented
4. Suggest the first implementation step
```

Create `.gemini/commands/taskmaster-complete.md`:

```markdown
Complete a Task Master task: $ARGUMENTS

Steps:

1. Review the current task with `task-master show $ARGUMENTS`
2. Verify all implementation is complete
3. Run any tests related to this task
4. Mark as complete: `task-master set-status --id=$ARGUMENTS --status=done`
5. Show the next available task with `task-master next`
```

## Tool Allowlist Recommendations

Add to `.gemini/settings.json`:

```json
{
  "allowedTools": [
    "Edit",
    "Bash(task-master *)",
    "Bash(git commit:*)",
    "Bash(git add:*)",
    "Bash(npm run *)",
    "Bash(npx playwright *)",
    "Bash(bun run test:e2e)",
    "Bash(bun run test:unit)",
    "mcp__task_master_ai__*"
  ]
}
```

## Configuration & Setup

### API Keys Required

At least **one** of these API keys must be configured:

- `ANTHROPIC_API_KEY` (Claude models) - **Recommended**
- `PERPLEXITY_API_KEY` (Research features) - **Highly recommended**
- `OPENAI_API_KEY` (GPT models)
- `GOOGLE_API_KEY` (Gemini models)
- `MISTRAL_API_KEY` (Mistral models)
- `OPENROUTER_API_KEY` (Multiple models)
- `XAI_API_KEY` (Grok models)

An API key is required for any provider used across any of the 3 roles defined in the `models` command.

### Model Configuration

```bash
# Interactive setup (recommended)
task-master models --setup

# Set specific models
task-master models --set-main claude-3-5-sonnet-20241022
task-master models --set-research perplexity-llama-3.1-sonar-large-128k-online
task-master models --set-fallback gpt-4o-mini
```

## Task Structure & IDs

### Task ID Format

- Main tasks: `1`, `2`, `3`, etc.
- Subtasks: `1.1`, `1.2`, `2.1`, etc.
- Sub-subtasks: `1.1.1`, `1.1.2`, etc.

### Task Status Values

- `pending` - Ready to work on
- `in-progress` - Currently being worked on
- `done` - Completed and verified
- `deferred` - Postponed
- `cancelled` - No longer needed
- `blocked` - Waiting on external factors

### Task Fields

```json
{
  "id": "1.2",
  "title": "Implement user authentication",
  "description": "Set up JWT-based auth system",
  "status": "pending",
  "priority": "high",
  "dependencies": ["1.1"],
  "details": "Use bcrypt for hashing, JWT for tokens...",
  "testStrategy": "Unit tests for auth functions, integration tests for login flow",
  "subtasks": []
}
```

## Gemini CLI Best Practices with Task Master

### Context Management

- Use `/clear` between different tasks to maintain focus
- This GEMINI.md file is automatically loaded for context
- Use `task-master show <id>` to pull specific task context when needed

### Iterative Implementation

1. `task-master show <subtask-id>` - Understand requirements
2. Explore codebase and plan implementation
3. `task-master update-subtask --id=<id> --prompt="detailed plan"` - Log plan
4. `task-master set-status --id=<id> --status=in-progress` - Start work
5. Implement code following logged plan
6. Write/update unit tests for the implemented functionality
7. Run E2E tests with `npx playwright test` to verify end-to-end flows
8. `task-master update-subtask --id=<id> --prompt="what worked/didn't work"` - Log progress
9. `task-master set-status --id=<id> --status=done` - Complete task

### Complex Workflows with Checklists

For large migrations or multi-step processes:

1. Create a markdown PRD file describing the new changes: `touch task-migration-checklist.md` (prds can be .txt or .md)
2. Use Taskmaster to parse the new prd with `task-master parse-prd --append` (also available in MCP)
3. Use Taskmaster to expand the newly generated tasks into subtasks. Consdier using `analyze-complexity` with the correct --to and --from IDs (the new ids) to identify the ideal subtask amounts for each task. Then expand them.
4. Work through items systematically, checking them off as completed
5. Use `task-master update-subtask` to log progress on each task/subtask and/or updating/researching them before/during implementation if getting stuck
6. **CRITICAL:** Run comprehensive E2E tests with `npx playwright test` after each major change to ensure no regressions
7. Use `npx playwright test --grep "specific flow"` to test particular user journeys affected by changes

### Git Integration

Task Master works well with `gh` CLI:

```bash
# Create PR for completed task
gh pr create --title "Complete task 1.2: User authentication" --body "Implements JWT auth system as specified in task 1.2"

# Reference task in commits
git commit -m "feat: implement JWT auth (task 1.2)"
```

### Parallel Development with Git Worktrees

```bash
# Create worktrees for parallel task development
git worktree add ../project-auth feature/auth-system
git worktree add ../project-api feature/api-refactor

# Run Gemini CLI in each worktree
cd ../project-auth && gemini    # Terminal 1: Auth work
cd ../project-api && gemini     # Terminal 2: API work
```

## Troubleshooting

### AI Commands Failing

```bash
# Check API keys are configured
cat .env                           # For CLI usage

# Verify model configuration
task-master models

# Test with different model
task-master models --set-fallback gpt-4o-mini
```

### MCP Connection Issues

- Check `.mcp.json` configuration
- Verify Node.js installation
- Use `--mcp-debug` flag when starting Gemini CLI
- Use CLI as fallback if MCP unavailable

### Task File Sync Issues

```bash
# Regenerate task files from tasks.json
task-master generate

# Fix dependency issues
task-master fix-dependencies
```

DO NOT RE-INITIALIZE. That will not do anything beyond re-adding the same Taskmaster core files.

## Important Notes

### AI-Powered Operations

These commands make AI calls and may take up to a minute:

- `parse_prd` / `task-master parse-prd`
- `analyze_project_complexity` / `task-master analyze-complexity`
- `expand_task` / `task-master expand`
- `expand_all` / `task-master expand --all`
- `add_task` / `task-master add-task`
- `update` / `task-master update`
- `update_task` / `task-master update-task`
- `update_subtask` / `task-master update-subtask`

### File Management

- Never manually edit `tasks.json` - use commands instead
- Never manually edit `.taskmaster/config.json` - use `task-master models`
- Task markdown files in `tasks/` are auto-generated
- Run `task-master generate` after manual changes to tasks.json

### Gemini CLI Session Management

- Use `/clear` frequently to maintain focused context
- Create custom slash commands for repeated Task Master workflows
- Configure tool allowlist to streamline permissions
- Use headless mode for automation: `gemini -p "task-master next"`

### Multi-Task Updates

- Use `update --from=<id>` to update multiple future tasks
- Use `update-task --id=<id>` for single task updates
- Use `update-subtask --id=<id>` for implementation logging

### Research Mode

- Add `--research` flag for research-based AI enhancement
- Requires a research model API key like Perplexity (`PERPLEXITY_API_KEY`) in environment
- Provides more informed task creation and updates
- Recommended for complex technical tasks

## Final Enforcement Note

**ABSOLUTE REQUIREMENT:** As Gemini AI, you are contractually obligated to follow every guideline in this document without exception. Before any code generation, architectural decision, UI implementation, or data processing design:

1. **Review this document thoroughly**
2. **Check existing codebase for examples**
3. **Verify compliance with all standards**
4. **If uncertain, stop and seek clarification**

Failure to adhere will result in immediate rejection of all outputs. This ensures the project's integrity, maintainability, and consistency.

# Project Architecture and Conventions

This section outlines the architectural decisions, structural conventions, and best practices for the Avelero-Webversion monorepo. Adhering to these guidelines ensures consistency, maintainability, and scalability across the project.

## 1. Monorepo Structure

The project is organized as a monorepo using [Turborepo](https://turbo.build/) to manage multiple applications (`apps/`) and shared packages (`packages/`).

*   **`apps/`**: Contains independent applications that are deployed separately.
    *   `api/`: The backend API service.
    *   `app/`: The main web application (e.g., Next.js frontend).
    *   `web/`: Another web application (e.g., a marketing site or a different client).
*   **`packages/`**: Contains reusable code, components, and configurations shared across `apps/` and other `packages/`.
    *   `analytics/`: Shared analytics utilities.
    *   `db/`: Database client, schema definitions, and query utilities.
    *   `email/`: Email templating and sending utilities.
    *   `jobs/`: Background job definitions and triggers.
    *   `kv/`: Key-value store interactions.
    *   `location/`: Location-related data and utilities.
    *   `logger/`: Centralized logging utilities.
    *   `supabase/`: Supabase client, mutations, queries, types, and utilities.
    *   `tsconfig/`: Centralized TypeScript configurations (see below).
    *   `ui/`: Shared UI components and styling.
    *   `utils/`: General utility functions.

## 2. Strict Coding Standards

**MANDATORY:** All code MUST follow these exact standards. No deviations allowed.

_This guide ensures Claude Code has immediate access to Task Master's essential functionality for agentic development workflows._
=======
### TypeScript/JavaScript Conventions
- **Naming:** Use camelCase for variables/functions, PascalCase for classes/components/types, UPPER_SNAKE_CASE for constants.
- **File Structure:** One export per file where possible. Use `index.ts` for barrel exports.
- **Imports:** Group imports: React/Next, third-party libraries, internal packages, relative imports. Use absolute imports for packages.
- **Types:** Always use explicit types. Prefer interfaces over types for object shapes. Use `type` for unions/aliases.
- **Error Handling:** Use try/catch with specific error types. Never use generic `any` or `unknown` without justification.
- **Async/Await:** Always use async/await over Promises. Handle errors properly.

### React/Next.js Patterns
- **Components:** Use functional components with hooks. Name files as `ComponentName.tsx`.
- **Hooks:** Custom hooks in `hooks/` directory. Prefix with `use`.
- **Pages:** Use App Router. Server components by default, client components only when necessary.
- **API Routes:** Use tRPC procedures in `trpc/` directory. No REST endpoints.
- **Styling:** Tailwind CSS only. No CSS modules or styled-components.

### Database/ORM
- **Queries:** Use Drizzle ORM exclusively. Define schemas in `packages/db/src/schema/`.
- **Migrations:** Run via Supabase CLI. Never manual SQL.
- **Types:** Auto-generate from schema. Import from `packages/db`.

### Package Boundaries
- **Imports:** Never import from `apps/` into `packages/`. Keep packages independent.
- **Dependencies:** Add to appropriate `package.json`. Use workspace versions for internal packages.

## 3. UI/UX Design System

**MANDATORY:** All UI elements MUST use the established design system.

### Component Library
- **Base Components:** Use components from `packages/ui/src/`. Examples: Button, Input, Card.
- **Icons:** Use Lucide React icons. Import from `lucide-react`.
- **Layout:** Use Tailwind grid/flexbox. Avoid custom CSS.

### Styling Guidelines
- **Colors:** Use Tailwind color palette. Define custom colors in `tailwind.config.ts`.
- **Typography:** Use Tailwind text utilities. Consistent font sizes: text-sm, text-base, text-lg, etc.
- **Spacing:** Use Tailwind spacing scale: p-4, m-2, gap-3, etc.
- **Responsive:** Mobile-first approach. Use sm:, md:, lg: breakpoints.

### User Experience
- **Loading States:** Always show loading indicators for async operations.
- **Error States:** Display user-friendly error messages. Use toast notifications.
- **Accessibility:** ARIA labels, keyboard navigation, screen reader support.
- **Performance:** Lazy load components, optimize images, minimize bundle size.

## 4. Data Processing and API Patterns

**MANDATORY:** Follow exact data flow patterns.

### API Communication
- **tRPC:** All client-server communication via tRPC. Define procedures in `apps/api/src/trpc/`.
- **Validation:** Use Zod schemas for input validation. Share schemas between client/server.
- **Error Handling:** Standardized error responses. Use tRPC error codes.

### State Management
- **Local State:** React hooks (useState, useReducer).
- **Server State:** tRPC queries with React Query.
- **Global State:** Minimal. Use context only for theme/auth.

### Data Flow
- **Fetch:** Use tRPC queries for data fetching.
- **Mutations:** Use tRPC mutations for updates.
- **Caching:** React Query handles caching. Configure staleTime appropriately.
- **Optimistic Updates:** Implement for better UX on mutations.

## 5. Core Technologies

The project leverages a modern web development stack:

*   **Frameworks:** [Next.js](https://nextjs.org/) (for `app/` and `web/`), [tRPC](https://trpc.io/) (for API communication).
*   **Database:** [Drizzle ORM](https://orm.drizzle.team/) (with PostgreSQL/Supabase).
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [PostCSS](https://postcss.org/).
*   **Package Manager:** [Bun](https://bun.sh/).
*   **Monorepo Tooling:** [Turborepo](https://turbo.build/).
*   **Code Formatting & Linting:** [Biome](https://biomejs.dev/).
*   **Testing:** [Playwright](https://playwright.dev/) for E2E tests, Jest/Vitest for unit tests.
*   **Cloud Platform:** [Vercel](https://vercel.com/) (for frontend apps), [Fly.io](https://fly.io/) (for API).

## 6. Configuration Management

### TypeScript Configurations

**CRITICAL IMPROVEMENT:** The project must consolidate TypeScript configurations. The existence of both `packages/tsconfig/` and `tooling/typescript/` is redundant and confusing.

*   **Strategy:** `packages/tsconfig/` will be the *single source of truth* for all TypeScript configurations.
    *   `base.json`: Provides foundational TypeScript settings for all packages and applications.
    *   `nextjs.json`: Extends `base.json` with Next.js specific configurations.
    *   `react-library.json`: Extends `base.json` with React library specific configurations.
    *   `api.json`: Extends `base.json` with API specific configurations.
*   **Usage:** Every `tsconfig.json` in `apps/` and `packages/` *must* extend from one of these centralized configurations.
*   **Action:** Remove `tooling/typescript/` and ensure all projects correctly extend from `packages/tsconfig/`.

### Shared Styling Configurations (Tailwind CSS & PostCSS)

*   **Strategy:** Centralize base `tailwind.config.ts` and `postcss.config.mjs` in a shared package (e.g., `packages/ui` or a new `packages/config`).
*   **Usage:** Applications (`apps/app`, `apps/web`) and other UI-related packages (`packages/ui`) should extend these base configurations to maintain consistency while allowing for app-specific overrides.

### Environment Variable Management

*   **Strategy:** Implement a shared environment variable package (e.g., `packages/env` or within `packages/utils`) that defines and validates environment variables.
*   **Usage:** All applications and packages requiring environment variables will import and use this shared package, ensuring type safety and consistency. This reduces duplication of `.env.example` files and prevents runtime errors due to missing or incorrectly typed variables.

## 7. Development Workflow

*   **Installation:** Use `bun install` at the monorepo root.
*   **Development Server:** Use `turbo dev` to run all applications in development mode.
*   **Linting & Formatting:** `biome check .` and `biome format .` should be run regularly. These are enforced via pre-commit hooks or CI/CD.
*   **Testing:** 
    - **Unit Tests:** `bun run test:unit` or `npm run test:unit`
    - **E2E Tests:** `bun run test:e2e` or `npx playwright test`
    - **Test Generation:** `npx playwright codegen` to record browser actions
    - **Test Debugging:** `npx playwright test --debug` for step-by-step debugging
*   **Browser Installation:** Run `npx playwright install` after first setup.

## 8. Testing Guidelines

A comprehensive testing strategy is crucial for monorepos.

*   **Unit Tests:** Should reside alongside the code they test (e.g., `src/__tests__/` or `src/*.test.ts`).
*   **Integration Tests:** For interactions between packages or services.
*   **End-to-End (E2E) Tests:** For critical user flows across applications using Playwright.
*   **Frameworks:** Jest/Vitest for unit tests, Playwright for E2E tests.

### Playwright E2E Testing

**MANDATORY:** All E2E tests MUST use Playwright following these exact patterns.

#### Test Structure
- **Location:** Tests in `apps/app/e2e/` or `apps/web/e2e/` for respective applications.
- **File Naming:** `*.spec.ts` (e.g., `auth.spec.ts`, `checkout.spec.ts`).
- **Test Organization:** Group related tests in describe blocks with clear naming.

#### Test Patterns
```typescript
// Example test structure
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'invalid@example.com');
    await page.fill('[data-testid="password"]', 'wrong');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });
});
```

#### Best Practices
- **Data Attributes:** Use `data-testid` attributes for element selection (never CSS classes).
- **Page Objects:** Create page object classes for complex pages in `e2e/pages/`.
- **Test Data:** Use fixtures for test data, avoid hardcoded values.
- **Assertions:** Use Playwright's expect API with descriptive messages.
- **Parallel Execution:** Tests run in parallel by default for speed.
- **Visual Testing:** Use `toHaveScreenshot()` for visual regression tests.

#### Configuration
- **playwright.config.ts:** Configure browsers, base URL, and test settings.
- **Browsers:** Test on Chromium, Firefox, and WebKit.
- **Base URL:** Set to local development server or staging environment.

#### CI/CD Integration
- **Commands:** `npx playwright test` for all tests, `npx playwright test --project=chromium` for specific browser.
- **Artifacts:** Screenshots and videos automatically captured on failures.
- **Reporting:** HTML reports generated with `npx playwright show-report`.

## 9. Deployment Overview

*   **Frontend Applications (`apps/app`, `apps/web`):** Deployed via Vercel, leveraging its integration with Next.js.
*   **Backend API (`apps/api`):** Deployed to Fly.io using Docker.
*   **Database:** Supabase.
