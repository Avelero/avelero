# Avelero API Documentation

Comprehensive documentation for the Avelero v2 API built with [Nextra](https://nextra.site).

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Access to Avelero monorepo

### Development

```bash
# From the monorepo root
cd apps/docs

# Install dependencies (if not already installed)
bun install

# Start development server
bun run dev
```

The documentation will be available at [http://localhost:3001](http://localhost:3001)

### Build

```bash
# Build for production
bun run build

# Preview production build
bun run start
```

## Project Structure

```
apps/docs/
├── pages/              # Documentation pages (MDX files)
│   ├── index.mdx       # Homepage
│   ├── getting-started.mdx
│   ├── authentication.mdx
│   ├── error-handling.mdx
│   ├── performance.mdx
│   ├── user/           # User API endpoints
│   ├── workflow/       # Workflow API endpoints
│   ├── brand/          # Brand API endpoints
│   ├── products/       # Products API endpoints
│   ├── passports/      # Passports API endpoints
│   ├── bulk/           # Bulk operations endpoints
│   └── composite/      # Composite endpoints
├── scripts/
│   └── generate-docs.ts   # Endpoint documentation generator
├── theme.config.tsx    # Nextra theme configuration
├── next.config.js      # Next.js configuration
└── tailwind.config.ts  # Tailwind CSS configuration
```

## Writing Documentation

### Creating a New Page

Create a `.mdx` file in the `pages/` directory:

```mdx
---
title: Page Title
description: Brief description for SEO
---

import { Callout, Steps, Tabs } from 'nextra/components'

# Page Title

Your content here...

## Section

<Callout type="info">
  Important note
</Callout>
```

### Adding Navigation

Update the corresponding `_meta.ts` file:

```typescript
// pages/user/_meta.ts
export default {
  index: 'Overview',
  get: 'user.get',
  update: 'user.update',
  // ...
}
```

### Available Components

Nextra provides built-in components:

```mdx
# Callouts
<Callout type="info">Info message</Callout>
<Callout type="warning">Warning message</Callout>
<Callout type="error">Error message</Callout>

# Tabs
<Tabs items={['Tab 1', 'Tab 2']}>
  <Tabs.Tab>Content 1</Tabs.Tab>
  <Tabs.Tab>Content 2</Tabs.Tab>
</Tabs>

# Steps
<Steps>
### Step 1
Content

### Step 2
Content
</Steps>
```

## Generating Endpoint Documentation

The project includes a script to automatically generate endpoint documentation:

```bash
cd apps/docs
bun run scripts/generate-docs.ts
```

This script:
1. Reads endpoint definitions
2. Generates `.mdx` files for each endpoint
3. Creates proper folder structure
4. Includes templates for parameters, examples, and errors

After generation, manually enhance the generated files with:
- Real code examples
- Detailed parameter descriptions
- Common error scenarios
- Related endpoints

## Customization

### Theme Configuration

Edit `theme.config.tsx` to customize:
- Logo and branding
- Navigation
- Footer
- Search
- Dark mode settings

```tsx
const config: DocsThemeConfig = {
  logo: <span>Avelero API</span>,
  primaryHue: 200,
  darkMode: true,
  // ...
}
```

### Styling

The docs use Tailwind CSS. Customize in `tailwind.config.ts`:

```typescript
const config: Config = {
  theme: {
    extend: {
      // Your customizations
    },
  },
}
```

## Content Guidelines

### Endpoint Documentation Template

Each endpoint should follow this structure:

1. **Title**: Endpoint name (e.g., `user.get`)
2. **Description**: One-line purpose
3. **Endpoint**: Full endpoint path and type (Query/Mutation)
4. **Purpose**: 2-3 sentences explaining usage
5. **Input Parameters**: Table of all parameters
6. **Return Value**: TypeScript type definition
7. **Examples**: TypeScript and JavaScript examples
8. **Error Handling**: Common error codes and solutions
9. **Notes**: Important caveats or tips
10. **Related Endpoints**: Links to related documentation

### Code Examples

Always provide TypeScript examples first:

```typescript
// Good: Clear, complete example
const user = await trpc.user.get.query()

if (user) {
  console.log(`Welcome, ${user.full_name}!`)
}
```

### Writing Style

- Be concise and clear
- Use active voice
- Provide practical examples
- Include error handling
- Link to related documentation

## Search

Nextra includes built-in search powered by FlexSearch. Search indexes are automatically generated from:
- Page titles
- Headings
- Content
- Code blocks (when enabled)

## Deployment

The documentation is designed to be deployed as a standalone site:

### Option 1: Vercel (Recommended)

1. Create a new Vercel project
2. Point to `apps/docs` directory
3. Configure custom domain (docs.avelero.com)
4. Deploy

### Option 2: Static Export

```bash
# Build static site
bun run build

# Output in .next/ directory
# Deploy to any static hosting
```

## Resources

- [Nextra Documentation](https://nextra.site)
- [MDX Documentation](https://mdxjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Avelero API Spec](../../docs/NEW_API_ENDPOINTS.txt)

## Contributing

### Adding a New Endpoint

1. Run the generator script to create initial file
2. Enhance with real examples from API implementation
3. Test code examples
4. Update navigation (`_meta.ts`)
5. Build and verify

### Updating Existing Documentation

1. Edit the corresponding `.mdx` file
2. Test changes locally (`bun run dev`)
3. Verify build (`bun run build`)
4. Submit PR

## Troubleshooting

### Build Fails

Check for:
- Invalid MDX syntax
- Missing imports
- Broken internal links
- Invalid frontmatter

### Navigation Not Updating

1. Check `_meta.ts` files
2. Restart dev server
3. Clear `.next` cache: `rm -rf .next`

### Search Not Working

Search is built at build time. Run `bun run build` to regenerate the index.

## Support

For questions or issues:
- Internal: Avelero team chat
- GitHub: [Open an issue](https://github.com/avelero/avelero/issues)
- Email: dev@avelero.com

---

Built with [Nextra](https://nextra.site)
