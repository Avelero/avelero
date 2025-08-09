This is a shortened tree, limting the amount of non-folder files to 20 per folder.

.
├── LICENSE
├── README.md
├── SECURITY.md
├── apps
│   ├── api
│   │   ├── Dockerfile
│   │   ├── README.md
│   │   ├── drizzle.config.ts
│   │   ├── fly-preview.yml
│   │   ├── fly.toml
│   │   ├── migrations
│   │   │   ├── 0000_bumpy_chat.sql
│   │   │   └── meta
│   │   │       ├── 0000_snapshot.json
│   │   │       └── _journal.json
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── db
│   │   │   │   ├── index.ts
│   │   │   │   ├── queries  [27 entries exceeds filelimit, not opening dir]
│   │   │   │   ├── replicas.ts
│   │   │   │   └── schema.ts
│   │   │   ├── index.ts
│   │   │   ├── rest
│   │   │   │   ├── middleware
│   │   │   │   │   ├── auth.ts
│   │   │   │   │   ├── db.ts
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── primary-read-after-write.ts
│   │   │   │   │   └── scope.ts
│   │   │   │   ├── routers
│   │   │   │   │   ├── bank-accounts.ts
│   │   │   │   │   ├── customers.ts
│   │   │   │   │   ├── documents.ts
│   │   │   │   │   ├── inbox.ts
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── invoices.ts
│   │   │   │   │   ├── metrics.ts
│   │   │   │   │   ├── search.ts
│   │   │   │   │   ├── tags.ts
│   │   │   │   │   ├── teams.ts
│   │   │   │   │   ├── tracker-entries.ts
│   │   │   │   │   ├── tracker-projects.ts
│   │   │   │   │   ├── transactions.ts
│   │   │   │   │   └── users.ts
│   │   │   │   └── types.ts
│   │   │   ├── schemas  [24 entries exceeds filelimit, not opening dir]
│   │   │   ├── services
│   │   │   │   ├── resend.ts
│   │   │   │   └── supabase.ts
│   │   │   ├── trpc
│   │   │   │   ├── init.ts
│   │   │   │   ├── middleware
│   │   │   │   │   ├── primary-read-after-write.ts
│   │   │   │   │   └── team-permission.ts
│   │   │   │   └── routers  [26 entries exceeds filelimit, not opening dir]
│   │   │   └── utils
│   │   │       ├── api-keys.ts
│   │   │       ├── auth.ts
│   │   │       ├── cache
│   │   │       │   ├── api-key-cache.ts
│   │   │       │   └── user-cache.ts
│   │   │       ├── geo.ts
│   │   │       ├── health.ts
│   │   │       ├── logger.ts
│   │   │       ├── parse.ts
│   │   │       ├── scopes.ts
│   │   │       ├── search-filters.ts
│   │   │       ├── search.ts
│   │   │       └── validate-response.ts
│   │   └── tsconfig.json
│   ├── dashboard
│   │   ├── README.md
│   │   ├── image-loader.ts
│   │   ├── next.config.mjs
│   │   ├── package.json
│   │   ├── postcss.config.cjs
│   │   ├── public
│   │   │   ├── appicon.png
│   │   │   └── assets
│   │   │       ├── bg-login-dark.jpg
│   │   │       ├── bg-login.jpg
│   │   │       ├── overview-1-light.png
│   │   │       ├── overview-1.png
│   │   │       ├── overview-2-light.png
│   │   │       ├── overview-2.png
│   │   │       ├── setup-animation-dark.json
│   │   │       ├── setup-animation.json
│   │   │       ├── transactions-1-light.png
│   │   │       ├── transactions-1.png
│   │   │       ├── transactions-2-light.png
│   │   │       └── transactions-2.png
│   │   ├── src
│   │   │   ├── actions
│   │   │   │   ├── ai
│   │   │   │   │   ├── editor
│   │   │   │   │   │   └── generate-editor-content.ts
│   │   │   │   │   ├── filters
│   │   │   │   │   │   ├── generate-invoice-filters.ts
│   │   │   │   │   │   ├── generate-tracker-filters.ts
│   │   │   │   │   │   ├── generate-transactions-filters.ts
│   │   │   │   │   │   └── generate-vault-filters.ts
│   │   │   │   │   ├── generate-csv-mapping.ts
│   │   │   │   │   └── get-tax-rate.ts
│   │   │   │   ├── export-transactions-action.ts
│   │   │   │   ├── hide-connect-flow-action.ts
│   │   │   │   ├── institutions
│   │   │   │   │   ├── create-enablebanking-link.ts
│   │   │   │   │   ├── create-gocardless-link.ts
│   │   │   │   │   ├── create-plaid-link.ts
│   │   │   │   │   ├── exchange-public-token.ts
│   │   │   │   │   ├── reconnect-enablebanking-link.ts
│   │   │   │   │   └── reconnect-gocardless-link.ts
│   │   │   │   ├── mfa-verify-action.ts
│   │   │   │   ├── safe-action.ts
│   │   │   │   ├── send-feedback-action.ts
│   │   │   │   ├── send-support-action.tsx
│   │   │   │   ├── set-weekly-calendar-action.ts
│   │   │   │   ├── tracking-consent-action.ts
│   │   │   │   ├── transactions
│   │   │   │   │   ├── import-transactions.ts
│   │   │   │   │   ├── manual-sync-transactions-action.ts
│   │   │   │   │   └── reconnect-connection-action.ts
│   │   │   │   ├── unenroll-mfa-action.ts
│   │   │   │   ├── update-column-visibility-action.ts
│   │   │   │   ├── update-subscriber-preference-action.ts
│   │   │   │   └── verify-otp-action.ts
│   │   │   ├── app
│   │   │   │   ├── [locale]
│   │   │   │   │   ├── (app)
│   │   │   │   │   │   ├── (sidebar)
│   │   │   │   │   │   │   ├── account
│   │   │   │   │   │   │   │   ├── date-and-locale
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   ├── layout.tsx
│   │   │   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   │   │   ├── security
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   ├── support
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   └── teams
│   │   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   │   ├── apps
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── customers
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── inbox
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── invoices
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── layout.tsx
│   │   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   │   ├── settings
│   │   │   │   │   │   │   │   ├── accounts
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   ├── billing
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   ├── developer
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   ├── layout.tsx
│   │   │   │   │   │   │   │   ├── members
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   ├── notifications
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── tracker
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── transactions
│   │   │   │   │   │   │   │   ├── categories
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   └── vault
│   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   ├── desktop
│   │   │   │   │   │   │   ├── checkout
│   │   │   │   │   │   │   │   └── success
│   │   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   │   └── search
│   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   ├── mfa
│   │   │   │   │   │   │   ├── setup
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   └── verify
│   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   ├── setup
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── teams
│   │   │   │   │   │       ├── create
│   │   │   │   │   │       │   └── page.tsx
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   ├── (public)
│   │   │   │   │   │   ├── all-done
│   │   │   │   │   │   │   ├── event-emitter.tsx
│   │   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   │   └── schema.ts
│   │   │   │   │   │   ├── i
│   │   │   │   │   │   │   └── [token]
│   │   │   │   │   │   │       ├── opengraph-image.tsx
│   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   ├── login
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   ├── s
│   │   │   │   │   │   │   └── [shortId]
│   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   └── verify
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   ├── error.tsx
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── not-found.tsx
│   │   │   │   │   └── providers.tsx
│   │   │   │   ├── api
│   │   │   │   │   ├── apps
│   │   │   │   │   │   └── slack
│   │   │   │   │   │       ├── install-url
│   │   │   │   │   │       │   └── route.ts
│   │   │   │   │   │       ├── interactive
│   │   │   │   │   │       │   └── route.ts
│   │   │   │   │   │       └── oauth_callback
│   │   │   │   │   │           └── route.ts
│   │   │   │   │   ├── auth
│   │   │   │   │   │   └── callback
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   ├── chat
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── checkout
│   │   │   │   │   │   ├── route.ts
│   │   │   │   │   │   └── success
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   ├── connector
│   │   │   │   │   │   └── callback
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   ├── download
│   │   │   │   │   │   ├── file
│   │   │   │   │   │   │   └── route.ts
│   │   │   │   │   │   └── invoice
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   ├── enablebanking
│   │   │   │   │   │   └── session
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   ├── gocardless
│   │   │   │   │   │   └── reconnect
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   ├── portal
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── preview
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── proxy
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── webhook
│   │   │   │   │       ├── inbox
│   │   │   │   │       │   └── route.ts
│   │   │   │   │       ├── plaid
│   │   │   │   │       │   └── route.ts
│   │   │   │   │       ├── polar
│   │   │   │   │       │   └── route.ts
│   │   │   │   │       ├── registered
│   │   │   │   │       │   └── route.ts
│   │   │   │   │       └── teller
│   │   │   │   │           └── route.ts
│   │   │   │   ├── favicon.ico
│   │   │   │   └── global-error.tsx
│   │   │   ├── components  [189 entries exceeds filelimit, not opening dir]
│   │   │   ├── hooks  [34 entries exceeds filelimit, not opening dir]
│   │   │   ├── lib
│   │   │   │   ├── download.ts
│   │   │   │   └── tools
│   │   │   │       ├── get-burn-rate.ts
│   │   │   │       ├── get-documents.tsx
│   │   │   │       ├── get-forecast.ts
│   │   │   │       ├── get-inbox.tsx
│   │   │   │       ├── get-profit.ts
│   │   │   │       ├── get-revenue.ts
│   │   │   │       ├── get-runway.ts
│   │   │   │       ├── get-spending.ts
│   │   │   │       ├── get-tax-summary.ts
│   │   │   │       └── get-transactions.ts
│   │   │   ├── locales
│   │   │   │   ├── client.ts
│   │   │   │   ├── en.ts
│   │   │   │   ├── server.ts
│   │   │   │   └── sv.ts
│   │   │   ├── middleware.ts
│   │   │   ├── store
│   │   │   │   ├── assistant.ts
│   │   │   │   ├── export.ts
│   │   │   │   ├── invoice.ts
│   │   │   │   ├── search.ts
│   │   │   │   ├── token-modal.ts
│   │   │   │   ├── transactions.ts
│   │   │   │   └── vault.ts
│   │   │   ├── styles
│   │   │   │   └── globals.css
│   │   │   ├── trpc
│   │   │   │   ├── client.tsx
│   │   │   │   ├── query-client.ts
│   │   │   │   └── server.tsx
│   │   │   ├── types
│   │   │   │   └── react-table.d.ts
│   │   │   └── utils
│   │   │       ├── canvas-factory.ts
│   │   │       ├── categories.ts
│   │   │       ├── columns.ts
│   │   │       ├── connection-status.ts
│   │   │       ├── constants.ts
│   │   │       ├── desktop.ts
│   │   │       ├── environment.ts
│   │   │       ├── format.ts
│   │   │       ├── logger.ts
│   │   │       ├── logos.ts
│   │   │       ├── pdf-to-img.ts
│   │   │       ├── plans.ts
│   │   │       ├── polar.ts
│   │   │       ├── process.ts
│   │   │       ├── resend.ts
│   │   │       ├── teller.ts
│   │   │       ├── tracker.ts
│   │   │       ├── transaction-filters.ts
│   │   │       └── upload.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── vercel.json
│   ├── desktop
│   │   ├── README.md
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── main.tsx
│   │   │   └── vite-env.d.ts
│   │   ├── src-tauri
│   │   │   ├── Cargo.lock
│   │   │   ├── Cargo.toml
│   │   │   ├── build.rs
│   │   │   ├── capabilities
│   │   │   │   ├── default.json
│   │   │   │   └── desktop.json
│   │   │   ├── icons
│   │   │   │   ├── dev
│   │   │   │   │   ├── 128x128.png
│   │   │   │   │   ├── 128x128@2x.png
│   │   │   │   │   ├── 32x32.png
│   │   │   │   │   ├── 64x64.png
│   │   │   │   │   ├── icon.icns
│   │   │   │   │   ├── icon.ico
│   │   │   │   │   └── icon.png
│   │   │   │   ├── production
│   │   │   │   │   ├── 128x128.png
│   │   │   │   │   ├── 128x128@2x.png
│   │   │   │   │   ├── 32x32.png
│   │   │   │   │   ├── 64x64.png
│   │   │   │   │   ├── icon.icns
│   │   │   │   │   ├── icon.ico
│   │   │   │   │   └── icon.png
│   │   │   │   ├── staging
│   │   │   │   │   ├── 128x128.png
│   │   │   │   │   ├── 128x128@2x.png
│   │   │   │   │   ├── 32x32.png
│   │   │   │   │   ├── 64x64.png
│   │   │   │   │   ├── icon.icns
│   │   │   │   │   ├── icon.ico
│   │   │   │   │   └── icon.png
│   │   │   │   └── tray-icon.png
│   │   │   ├── images
│   │   │   │   └── installer.png
│   │   │   ├── src
│   │   │   │   ├── lib.rs
│   │   │   │   └── main.rs
│   │   │   ├── tauri.conf.json
│   │   │   ├── tauri.dev.conf.json
│   │   │   └── tauri.staging.conf.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.node.json
│   │   └── vite.config.ts
│   ├── docs
│   │   ├── README.md
│   │   ├── api-reference
│   │   │   └── engine
│   │   │       ├── endpoint  [24 entries exceeds filelimit, not opening dir]
│   │   │       └── introduction.mdx
│   │   ├── examples.mdx
│   │   ├── images
│   │   │   ├── engine.png
│   │   │   └── header.png
│   │   ├── integrations.mdx
│   │   ├── introduction.mdx
│   │   ├── local-development.mdx
│   │   ├── logos
│   │   │   ├── favicon.png
│   │   │   ├── logotype-dark.svg
│   │   │   └── logotype.svg
│   │   ├── mint.json
│   │   ├── package.json
│   │   └── self-hosting.mdx
│   ├── engine
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── common
│   │   │   │   ├── bindings.ts
│   │   │   │   └── schema.ts
│   │   │   ├── index.ts
│   │   │   ├── middleware.ts
│   │   │   ├── providers
│   │   │   │   ├── enablebanking
│   │   │   │   │   ├── __snapshots__
│   │   │   │   │   │   └── transform.test.ts.snap
│   │   │   │   │   ├── enablebanking-api.ts
│   │   │   │   │   ├── enablebanking-provider.ts
│   │   │   │   │   ├── transform.test.ts
│   │   │   │   │   ├── transform.ts
│   │   │   │   │   └── types.ts
│   │   │   │   ├── gocardless
│   │   │   │   │   ├── __snapshots__
│   │   │   │   │   │   └── transform.test.ts.snap
│   │   │   │   │   ├── gocardless-api.ts
│   │   │   │   │   ├── gocardless-provider.ts
│   │   │   │   │   ├── transform.test.ts
│   │   │   │   │   ├── transform.ts
│   │   │   │   │   ├── types.ts
│   │   │   │   │   ├── utils.test.ts
│   │   │   │   │   └── utils.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── interface.ts
│   │   │   │   ├── plaid
│   │   │   │   │   ├── __snapshots__
│   │   │   │   │   │   └── transform.test.ts.snap
│   │   │   │   │   ├── plaid-api.ts
│   │   │   │   │   ├── plaid-provider.ts
│   │   │   │   │   ├── transform.test.ts
│   │   │   │   │   ├── transform.ts
│   │   │   │   │   ├── types.ts
│   │   │   │   │   └── utils.ts
│   │   │   │   ├── teller
│   │   │   │   │   ├── __snapshots__
│   │   │   │   │   │   └── transform.test.ts.snap
│   │   │   │   │   ├── teller-api.ts
│   │   │   │   │   ├── teller-provider.ts
│   │   │   │   │   ├── transform.test.ts
│   │   │   │   │   ├── transform.ts
│   │   │   │   │   ├── types.ts
│   │   │   │   │   └── utils.ts
│   │   │   │   └── types.ts
│   │   │   ├── routes
│   │   │   │   ├── accounts
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── schema.ts
│   │   │   │   ├── auth
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── schema.ts
│   │   │   │   ├── connections
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── schema.ts
│   │   │   │   ├── enrich
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── schema.ts
│   │   │   │   ├── health
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── schema.ts
│   │   │   │   ├── institutions
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── schema.ts
│   │   │   │   │   └── utils.ts
│   │   │   │   ├── rates
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── schema.ts
│   │   │   │   └── transactions
│   │   │   │       ├── index.ts
│   │   │   │       └── schema.ts
│   │   │   └── utils
│   │   │       ├── account.test.ts
│   │   │       ├── account.ts
│   │   │       ├── countries.ts
│   │   │       ├── enrich.ts
│   │   │       ├── error.ts
│   │   │       ├── logger.ts
│   │   │       ├── logo.ts
│   │   │       ├── paginate.ts
│   │   │       ├── prompt.ts
│   │   │       ├── rates.ts
│   │   │       ├── retry.ts
│   │   │       └── search.ts
│   │   ├── tasks
│   │   │   ├── download-gocardless.ts
│   │   │   ├── download-teller.ts
│   │   │   ├── get-institutions.ts
│   │   │   ├── import.ts
│   │   │   └── utils.ts
│   │   ├── tsconfig.build.json
│   │   ├── tsconfig.json
│   │   └── wrangler.toml
│   └── website
│       ├── README.md
│       ├── image-loader.ts
│       ├── next.config.mjs
│       ├── package.json
│       ├── postcss.config.cjs
│       ├── public  [70 entries exceeds filelimit, not opening dir]
│       ├── src
│       │   ├── actions
│       │   │   ├── fetch-status.ts
│       │   │   ├── safe-action.ts
│       │   │   ├── schema.ts
│       │   │   ├── send-support-action.ts
│       │   │   └── subscribe-action.ts
│       │   ├── app  [25 entries exceeds filelimit, not opening dir]
│       │   ├── components  [54 entries exceeds filelimit, not opening dir]
│       │   ├── lib
│       │   │   ├── blog.ts
│       │   │   ├── fetch-github-stars.ts
│       │   │   ├── fetch-github.ts
│       │   │   └── fetch-stats.ts
│       │   ├── styles
│       │   │   └── globals.css
│       │   └── utils
│       │       └── resend.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── vercel.json
├── biome.json
├── bun.lock
├── github.png
├── package.json
├── packages
│   ├── app-store
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── cal
│   │   │   │   ├── assets
│   │   │   │   │   └── logo.tsx
│   │   │   │   └── config.ts
│   │   │   ├── db
│   │   │   │   └── index.ts
│   │   │   ├── fortnox
│   │   │   │   ├── assets
│   │   │   │   │   └── logo.tsx
│   │   │   │   └── config.ts
│   │   │   ├── index.ts
│   │   │   ├── quick-books
│   │   │   │   ├── assets
│   │   │   │   │   └── logo.tsx
│   │   │   │   └── config.ts
│   │   │   ├── raycast
│   │   │   │   ├── assets
│   │   │   │   │   └── logo.tsx
│   │   │   │   └── config.ts
│   │   │   ├── slack
│   │   │   │   ├── assets
│   │   │   │   │   ├── image.png
│   │   │   │   │   └── logo.tsx
│   │   │   │   ├── config.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── initialize.ts
│   │   │   │   └── lib
│   │   │   │       ├── client.ts
│   │   │   │       ├── events
│   │   │   │       │   └── file
│   │   │   │       │       ├── index.ts
│   │   │   │       │       └── share.ts
│   │   │   │       ├── index.ts
│   │   │   │       ├── notifications
│   │   │   │       │   ├── index.ts
│   │   │   │       │   └── transactions.ts
│   │   │   │       └── verify.ts
│   │   │   ├── visma
│   │   │   │   ├── assets
│   │   │   │   │   └── logo.tsx
│   │   │   │   └── config.ts
│   │   │   ├── xero
│   │   │   │   ├── assets
│   │   │   │   │   └── logo.tsx
│   │   │   │   └── config.ts
│   │   │   └── zapier
│   │   │       ├── assets
│   │   │       │   └── logo.tsx
│   │   │       └── config.ts
│   │   └── tsconfig.json
│   ├── desktop-client
│   │   ├── package.json
│   │   └── src
│   │       ├── core.ts
│   │       ├── desktop-variants.ts
│   │       └── platform.ts
│   ├── documents
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── classifier
│   │   │   │   └── classifier.ts
│   │   │   ├── client.ts
│   │   │   ├── embed
│   │   │   │   └── embed.ts
│   │   │   ├── index.ts
│   │   │   ├── interface.ts
│   │   │   ├── loaders
│   │   │   │   └── loader.ts
│   │   │   ├── processors
│   │   │   │   ├── invoice
│   │   │   │   │   └── invoice-processor.ts
│   │   │   │   └── receipt
│   │   │   │       └── receipt-processor.ts
│   │   │   ├── prompt.ts
│   │   │   ├── schema.ts
│   │   │   ├── types.ts
│   │   │   ├── utils.test.ts
│   │   │   └── utils.ts
│   │   └── tsconfig.json
│   ├── email
│   │   ├── components
│   │   │   ├── button.tsx
│   │   │   ├── column.tsx
│   │   │   ├── footer.tsx
│   │   │   ├── get-started.tsx
│   │   │   ├── logo-footer.tsx
│   │   │   ├── logo.tsx
│   │   │   └── theme.tsx
│   │   ├── emails
│   │   │   ├── api-key-created.tsx
│   │   │   ├── connection-expire.tsx
│   │   │   ├── connection-issue.tsx
│   │   │   ├── get-started.tsx
│   │   │   ├── invite.tsx
│   │   │   ├── invoice-overdue.tsx
│   │   │   ├── invoice-paid.tsx
│   │   │   ├── invoice-reminder.tsx
│   │   │   ├── invoice.tsx
│   │   │   ├── transactions.tsx
│   │   │   ├── trial-ended.tsx
│   │   │   ├── trial-expiring.tsx
│   │   │   └── welcome.tsx
│   │   ├── locales
│   │   │   ├── index.ts
│   │   │   └── translations.ts
│   │   ├── package.json
│   │   ├── public
│   │   ├── render.ts
│   │   ├── tsconfig.json
│   │   └── vercel.json
│   ├── encryption
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── index.test.ts
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   ├── engine-client
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   ├── events
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── client.tsx
│   │   │   ├── events.ts
│   │   │   └── server.ts
│   │   └── tsconfig.json
│   ├── import
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── index.ts
│   │   │   ├── mappings.ts
│   │   │   ├── transform.ts
│   │   │   ├── types.ts
│   │   │   ├── utils.test.ts
│   │   │   ├── utils.ts
│   │   │   └── validate.ts
│   │   └── tsconfig.json
│   ├── inbox
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── attachments.ts
│   │   │   ├── connector.ts
│   │   │   ├── generate-id.ts
│   │   │   ├── index.ts
│   │   │   ├── providers
│   │   │   │   ├── gmail.ts
│   │   │   │   ├── outlook.ts
│   │   │   │   └── types.ts
│   │   │   ├── schema.ts
│   │   │   ├── tokens.ts
│   │   │   ├── utils.test.ts
│   │   │   └── utils.ts
│   │   └── tsconfig.json
│   ├── invoice
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── editor
│   │   │   │   └── index.tsx
│   │   │   ├── index.tsx
│   │   │   ├── templates
│   │   │   │   ├── html
│   │   │   │   │   ├── components
│   │   │   │   │   │   ├── description.tsx
│   │   │   │   │   │   ├── editor-content.tsx
│   │   │   │   │   │   ├── line-items.tsx
│   │   │   │   │   │   ├── logo.tsx
│   │   │   │   │   │   ├── meta.tsx
│   │   │   │   │   │   └── summary.tsx
│   │   │   │   │   ├── format.tsx
│   │   │   │   │   └── index.tsx
│   │   │   │   ├── og
│   │   │   │   │   ├── components
│   │   │   │   │   │   ├── avatar.tsx
│   │   │   │   │   │   ├── editor-content.tsx
│   │   │   │   │   │   ├── header.tsx
│   │   │   │   │   │   ├── logo.tsx
│   │   │   │   │   │   ├── meta.tsx
│   │   │   │   │   │   └── status.tsx
│   │   │   │   │   ├── format.tsx
│   │   │   │   │   └── index.tsx
│   │   │   │   └── pdf
│   │   │   │       ├── components
│   │   │   │       │   ├── description.tsx
│   │   │   │       │   ├── editor-content.tsx
│   │   │   │       │   ├── line-items.tsx
│   │   │   │       │   ├── meta.tsx
│   │   │   │       │   ├── note.tsx
│   │   │   │       │   ├── payment-details.tsx
│   │   │   │       │   ├── qr-code.tsx
│   │   │   │       │   └── summary.tsx
│   │   │   │       ├── format.tsx
│   │   │   │       └── index.tsx
│   │   │   ├── token
│   │   │   │   └── index.ts
│   │   │   ├── types.ts
│   │   │   └── utils
│   │   │       ├── calculate.test.ts
│   │   │       ├── calculate.ts
│   │   │       ├── content.ts
│   │   │       ├── logo.ts
│   │   │       └── pdf-format.ts
│   │   └── tsconfig.json
│   ├── jobs
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── schema.ts
│   │   │   ├── tasks
│   │   │   │   ├── bank
│   │   │   │   │   ├── delete
│   │   │   │   │   │   └── delete-connection.ts
│   │   │   │   │   ├── notifications
│   │   │   │   │   │   ├── disconnected.tsx
│   │   │   │   │   │   ├── expiring.tsx
│   │   │   │   │   │   └── transactions.ts
│   │   │   │   │   ├── scheduler
│   │   │   │   │   │   └── bank-scheduler.ts
│   │   │   │   │   ├── setup
│   │   │   │   │   │   └── initial.ts
│   │   │   │   │   ├── sync
│   │   │   │   │   │   ├── account.ts
│   │   │   │   │   │   └── connection.ts
│   │   │   │   │   └── transactions
│   │   │   │   │       └── upsert.ts
│   │   │   │   ├── document
│   │   │   │   │   ├── classify-document.ts
│   │   │   │   │   ├── classify-image.ts
│   │   │   │   │   ├── convert-heic.ts
│   │   │   │   │   ├── embed-document-tags.ts
│   │   │   │   │   └── process-document.ts
│   │   │   │   ├── inbox
│   │   │   │   │   ├── process-attachment.ts
│   │   │   │   │   ├── provider
│   │   │   │   │   │   ├── initial-setup.ts
│   │   │   │   │   │   ├── sheduler.ts
│   │   │   │   │   │   └── sync-account.ts
│   │   │   │   │   └── slack-upload.ts
│   │   │   │   ├── invoice
│   │   │   │   │   ├── email
│   │   │   │   │   │   ├── send-email.tsx
│   │   │   │   │   │   └── send-reminder.tsx
│   │   │   │   │   ├── notifications
│   │   │   │   │   │   └── send-notifications.ts
│   │   │   │   │   ├── operations
│   │   │   │   │   │   ├── check-status.ts
│   │   │   │   │   │   └── generate-invoice.ts
│   │   │   │   │   └── scheduler
│   │   │   │   │       └── schedule-invoice.ts
│   │   │   │   ├── rates
│   │   │   │   │   └── rates-scheduler.ts
│   │   │   │   ├── reconnect
│   │   │   │   │   └── connection.ts
│   │   │   │   ├── team
│   │   │   │   │   ├── delete.ts
│   │   │   │   │   ├── invite.ts
│   │   │   │   │   └── onboarding.ts
│   │   │   │   └── transactions
│   │   │   │       ├── enrich.ts
│   │   │   │       ├── export.ts
│   │   │   │       ├── import.ts
│   │   │   │       ├── process-attachment.ts
│   │   │   │       ├── process-export.ts
│   │   │   │       ├── update-account-base-currency.ts
│   │   │   │       └── update-base-currency.ts
│   │   │   └── utils
│   │   │       ├── base-currency.ts
│   │   │       ├── blob.ts
│   │   │       ├── check-team-plan.ts
│   │   │       ├── enrichment-service.ts
│   │   │       ├── generate-cron-tag.ts
│   │   │       ├── inbox-notifications.ts
│   │   │       ├── invoice-notifications.tsx
│   │   │       ├── parse-error.ts
│   │   │       ├── process-batch.ts
│   │   │       ├── resend.ts
│   │   │       ├── transaction-notifications.tsx
│   │   │       ├── transform.test.ts
│   │   │       ├── transform.ts
│   │   │       ├── trigger-batch.ts
│   │   │       ├── trigger-sequence.ts
│   │   │       └── update-invocie.ts
│   │   ├── trigger.config.ts
│   │   └── tsconfig.json
│   ├── location
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── countries-intl.json
│   │   │   ├── countries-intl.ts
│   │   │   ├── countries.json
│   │   │   ├── countries.ts
│   │   │   ├── country-flags.ts
│   │   │   ├── currencies.ts
│   │   │   ├── eu-countries.ts
│   │   │   ├── index.ts
│   │   │   ├── timezones.json
│   │   │   └── timezones.ts
│   │   └── tsconfig.json
│   ├── notification
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   ├── supabase
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── client
│   │   │   │   ├── client.ts
│   │   │   │   ├── job.ts
│   │   │   │   ├── middleware.ts
│   │   │   │   └── server.ts
│   │   │   ├── mutations
│   │   │   │   └── index.ts
│   │   │   ├── queries
│   │   │   │   ├── cached-queries.ts
│   │   │   │   └── index.ts
│   │   │   ├── types
│   │   │   │   ├── db.ts
│   │   │   │   └── index.ts
│   │   │   └── utils
│   │   │       └── storage.ts
│   │   └── tsconfig.json
│   ├── tsconfig
│   │   ├── base.json
│   │   ├── nextjs.json
│   │   ├── package.json
│   │   └── react-library.json
│   ├── ui
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── postcss.config.js
│   │   ├── src
│   │   │   ├── components  [52 entries exceeds filelimit, not opening dir]
│   │   │   ├── globals.css
│   │   │   ├── hooks
│   │   │   │   ├── index.ts
│   │   │   │   ├── use-enter-submit.ts
│   │   │   │   ├── use-media-query.ts
│   │   │   │   └── use-resize-observer.ts
│   │   │   └── utils
│   │   │       ├── cn.ts
│   │   │       ├── index.ts
│   │   │       └── truncate.ts
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   └── utils
│       ├── package.json
│       ├── src
│       │   ├── envs.ts
│       │   ├── format.ts
│       │   ├── index.ts
│       │   └── tax.ts
│       └── tsconfig.json
├── tsconfig.json
├── turbo.json
└── types
    ├── images.d.ts
    └── jsx.d.ts