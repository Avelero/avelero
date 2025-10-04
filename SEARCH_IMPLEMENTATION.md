# Passport Search Implementation

## Overview

The passport search functionality has been enhanced with the following features:
1. **Manual trigger strategy** - Search executes only on Enter key or blur (click away)
2. **Case-insensitive search** - Search works regardless of letter case
3. **NULL-safe queries** - Handles NULL values in database fields properly

## Search Behavior

### Trigger Strategy

Search queries are **NOT** sent while typing. Instead, they execute when:

1. **User presses Enter key** - Immediate execution
2. **User clicks away from search box** - Blur event triggers search
3. **User clicks any button/filter** - Blur happens first, then the click action

### Case Sensitivity

**Search is completely case-insensitive** using PostgreSQL's `ILIKE` operator.

All of these queries return the same results:
- `SKU-D28BE390-006377` (uppercase)
- `sku-d28be390-006377` (lowercase)
- `Sku-D28be390-006377` (mixed case)

Examples:
- `Blue` = `blue` = `BLUE` = `bLuE`
- `Summer` = `summer` = `SUMMER`
- `SKU-123` = `sku-123` = `Sku-123`

### Search Fields

The search looks across multiple fields simultaneously:
- **Product name** (`products.name`)
- **Product description** (`products.description`)
- **Season** (`products.season`)
- **SKU** (`product_variants.sku`)
- **UPID** (`product_variants.upid`)
- **Passport ID** (`passports.id`)
- **Slug** (`passports.slug`)
- **Category name** (`categories.name`)
- **Color name** (`brand_colors.name`)
- **Size name** (`brand_sizes.name`)

## Technical Implementation

### Frontend (React Hooks)

**File**: `/apps/app/src/hooks/use-search-state.ts`

```typescript
export function useSearchState(initialQuery = "") {
  const [query, setQuery] = useState(initialQuery);
  const [executedQuery, setExecutedQuery] = useState(initialQuery);

  const actions = {
    setQuery: (newQuery) => setQuery(newQuery),
    executeSearch: () => setExecutedQuery(query), // Manual trigger
    clearQuery: () => { setQuery(""); setExecutedQuery(""); }
  };

  return [{ query, debouncedQuery: executedQuery }, actions];
}
```

### Frontend (Input Component)

**File**: `/apps/app/src/components/passports/passport-controls.tsx`

```typescript
<Input
  value={searchState?.query || ""}
  onChange={(e) => searchActions?.setQuery(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchActions?.executeSearch(); // Trigger on Enter
    }
  }}
  onBlur={() => {
    setIsSearchFocused(false);
    searchActions?.executeSearch(); // Trigger on blur
  }}
/>
```

### Backend (SQL Query)

**File**: `/apps/api/src/trpc/routers/passports.ts`

```typescript
if (filter.search?.trim()) {
  const searchTerm = `%${filter.search.trim()}%`;
  
  // ILIKE = case-Insensitive LIKE
  // COALESCE handles NULL values by converting them to empty strings
  conditions.push(
    sql`(
      ${products.name} ILIKE ${searchTerm}
      OR COALESCE(${products.description}, '') ILIKE ${searchTerm}
      OR COALESCE(${products.season}, '') ILIKE ${searchTerm}
      OR COALESCE(${productVariants.sku}, '') ILIKE ${searchTerm}
      OR ${productVariants.upid} ILIKE ${searchTerm}
      OR ${passports.id}::text ILIKE ${searchTerm}
      OR ${passports.slug} ILIKE ${searchTerm}
      OR COALESCE(${categories.name}, '') ILIKE ${searchTerm}
      OR COALESCE(${brandColors.name}, '') ILIKE ${searchTerm}
      OR COALESCE(${brandSizes.name}, '') ILIKE ${searchTerm}
    )`
  );
}
```

## Why This Design?

### Manual Trigger (Enter/Blur)

**Problem**: Auto-debouncing sends API calls while user is still typing
- Wasteful API calls
- Poor user experience
- Unexpected behavior while typing

**Solution**: Execute only when user is ready
- Press Enter = "I'm done typing, search now"
- Click away = "I'm moving on, search with what I typed"
- Reduces API load
- Predictable behavior

### Case-Insensitive Search

**Problem**: Users shouldn't have to match exact case
- User types "blue" but data has "Blue"
- User types "SKU-123" but data has "sku-123"
- Frustrating user experience

**Solution**: Use PostgreSQL's `ILIKE` operator
- `ILIKE` = case-Insensitive LIKE
- "Blue" matches "blue", "BLUE", "bLuE"
- Works for all text fields
- Native PostgreSQL feature (fast)

### NULL-Safe Queries

**Problem**: `NULL ILIKE 'pattern'` returns `NULL` (not `FALSE`)
- In OR conditions, NULL can break the entire expression
- Fields with NULL values break search
- Inconsistent results

**Solution**: Use `COALESCE(field, '')` to convert NULL to empty string
- `COALESCE(NULL, '')` = `''`
- `'' ILIKE 'pattern'` = `FALSE` (clean boolean)
- OR conditions work correctly
- Consistent results

## Testing

### Test Case-Insensitive Search

1. Navigate to http://localhost:3000/passports
2. Search for a product you know exists (e.g., "Blue Shirt")
3. Try these variations and verify all return the same results:
   - `Blue Shirt`
   - `blue shirt`
   - `BLUE SHIRT`
   - `bLuE sHiRt`

### Test Manual Trigger

1. Start typing in the search box
2. Open browser DevTools → Network tab
3. Verify NO API calls are made while typing
4. Press Enter
5. Verify API call is made immediately
6. Type something new
7. Click outside the search box
8. Verify API call is made on blur

### Test NULL Handling

1. Search for partial SKUs (some variants may have NULL SKUs)
2. Verify search completes without errors
3. Check API logs for successful query execution
4. Results should include items with and without SKUs

## Debug Logs

Enable debug logging to see search execution:

**Browser Console**:
```
useSearchState: setQuery called with: blue shirt
useSearchState: executeSearch called with: blue shirt
```

**API Server**:
```
[SEARCH DEBUG] Input filter: {"search":"blue shirt"}
[SEARCH DEBUG] Raw search: blue shirt | Pattern: %blue shirt% | Case-insensitive: YES (ILIKE)
```

## Performance Considerations

- **Reduced API calls**: No calls while typing, only on explicit trigger
- **Database indexes**: Ensure indexes exist on frequently searched fields
- **ILIKE performance**: Consider using PostgreSQL's `pg_trgm` extension for better performance on partial matches
- **Field selection**: Search only includes fields displayed to users

## Future Enhancements

Potential improvements for future iterations:

1. **Search highlighting** - Highlight matched terms in results
2. **Search suggestions** - Auto-complete based on common searches
3. **Search history** - Remember recent searches per user
4. **Advanced operators** - Support quotes for exact match, minus for exclusion
5. **Field-specific search** - Allow searching in specific fields (e.g., `sku:123`)
6. **Full-text search** - Use PostgreSQL's `tsvector` for more advanced text search
