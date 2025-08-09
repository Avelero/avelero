# Monorepo Organization Structure

```
avelero-v2/
├── apps/
│   ├── app/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── actions/
│   │   │   │   ├── [domain]/
│   │   │   │   └── safe-action.ts
│   │   │   ├── app/
│   │   │   │   ├── [locale]/
│   │   │   │   │   ├── (dashboard)/
│   │   │   │   │   │   └── [feature]/
│   │   │   │   │   ├── (public)/
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── api/
│   │   │   │   └── global-error.tsx
│   │   │   ├── components/
│   │   │   │   ├── [feature]/
│   │   │   │   ├── tables/
│   │   │   │   ├── modals/
│   │   │   │   ├── sheets/
│   │   │   │   └── widgets/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── store/
│   │   │   ├── utils/
│   │   │   ├── locales/
│   │   │   ├── env.mjs
│   │   │   ├── instrumentation.ts
│   │   │   └── middleware.ts
│   │   ├── next.config.mjs
│   │   ├── postcss.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── sentry.client.config.ts
│   │   ├── sentry.edge.config.ts
│   │   ├── sentry.server.config.ts
│   │   └── package.json
│   ├── api/
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── queries/
│   │   │   │   ├── schema.ts
│   │   │   │   └── index.ts
│   │   │   ├── rest/
│   │   │   │   ├── routers/
│   │   │   │   └── middleware/
│   │   │   ├── trpc/
│   │   │   │   ├── routers/
│   │   │   │   └── middleware/
│   │   │   ├── schemas/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   ├── supabase/
│   │   │   ├── functions/
│   │   │   ├── migrations/
│   │   │   ├── config.toml
│   │   │   └── seed.sql
│   │   └── package.json
│   └── web/
│       ├── public/
│       ├── src/
│       │   ├── actions/
│       │   ├── app/
│       │   ├── components/
│       │   ├── fonts/
│       │   └── lib/
│       ├── next.config.mjs
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── ui/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── utils/
│   │   │   └── globals.css
│   │   └── package.json
│   ├── supabase/
│   │   ├── src/
│   │   │   ├── clients/
│   │   │   ├── queries/
│   │   │   ├── mutations/
│   │   │   └── types/
│   │   └── package.json
│   ├── analytics/
│   │   ├── src/
│   │   └── package.json
│   ├── email/
│   │   ├── components/
│   │   ├── emails/
│   │   └── package.json
│   ├── jobs/
│   │   ├── trigger/
│   │   ├── trigger.config.ts
│   │   └── package.json
│   ├── kv/
│   │   ├── src/
│   │   └── package.json
│   └── logger/
│       ├── src/
│       └── package.json
├── tooling/
│   └── typescript/
│       ├── base.json
│       ├── nextjs.json
│       ├── react-library.json
│       └── package.json
├── .github/
├── .vscode/
├── llm_context/
├── package.json
├── turbo.json
├── biome.json
├── tsconfig.json
├── bun.lockb
├── .gitignore
├── .cursorrules
├── LICENSE.md
└── README.md
```

## Folder Descriptions

### `apps/`
Main applications of the monorepo, each independently deployable.

#### `apps/app/`
Primary dashboard application built with Next.js App Router.

- `public/` - Static assets (images, favicon, etc.)
- `src/actions/` - Server Actions organized by domain/feature with safe-action wrapper
- `src/app/[locale]/(dashboard)/` - Main authenticated app pages with dashboard layout
- `src/app/[locale]/(public)/` - Public pages (login, signup, etc.)
- `src/app/api/` - Next.js API routes
- `src/app/global-error.tsx` - Global error boundary
- `src/components/` - UI components organized by feature or type
- `src/hooks/` - Custom React hooks (to be implemented)
- `src/lib/` - Library configurations and setup
- `src/store/` - Client-side state management (to be implemented)
- `src/utils/` - Utility functions specific to the app (to be implemented)
- `src/locales/` - Internationalization files
- `src/env.mjs` - Environment variable validation
- `src/instrumentation.ts` - Sentry instrumentation
- `src/middleware.ts` - Next.js middleware for auth and i18n
- Configuration files: `next.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, Sentry configs

#### `apps/api/`
Backend API server currently implemented as Supabase configuration.

- `supabase/` - Supabase project configuration
  - `functions/` - Supabase Edge Functions
  - `migrations/` - Database migration files
  - `config.toml` - Supabase project configuration
  - `seed.sql` - Database seed data
- Future expansion: REST/tRPC endpoints, database queries, validation schemas

#### `apps/web/`
Marketing/public website for SEO and static content.

- `public/` - Static assets for marketing site
- `src/actions/` - Server Actions for marketing site functionality
- `src/app/` - Next.js pages for marketing site
- `src/components/` - Marketing-specific components
- `src/fonts/` - Custom fonts for marketing site
- `src/lib/` - Website-specific utilities
- Configuration files: `next.config.mjs`, `tailwind.config.ts`, `tsconfig.json`

### `packages/`
Shared packages used across multiple applications.

#### `packages/ui/`
Design system with reusable UI components.

- `src/components/` - Base UI components (button, dialog, icons, input, tooltip)
- `src/utils/` - UI utility functions (cn, styling helpers)
- `src/globals.css` - Global CSS styles and design tokens
- Configuration files: `components.json`, `tailwind.config.ts`, `postcss.config.js`

#### `packages/supabase/`
Database client and query abstractions.

- `src/clients/` - Supabase client configurations (server, client, middleware)
- `src/queries/` - Pre-built query functions
- `src/mutations/` - Database mutation helpers
- `src/types/` - Generated TypeScript types from database schema

#### `packages/analytics/`
Analytics tracking and event management.

- `src/` - Analytics client setup and event tracking utilities

#### `packages/email/`
Email template system and sending utilities.

- `components/` - Reusable email components
- `emails/` - Email template definitions

#### `packages/jobs/`
Background job processing and scheduling.

- `trigger/` - Trigger.dev job definitions
- `trigger.config.ts` - Job configuration

#### `packages/kv/`
Key-value store abstractions and rate limiting.

- `src/` - KV store utilities and rate limiting functions

#### `packages/logger/`
Centralized logging utilities.

- `src/` - Logger configuration and utilities

### `tooling/`
Development and build tooling configurations.

#### `tooling/typescript/`
Shared TypeScript configurations.

- `base.json` - Base TypeScript configuration
- `nextjs.json` - Next.js specific TypeScript config
- `react-library.json` - React library TypeScript config

### Root Configuration Files

- `.github/` - GitHub Actions workflows and issue templates
- `.vscode/` - VS Code workspace configuration
- `llm_context/` - LLM context documents and project documentation
- `package.json` - Root package configuration with Bun workspaces
- `turbo.json` - Turborepo build pipeline configuration
- `biome.json` - Linting and formatting configuration
- `tsconfig.json` - Root TypeScript configuration
- `bun.lockb` - Bun package manager lock file
- `.gitignore` - Git ignore patterns
- `.cursorrules` - Cursor IDE configuration rules
- `LICENSE.md` - Project license
- `README.md` - Project documentation

## Development Rules & Best Practices

### File Organization Rules

#### Component Organization
- **Reusability Threshold**: Components used in 2+ places → move to `/components/`, single-use components → keep in page/feature directory
- **Feature Grouping**: Organize related components in subdirectories (tables/, modals/, sheets/, widgets/)
- **File Size Management**: Target 50-200 lines per component, maximum 500 lines (requires justification)
- **Single Responsibility**: One primary component per file with supporting types and constants in same file
- **Descriptive Filenames**: Use names that clearly indicate component purpose

#### Naming Conventions
- **Components**: `kebab-case.tsx` (e.g., `user-menu.tsx`)
- **Pages**: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- **Actions**: `[action-name]-action.ts`
- **Hooks**: `use-[feature].ts`
- **Utils**: `[domain].ts` (e.g., `format.ts`, `auth.ts`)

#### Import Patterns
- **App components**: Use absolute imports with `@/` prefix
- **Shared packages**: Use package imports (e.g., `@/ui/button`)
- **External libraries**: Standard npm imports

### Component Architecture Rules

#### Composition Over Inheritance
- Build composable components rather than large monolithic ones
- Use render props and children patterns for flexibility
- Extract complex logic into custom hooks

#### Logic Extraction
- **Custom Hooks**: Extract complex state logic and side effects
- **Utility Functions**: Move pure functions to utils directories
- **Services**: Abstract external API calls into service layers

### Performance Optimization Rules

#### Code Splitting
- Use dynamic imports for heavy components
- Implement loading skeletons for async components
- Split routes at page level automatically via Next.js

#### Server-Side Optimization
- Prefetch data on server when possible
- Use server components for static content
- Implement proper caching strategies

#### Client-Side Optimization
- Implement optimistic updates for better UX
- Use proper loading states and error boundaries
- Minimize client-side JavaScript bundles

### State Management Strategy

#### Server State
- Use tRPC + TanStack Query for server state
- Implement proper caching and invalidation
- Handle loading and error states consistently

#### URL State
- Use URL state for filters and UI state that should be shareable
- Implement proper parsing and validation of URL parameters

#### Client State
- Use Zustand for temporary UI state
- Keep client state minimal and focused
- Avoid duplicating server state in client stores

### Type Safety Rules

#### TypeScript Configuration
- Enable strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- Generate types from database schema
- Maintain end-to-end type safety from database to UI

#### API Type Safety
- Use tRPC for full type safety between client and server
- Validate inputs with schema validation (Zod)
- Generate OpenAPI documentation from schemas

### Error Handling Rules

#### Component Error Boundaries
- Implement error boundaries for component isolation
- Provide meaningful fallback UIs
- Log errors properly for debugging

#### Graceful Degradation
- Always provide fallbacks for optional features
- Handle loading and error states consistently
- Implement proper retry mechanisms

### Development Workflow Rules

#### Component Creation Flow
1. Start with inline components in pages
2. Extract to `/components/` when used 2+ times
3. Group related components in subdirectories
4. Move to shared UI package when used across apps

#### API Development Flow
1. Add database schema changes
2. Create tRPC router for new endpoints
3. Add router to main router configuration
4. Create client hooks for frontend consumption

#### Testing Strategy
- Unit tests for utilities and pure functions
- Component tests with Testing Library
- Integration tests for API routes
- E2E tests for critical user flows

### Code Quality Standards

#### Linting and Formatting
- Use Biome for fast linting and formatting
- Enable strict TypeScript checking
- Maintain consistent code style across monorepo

#### Git Workflow
- Use conventional commit messages (`feat:`, `fix:`, `chore:`)
- Create feature branches with descriptive names
- Keep commits focused and atomic

#### Package Management
- Add dependencies to specific workspaces when possible
- Use shared dependencies at root level for tooling
- Keep dependencies up to date regularly