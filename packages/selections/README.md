# @v1/selections

Predefined selection options for the apparel industry. This package provides a single source of truth for categories, colors, certifications, production steps, seasons, sizes, and countries.

## Philosophy

Instead of storing all possible options in the database, this package provides default selections that users can choose from. When a user selects an option, only that specific selection is stored in their database. This approach:

- **Reduces database bloat**: Only stores selections that users actually use
- **Provides consistency**: All users see the same default options
- **Simplifies components**: No need to hardcode options in UI components
- **Enables proper typing**: TypeScript types for all selection options

## Installation

This package is part of the monorepo and can be imported in any workspace project:

```typescript
import { allColors } from "@v1/selections/colors";
import { categoryHierarchy } from "@v1/selections/categories";
import { allCertifications } from "@v1/selections/certifications";
```

Or import everything:

```typescript
import { allColors, categoryHierarchy, allCertifications } from "@v1/selections";
```

## Available Exports

### Categories (`@v1/selections/categories`)

Hierarchical category structure for men's and women's apparel.

```typescript
import { categoryHierarchy, type CategoryNode } from "@v1/selections/categories";

// Access the full hierarchy
const mensBottoms = categoryHierarchy.mens.children.bottoms;
```

### Colors (`@v1/selections/colors`)

Comprehensive color palette for textile and fashion industry.

```typescript
import { allColors, colors, type Color } from "@v1/selections/colors";

// Array of all colors
const colorOptions = allColors; // Color[]

// Access specific colors
const black = colors.BLACK; // { name: "Black", hex: "000000" }
```

### Certifications (`@v1/selections/certifications`)

Textile and apparel industry certifications (GOTS, OEKO-TEX, etc.).

```typescript
import { allCertifications, certifications } from "@v1/selections/certifications";

// Array of all certifications
const certOptions = allCertifications; // Certification[]

// Access specific certification
const gots = certifications.GOTS;
```

### Countries (`@v1/selections/countries`)

Complete list of countries with ISO codes, names, and emoji flags.

```typescript
import { allCountries, countries } from "@v1/selections/countries";

// Array of all countries
const countryOptions = allCountries; // Array<{ code, name, emoji }>

// Access specific country
const usa = countries.US; // { code: "US", name: "United States", emoji: "🇺🇸" }
```

### Production Steps (`@v1/selections/production-steps`)

Manufacturing and production journey steps.

```typescript
import { 
  allProductionSteps, 
  productionStepNames,
  productionStepsByCategory 
} from "@v1/selections/production-steps";

// For simple dropdowns
const stepOptions = productionStepNames; // string[]

// Full data with descriptions
const steps = allProductionSteps; // ProductionStep[]

// Grouped by category
const materialSteps = productionStepsByCategory.material;
```

### Seasons (`@v1/selections/seasons`)

Fashion seasonal collections (Spring/Summer, Fall/Winter, etc.).

```typescript
import { 
  allSeasons, 
  seasons,
  generateSeasonOptions 
} from "@v1/selections/seasons";

// All seasons
const seasonOptions = allSeasons; // Season[]

// Generate season options with years
const options = generateSeasonOptions(2024, 3); 
// Returns: [{ season, year, displayName: "SS 2024" }, ...]
```

### Sizes (`@v1/selections/sizes`)

Comprehensive sizing systems (US, EU, UK) for clothing and footwear. **Size systems are category-dependent at level 2** (e.g., "Men's / Tops", "Women's / Bottoms").

```typescript
import { 
  getSizesForCategory,
  getCategoryKey,
  getLevel2CategoryPath,
  defaultSizesByCategory,
  getAllLevel2Categories 
} from "@v1/selections/sizes";

// Get sizes for a specific category path (auto-resolves to level 2)
const sizes = getSizesForCategory("Men's / Tops / Jerseys"); 
// Returns: ["XS", "S", "M", "L", "XL", "XXL", "3XL"]

// Extract level 2 category key
const key = getCategoryKey("Men's / Tops / Jerseys"); 
// Returns: "mens-tops"

// Trim category path to level 2
const level2 = getLevel2CategoryPath("Men's / Tops / Jerseys"); 
// Returns: "Men's / Tops"

// Access category-specific default sizes directly
const mensTops = defaultSizesByCategory["mens-tops"];
const womensDresses = defaultSizesByCategory["womens-dresses"];

// Get all level 2 categories
const allCategories = getAllLevel2Categories();
// Returns: [{ key: "mens-tops", displayName: "Men's / Tops" }, ...]
```

#### Category-Dependent Size Systems

Each level 2 category has its own default size system:

- **Men's / Tops**: XS, S, M, L, XL, XXL, 3XL
- **Men's / Bottoms**: 28, 30, 32, 34, 36, 38, 40, 42
- **Men's / Footwear**: 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13
- **Men's / Outerwear**: XS, S, M, L, XL, XXL, 3XL
- **Women's / Tops**: XXS, XS, S, M, L, XL, XXL
- **Women's / Bottoms**: 00, 0, 2, 4, 6, 8, 10, 12, 14, 16
- **Women's / Dresses**: XXS, XS, S, M, L, XL, XXL
- **Women's / Footwear**: 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11
- **Women's / Outerwear**: XXS, XS, S, M, L, XL, XXL

Categories deeper than level 2 (e.g., "Men's / Tops / Jerseys") automatically use their level 2 parent's size system.

## Usage Example

Here's how to use these selections in a component:

```typescript
import { allColors, type Color } from "@v1/selections/colors";
import { ColorSelect } from "./color-select";

export function ProductForm() {
  const [selectedColors, setSelectedColors] = useState<Color[]>([]);

  return (
    <ColorSelect
      value={selectedColors}
      onValueChange={setSelectedColors}
      defaultColors={allColors} // Pass default options
      placeholder="Add color"
    />
  );
}
```

When the user selects colors and saves the product, only the selected colors are stored in the database.

## TypeScript Support

All exports include proper TypeScript types:

```typescript
import type { 
  Color,
  ColorName,
  Category,
  CategoryKey,
  Certification,
  CertificationId,
  ProductionStep,
  ProductionStepId,
  Season,
  SeasonId,
  SizeSystem,
  SizeSystemId,
  Country,
  CountryCode
} from "@v1/selections";
```

## Maintenance

To add new options:

1. Edit the appropriate file in `packages/selections/src/`
2. Follow the existing pattern (Record object + allXxx export)
3. Run `bun typecheck` to verify types
4. Run `bun lint` to check for errors

## Files

- `categories.ts` - Product category hierarchy
- `certifications.ts` - Industry certifications
- `colors.ts` - Color palette with hex values
- `countries.ts` - Countries with ISO codes
- `production-steps.ts` - Manufacturing journey steps
- `seasons.ts` - Seasonal collections
- `sizes.ts` - Sizing systems for apparel and footwear
- `index.ts` - Convenience exports

