.
├── README.md
├── components.json
├── drizzle.config.ts
├── eslint-results.json
├── eslint.config.mjs
├── llm_context
│   ├── authentication-guide.md
│   ├── create-passports-documentation.md
│   ├── data-implementation.md
│   ├── data-insertion-categorization.md
│   ├── design-rules.md
│   ├── progress-updates.md
│   └── project-requirements-document.md
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── public
│   ├── AveleroSVG48.svg
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── scripts
│   └── seed-diverse-test-data.js
├── src
│   ├── app
│   │   ├── (auth)
│   │   │   ├── layout.tsx
│   │   │   ├── login
│   │   │   │   └── page.tsx
│   │   │   └── signup
│   │   │       ├── confirm
│   │   │       │   └── page.tsx
│   │   │       ├── page.tsx
│   │   │       ├── profile
│   │   │       │   └── page.tsx
│   │   │       └── set-password
│   │   │           └── page.tsx
│   │   ├── (dashboard)
│   │   │   ├── layout.tsx
│   │   │   ├── passports
│   │   │   │   ├── create
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   └── settings
│   │   │       ├── layout.tsx
│   │   │       └── users
│   │   │           └── page.tsx
│   │   ├── account
│   │   │   ├── layout.tsx
│   │   │   └── settings
│   │   │       └── page.tsx
│   │   ├── api
│   │   │   ├── account
│   │   │   │   └── route.ts
│   │   │   ├── auth
│   │   │   │   ├── route.ts
│   │   │   │   ├── set-password
│   │   │   │   │   └── route.ts
│   │   │   │   └── verify
│   │   │   │       └── route.ts
│   │   │   ├── brands
│   │   │   │   ├── leave
│   │   │   │   │   └── route.ts
│   │   │   │   ├── route.ts
│   │   │   │   └── users
│   │   │   │       ├── [id]
│   │   │   │       │   └── route.ts
│   │   │   │       └── route.ts
│   │   │   ├── certifications
│   │   │   │   └── route.ts
│   │   │   ├── cron
│   │   │   │   └── delete-unconfirmed-users
│   │   │   │       └── route.ts
│   │   │   ├── facilities
│   │   │   │   └── route.ts
│   │   │   ├── invitations
│   │   │   │   ├── [id]
│   │   │   │   │   └── route.ts
│   │   │   │   ├── route.ts
│   │   │   │   └── token
│   │   │   │       └── [token]
│   │   │   │           └── route.ts
│   │   │   ├── manufacturers
│   │   │   │   └── route.ts
│   │   │   └── products
│   │   │       ├── [id]
│   │   │       │   └── route.ts
│   │   │       ├── bulk
│   │   │       │   └── route.ts
│   │   │       ├── route.ts
│   │   │       └── stats
│   │   │           └── route.ts
│   │   ├── create-brand
│   │   │   └── page.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── invitations
│   │   │   └── accept
│   │   │       └── page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   ├── BrandsSelectionPage.tsx
│   │   ├── MainContent.tsx
│   │   ├── PassportsPage.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── passports
│   │   │   ├── PassportsControls.tsx
│   │   │   ├── PassportsHeader.tsx
│   │   │   ├── PassportsPageClient.tsx
│   │   │   ├── PassportsPagination.tsx
│   │   │   ├── PassportsStats.tsx
│   │   │   ├── PassportsStatsSkeleton.tsx
│   │   │   ├── PassportsTable.tsx
│   │   │   ├── PassportsTableSkeleton.tsx
│   │   │   ├── SortableItem.tsx
│   │   │   └── create
│   │   │       ├── BasicInfoSection.tsx
│   │   │       ├── BrandCreateModal.tsx
│   │   │       ├── CreateHeader.tsx
│   │   │       ├── EnvironmentSection.tsx
│   │   │       ├── IdentifiersSection.tsx
│   │   │       ├── ImageUpload.tsx
│   │   │       ├── JourneySection.tsx
│   │   │       ├── MaterialsSection.tsx
│   │   │       ├── OrganizationSection.tsx
│   │   │       ├── StatusToggle.tsx
│   │   │       └── organization
│   │   │           ├── CategorySelector.tsx
│   │   │           ├── MultiSelectDropdown.tsx
│   │   │           ├── ProgressiveFieldsManager.tsx
│   │   │           └── SingleSelectDropdown.tsx
│   │   ├── settings
│   │   │   └── UsersPageClient.tsx
│   │   └── ui
│   │       ├── ComplianceStatusBadges.tsx
│   │       ├── FormFields.tsx
│   │       ├── SideModal.tsx
│   │       ├── UsersSkeleton.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── checkbox.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── popover.tsx
│   │       ├── sonner.tsx
│   │       ├── table.tsx
│   │       └── toast.tsx
│   ├── drizzle
│   │   ├── 0000_even_professor_monster.sql
│   │   ├── db.ts
│   │   ├── meta
│   │   │   ├── 0000_snapshot.json
│   │   │   └── _journal.json
│   │   ├── relations.ts
│   │   └── schema.ts
│   ├── hooks
│   │   ├── useAuth.ts
│   │   ├── useBrand.ts
│   │   ├── useColumnConfig.ts
│   │   ├── useDebounce.ts
│   │   ├── useImageUpload.ts
│   │   ├── usePassportsData.ts
│   │   ├── useProductStats.ts
│   │   └── useProducts.ts
│   ├── lib
│   │   ├── api-auth.ts
│   │   ├── api-constants.ts
│   │   ├── auth-enhanced.ts
│   │   ├── auth-middleware.ts
│   │   ├── column-config.ts
│   │   ├── compliance-calculator.ts
│   │   ├── cookie-config.ts
│   │   ├── countries.ts
│   │   ├── product-filters.ts
│   │   ├── search-cache.ts
│   │   ├── server-data.ts
│   │   ├── supabase-enhanced.ts
│   │   └── utils.ts
│   ├── middleware.ts
│   ├── providers
│   │   └── query-provider.tsx
│   ├── types
│   │   ├── brand.ts
│   │   ├── filters.ts
│   │   └── index.ts
│   └── utils
│       └── subdomain.ts
├── tsconfig.json
├── tsconfig.tsbuildinfo
├── vercel.json
└── vitest.config.ts