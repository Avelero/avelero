# Passport Design System - Implementation Progress

## 🎯 Overview

A passport design system with live preview using iframe + postMessage:
- **Content Tab** (`/design`): Configure logos, banners, buttons, carousels, socials (Uses `ThemeConfig`)
- **Theme Tab** (`/design/theme`): Configure design tokens - **Coming in Phase 2**
- **Live Preview**: iframe-based mobile preview with real-time updates via postMessage
- **Global Configuration**: Single config shared across all passports

---

## ✅ Phase 1 Complete - Preview Infrastructure

### **What We Built:**

#### **1. Type Exports (DPP Package)**
- ✅ Added exports to `apps/dpp/package.json`
- ✅ Types available at `@v1/dpp/types/theme-config`
- ✅ Added `@v1/dpp` workspace dependency to admin app

#### **2. DPP Preview Route**
- ✅ Created `apps/dpp/src/app/preview/page.tsx`
- ✅ Implements postMessage listener for config updates
- ✅ Validates message origin for security
- ✅ Renders DPP with received ThemeConfig
- ✅ Sends `PREVIEW_READY` event to parent

#### **3. Preview Components (Admin)**
- ✅ `use-preview-messenger.ts` - Hook for postMessage communication
- ✅ `preview-frame.tsx` - iframe wrapper with dynamic zoom scaling
- ✅ Uses CSS `zoom` property for responsive scaling
- ✅ Calculates zoom: `containerHeight / 852` (iPhone 14 Pro height)
- ✅ ResizeObserver for responsive updates

#### **4. State Management**
- ✅ `design-provider.tsx` - Context for shared config state
- ✅ `use-design-config.ts` - Hook to access/update config
- ✅ Type-safe context with `ThemeConfig`

#### **5. Example Section Components**
- ✅ `header-section.tsx` - Configure header logo
- ✅ `footer-section.tsx` - Configure social media links
- Both use context for state management

#### **6. Main Design Page**
- ✅ Server component with Suspense boundaries
- ✅ DesignProvider wraps content
- ✅ Two-panel layout: form controls (left) + preview (right)
- ✅ Sticky preview panel
- ✅ Proper overflow handling

---

## 📁 Created Files

```
✅ apps/dpp/src/app/preview/page.tsx
✅ apps/app/src/hooks/use-preview-messenger.ts
✅ apps/app/src/hooks/use-design-config.ts
✅ apps/app/src/components/design/design-provider.tsx
✅ apps/app/src/components/design/preview-frame.tsx
✅ apps/app/src/components/design/header-section.tsx
✅ apps/app/src/components/design/footer-section.tsx
```

**Modified:**
```
✅ apps/dpp/package.json (added exports)
✅ apps/app/package.json (added @v1/dpp dependency)
✅ apps/app/src/app/(dashboard)/(sidebar)/design/page.tsx (refactored)
✅ apps/app/src/app/(dashboard)/(sidebar)/design/layout.tsx (fixed overflow)
```

---

## 🔧 Technical Implementation

### **iframe Scaling Solution**
Uses CSS `zoom` property for responsive scaling:
- Container maintains aspect ratio `393/852` (iPhone 14 Pro)
- iframe renders at full device size (393×852px)
- zoom calculated dynamically: `containerHeight / DEVICE_HEIGHT`
- ResizeObserver updates zoom on window resize
- No layout overflow (zoom affects both visual and layout space)

### **postMessage Flow**
```
User edits form
  ↓
Context updates
  ↓
usePreviewMessenger detects change
  ↓
Sends THEME_CONFIG_UPDATE to iframe
  ↓
DPP preview receives + validates origin
  ↓
Updates config state
  ↓
Re-renders with new config
```

### **Security**
- Origin validation in preview page
- Allowed origins: `localhost:3000`, `app.avelero.com`
- iframe sandbox: `allow-scripts allow-same-origin`

---

## 📋 Phase 2 To-Do List

### **A. Remaining Section Components** 🔨

#### **1. Redirects Section** (`redirects-section.tsx`)
- [ ] Enable/disable toggle
- [ ] 5 configurable buttons (label + link)
- [ ] Maps to `config.menus.primary`
- [ ] Add/remove buttons dynamically

#### **2. Carousel Section** (`carousel-section.tsx`)
- [ ] Enable/disable toggle
- [ ] Product count selector (1-10)
- [ ] "Manage Products" button → opens product selector modal
- [ ] Maps to `config.sections.showSimilarProducts` + count

#### **3. Banner Section** (`banner-section.tsx`)
- [ ] Enable/disable toggle
- [ ] Background image upload
- [ ] Logo toggle + upload
- [ ] Headline toggle + text input
- [ ] Secondary text toggle + text input
- [ ] Button toggle + label + link
- [ ] Maps to `config.cta`

---

### **B. File Upload System** 📸

Need to implement image uploads for:
- Header logo (`config.branding.headerLogoUrl`)
- Banner background (`config.cta.bannerBackgroundImage`)
- Banner logo (`config.branding.bannerLogoUrl`)

**Options:**
1. **Use existing upload infrastructure** (if you have one)
2. **Integrate with existing avatar upload system** (`AvatarUpload` component)
3. **Create new upload component** for design assets

**Tasks:**
- [ ] Decide on upload strategy (immediate vs on-save)
- [ ] Create `DesignImageUpload` component
- [ ] Integrate with storage (Cloudinary/Supabase/S3)
- [ ] Add upload to header/banner sections
- [ ] Handle upload errors/loading states

---

### **C. Save Functionality** 💾

#### **Backend:**
- [ ] Create database schema for passport config
  - Single row? Brand-level? Global?
- [ ] Create tRPC/API route: `passportConfig.update`
- [ ] Implement validation (Zod schema)
- [ ] Handle config persistence

#### **Frontend:**
- [ ] Add "Save" button to layout (ControlBarRight?)
- [ ] Track dirty state (unsaved changes)
- [ ] Implement save mutation
- [ ] Show success/error toasts
- [ ] Reset dirty state on save
- [ ] Confirm before leaving with unsaved changes

**Suggested Schema:**
```typescript
// In database
passportConfig {
  id: string;
  brandId: string;  // or null for global
  config: ThemeConfig;  // JSONB column
  updatedAt: timestamp;
}
```

---

### **D. DPP Integration** 🔗

Currently the preview shows demo data. Need to integrate config:

**In DPP Components:**
- [ ] Update `Header` to use `config.branding.headerLogoUrl`
- [ ] Update `Footer` to use `config.social` for links
- [ ] Update CTA banner to use `config.cta`
- [ ] Show/hide sections based on `config.sections`
- [ ] Apply menu items from `config.menus`

---

### **E. Validation & UX** ✨

- [ ] Add URL validation for links
- [ ] Add required field indicators
- [ ] Add character limits for text inputs
- [ ] Add "Reset to defaults" button
- [ ] Add loading states for sections
- [ ] Add error boundaries
- [ ] Test with empty/invalid data

---

### **F. Theme Tab** (Future Phase)

- [ ] Create `/design/theme/page.tsx`
- [ ] Design token controls (colors, fonts)
- [ ] Use `ThemeStyles` type
- [ ] Component style overrides
- [ ] Live preview of theme changes

---

## 🎯 Immediate Next Steps (Priority Order)

1. **Redirects Section** - Finish basic content controls
2. **Banner Section** - Most visual impact
3. **Carousel Section** - Complete content tab
4. **File Upload** - Enable logo/background uploads
5. **Save Functionality** - Persist changes
6. **DPP Integration** - Make preview actually use config
7. **Validation** - Polish UX

---

## 🐛 Known Issues

- ✅ ~~Scroll feels slightly buggy in iframe~~ - Expected with CSS zoom, acceptable for preview
- ⚠️ Preview shows demo data instead of actual config
- ⚠️ No save functionality yet
- ⚠️ Missing 3 section components (redirects, carousel, banner)

---

## 📝 Notes

- **Server Components**: Page uses Suspense for progressive loading
- **Context Pattern**: Clean state sharing without prop drilling
- **Type Safety**: Full TypeScript across iframe boundary
- **Security**: Origin validation prevents unauthorized postMessage
- **Responsive**: Dynamic zoom calculation works on all screen sizes
- **Clean Code**: No mobile-frame wrapper needed, simpler implementation

---

## 🤔 Design Decisions Made

1. **Context over props** - Cleaner than passing config through all components
2. **CSS zoom over transform** - Avoids layout overflow issues
3. **Dynamic zoom calculation** - Responsive to any screen size
4. **Removed mobile frame wrapper** - Unnecessary complexity
5. **Server component page** - Leverages Next.js 16 features
6. **Suspense boundaries** - Better UX with progressive loading
