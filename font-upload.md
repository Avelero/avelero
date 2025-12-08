# Custom Font Upload Feature Plan

## Overview

Enable brands to upload custom fonts for their Digital Product Passports (DPP), providing full typography control beyond Google Fonts. Users can drag-and-drop font files, and metadata (family name, weight, style) is automatically extracted.

## Goals

- **Zero manual entry**: Font metadata auto-detected from file
- **Seamless integration**: Works alongside existing Google Fonts selection
- **Simple UX**: Drag-and-drop upload in font selection popover
- **Multiple weights**: Support uploading multiple files for the same font family
- **Variable fonts**: Support modern variable fonts with weight ranges

---

## Current Infrastructure (Already Built)

### 1. Custom Font Type System
```typescript
// packages/dpp-components/src/types/theme-styles.ts
interface CustomFont {
  fontFamily: string;
  src: string;           // CDN URL
  fontWeight?: number | string;  // 400 or "100 900" for variable
  fontStyle?: string;    // 'normal', 'italic'
  fontDisplay?: string;  // 'swap' (default)
  format?: string;       // 'woff2', 'woff', 'truetype', 'opentype'
  unicodeRange?: string;
}
```

### 2. CSS Generation
```typescript
// packages/dpp-components/src/lib/css-generator.ts
generateFontFaceCSS(customFonts?: CustomFont[]): string
// Already generates proper @font-face rules
```

### 3. DPP Rendering
```typescript
// apps/dpp/src/app/[brand]/[productUpid]/page.tsx
const fontFaceCSS = generateFontFaceCSS(themeStyles?.customFonts);
// Already injects custom fonts via <style> tag
```

### 4. Storage
- Bucket: `dpp-assets` (public)
- Path pattern: `[brandId]/fonts/[filename]`
- Generic upload utilities: `apps/app/src/hooks/use-upload.ts`

### 5. Database
- `brand_theme.theme_styles` (JSONB) already stores `customFonts` array
- No schema changes needed

---

## Technical Approach

### Font Metadata Extraction

Using `opentype.js` (already installed) to parse font files client-side:

```typescript
import opentype from "opentype.js";

// Extracts from font tables:
// - Font family name (from name table)
// - Weight class (from OS/2 table)
// - Style (italic/oblique flags)
// - Variable font detection (fvar table)
// - Weight axis range for variable fonts
```

### Storage Structure

```
dpp-assets/
└── [brandId]/
    ├── banner/
    ├── header-logo/
    └── fonts/
        ├── inter-400-normal.woff2
        ├── inter-700-normal.woff2
        └── playfair-display-400-900-normal.woff2  (variable)
```

### Font Family Grouping

Multiple uploaded files with the same normalized family name are grouped:
- `Inter-Regular.ttf` → family: "Inter", weight: 400
- `Inter-Bold.ttf` → family: "Inter", weight: 700

Both stored as separate `CustomFont` entries but share `fontFamily: "Inter"`.

### Modal Upload Flow (Code Example)

The modal component orchestrates the entire flow using existing utilities:

```typescript
// In custom-fonts-modal.tsx
import { useUpload } from "@/hooks/use-upload";
import { parseFontFile, normalizeFontFamily } from "@/utils/font-parser";
import { validateFontFile } from "@/utils/upload";
import { UPLOAD_CONFIGS } from "@/utils/storage-config";
import type { CustomFont } from "@v1/dpp-components";

function CustomFontsModal({ brandId, customFonts, onFontsChange, ... }) {
  const { uploadFile, isLoading } = useUpload();

  const handleFileDrop = async (file: File) => {
    // 1. Validate extension
    const validation = validateFontFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // 2. Parse metadata (auto-detect family, weight, style)
    const metadata = await parseFontFile(file);
    const family = normalizeFontFamily(metadata.fontFamily);

    // 3. Upload using existing hook
    const filename = `${family}-${metadata.fontWeight}-${metadata.fontStyle}.${metadata.format}`;
    const result = await uploadFile({
      file,
      bucket: UPLOAD_CONFIGS.font.bucket,
      path: [brandId, "fonts", filename],
      isPublic: true,
      validation: validateFontFile,
    });

    // 4. Build CustomFont and update state
    const newFont: CustomFont = {
      fontFamily: family,
      src: result.displayUrl,
      fontWeight: metadata.fontWeight,
      fontStyle: metadata.fontStyle,
      format: metadata.format,
      fontDisplay: "swap",
    };

    onFontsChange([...customFonts, newFont]);
  };

  // ... render drag & drop UI, font list, etc.
}
```

---

## Files to Create/Modify

### 1. NEW: Font Parser Utility
**Path**: `apps/app/src/utils/font-parser.ts`

The only genuinely new file - handles opentype.js integration for metadata extraction.

```typescript
export interface ParsedFontMetadata {
  fontFamily: string;
  fontWeight: number | string;  // 400 or "100 900" for variable
  fontStyle: "normal" | "italic" | "oblique";
  isVariable: boolean;
  format: "woff2" | "woff" | "truetype" | "opentype";
  weightRange?: { min: number; max: number };
}

// Functions:
// - parseFontFile(file: File): Promise<ParsedFontMetadata>
// - normalizeFontFamily(name: string): string
```

### 2. MODIFY: Upload Utilities
**Path**: `apps/app/src/utils/upload.ts`

Add font validation alongside existing `validateFile()` and `validateImageFile()`:

```typescript
// Add constants:
export const FONT_EXTENSIONS = ["woff2", "woff", "ttf", "otf"] as const;

// Add function:
export function validateFontFile(file: File): ValidationResult {
  // Extension-based validation (more reliable than MIME for fonts)
}
```

### 3. MODIFY: Storage Config
**Path**: `apps/app/src/utils/storage-config.ts`

Add font config to existing `UPLOAD_CONFIGS`:

```typescript
export const UPLOAD_CONFIGS = {
  // ... existing configs ...
  font: {
    bucket: BUCKETS.DPP_ASSETS,
    maxBytes: 10 * 1024 * 1024, // 10MB
    allowedMime: ["font/woff2", "font/woff", ...],
    isPublic: true,
  },
} as const;
```

### 4. NEW: Custom Fonts Modal
**Path**: `apps/app/src/components/modals/custom-fonts-modal.tsx`

Uses existing `useUpload()` hook - no new hook needed.

```typescript
interface CustomFontsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  customFonts: CustomFont[];
  onFontsChange: (fonts: CustomFont[]) => void;
}

// The modal orchestrates:
// 1. validateFontFile() from upload.ts
// 2. parseFontFile() from font-parser.ts  
// 3. uploadFile() from useUpload() hook
// 4. Build CustomFont object and call onFontsChange()
```

### 5. MODIFY: FontSelect Component
**Path**: `apps/app/src/components/select/font-select.tsx`

Changes:
- Add `customFonts` prop
- Add `onManageCustomFonts` callback prop (opens modal)
- Add "Custom Fonts" button in popover header
- Show custom fonts at top of list with distinct styling

---

## Implementation Steps

### Phase 1: Core Utilities (Day 1)

1. **Create `font-parser.ts`**
   - Implement `parseFontFile()` using opentype.js
   - Implement `normalizeFontFamily()` helper
   - Handle edge cases (missing name table, etc.)

2. **Update `upload.ts`**
   - Add `FONT_EXTENSIONS` constant
   - Add `validateFontFile()` function

3. **Update `storage-config.ts`**
   - Add `font` config to `UPLOAD_CONFIGS`

### Phase 2: UI Components (Day 1-2)

4. **Create `custom-fonts-modal.tsx`**
   - Drag & drop zone (reuse patterns from existing uploaders)
   - Use existing `useUpload()` hook for uploads
   - Font list with metadata display (grouped by family)
   - Delete functionality
   - Loading states

5. **Update `font-select.tsx`**
   - Add `customFonts` and `onManageCustomFonts` props
   - Add "Custom Fonts" button in popover header
   - Show custom fonts at top of list with distinct styling

### Phase 3: Integration (Day 2)

6. **Wire up in Typography Editor**
   - Pass custom fonts from design editor context to FontSelect
   - Handle modal state for custom fonts management
   - Connect `onFontsChange` to update `themeStyles.customFonts`

7. **Verify save flow**
   - Custom fonts already in `themeStyles`, verify it saves correctly
   - Ensure `@font-face` CSS is generated in stylesheet

### Phase 4: Testing & Polish (Day 3)

8. **Test end-to-end flow**
   - Upload fonts in theme editor
   - Verify fonts appear in FontSelect
   - Save theme and verify DPP renders correctly

9. **Edge cases**
   - Variable fonts
   - Fonts with unusual naming
   - Large font files
   - Network errors during upload

---

## UI/UX Flow

### Font Selection Popover (Updated)

```
┌─────────────────────────────────────┐
│ 🔍 Search fonts...              [x] │
├─────────────────────────────────────┤
│ [+ Custom Fonts]                    │  ← Opens modal
├─────────────────────────────────────┤
│ YOUR FONTS                          │  ← Section header (if any custom)
│ ┌─────────────────────────────────┐ │
│ │ ★ Inter                         │ │  ← Custom font indicator
│ │ ★ Playfair Display              │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ GOOGLE FONTS                        │
│ ┌─────────────────────────────────┐ │
│ │   ABeeZee                       │ │
│ │   Abel                          │ │
│ │   ...                           │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Custom Fonts Modal

```
┌─────────────────────────────────────────────────────┐
│ Custom Fonts                                    [x] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │     📁 Drag & drop font files here           │  │
│  │        or click to browse                    │  │
│  │                                               │  │
│  │     Supports: .woff2, .woff, .ttf, .otf      │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
├─────────────────────────────────────────────────────┤
│ UPLOADED FONTS                                      │
│                                                     │
│  Inter                                              │
│  ├─ Regular (400)                          [🗑️]    │
│  └─ Bold (700)                             [🗑️]    │
│                                                     │
│  Playfair Display                                   │
│  └─ Variable (400-900)                     [🗑️]    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        custom-fonts-modal.tsx                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐                                                        │
│  │ User drops  │                                                        │
│  │ font file   │                                                        │
│  └──────┬──────┘                                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌──────────────────┐                                                   │
│  │ validateFontFile │  ← from upload.ts                                 │
│  │ (extension check)│                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐     ┌────────────────────────────┐                │
│  │  parseFontFile   │────▶│ Extracted metadata:        │                │
│  │  (opentype.js)   │     │ - fontFamily: "Inter"      │                │
│  └──────────────────┘     │ - fontWeight: 400          │                │
│                           │ - fontStyle: "normal"      │                │
│                           │ - format: "woff2"          │                │
│                           └─────────────┬──────────────┘                │
│                                         │                               │
│                                         ▼                               │
│  ┌──────────────────┐     ┌────────────────────────────┐                │
│  │   useUpload()    │────▶│ Upload result:             │                │
│  │   .uploadFile()  │     │ - displayUrl: "https://..."│                │
│  └──────────────────┘     └─────────────┬──────────────┘                │
│                                         │                               │
│                                         ▼                               │
│                           ┌────────────────────────────┐                │
│                           │ Build CustomFont object:   │                │
│                           │ {                          │                │
│                           │   fontFamily: "Inter",     │                │
│                           │   src: displayUrl,         │                │
│                           │   fontWeight: 400,         │                │
│                           │   fontStyle: "normal",     │                │
│                           │   format: "woff2",         │                │
│                           │   fontDisplay: "swap"      │                │
│                           │ }                          │                │
│                           └─────────────┬──────────────┘                │
│                                         │                               │
│                                         ▼                               │
│                           ┌────────────────────────────┐                │
│                           │ onFontsChange(             │                │
│                           │   [...existingFonts, new]  │                │
│                           │ )                          │                │
│                           └────────────────────────────┘                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                    ┌────────────────────────────────────┐
                    │ themeStyles.customFonts[]          │
                    │ (managed by design editor context) │
                    └────────────────────────────────────┘
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                    ┌──────────────────┐  ┌──────────────────┐
                    │ FontSelect shows │  │ Save action      │
                    │ custom fonts     │  │ persists to DB   │
                    └──────────────────┘  └──────────────────┘
                                                   │
                                                   ▼
                                    ┌────────────────────────────┐
                                    │ DPP renders @font-face CSS │
                                    │ via generateFontFaceCSS()  │
                                    └────────────────────────────┘
```

---

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Invalid font file | Show error: "Could not parse font. Please ensure it's a valid .woff2, .woff, .ttf, or .otf file." |
| Missing font family name | Use filename as fallback, allow user to edit |
| File too large (>10MB) | Show error before upload attempt |
| Network error during upload | Show retry option, don't add to list |
| Duplicate font (same family + weight) | Replace existing or show warning |
| Corrupt font file | opentype.js throws, catch and show error |

---

## Dependencies

### Already Available
- `opentype.js` (installed in apps/app)
- `@v1/supabase/storage` (upload utilities)
- `dpp-assets` bucket (exists, public)
- `CustomFont` type (defined in `@v1/dpp-components`)
- `generateFontFaceCSS()` (implemented in `@v1/dpp-components`)
- `useUpload()` hook (`apps/app/src/hooks/use-upload.ts`)
- `validateFile()` utility (`apps/app/src/utils/upload.ts`)

### No New Dependencies Required

---

## Summary: File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/app/src/utils/font-parser.ts` | **CREATE** | opentype.js integration for metadata extraction |
| `apps/app/src/utils/upload.ts` | MODIFY | Add `validateFontFile()` function |
| `apps/app/src/utils/storage-config.ts` | MODIFY | Add `font` to `UPLOAD_CONFIGS` |
| `apps/app/src/components/modals/custom-fonts-modal.tsx` | **CREATE** | Drag & drop UI, font list management |
| `apps/app/src/components/select/font-select.tsx` | MODIFY | Add custom fonts section + modal trigger |

---

## Testing Checklist

- [ ] Upload .woff2 file → metadata extracted correctly
- [ ] Upload .woff file → metadata extracted correctly
- [ ] Upload .ttf file → metadata extracted correctly  
- [ ] Upload .otf file → metadata extracted correctly
- [ ] Upload variable font → weight range detected
- [ ] Upload multiple weights of same family → grouped correctly
- [ ] Delete individual font file → removed from list and storage
- [ ] Select custom font in typography editor → applied correctly
- [ ] Save theme with custom fonts → persisted to database
- [ ] Load DPP page → custom fonts render correctly
- [ ] Custom fonts appear in FontSelect dropdown
- [ ] Search works for custom fonts
- [ ] Error handling for invalid files
- [ ] Error handling for upload failures

---

## Future Enhancements (Out of Scope)

- Font subsetting (reduce file size by removing unused glyphs)
- Font preview in upload modal
- Font licensing validation
- Automatic format conversion (e.g., TTF → WOFF2)
- Font loading performance monitoring

