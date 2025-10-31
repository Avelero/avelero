# Avelero Project Context

## Overview
Avelero is a SaaS application built on the Create v1 starter kit (based on Midday). It's a production-ready monorepo featuring brand and product management with a modern tech stack.

## Tech Stack

### Core Framework
- **Runtime**: Bun 1.2.21
- **Build System**: Turborepo
- **Language**: TypeScript
- **Linting/Formatting**: Biome

### Frontend
- **Framework**: Next.js
- **Styling**: TailwindCSS
- **UI Components**: Shadcn
- **State Management**: nuqs (type-safe search params)
- **Theme**: next-themes
- **Internationalization**: next-international

### Backend
- **API**: tRPC with Hono server
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Server Actions**: react-safe-action

### Infrastructure
- **Cache/Rate Limiting**: Upstash Redis
- **Background Jobs**: Trigger.dev
- **Email**: React Email + Resend
- **Analytics**: OpenPanel
- **Link Sharing**: Dub
- **Deployment**: Vercel

## Project Structure

```
avelero/
├── apps/
│   ├── api/          # tRPC API with Hono (Bun runtime)
│   ├── app/          # Main SaaS application (Next.js)
│   └── web/          # Marketing website (Next.js)
├── packages/
│   ├── analytics/    # OpenPanel analytics wrapper
│   ├── db/           # Supabase queries & mutations
│   ├── email/        # React Email templates
│   ├── jobs/         # Trigger.dev background jobs
│   ├── kv/           # Upstash key-value storage
│   ├── location/     # Location utilities
│   ├── logger/       # Logging utilities
│   ├── supabase/     # Supabase clients & types
│   ├── ui/           # Shared Shadcn components
│   └── utils/        # Shared utilities
├── tooling/
│   └── typescript/   # Shared TypeScript configs
└── types/            # Shared type definitions
```

## API Architecture

### tRPC Setup
- **Server**: `apps/api/src/index.ts` - Hono server with tRPC
- **Router**: `apps/api/src/trpc/routers/_app.ts` - Main router
- **Context**: `apps/api/src/trpc/init.ts` - Request context creation

### Key Routers
- `brand.ts` - Brand management
- `catalog.ts` - Catalog operations
- `brand-catalog.ts` - Brand-catalog relationships
- `products.ts` - Product management
- `product-attributes.ts` - Product attributes
- `passport-templates.ts` - Passport templates
- `passports.ts` - Passport operations
- `imports.ts` - Data import functionality
- `user.ts` - User management

### Middleware
- **RBAC**: `rbac.middleware.ts` - Role-based access control
- **Brand Permission**: `brand-permission.ts` - Brand-level permissions
- **Team Permission**: `team-permission.ts` - Team-level permissions
- **Read After Write**: `primary-read-after-write.ts` - Consistency handling

### Security
- CORS configured with environment-based allowed origins
- Secure headers via Hono
- Permission system with roles defined in `apps/api/src/config/roles.ts`
- Fine-grained permissions in `apps/api/src/config/permissions.ts`

## Database Schema

Key entities (in `apps/api/src/schemas/`):
- `user.ts` - User accounts
- `brand.ts` - Brand entities
- `catalog.ts` - Product catalogs
- `brand-catalog.ts` - Brand-catalog linking
- `products.ts` - Product records
- `product-attributes.ts` - Product metadata

## Development

### Commands
```bash
bun dev                 # Start all apps in development
bun dev:web            # Start marketing site
bun dev:app            # Start SaaS app
bun dev:api            # Start API server
bun dev:jobs           # Start background jobs

bun build              # Build all apps
bun build:app          # Build SaaS app only

bun test               # Run all tests
bun lint               # Run linting
bun format             # Format code with Biome
bun typecheck          # Type check all packages

bun migrate            # Run database migrations
bun seed               # Seed database
```

### Environment Setup
Each app requires its own `.env` file:
- `apps/api/.env` - API configuration
- `apps/app/.env` - SaaS app configuration
- `apps/web/.env` - Marketing site configuration

Required services:
- Supabase (database, auth, storage)
- Upstash (Redis)
- Trigger.dev (background jobs)
- Resend (emails)
- Dub (link sharing)
- OpenPanel (analytics)

## Code Conventions

### TypeScript
- Strict mode enabled
- Shared configs in `tooling/typescript`
- Workspace references for type safety

### Formatting & Linting
- Biome for both linting and formatting
- Configuration in `biome.json`
- Run `bun format` before committing

### API Development
- Use tRPC procedures with proper input validation
- Apply appropriate middleware for permissions
- Follow existing router patterns in `apps/api/src/trpc/routers/`
- Document complex procedures with JSDoc

### UI Development
- Use Shadcn components from `packages/ui`
- Follow TailwindCSS conventions
- Implement responsive designs
- Support dark/light themes

## TypeScript Coding Standards

### Core Principles

**KISS (Keep It Simple, Stupid):** Always choose the simplest solution that works.

**DRY (Don't Repeat Yourself):** Maximize code reuse through utilities, shared components, and abstractions.

**YAGNI (You Aren't Gonna Need It):** Don't write code for hypothetical future requirements.

**Code Reuse First:** Before writing new code, search for existing solutions in the codebase.

**Clarity Over Cleverness:** Write code that any developer can understand, not just experts.

### Type Safety Rules

#### No `any` Types
```typescript
// ❌ DON'T: Use any
function processData(data: any) {
  return data.value;
}

// ✅ DO: Use proper types or unknown
function processData(data: UserData) {
  return data.value;
}

// ✅ DO: Use unknown when type is truly unknown
function parseJson(json: string): unknown {
  return JSON.parse(json);
}
```

#### Explicit Return Types
```typescript
// ❌ DON'T: Implicit return types for public functions
export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ DO: Explicit return types
export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

#### Avoid Type Assertions
```typescript
// ❌ DON'T: Unsafe type assertions
const user = data as User;

// ✅ DO: Type guards and validation
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null && 'id' in data;
}

if (isUser(data)) {
  // TypeScript knows data is User here
}
```

#### Use Discriminated Unions
```typescript
// ❌ DON'T: Optional fields for state
type Response = {
  data?: User;
  error?: Error;
}

// ✅ DO: Discriminated unions
type Response =
  | { success: true; data: User }
  | { success: false; error: Error };
```

### Avoid Overcomplexity

#### No Deep Nesting
```typescript
// ❌ DON'T: Deep nesting
function processOrder(order: Order) {
  if (order.items.length > 0) {
    if (order.user.isActive) {
      if (order.total > 0) {
        // Process order
      }
    }
  }
}

// ✅ DO: Early returns
function processOrder(order: Order): void {
  if (order.items.length === 0) return;
  if (!order.user.isActive) return;
  if (order.total <= 0) return;

  // Process order
}
```

#### Limit Function Parameters
```typescript
// ❌ DON'T: Too many parameters
function createUser(
  name: string,
  email: string,
  age: number,
  address: string,
  phone: string
) {}

// ✅ DO: Use object parameter
interface CreateUserParams {
  name: string;
  email: string;
  age: number;
  address: string;
  phone: string;
}

function createUser(params: CreateUserParams) {}
```

#### Single Responsibility
```typescript
// ❌ DON'T: Functions doing too much
function handleUserRegistration(data: FormData) {
  // Validates, creates user, sends email, logs analytics, updates cache
}

// ✅ DO: Break into focused functions
function validateRegistrationData(data: FormData): ValidationResult {}
function createUserAccount(data: ValidatedData): User {}
function sendWelcomeEmail(user: User): Promise<void> {}
function trackUserRegistration(user: User): void {}
```

### Code Reuse Strategies

#### Extract Shared Logic
```typescript
// ❌ DON'T: Duplicate logic
function formatUserName(user: User) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function formatEmployeeName(employee: Employee) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

// ✅ DO: Extract to utility
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
```

#### Leverage Utility Types
```typescript
// ❌ DON'T: Recreate similar types
type UserUpdate = {
  name?: string;
  email?: string;
  age?: number;
}

// ✅ DO: Use built-in utility types
type User = {
  name: string;
  email: string;
  age: number;
}

type UserUpdate = Partial<User>;
type UserKeys = keyof User;
type UserWithoutId = Omit<User, 'id'>;
```

#### Generic Functions
```typescript
// ❌ DON'T: Duplicate for different types
function findUserById(users: User[], id: string) {
  return users.find(u => u.id === id);
}

function findProductById(products: Product[], id: string) {
  return products.find(p => p.id === id);
}

// ✅ DO: Use generics
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}
```

### Naming Conventions

#### Clear, Descriptive Names
```typescript
// ❌ DON'T: Unclear abbreviations
const usr = getUsr();
const tmp = calcTmp();

// ✅ DO: Full, descriptive names
const user = getUser();
const totalAmount = calculateTotalAmount();
```

#### Boolean Prefixes
```typescript
// ❌ DON'T: Unclear boolean names
const active = true;
const admin = false;

// ✅ DO: Use is/has/can/should prefixes
const isActive = true;
const hasAdminAccess = false;
const canEdit = true;
const shouldShowNotification = false;
```

#### Consistent Function Naming
```typescript
// ✅ DO: Consistent patterns
// Functions: verb + noun
function getUser() {}
function createOrder() {}
function updateProfile() {}
function deleteComment() {}

// Boolean functions: is/has/can/should + condition
function isAuthenticated() {}
function hasPermission() {}

// Event handlers: handle + event
function handleClick() {}
function handleSubmit() {}
```

### React-Specific Standards

#### Component Simplicity
```typescript
// ❌ DON'T: Complex components with 500 lines
function UserDashboard() {
  // Multiple API calls, complex state, business logic
}

// ✅ DO: Break into smaller components
function UserDashboard() {
  return (
    <div>
      <UserHeader />
      <UserStats />
      <UserActivity />
      <UserSettings />
    </div>
  );
}
```

#### Custom Hooks for Reuse
```typescript
// ❌ DON'T: Duplicate logic in components

// ✅ DO: Extract to custom hook
function useFetchData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetcher().then(setData).finally(() => setLoading(false));
  }, [fetcher]);

  return { data, loading };
}
```

#### Props Interface
```typescript
// ❌ DON'T: Inline prop types
function Button({ text, onClick }: { text: string; onClick: () => void }) {}

// ✅ DO: Dedicated interface
interface ButtonProps {
  text: string;
  onClick: () => void;
}

function Button({ text, onClick }: ButtonProps) {}
```

### Error Handling

```typescript
// ❌ DON'T: Generic error handling
try {
  await saveUser(user);
} catch (error) {
  console.log(error.message); // error is unknown
}

// ✅ DO: Proper error handling
try {
  await saveUser(user);
} catch (error) {
  if (error instanceof ValidationError) {
    handleValidationError(error);
  } else if (error instanceof NetworkError) {
    handleNetworkError(error);
  } else {
    handleUnknownError(error);
  }
}
```

### Performance

```typescript
// ❌ DON'T: Premature optimization
const sum = useMemo(() => a + b, [a, b]); // Simple operation

// ✅ DO: Only optimize when needed
const sum = a + b; // Simple operations don't need memoization

// ✅ DO: Memoize expensive operations
const expensiveResult = useMemo(() => {
  return items.reduce((acc, item) => {
    // Complex calculation
  }, {});
}, [items]);
```

## Documentation Standards

### Core Documentation Principles
- Write documentation for humans first, not machines
- Keep explanations clear and concise
- Avoid unnecessary complexity or technical jargon
- Focus on WHAT the code does and WHY it matters
- Use JSDoc format for TypeScript compatibility

### Functions and Utilities

```typescript
/**
 * Sends a notification message to a specific user.
 *
 * This queues the message for delivery through our notification
 * system. The message will be sent via the user's preferred channel
 * (email, SMS, or push notification).
 *
 * @param userId - The unique ID of the user to notify
 * @param message - The text message to send
 * @returns True if the notification was queued successfully
 */
async function sendNotification(userId: string, message: string): Promise<boolean> {
  // implementation
}
```

### React Components

```typescript
/**
 * Displays a user profile card with avatar and basic info.
 *
 * This component handles the layout and styling for showing user
 * information in a card format. It automatically fetches the user's
 * avatar if not provided.
 *
 * @param props - Component props
 * @param props.userId - The unique ID of the user to display
 * @param props.showEmail - Whether to show the user's email address
 * @param props.onEdit - Callback when the edit button is clicked
 *
 * @example
 * <UserCard userId="123" showEmail={true} onEdit={handleEdit} />
 */
export function UserCard({ userId, showEmail, onEdit }: UserCardProps) {
  // implementation
}
```

### Custom Hooks

```typescript
/**
 * Manages authentication state and provides login/logout functions.
 *
 * This hook handles all authentication logic including token storage,
 * session management, and automatic token refresh. It persists the
 * auth state across page reloads.
 *
 * @returns Object containing auth state and control functions
 * @returns .user - The currently logged in user, or null
 * @returns .isLoading - True while checking authentication status
 * @returns .login - Function to log in with email and password
 * @returns .logout - Function to log out and clear session
 *
 * @example
 * const { user, login, logout } = useAuth();
 */
export function useAuth() {
  // implementation
}
```

### Types and Interfaces

```typescript
/**
 * Represents a user in the system.
 *
 * This is the main user type used throughout the app. It contains
 * both public profile information and account metadata.
 */
interface User {
  /** Unique identifier for the user */
  id: string;
  /** User's display name */
  name: string;
  /** User's email address (private, only visible to admins) */
  email: string;
  /** Account creation timestamp */
  createdAt: Date;
}
```

### Documentation Guidelines

**Always document:**
- Public functions and utilities
- React components (functional and class)
- Custom hooks
- Context providers
- Complex types and interfaces
- API functions and data fetching
- Business logic and algorithms
- Non-obvious behaviors or side effects

**DO:**
- Start with clear one-line summary
- Use simple, everyday language
- Explain WHY something exists, not just WHAT
- Include practical examples for complex functions
- Describe parameters in plain English
- Mention important side effects

**DON'T:**
- Use overly technical terminology without explanation
- Write long paragraphs
- Repeat the function name in description
- Document obvious parameters
- Include implementation details unless critical

## Code Review Checklist

Before submitting code:

- [ ] No `any` types used
- [ ] All public functions have explicit return types
- [ ] Functions have single responsibility
- [ ] No deep nesting (use early returns)
- [ ] No code duplication (check for reusable utilities)
- [ ] Clear, descriptive variable/function names
- [ ] Complex functions have JSDoc comments
- [ ] Proper error handling with typed errors
- [ ] No premature optimization
- [ ] Types are as specific as possible
- [ ] Used existing utilities/components before creating new ones
- [ ] Followed project naming conventions
- [ ] Components are simple and focused
- [ ] Custom hooks for reusable logic

## Key Features

### Multi-tenancy
- Brand-based tenancy with RBAC
- Team permissions and roles
- Isolated catalogs per brand

### Product Management
- Product catalogs with attributes
- Brand-catalog relationships
- Import functionality for bulk operations
- Passport templates and instances

### Authentication & Authorization
- Supabase Auth integration
- Role-based access control (RBAC)
- Team and brand-level permissions
- Middleware-enforced security

## Testing
- Jest configuration in `jest.config.js`
- Test files should be co-located with source
- Run `bun test` for all tests

## Deployment
- Vercel for hosting (Next.js apps)
- Docker support (see `.dockerignore`)
- GitHub workflows in `.github/`
- Health check endpoint at `/health`

## Important Notes

### Modified Files
Recent changes focus on:
- Permission system configuration
- RBAC middleware improvements
- Schema updates for brands, catalogs, products
- Router enhancements for all entities

### Best Practices
1. Use workspace packages for shared code
2. Keep business logic in tRPC procedures
3. Apply proper middleware for all protected routes
4. Validate inputs with Zod schemas
5. Use TypeScript strictly - no `any` types
6. Follow monorepo patterns - don't duplicate code
7. Test RBAC changes thoroughly
8. Document API changes in procedure comments

### Current Focus Areas
Based on git status, active development includes:
- Permission system refinement
- Role configuration updates
- Middleware improvements
- Schema enhancements across all core entities
