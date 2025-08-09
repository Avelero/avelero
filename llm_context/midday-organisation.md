# Midday Repository Architecture Guide

> A comprehensive guide to understanding the architecture, organization, and best practices of the Midday monorepo - an all-in-one business management platform.

## 📋 Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Applications Deep Dive](#applications-deep-dive)
4. [Shared Packages](#shared-packages)
5. [Component Organization](#component-organization)
6. [Routing Architecture](#routing-architecture)
7. [Best Practices & Patterns](#best-practices--patterns)
8. [Development Guidelines](#development-guidelines)

---

## 🏗️ High-Level Overview

**Midday** is a modern business management platform built as a **monorepo** using **Turborepo** and **Bun**. It combines multiple applications and shared packages to provide an all-in-one solution for freelancers, contractors, and small businesses.

### Core Technology Stack
- **Package Manager**: Bun 1.2.16
- **Build System**: Turborepo 2.5.4
- **Frontend**: Next.js 15.3.3 with App Router
- **Backend**: Hono.js with tRPC
- **Database**: Supabase (PostgreSQL)
- **UI Framework**: Radix UI + Tailwind CSS
- **Type Safety**: TypeScript throughout
- **Deployment**: Vercel (Frontend), Fly.io (API)

---

## 🗂️ Monorepo Structure

```
midday/
├── apps/                    # Applications
│   ├── dashboard/          # Main SaaS platform (app.midday.ai)
│   ├── website/            # Marketing website (midday.ai)
│   ├── api/                # Backend API server
│   ├── engine/             # Banking integration engine
│   ├── desktop/            # Tauri desktop application
│   └── docs/               # Documentation site
├── packages/               # Shared packages
│   ├── ui/                 # Design system components
│   ├── supabase/          # Database client & queries
│   ├── utils/             # Cross-app utilities
│   ├── email/             # Email templates & sending
│   ├── invoice/           # Invoice generation & PDF
│   ├── documents/         # Document processing & OCR
│   ├── jobs/              # Background job processing
│   ├── events/            # Analytics & tracking
│   ├── import/            # CSV import functionality
│   ├── inbox/             # Email/document processing
│   ├── location/          # Geographic utilities
│   ├── encryption/        # Data encryption
│   ├── engine-client/     # Banking engine client
│   ├── desktop-client/    # Desktop app utilities
│   ├── app-store/         # Third-party integrations
│   └── notification/      # Notification system
├── types/                 # Global TypeScript definitions
└── turbo.json            # Turborepo configuration
```

### Workspace Configuration

The monorepo uses **Bun workspaces** with the following pattern:
```json
{
  "workspaces": ["packages/*", "apps/*", "packages/email/*"]
}
```

Each workspace is independently versioned and can be developed, tested, and deployed separately while sharing common dependencies and build configurations.

---

## 🚀 Applications Deep Dive

### 1. Dashboard App (`apps/dashboard/`)

**The main SaaS application** - A Next.js application using the App Router pattern.

#### Directory Structure
```
apps/dashboard/src/
├── actions/              # Server Actions (Next.js)
│   ├── ai/              # AI-related actions
│   ├── institutions/    # Banking institution actions
│   ├── transactions/    # Transaction management
│   └── mfa-verify-action.ts
├── app/                 # Next.js App Router
│   ├── [locale]/        # Internationalization
│   │   ├── (app)/       # Main app route group
│   │   │   ├── (sidebar)/   # Sidebar layout pages
│   │   │   └── desktop/     # Desktop-specific routes
│   │   └── (public)/    # Public pages (login, etc.)
│   └── api/            # API routes
├── components/          # UI Components (189+ files)
│   ├── [feature-name].tsx   # Single-purpose components
│   ├── tables/          # Data table components
│   ├── modals/          # Modal components
│   ├── sheets/          # Sheet/drawer components
│   ├── widgets/         # Dashboard widgets
│   ├── vault/           # Document management
│   ├── tracker/         # Time tracking
│   └── invoice/         # Invoice components
├── hooks/               # Custom React hooks (34+ files)
├── lib/                 # Library configurations
├── store/               # Zustand state management
├── trpc/                # tRPC client setup
├── utils/               # Utility functions
└── middleware.ts        # Authentication & i18n
```

#### Key Features
- **Authentication**: Supabase Auth with MFA support
- **Internationalization**: Next International with locale routing
- **Real-time**: Supabase realtime subscriptions
- **State Management**: tRPC for server state, Zustand for client state
- **File Upload**: Chunked uploads with progress tracking
- **Desktop Integration**: Tauri bridge for desktop features

### 2. API App (`apps/api/`)

**Backend API server** built with Hono.js providing both tRPC and REST endpoints.

#### Directory Structure
```
apps/api/src/
├── db/                  # Database layer
│   ├── queries/         # SQL queries (27+ files)
│   ├── schema.ts        # Drizzle schema definitions
│   └── index.ts         # Database connection
├── rest/                # REST API endpoints
│   ├── routers/         # REST route handlers
│   └── middleware/      # REST middleware
├── trpc/                # tRPC setup
│   ├── routers/         # tRPC routers by domain (26+ files)
│   └── middleware/      # tRPC middleware
├── schemas/             # Validation schemas (24+ files)
├── services/            # External service integrations
└── utils/               # API utilities
```

#### API Architecture
- **Framework**: Hono.js for performance and edge compatibility
- **Type Safety**: Full TypeScript with tRPC for client-server communication
- **Database**: Drizzle ORM with PostgreSQL
- **Authentication**: JWT with Supabase integration
- **Documentation**: OpenAPI 3.1 with Scalar UI
- **Deployment**: Fly.io with Docker containers

### 3. Website App (`apps/website/`)

**Marketing website** built with Next.js for static generation and SEO optimization.

#### Key Features
- **Static Generation**: Pre-rendered pages for performance
- **MDX Content**: Blog posts and documentation in MDX
- **SEO Optimized**: Meta tags, sitemaps, and structured data
- **Analytics**: OpenPanel integration for privacy-focused analytics
- **Performance**: Optimized images and code splitting

### 4. Engine App (`apps/engine/`)

**Banking integration engine** that handles connections to 20,000+ banks across 33 countries.

#### Architecture
- **Runtime**: Cloudflare Workers for global edge deployment
- **Providers**: GoCardless, Plaid, Teller, EnableBanking
- **Search**: Typesense for institution search
- **Caching**: Cloudflare KV for session and rate limit management
- **Jobs**: Trigger.dev for background processing

### 5. Desktop App (`apps/desktop/`)

**Cross-platform desktop application** built with Tauri and React.

#### Features
- **Native Performance**: Rust backend with web frontend
- **System Integration**: File system access, notifications
- **Auto Updates**: Built-in update mechanism
- **Security**: Sandboxed execution environment

---

## 📦 Shared Packages

### UI Package (`packages/ui/`)

**Design system** providing consistent UI components across all applications.

#### Structure
```
packages/ui/src/
├── components/          # 52+ UI components
│   ├── button.tsx      # Base components
│   ├── form.tsx        # Compound components
│   ├── editor/         # Rich text editor
│   └── chart.tsx       # Data visualization
├── hooks/              # UI-specific hooks
├── utils/              # UI utilities (cn, truncate)
└── globals.css         # Base styles
```

#### Key Features
- **Radix UI Primitives**: Accessible, unstyled components
- **Tailwind CSS**: Utility-first styling with design tokens
- **Variant System**: Class Variance Authority for component variants
- **TypeScript**: Full type safety for props and APIs
- **Tree Shaking**: Optimized exports for minimal bundle size

### Supabase Package (`packages/supabase/`)

**Database client** providing type-safe database operations and real-time subscriptions.

#### Exports
- `server`: Server-side Supabase client
- `client`: Client-side Supabase client
- `queries`: Pre-built query functions
- `mutations`: Database mutation helpers
- `types`: Generated TypeScript types from database schema

### Other Key Packages

#### Documents (`packages/documents/`)
- **OCR Processing**: Receipt and invoice text extraction
- **Classification**: AI-powered document categorization
- **Embedding**: Vector embeddings for document search

#### Invoice (`packages/invoice/`)
- **PDF Generation**: React-PDF templates
- **HTML Templates**: Web-based invoice views
- **Calculations**: Tax, discount, and total calculations

#### Jobs (`packages/jobs/`)
- **Background Processing**: Trigger.dev integration
- **Email Notifications**: Automated email workflows
- **Document Processing**: Async file processing

#### Email (`packages/email/`)
- **Template System**: React-based email templates
- **Multi-language**: Internationalized email content
- **Transactional**: Resend integration for reliable delivery

---

## 🧩 Component Organization

### File Organization Rules

#### 1. **Reusability Threshold**
- Components used in **2+ places** → move to `/components/`
- Single-use components → keep in page/feature directory

#### 2. **Feature Grouping**
Related components are organized in subdirectories:
```
components/
├── transaction-details.tsx     # Root level - used across app
├── user-menu.tsx              # Root level - used in multiple layouts
├── tables/                    # Feature group
│   ├── transactions/          # Entity-specific
│   │   ├── data-table.tsx
│   │   ├── columns.tsx
│   │   └── loading.tsx
│   ├── invoices/
│   └── customers/
├── modals/                    # Feature group
│   ├── import-modal/
│   └── export-modal/
├── sheets/                    # Feature group
│   └── global-sheets.tsx
└── widgets/                   # Feature group
    ├── spending/
    ├── revenue/
    └── transactions/
```

#### 3. **File Size Management**
- **Target**: 50-200 lines per component
- **Maximum**: 500 lines (requires justification)
- **Strategy**: Extract complex logic into custom hooks or utilities

#### 4. **Single Responsibility**
- One primary component per file
- Supporting types and constants in the same file
- Descriptive filenames that indicate purpose

### Component Examples

#### Simple Component (50 lines)
```typescript
// components/theme-switch.tsx
"use client";

import { Icons } from "@midday/ui/icons";
import { useTheme } from "next-themes";

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-md hover:bg-accent"
    >
      <Icons.Sun className="dark:hidden" />
      <Icons.Moon className="hidden dark:block" />
    </button>
  );
}
```

#### Complex Component with Hooks (150 lines)
```typescript
// components/transaction-details.tsx
"use client";

import { useTransactionParams } from "@/hooks/use-transaction-params";
import { useTRPC } from "@/trpc/client";
import { Sheet, SheetContent } from "@midday/ui/sheet";

export function TransactionDetails() {
  const { params } = useTransactionParams();
  const trpc = useTRPC();
  
  const { data, isLoading } = useQuery(
    trpc.transactions.getById.queryOptions({
      id: params.transactionId!,
    }),
    { enabled: Boolean(params.transactionId) }
  );
  
  // Component logic...
  
  return (
    <Sheet open={Boolean(params.transactionId)}>
      <SheetContent>
        {/* Component content */}
      </SheetContent>
    </Sheet>
  );
}
```

---

## 🛣️ Routing Architecture

### Next.js App Router Structure

The dashboard uses **Next.js App Router** with sophisticated routing patterns:

```
app/[locale]/
├── (app)/                 # Main application route group
│   ├── (sidebar)/         # Pages with sidebar layout
│   │   ├── page.tsx       # Dashboard overview
│   │   ├── transactions/
│   │   │   ├── page.tsx
│   │   │   └── categories/
│   │   │       └── page.tsx
│   │   ├── invoices/
│   │   ├── tracker/
│   │   ├── customers/
│   │   ├── vault/
│   │   ├── inbox/
│   │   ├── apps/
│   │   ├── settings/
│   │   │   ├── layout.tsx  # Nested layout
│   │   │   ├── page.tsx
│   │   │   ├── billing/
│   │   │   ├── accounts/
│   │   │   ├── members/
│   │   │   └── notifications/
│   │   └── account/
│   │       ├── layout.tsx  # Nested layout
│   │       ├── page.tsx
│   │       ├── security/
│   │       └── teams/
│   ├── desktop/           # Desktop-specific routes
│   │   └── search/
│   ├── mfa/               # Multi-factor auth
│   │   ├── setup/
│   │   └── verify/
│   └── setup/             # Onboarding
├── (public)/              # Public pages route group
│   ├── login/
│   ├── verify/
│   ├── i/[token]/         # Invoice sharing
│   └── s/[shortId]/       # Short links
└── api/                   # API routes
    ├── auth/
    ├── checkout/
    ├── webhook/
    └── proxy/
```

### Route Group Benefits

1. **Layout Organization**: Different layouts without affecting URLs
2. **Code Splitting**: Automatic splitting by route groups
3. **Middleware Targeting**: Specific middleware per route group
4. **SEO Optimization**: Clean URLs without group names

### URL State Management

The application heavily uses **URL state** for managing UI state:

```typescript
// Search params for filters and modals
/transactions?status=pending&createTransaction=true
/invoices?statuses=overdue&type=create
/tracker?create=true&project=abc123

// Dynamic routes for entities
/i/[token]           # Shared invoice view
/s/[shortId]         # Short link redirects
```

### Navigation Patterns

```typescript
// Main navigation structure
const navigationItems = [
  { path: "/", name: "Overview" },
  { path: "/inbox", name: "Inbox" },
  { 
    path: "/transactions", 
    name: "Transactions",
    children: [
      { path: "/transactions/categories", name: "Categories" },
      { path: "/transactions?step=connect", name: "Connect bank" },
      { path: "/transactions?step=import", name: "Import" },
    ]
  },
  // ... more items
];
```

---

## 🎯 Best Practices & Patterns

### 1. File Organization

#### Naming Conventions
- **Components**: `kebab-case.tsx` (e.g., `user-menu.tsx`)
- **Pages**: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- **Actions**: `[action-name]-action.ts`
- **Hooks**: `use-[feature].ts`
- **Utils**: `[domain].ts` (e.g., `format.ts`, `tracker.ts`)

#### Import Patterns
```typescript
// App components - absolute imports with @/
import { DataTable } from "@/components/tables/transactions/data-table";
import { useTransactionParams } from "@/hooks/use-transaction-params";

// Shared packages - package imports
import { Button } from "@midday/ui/button";
import { cn } from "@midday/ui/cn";
import { Icons } from "@midday/ui/icons";
```

### 2. Component Architecture

#### Composition over Inheritance
```typescript
// ✅ Good - Composable components
export function TransactionTable() {
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={<TransactionTableSkeleton />}
      empty={<EmptyTransactions />}
    />
  );
}

// ❌ Avoid - Large monolithic components
export function TransactionPage() {
  // 500+ lines of mixed concerns
}
```

#### Custom Hooks for Logic
```typescript
// ✅ Extract complex logic into hooks
export function useTransactionFilters() {
  const [params, setParams] = useQueryStates({
    status: parseAsArrayOf(parseAsString),
    category: parseAsString,
    dateRange: parseAsString,
  });
  
  return { filters: params, setFilters: setParams };
}

// Component stays focused on rendering
export function TransactionFilters() {
  const { filters, setFilters } = useTransactionFilters();
  return <FilterUI filters={filters} onChange={setFilters} />;
}
```

### 3. State Management Strategy

#### Server State (tRPC + TanStack Query)
```typescript
// ✅ Server state with tRPC
const { data: transactions } = useQuery(
  trpc.transactions.get.queryOptions({
    pageSize: 50,
    filters: { status: 'pending' }
  })
);
```

#### URL State (nuqs)
```typescript
// ✅ URL state for filters and UI state
const [params, setParams] = useQueryStates({
  view: parseAsStringLiteral(['grid', 'list']).withDefault('grid'),
  modal: parseAsBoolean.withDefault(false),
});
```

#### Client State (Zustand)
```typescript
// ✅ Client state for temporary UI state
export const useAssistantStore = create<AssistantState>((set) => ({
  message: null,
  setMessage: (message) => set({ message }),
}));
```

### 4. Performance Optimization

#### Server-Side Prefetching
```typescript
// ✅ Prefetch data on the server
export default async function Page() {
  batchPrefetch([
    trpc.team.current.queryOptions(),
    trpc.transactions.get.queryOptions({ pageSize: 15 }),
    trpc.bankAccounts.get.queryOptions(),
  ]);
  
  return <PageContent />;
}
```

#### Code Splitting
```typescript
// ✅ Dynamic imports for heavy components
const InvoiceEditor = dynamic(() => import("@/components/invoice/editor"), {
  loading: () => <EditorSkeleton />,
});
```

#### Optimistic Updates
```typescript
// ✅ Optimistic updates for better UX
const updateTransaction = useMutation(
  trpc.transactions.update.mutationOptions({
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old) => ({ ...old, ...newData }));
      return { previousData };
    },
    onError: (err, newData, context) => {
      queryClient.setQueryData(queryKey, context.previousData);
    },
  })
);
```

### 5. Type Safety

#### Strict TypeScript Configuration
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

#### End-to-End Type Safety
```typescript
// Database schema generates types
export type Transaction = Database['public']['Tables']['transactions']['Row'];

// tRPC provides full type safety
const router = createTRPCRouter({
  get: protectedProcedure
    .input(getTransactionsSchema)
    .query(({ input, ctx }) => {
      // Fully typed input and context
      return getTransactions(ctx.db, input);
    }),
});

// Client gets full type inference
const { data } = trpc.transactions.get.useQuery({ status: 'pending' });
//    ^? Transaction[]
```

### 6. Error Handling

#### Error Boundaries
```typescript
// ✅ Error boundaries for component isolation
export function TransactionTable() {
  return (
    <ErrorBoundary fallback={<TableError />}>
      <DataTable />
    </ErrorBoundary>
  );
}
```

#### Graceful Degradation
```typescript
// ✅ Fallbacks for optional features
export function BankBalance() {
  const { data, error } = useQuery(bankAccountQuery);
  
  if (error) {
    return <BalanceError />;
  }
  
  return data ? <Balance amount={data.balance} /> : <BalanceSkeleton />;
}
```

---

## 🛠️ Development Guidelines

### Adding New Features

#### 1. **Component Creation Flow**
```bash
# 1. Start with inline components in pages
app/[locale]/(app)/new-feature/page.tsx

# 2. Extract to components when used 2+ times
components/new-feature-component.tsx

# 3. Group related components
components/new-feature/
├── index.tsx
├── form.tsx
└── table.tsx

# 4. Create shared UI components if needed
packages/ui/src/components/new-component.tsx
```

#### 2. **API Development Flow**
```bash
# 1. Add database schema
apps/api/src/db/schema.ts

# 2. Create tRPC router
apps/api/src/trpc/routers/new-feature.ts

# 3. Add to main router
apps/api/src/trpc/routers/_app.ts

# 4. Create client hooks
apps/dashboard/src/hooks/use-new-feature.ts
```

#### 3. **Testing Strategy**
```typescript
// Unit tests for utilities
utils/format.test.ts

// Component tests with Testing Library
components/user-menu.test.tsx

// Integration tests for API routes
api/transactions.test.ts

// E2E tests with Playwright
e2e/transaction-flow.spec.ts
```

### Code Quality Standards

#### 1. **Linting and Formatting**
- **Biome**: Fast linting and formatting
- **TypeScript**: Strict type checking
- **Prettier**: Code formatting (via Biome)

#### 2. **Git Workflow**
```bash
# Feature branch naming
feature/transaction-filters
fix/invoice-calculation-bug
chore/update-dependencies

# Commit message format
feat(transactions): add advanced filtering
fix(invoice): correct tax calculation
docs(readme): update installation steps
```

#### 3. **Package Management**
```bash
# Add dependencies to specific workspace
bun add @radix-ui/react-dialog --cwd apps/dashboard

# Add shared dependency to root
bun add -D typescript

# Update all dependencies
bun update
```

### Deployment Strategy

#### 1. **Staging Environment**
- **Dashboard**: Vercel preview deployments
- **API**: Fly.io staging app
- **Database**: Supabase staging project

#### 2. **Production Deployment**
```bash
# Build all apps
bun run build

# Deploy dashboard
bun run build:dashboard
# Vercel automatic deployment

# Deploy API
bun run deploy:api
# Fly.io deployment
```

#### 3. **Monitoring**
- **Error Tracking**: Sentry integration
- **Performance**: Vercel Analytics
- **Uptime**: OpenStatus monitoring
- **Logs**: Structured logging with Pino

---

## 🎨 Styling Architecture

### Design System

#### 1. **Tailwind CSS Configuration**
```typescript
// tailwind.config.ts
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // ... design tokens
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

#### 2. **Component Variants**
```typescript
// Using class-variance-authority
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
  }
);
```

#### 3. **Responsive Design**
```typescript
// Mobile-first responsive classes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card className="p-4 md:p-6" />
</div>

// Desktop-specific styles
<div className="hidden desktop:block md:hidden">
  Desktop only content
</div>
```

---

## 📚 Resources & References

### Documentation
- [Next.js App Router](https://nextjs.org/docs/app)
- [tRPC Documentation](https://trpc.io/docs)
- [Radix UI Components](https://www.radix-ui.com/primitives)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Turborepo Guide](https://turbo.build/repo/docs)

### Key Libraries
- **UI**: Radix UI, Tailwind CSS, Framer Motion
- **State**: TanStack Query, Zustand, nuqs
- **Forms**: React Hook Form, Zod
- **Database**: Drizzle ORM, Supabase
- **Testing**: Vitest, Testing Library, Playwright

### Development Tools
- **Package Manager**: Bun
- **Build Tool**: Turborepo
- **Linting**: Biome
- **Type Checking**: TypeScript
- **Git Hooks**: Husky + lint-staged

---

*This guide serves as a comprehensive reference for understanding and contributing to the Midday monorepo. Use it as a foundation for building similar applications with modern architectural patterns.*