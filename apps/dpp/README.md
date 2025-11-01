# Digital Product Passport (DPP) Application

A Next.js 15 application for displaying digital product passports with sustainability information, supply chain data, and environmental impact metrics.

## Features

- **Server-Side Rendering**: Fast, SEO-friendly product passport pages
- **Theme Customization**: Full brand customization through theme configuration
- **Mock Data**: Complete UI implementation with mock data (ready for API integration)
- **Responsive Design**: Optimized for mobile, tablet, and desktop
- **Interactive Components**: Show more/less, horizontal scroll carousel, dynamic menus
- **Modular Architecture**: Clean separation of components for easy maintenance

## Tech Stack

- **Framework**: Next.js 15 (React 19)
- **Styling**: Tailwind CSS + CSS Variables
- **Icons**: Phosphor React
- **Type Safety**: TypeScript
- **Package Manager**: Bun
- **Monorepo**: TurboRepo

## Getting Started

### Install Dependencies

```bash
# From the project root
bun install
```

### Development

```bash
# Run DPP app only
bun run dev:dpp

# Run all apps
bun run dev
```

The DPP app will be available at `http://localhost:3002`

### Build

```bash
# Build DPP app only
bun run build:dpp

# Build all apps
bun run build
```

### Production

```bash
bun run start:dpp
```

## Project Structure

```
apps/dpp/
├── src/
│   ├── app/                      # Next.js app directory
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home page
│   │   └── [brand]/[upid]/      # Dynamic passport pages
│   ├── components/              # React components
│   │   ├── layout/             # Layout components
│   │   ├── product/            # Product display components
│   │   ├── impact/             # Environmental impact components
│   │   ├── materials/          # Materials composition components
│   │   ├── journey/            # Supply chain journey components
│   │   ├── navigation/         # Navigation and menu components
│   │   ├── carousel/           # Product carousel components
│   │   ├── cta/                # Call-to-action components
│   │   └── icons/              # Icon components
│   ├── lib/                    # Utilities and helpers
│   │   ├── mock-data/         # Mock data for development
│   │   ├── theme/             # Theme system
│   │   └── utils/             # Utility functions
│   ├── types/                  # TypeScript type definitions
│   └── styles/                 # Global styles
├── public/                      # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

## Mock Data

The application currently uses mock data for development. Two mock products are available:

- `/acme/ABC123` - Classic Wool Jacket
- `/acme/DEF456` - Organic Cotton T-Shirt

Mock data is located in:
- `src/lib/mock-data/products.ts` - Product information
- `src/lib/mock-data/themes.ts` - Brand themes and styling

## Theme System

Themes are fully customizable and support:

- **Colors**: Primary, secondary, highlight, borders
- **Typography**: Font families, sizes, weights, line heights
- **Spacing**: Consistent spacing scale
- **Sections**: Show/hide individual sections
- **Images**: Zoom and positioning controls
- **Branding**: Logo placement and sizing
- **Menus**: Custom navigation items
- **CTA**: Customizable call-to-action banner
- **Social**: Footer social media links

Themes are applied via CSS custom properties for maximum flexibility.

## Components

### Layout Components
- `Header`: Fixed header with brand logo and "Powered by Avelero"
- `Footer`: Social media links and legal name
- `ProductImage`: Sticky product image with zoom/positioning
- `InformationFrame`: Right-side content container
- `ContentFrame`: Main content wrapper
- `ImageAndInfo`: Two-column layout manager

### Product Components
- `ProductDescription`: Brand, title, and expandable description
- `ProductDetails`: Technical specifications table

### Impact Components
- `ImpactFrame`: Environmental impact section wrapper
- `LargeImpactCard`: Metric cards (CO2, water, etc.)
- `SmallImpactFrame`: Horizontal scrollable claims
- `SmallImpactCard`: Individual certification badges

### Other Components
- `MaterialsFrame`: Materials composition display
- `JourneyFrame`: Supply chain timeline
- `MenuFrame` / `MenuButton`: Navigation menus
- `CTABanner`: Call-to-action with background image
- `ProductCarousel`: Horizontal scrollable product carousel

## Future Integration

This application is built with future API integration in mind. See `INTEGRATION.md` for:

- REST API integration for public product data
- tRPC integration for private theme data
- Database schema changes
- Hash-based ISR for performance
- Deployment configuration

## Development Guidelines

1. **Type Safety**: All components use TypeScript types
2. **Props Pattern**: Components accept `theme` prop for styling
3. **Responsive Design**: Mobile-first with desktop enhancements
4. **Performance**: Optimized images and lazy loading
5. **Accessibility**: Semantic HTML and ARIA labels

## Available Scripts

```bash
bun run dev:dpp       # Start development server
bun run build:dpp     # Build for production
bun run start:dpp     # Start production server
bun run lint          # Run linter
bun run typecheck     # Type check without emitting
```

## Environment Variables

Create `.env.local` for local development:

```bash
# Future API Integration (not currently used)
# NEXT_PUBLIC_API_URL=https://api.avelero.com
# NEXT_PUBLIC_REST_API_URL=https://api.avelero.com/public
# REVALIDATION_SECRET=your-secret-here
```

## Contributing

This is part of the Avelero monorepo. Follow the main repository's contribution guidelines.

## License

Proprietary - Avelero


