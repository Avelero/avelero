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

## 2. Core Technologies

The project leverages a modern web development stack:

*   **Frameworks:** [Next.js](https://nextjs.org/) (for `app/` and `web/`), [tRPC](https://trpc.io/) (for API communication).
*   **Database:** [Drizzle ORM](https://orm.drizzle.team/) (with PostgreSQL/Supabase).
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [PostCSS](https://postcss.org/).
*   **Package Manager:** [Bun](https://bun.sh/).
*   **Monorepo Tooling:** [Turborepo](https://turbo.build/).
*   **Code Formatting & Linting:** [Biome](https://biomejs.dev/).
*   **Cloud Platform:** [Vercel](https://vercel.com/) (for frontend apps), [Fly.io](https://fly.io/) (for API).

## 3. Configuration Management

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

## 4. Development Workflow

*   **Installation:** Use `bun install` at the monorepo root.
*   **Development Server:** Use `turbo dev` to run all applications in development mode.
*   **Linting & Formatting:** `biome check .` and `biome format .` should be run regularly. These are enforced via pre-commit hooks or CI/CD.
*   **Testing:** (Further details to be added here once a comprehensive testing strategy is defined).

## 5. Testing Guidelines

A comprehensive testing strategy is crucial for monorepos.

*   **Unit Tests:** Should reside alongside the code they test (e.g., `src/__tests__/` or `src/*.test.ts`).
*   **Integration Tests:** For interactions between packages or services.
*   **End-to-End (E2E) Tests:** For critical user flows across applications.
*   **Frameworks:** (e.g., Jest, Vitest, Playwright - to be specified).

## 6. Deployment Overview

*   **Frontend Applications (`apps/app`, `apps/web`):** Deployed via Vercel, leveraging its integration with Next.js.
*   **Backend API (`apps/api`):** Deployed to Fly.io using Docker.
*   **Database:** Supabase.
