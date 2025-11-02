import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: <span style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>Avelero API Documentation</span>,
  project: {
    link: 'https://github.com/avelero/avelero',
  },
  docsRepositoryBase: 'https://github.com/avelero/avelero/tree/main/apps/docs',
  footer: {
    component: null,
  },
  primaryHue: 200,
  primarySaturation: 100,
  darkMode: false,
  nextThemes: {
    defaultTheme: 'light',
    forcedTheme: 'light',
  },
  search: {
    placeholder: 'Search documentation...',
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  toc: {
    backToTop: true,
    title: 'On This Page',
  },
  editLink: {
    text: 'Edit this page on GitHub →'
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback'
  },
  gitTimestamp: true,
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="Avelero API Documentation" />
      <meta property="og:description" content="Complete API documentation for Avelero's tRPC endpoints" />
      <link rel="icon" href="/favicon.ico" />
      <link rel="icon" type="image/svg+xml" href="/LogoIcon256.svg" />
    </>
  ),
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Avelero API'
    }
  }
}

export default config
