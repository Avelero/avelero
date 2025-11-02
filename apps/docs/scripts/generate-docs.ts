#!/usr/bin/env bun
/**
 * Script to generate MDX documentation files from NEW_API_ENDPOINTS.txt
 *
 * This script parses the API endpoints specification and generates individual
 * .mdx files for each endpoint, organized by domain.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

interface EndpointDoc {
  name: string
  domain: string
  resource?: string
  operation: string
  type: 'query' | 'mutation'
  purpose: string
  description: string
  inputs: string[]
  outputs: string[]
  exampleRequest?: string
  exampleResponse?: string
  notes: string[]
  errors: string[]
  relatedEndpoints: string[]
}

// Read the API endpoints file
const apiEndpointsPath = join(process.cwd(), '../../docs/NEW_API_ENDPOINTS.txt')
const content = readFileSync(apiEndpointsPath, 'utf-8')

// Parse endpoints from the specification
function parseEndpoints(content: string): EndpointDoc[] {
  const endpoints: EndpointDoc[] = []
  const lines = content.split('\n')

  let currentSection = ''
  let currentEndpoint: Partial<EndpointDoc> = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Detect domain sections (e.g., "## 1. USER DOMAIN")
    if (line.match(/^## \d+\. (.+) DOMAIN/)) {
      const match = line.match(/^## \d+\. (.+) DOMAIN/)
      if (match) {
        currentSection = match[1].toLowerCase()
      }
      continue
    }

    // Detect endpoint definitions (e.g., "user.get")
    const endpointMatch = line.match(/^([a-z]+)\.([a-z.]+)\s+•/)
    if (endpointMatch) {
      // Save previous endpoint if exists
      if (currentEndpoint.name) {
        endpoints.push(currentEndpoint as EndpointDoc)
      }

      const [, domain, path] = endpointMatch
      const parts = path.split('.')
      const operation = parts[parts.length - 1]
      const resource = parts.length > 1 ? parts.slice(0, -1).join('.') : undefined

      currentEndpoint = {
        name: `${domain}.${path}`,
        domain,
        resource,
        operation,
        type: 'query', // Will be determined from context
        purpose: '',
        description: '',
        inputs: [],
        outputs: [],
        notes: [],
        errors: [],
        relatedEndpoints: []
      }
    }
  }

  // Save last endpoint
  if (currentEndpoint.name) {
    endpoints.push(currentEndpoint as EndpointDoc)
  }

  return endpoints
}

// Generate MDX content for an endpoint
function generateMdx(endpoint: Partial<EndpointDoc>): string {
  const resourcePath = endpoint.resource ? `${endpoint.resource}/` : ''
  const inputs = endpoint.inputs || []
  const outputs = endpoint.outputs || []
  const notes = endpoint.notes || []
  const errors = endpoint.errors || []
  const relatedEndpoints = endpoint.relatedEndpoints || []

  return `---
title: ${endpoint.name}
description: ${endpoint.purpose || `${endpoint.operation} endpoint for ${endpoint.domain}`}
---

import { Callout, Tabs } from 'nextra/components'

# ${endpoint.name}

${endpoint.description || `Documentation for ${endpoint.name} endpoint.`}

## Endpoint

\`${endpoint.name}\` (${endpoint.type === 'query' ? 'Query' : 'Mutation'})

## Purpose

${endpoint.purpose || `This endpoint allows you to ${endpoint.operation} ${endpoint.resource || endpoint.domain} resources.`}

## Input Parameters

${inputs.length > 0 ? inputs.join('\n') : 'None. Uses authenticated user context from session.'}

## Return Value

\`\`\`typescript
// Return type definition
${outputs.length > 0 ? outputs.join('\n') : '{ success: boolean }'}
\`\`\`

## Examples

<Tabs items={['TypeScript', 'JavaScript']}>
  <Tabs.Tab>
    \`\`\`typescript
${endpoint.exampleRequest || `const result = await trpc.${endpoint.name}.${endpoint.type === 'query' ? 'query' : 'mutate'}({})`}
    \`\`\`
  </Tabs.Tab>
  <Tabs.Tab>
    \`\`\`javascript
${endpoint.exampleRequest || `const result = await trpc.${endpoint.name}.${endpoint.type === 'query' ? 'query' : 'mutate'}({})`}
    \`\`\`
  </Tabs.Tab>
</Tabs>

### Response

\`\`\`json
${endpoint.exampleResponse || '{\n  "success": true\n}'}
\`\`\`

## Error Handling

${errors.length > 0 ? errors.map(e => `- ${e}`).join('\n') : `- \`UNAUTHORIZED\`: User is not authenticated
- \`BAD_REQUEST\`: Invalid parameters
- \`INTERNAL_SERVER_ERROR\`: Server error`}

${notes.length > 0 ? `## Notes

<Callout type="info">
${notes.join('\n')}
</Callout>` : ''}

${relatedEndpoints.length > 0 ? `## Related Endpoints

${relatedEndpoints.map(e => `- [${e}](/${e.replace(/\./g, '/')})`).join('\n')}` : ''}
`
}

// Define manual endpoint list for all 32+ endpoints
const endpoints = [
  // User domain (4 endpoints)
  { name: 'user.get', domain: 'user', operation: 'get', type: 'query' as const,
    purpose: 'Get the authenticated user\'s profile information' },
  { name: 'user.update', domain: 'user', operation: 'update', type: 'mutation' as const,
    purpose: 'Update user profile fields' },
  { name: 'user.delete', domain: 'user', operation: 'delete', type: 'mutation' as const,
    purpose: 'Delete user account and all associated data' },
  { name: 'user.invites.list', domain: 'user', resource: 'invites', operation: 'list', type: 'query' as const,
    purpose: 'List pending invites sent to the current user' },

  // Workflow domain (8 endpoints)
  { name: 'workflow.list', domain: 'workflow', operation: 'list', type: 'query' as const,
    purpose: 'List all brands for the current user' },
  { name: 'workflow.create', domain: 'workflow', operation: 'create', type: 'mutation' as const,
    purpose: 'Create a new brand' },
  { name: 'workflow.delete', domain: 'workflow', operation: 'delete', type: 'mutation' as const,
    purpose: 'Delete a brand' },
  { name: 'workflow.members.list', domain: 'workflow', resource: 'members', operation: 'list', type: 'query' as const,
    purpose: 'List team members for a brand' },
  { name: 'workflow.members.update', domain: 'workflow', resource: 'members', operation: 'update', type: 'mutation' as const,
    purpose: 'Update member role, remove member, or leave brand' },
  { name: 'workflow.invites.list', domain: 'workflow', resource: 'invites', operation: 'list', type: 'query' as const,
    purpose: 'List pending invites for a brand' },
  { name: 'workflow.invites.send', domain: 'workflow', resource: 'invites', operation: 'send', type: 'mutation' as const,
    purpose: 'Send invitation to join brand' },
  { name: 'workflow.invites.respond', domain: 'workflow', resource: 'invites', operation: 'respond', type: 'mutation' as const,
    purpose: 'Accept, decline, or revoke brand invitation' },

  // Brand domain - Colors (4 endpoints)
  { name: 'brand.colors.list', domain: 'brand', resource: 'colors', operation: 'list', type: 'query' as const,
    purpose: 'List all colors for a brand' },
  { name: 'brand.colors.create', domain: 'brand', resource: 'colors', operation: 'create', type: 'mutation' as const,
    purpose: 'Create a new color' },
  { name: 'brand.colors.update', domain: 'brand', resource: 'colors', operation: 'update', type: 'mutation' as const,
    purpose: 'Update a color' },
  { name: 'brand.colors.delete', domain: 'brand', resource: 'colors', operation: 'delete', type: 'mutation' as const,
    purpose: 'Delete a color' },

  // Products domain (7 endpoints)
  { name: 'products.list', domain: 'products', operation: 'list', type: 'query' as const,
    purpose: 'List products with optional filters' },
  { name: 'products.get', domain: 'products', operation: 'get', type: 'query' as const,
    purpose: 'Get a single product by ID' },
  { name: 'products.create', domain: 'products', operation: 'create', type: 'mutation' as const,
    purpose: 'Create a new product' },
  { name: 'products.update', domain: 'products', operation: 'update', type: 'mutation' as const,
    purpose: 'Update product details and attributes' },
  { name: 'products.delete', domain: 'products', operation: 'delete', type: 'mutation' as const,
    purpose: 'Delete a product' },
  { name: 'products.variants.list', domain: 'products', resource: 'variants', operation: 'list', type: 'query' as const,
    purpose: 'List variants for a product' },
  { name: 'products.variants.upsert', domain: 'products', resource: 'variants', operation: 'upsert', type: 'mutation' as const,
    purpose: 'Create or update product variants' },

  // Passports domain (10 endpoints)
  { name: 'passports.list', domain: 'passports', operation: 'list', type: 'query' as const,
    purpose: 'List passports with pagination and filters' },
  { name: 'passports.get', domain: 'passports', operation: 'get', type: 'query' as const,
    purpose: 'Get a single passport by UPID' },
  { name: 'passports.create', domain: 'passports', operation: 'create', type: 'mutation' as const,
    purpose: 'Create a new passport' },
  { name: 'passports.update', domain: 'passports', operation: 'update', type: 'mutation' as const,
    purpose: 'Update passport status or template' },
  { name: 'passports.delete', domain: 'passports', operation: 'delete', type: 'mutation' as const,
    purpose: 'Delete a passport' },
  { name: 'passports.templates.list', domain: 'passports', resource: 'templates', operation: 'list', type: 'query' as const,
    purpose: 'List passport templates for a brand' },
  { name: 'passports.templates.get', domain: 'passports', resource: 'templates', operation: 'get', type: 'query' as const,
    purpose: 'Get template details including modules' },
  { name: 'passports.templates.create', domain: 'passports', resource: 'templates', operation: 'create', type: 'mutation' as const,
    purpose: 'Create a new passport template' },
  { name: 'passports.templates.update', domain: 'passports', resource: 'templates', operation: 'update', type: 'mutation' as const,
    purpose: 'Update template configuration' },
  { name: 'passports.templates.delete', domain: 'passports', resource: 'templates', operation: 'delete', type: 'mutation' as const,
    purpose: 'Delete a passport template' },

  // Bulk domain (2 endpoints)
  { name: 'bulk.import', domain: 'bulk', operation: 'import', type: 'mutation' as const,
    purpose: 'Bulk import products or other resources' },
  { name: 'bulk.update', domain: 'bulk', operation: 'update', type: 'mutation' as const,
    purpose: 'Bulk update multiple records' },

  // Composite domain (4 endpoints)
  { name: 'composite.workflowInit', domain: 'composite', operation: 'workflowInit', type: 'query' as const,
    purpose: 'Dashboard initialization combining user, brands, and invites' },
  { name: 'composite.dashboard', domain: 'composite', operation: 'dashboard', type: 'query' as const,
    purpose: 'Dashboard data with metrics and activity' },
  { name: 'composite.membersWithInvites', domain: 'composite', operation: 'membersWithInvites', type: 'query' as const,
    purpose: 'Combined members and invites for team management' },
  { name: 'composite.passportFormReferences', domain: 'composite', operation: 'passportFormReferences', type: 'query' as const,
    purpose: 'All reference data needed for passport forms' },
]

// Generate MDX files for each endpoint
console.log('🚀 Generating API documentation files...\n')

let generatedCount = 0

for (const endpoint of endpoints) {
  const resourcePath = endpoint.resource ? `${endpoint.resource}/` : ''
  const outputDir = join(process.cwd(), 'pages', endpoint.domain, resourcePath)
  const outputFile = join(outputDir, `${endpoint.operation}.mdx`)

  // Create directory if it doesn't exist
  mkdirSync(outputDir, { recursive: true })

  // Generate and write MDX content
  const mdxContent = generateMdx(endpoint as EndpointDoc)
  writeFileSync(outputFile, mdxContent)

  generatedCount++
  console.log(`✓ Generated: ${endpoint.name} → ${outputFile.replace(process.cwd(), '.')}`)
}

console.log(`\n✅ Successfully generated ${generatedCount} endpoint documentation files!`)
console.log(`\n📝 Next steps:`)
console.log(`   1. Review generated files in pages/ directory`)
console.log(`   2. Add detailed examples and descriptions`)
console.log(`   3. Run 'bun run dev' to preview documentation`)
