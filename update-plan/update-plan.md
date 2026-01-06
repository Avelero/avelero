# Updates/Blog Section Implementation Plan

This document outlines the complete implementation plan for adding an Updates section to the Avelero marketing website.

---

## 1. Overview

### Goals
- Add a `/updates/` page listing all blog posts in a responsive grid
- Add individual update pages at `/updates/[slug]/`
- Maintain full visual consistency with existing website styling
- Ensure SEO optimization for all pages
- Enable easy content creation via MDX files

### Key Decisions
- Grid layout: 1 column (mobile) → 2 columns (tablet) → 3 columns (desktop)
- Date displayed: Only on individual post pages, above the title
- No date on cards
- No search/filter functionality - simple newest-first ordering
- Navigation: Add "Updates" to both header and footer

---

## 2. File Structure

```
apps/web/
├── content/
│   ├── legal/                              # Existing
│   │   ├── privacy-policy.mdx
│   │   └── terms-and-conditions.mdx
│   └── updates/                            # NEW
│       └── [slug].mdx                      # e.g., introducing-avelero.mdx
│
├── public/
│   └── updates/                            # NEW - Images for updates
│       └── [slug].webp                     # Cover images (1200x630px recommended)
│
├── src/
│   ├── app/
│   │   ├── updates/
│   │   │   ├── page.tsx                    # NEW - Grid listing page
│   │   │   └── [slug]/
│   │   │       └── page.tsx                # NEW - Individual post page
│   │   └── sitemap.ts                      # MODIFY - Include updates
│   │
│   ├── components/
│   │   ├── header.tsx                      # MODIFY - Add Updates link
│   │   ├── footer.tsx                      # MODIFY - Add Resources column
│   │   └── update-card.tsx                 # NEW - Card component
│   │
│   └── lib/
│       ├── mdx.tsx                         # Existing (may extend for updates)
│       └── updates.ts                      # NEW - Utility functions
```

---

## 3. MDX Frontmatter Schema

### Required Fields

```yaml
---
title: "Your Update Title"
description: "A compelling 1-2 sentence description for SEO and card display."
date: "2025-01-06"
image: "/updates/your-slug.webp"
---
```

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `title` | string | Yes | H1 on post page, card headline, SEO title |
| `description` | string | Yes | Card description, meta description |
| `date` | string (YYYY-MM-DD) | Yes | Sorting, display on post, SEO |
| `image` | string | Yes | Card image, Open Graph image |
| `author` | string | No | For JSON-LD Article schema (defaults to "Avelero") |

### Example MDX File

```mdx
---
title: "Introducing Avelero"
description: "We're launching Avelero, the digital product passport platform built for fashion brands."
date: "2025-01-06"
image: "/updates/introducing-avelero.webp"
author: "Raf Mevis"
---

Your MDX content starts here...

## A Subheading

Paragraph text with **bold** and *italic* formatting.

- Bullet point one
- Bullet point two

### Another Section

More content...
```

---

## 4. Developer Workflow

### Creating a New Update

1. **Create image** (recommended: 1200x630px WebP)
   ```
   Save to: public/updates/your-slug.webp
   ```

2. **Create MDX file**
   ```
   Create: content/updates/your-slug.mdx
   ```

3. **Add frontmatter and content**
   - Fill in title, description, date, image
   - Write content using markdown

4. **Done!** The update is automatically:
   - Listed on `/updates/` (newest first)
   - Accessible at `/updates/your-slug/`
   - Included in sitemap
   - Fully SEO-optimized

### Slug Convention
- Filename becomes the URL slug
- Use lowercase with hyphens: `my-update-title.mdx` → `/updates/my-update-title/`
- No special characters, spaces, or uppercase

---

## 5. Styling Specifications

### 5.1 Breakpoints (from existing codebase)

| Breakpoint | Tailwind Prefix | Min Width |
|------------|-----------------|-----------|
| Mobile | (default) | 0px |
| Small | `sm:` | 640px |
| Medium | `md:` | 768px |
| Large | `lg:` | 1024px |
| Extra Large | `xl:` | 1280px |

### 5.2 Typography Scale (from tailwind.config.ts)

| Class | Size | Line Height | Letter Spacing |
|-------|------|-------------|----------------|
| `text-h1` | 8rem | 0.9 | -0.02em |
| `text-h2` | 5.625rem | 1 | -0.01em |
| `text-h3` | 4rem | 1.1 | -0.01em |
| `text-h4` | 2.812rem | 1.2 | 0 |
| `text-h5` | 2rem | 1.3 | 0 |
| `text-h6` | 1.438rem | 1.4 | 0 |
| `text-body` | 1rem | 1.5 | 0 |
| `text-small` | 0.875rem | 1.5 | 0 |
| `text-button` | 0.875rem | 1 | 0 |
| `text-micro` | 0.75rem | 1.5 | 0 |

### 5.3 Color System (CSS Variables)

| Variable | HSL Value | Usage |
|----------|-----------|-------|
| `--background` | 240 100% 99% | Page background |
| `--foreground` | 240 80% 4% | Primary text |
| `--border` | 240 11% 89% | Borders |
| `--card` | 240 23% 95% | Card backgrounds |
| `--primary` | 240 100% 50% | Accent/brand color |

**Common color classes:**
- `text-foreground` - Primary text
- `text-foreground/80` - Secondary text (body content)
- `text-foreground/50` - Muted text (descriptions, labels)
- `text-foreground/70` - Hover state for links
- `bg-background` - Page background
- `bg-card` - Card/section backgrounds
- `border-border` - Standard borders

### 5.4 Spacing Patterns (from existing components)

**Section Padding (vertical):**
```
py-[45px] sm:py-[62px]    # Standard section spacing
pt-[58px] sm:pt-[92px]    # Hero/page top padding
pb-[90px] sm:pb-[124px]   # Large bottom spacing (before CTA)
```

**Container Padding (horizontal) - Applied in layout.tsx:**
```
px-6 sm:px-16             # Standard horizontal padding
```

**Grid/Flex Gaps:**
```
gap-4 lg:gap-6            # Card grids
gap-6                     # Standard element spacing
gap-8 md:gap-16           # Large section gaps
```

### 5.5 Updates Listing Page (`/updates/page.tsx`)

#### Page Container
```tsx
<main className="h-[calc(100%-102px)] w-full flex flex-col items-center justify-center">
  <div className="w-full pt-[58px] pb-[45px] sm:pt-[92px] sm:pb-[62px]">
    {/* Content */}
  </div>
</main>
```

#### Page Title
```tsx
<h1 className="text-h3 md:text-h2 text-foreground mb-8 md:mb-12">
  Updates
</h1>
```

**Rationale:**
- Using `text-h3 md:text-h2` for a large, impactful title (similar to hero sections)
- `mb-8 md:mb-12` for spacing before the grid

#### Updates Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {updates.map((update) => (
    <UpdateCard key={update.slug} {...update} />
  ))}
</div>
```

**Grid breakdown:**
- `grid-cols-1` - 1 column on mobile (< 768px)
- `md:grid-cols-2` - 2 columns on tablet (≥ 768px)
- `lg:grid-cols-3` - 3 columns on desktop (≥ 1024px)
- `gap-6` - 24px gap between cards (matching existing patterns)

### 5.6 Update Card Component (`/components/update-card.tsx`)

```tsx
interface UpdateCardProps {
  slug: string;
  title: string;
  description: string;
  image: string;
}

export function UpdateCard({ slug, title, description, image }: UpdateCardProps) {
  return (
    <Link
      href={`/updates/${slug}/`}
      className="flex flex-col group"
    >
      {/* Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden mb-4">
        <Image
          src={image}
          alt={title}
          fill
          loading="lazy"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          quality={85}
        />
      </div>

      {/* Text Content */}
      <div className="flex flex-col">
        <h2 className="text-h6 text-foreground mb-2 group-hover:text-foreground/70 transition-colors duration-150">
          {title}
        </h2>
        <p className="text-small text-foreground/50 line-clamp-2">
          {description}
        </p>
      </div>
    </Link>
  );
}
```

**Styling details:**
- `aspect-[16/10]` - Slightly wider than standard 16:9 for visual appeal
- `mb-4` - 16px gap between image and text
- `text-h6` - Title size (1.438rem) matching FeatureCard titles
- `text-small text-foreground/50` - Description matches existing card patterns
- `line-clamp-2` - Truncate description to 2 lines
- `group-hover:scale-105` - Subtle image zoom on hover
- `group-hover:text-foreground/70` - Title dims on hover
- `transition-colors duration-150` - Matches existing hover transitions

### 5.7 Individual Update Page (`/updates/[slug]/page.tsx`)

#### Page Container
```tsx
<main className="h-[calc(100%-102px)] w-full flex flex-col items-center justify-center">
  <article className="max-w-[768px] w-full pt-[58px] pb-[45px] sm:pt-[92px] sm:pb-[62px]">
    {/* Content */}
  </article>
</main>
```

**Note:** Using `<article>` for semantic HTML (important for SEO)

#### Header Section (Date + Title)
```tsx
<header className="mb-8">
  {/* Date */}
  <time
    dateTime={update.date}
    className="text-small text-foreground/50 mb-2 block"
  >
    {formatDate(update.date)}
  </time>

  {/* Title */}
  <h1 className="text-h4 md:text-h3 font-bold text-foreground">
    {update.title}
  </h1>
</header>

{/* Divider */}
<hr className="border-border mb-8" />

{/* MDX Content */}
<MDXRenderer source={content} />
```

**Styling details:**
- Date above title using `text-small text-foreground/50` (muted)
- `<time>` element with `dateTime` attribute for SEO
- Title uses `text-h4 md:text-h3` for appropriate sizing
- `mb-8` spacing after header
- Horizontal rule divider before content

#### Date Formatting Function
```ts
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  // Output: "January 6, 2025"
}
```

### 5.8 Navigation Updates

#### Header (Desktop Navigation)

Add "Updates" link after "Compliance" and before the Login button:

```tsx
<Link
  href="/updates/"
  aria-label="Go to updates page"
  className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150"
>
  Updates
</Link>
```

**Placement:** Between Compliance link and Login button

#### Header (Mobile Navigation)

Add to mobile menu:
```tsx
<Link
  href="/updates/"
  aria-label="Go to updates page"
  className="text-2xl font-medium text-foreground hover:text-foreground/70 transition-colors duration-150"
  onClick={() => setIsMobileMenuOpen(false)}
>
  Updates
</Link>
```

#### Footer

Change grid from 3 columns to 4 columns and add Resources column:

```tsx
<div className="gap-x-3 gap-y-2 grid grid-cols-2 md:grid-cols-4">
  {/* Product column - existing */}
  {/* Legal column - existing */}

  {/* NEW: Resources column */}
  <div>
    <h6 className="text-small text-foreground/50 pb-1">Resources</h6>
    <ul>
      <li>
        <Link
          aria-label="Go to updates page"
          className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
          href="/updates/"
        >
          Updates
        </Link>
      </li>
    </ul>
  </div>

  {/* Connect column - existing */}
</div>
```

---

## 6. SEO Strategy

### 6.1 Page-Level Metadata

#### Updates Listing Page
```ts
export const metadata: Metadata = {
  title: "Updates",
  description: "Latest news, announcements, and insights from Avelero.",
  openGraph: {
    title: "Updates | Avelero",
    description: "Latest news, announcements, and insights from Avelero.",
    type: "website",
  },
};
```

#### Individual Update Pages (Dynamic)
```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const update = await getUpdateBySlug(params.slug);

  return {
    title: update.title,
    description: update.description,
    openGraph: {
      title: update.title,
      description: update.description,
      type: "article",
      publishedTime: update.date,
      authors: [update.author || "Avelero"],
      images: [
        {
          url: `https://avelero.com${update.image}`,
          width: 1200,
          height: 630,
          alt: update.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: update.title,
      description: update.description,
      images: [`https://avelero.com${update.image}`],
    },
  };
}
```

### 6.2 JSON-LD Structured Data

Each update page includes Article schema:

```ts
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: update.title,
  description: update.description,
  image: `https://avelero.com${update.image}`,
  datePublished: update.date,
  author: {
    "@type": "Person",
    name: update.author || "Avelero",
  },
  publisher: {
    "@type": "Organization",
    name: "Avelero",
    logo: {
      "@type": "ImageObject",
      url: "https://avelero.com/og-image.jpg",
    },
  },
};
```

### 6.3 Sitemap Updates

Modify `src/app/sitemap.ts` to include all updates:

```ts
import { getAllUpdates } from "@/lib/updates";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const updates = await getAllUpdates();

  const updateRoutes = updates.map((update) => ({
    url: `${baseUrl}/updates/${update.slug}/`,
    lastModified: update.date,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const staticRoutes = [
    { route: "/", priority: 1.0 },
    { route: "/updates/", priority: 0.8 },
    { route: "/terms-and-conditions/", priority: 0.3 },
    { route: "/privacy-policy/", priority: 0.3 },
  ].map((item) => ({
    url: `${baseUrl}${item.route}`,
    lastModified: "2025-11-09",
    changeFrequency: "monthly" as const,
    priority: item.priority,
  }));

  return [...staticRoutes, ...updateRoutes];
}
```

### 6.4 Heading Hierarchy

For SEO-compliant heading structure:

**Listing page:**
- `<h1>` - "Updates" (page title)
- `<h2>` - Individual card titles (within `<UpdateCard>`)

**Individual post page:**
- `<h1>` - Post title (from frontmatter)
- `<h2>`, `<h3>`, etc. - Content headings (from MDX)

**Important:** MDX content should start with `##` (h2), not `#` (h1), since the page title is already h1.

---

## 7. Interactive MDX Capabilities

The MDX setup supports rich, interactive content through custom components.

### 7.1 Built-in Elements

These work out of the box:

| Markdown | Renders As | Styling |
|----------|------------|---------|
| `# Heading` | `<h1>` | `text-h4 font-bold` |
| `## Heading` | `<h2>` | `text-h5 font-semibold` |
| `### Heading` | `<h3>` | `text-h6 font-semibold` |
| `**bold**` | `<strong>` | `font-semibold text-foreground` |
| `*italic*` | `<em>` | `italic` |
| `[link](url)` | `<a>` / `<Link>` | Underline, hover effect |
| `- item` | `<ul><li>` | Disc, indented |
| `1. item` | `<ol><li>` | Decimal, indented |
| `> quote` | `<blockquote>` | Left border, italic |
| `` `code` `` | `<code>` | Monospace, bg-card |
| `---` | `<hr>` | Border line |

### 7.2 Images in Content

Standard markdown images work:

```mdx
![Alt text description](/updates/inline-image.webp)
```

For more control, you can use the Next.js Image component directly (if added as a custom component):

```mdx
<Image
  src="/updates/diagram.webp"
  alt="Detailed diagram"
  width={800}
  height={400}
/>
```

### 7.3 Tables

Standard markdown tables are supported:

```mdx
| Feature | Description |
|---------|-------------|
| LCA Engine | Calculate product footprint |
| Designer | Customize passport templates |
```

Add this to `mdxComponents` for styling:

```tsx
table: ({ children, ...props }) => (
  <div className="overflow-x-auto mb-4">
    <table className="w-full border-collapse border border-border" {...props}>
      {children}
    </table>
  </div>
),
thead: ({ children, ...props }) => (
  <thead className="bg-card" {...props}>{children}</thead>
),
th: ({ children, ...props }) => (
  <th className="border border-border px-4 py-2 text-left text-small font-semibold" {...props}>
    {children}
  </th>
),
td: ({ children, ...props }) => (
  <td className="border border-border px-4 py-2 text-small text-foreground/80" {...props}>
    {children}
  </td>
),
```

### 7.4 Custom Interactive Components

You can create custom React components and use them in MDX files.

**Example: Callout/Note Box**

Create `src/components/mdx/callout.tsx`:
```tsx
interface CalloutProps {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}

export function Callout({ type = "info", children }: CalloutProps) {
  const styles = {
    info: "bg-primary/10 border-primary/30",
    warning: "bg-destructive/10 border-destructive/30",
    tip: "bg-card border-border",
  };

  return (
    <div className={`p-4 border-l-4 mb-4 ${styles[type]}`}>
      {children}
    </div>
  );
}
```

Usage in MDX:
```mdx
<Callout type="tip">
  This is a helpful tip for your readers!
</Callout>
```

**Example: Interactive Button**

```tsx
"use client";

export function DemoButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick || (() => alert("Button clicked!"))}
      className="button-3d-brand text-primary-foreground px-4 py-3"
    >
      <span className="text-button">{label}</span>
    </button>
  );
}
```

Usage in MDX:
```mdx
Click the button to see it in action:

<DemoButton label="Try it out" />
```

**Example: Embedded Calculator**

You can create any React component with state:

```tsx
"use client";

import { useState } from "react";

export function FootprintCalculator() {
  const [weight, setWeight] = useState(0);
  const footprint = weight * 2.5; // Simplified calculation

  return (
    <div className="bg-card border border-border p-6 mb-4">
      <label className="text-small text-foreground block mb-2">
        Product weight (kg):
      </label>
      <input
        type="number"
        value={weight}
        onChange={(e) => setWeight(Number(e.target.value))}
        className="border border-border px-3 py-2 w-full mb-4"
      />
      <p className="text-body text-foreground">
        Estimated CO2 footprint: <strong>{footprint.toFixed(2)} kg</strong>
      </p>
    </div>
  );
}
```

### 7.5 Registering Custom Components

Add custom components to the MDXRenderer call:

```tsx
import { Callout } from "@/components/mdx/callout";
import { DemoButton } from "@/components/mdx/demo-button";
import { FootprintCalculator } from "@/components/mdx/footprint-calculator";

// In your page component:
<MDXRenderer
  source={content}
  components={{
    Callout,
    DemoButton,
    FootprintCalculator,
    // Add more as needed
  }}
/>
```

---

## 8. Utility Functions (`/lib/updates.ts`)

```ts
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";

const UPDATES_DIR = join(process.cwd(), "content/updates");

export interface UpdateMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  image: string;
  author?: string;
}

export interface Update extends UpdateMeta {
  content: string;
}

/**
 * Get all updates, sorted by date (newest first)
 */
export async function getAllUpdates(): Promise<UpdateMeta[]> {
  const files = await readdir(UPDATES_DIR);
  const mdxFiles = files.filter((file) => file.endsWith(".mdx"));

  const updates = await Promise.all(
    mdxFiles.map(async (file) => {
      const slug = file.replace(/\.mdx$/, "");
      const filePath = join(UPDATES_DIR, file);
      const fileContent = await readFile(filePath, "utf-8");
      const { data } = matter(fileContent);

      return {
        slug,
        title: data.title,
        description: data.description,
        date: data.date,
        image: data.image,
        author: data.author,
      } as UpdateMeta;
    })
  );

  // Sort by date, newest first
  return updates.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Get a single update by slug
 */
export async function getUpdateBySlug(slug: string): Promise<Update> {
  const filePath = join(UPDATES_DIR, `${slug}.mdx`);
  const fileContent = await readFile(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  return {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    image: data.image,
    author: data.author,
    content,
  };
}

/**
 * Get all slugs for static generation
 */
export async function getAllUpdateSlugs(): Promise<string[]> {
  const files = await readdir(UPDATES_DIR);
  return files
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}
```

---

## 9. Implementation Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Create `content/updates/` directory | Pending |
| 2 | Create `public/updates/` directory for images | Pending |
| 3 | Create `src/lib/updates.ts` utility functions | Pending |
| 4 | Create `src/components/update-card.tsx` | Pending |
| 5 | Create `src/app/updates/page.tsx` (listing page) | Pending |
| 6 | Create `src/app/updates/[slug]/page.tsx` (post page) | Pending |
| 7 | Update `src/components/header.tsx` (add Updates link) | Pending |
| 8 | Update `src/components/footer.tsx` (add Resources column) | Pending |
| 9 | Update `src/app/sitemap.ts` (include updates) | Pending |
| 10 | Add table components to `src/lib/mdx.tsx` (optional) | Pending |
| 11 | Create example update post for testing | Pending |

---

## 10. Example Files

### Example Update: `content/updates/welcome-to-avelero.mdx`

```mdx
---
title: "Welcome to Avelero Updates"
description: "Stay informed about the latest features, improvements, and news from Avelero."
date: "2025-01-06"
image: "/updates/welcome-to-avelero.webp"
author: "Raf Mevis"
---

We're excited to launch our Updates page, your go-to destination for all things Avelero.

## What to Expect

Here you'll find:

- **Product updates** - New features and improvements
- **Industry insights** - Thoughts on digital product passports and sustainability
- **Company news** - Milestones, partnerships, and announcements

## Stay Connected

Follow us on [LinkedIn](https://www.linkedin.com/company/avelero) and [X](https://x.com/avelerodpp) for real-time updates.

We're just getting started. Thanks for being part of the journey.
```

---

## 11. Testing Checklist

Before deployment:

- [ ] Verify responsive grid (1/2/3 columns at breakpoints)
- [ ] Test card hover states (image zoom, title color change)
- [ ] Verify date displays correctly on individual posts
- [ ] Check SEO metadata with browser dev tools
- [ ] Validate JSON-LD with Google's Rich Results Test
- [ ] Test sitemap includes all update URLs
- [ ] Verify header/footer navigation on mobile and desktop
- [ ] Test MDX rendering for all element types
- [ ] Check image loading and optimization
- [ ] Verify trailing slashes work correctly

---

*Plan created: January 6, 2025*
