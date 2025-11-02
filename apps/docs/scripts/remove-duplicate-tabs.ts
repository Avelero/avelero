import { readFileSync, writeFileSync } from 'fs'

const files = [
  'composite/passportFormReferences.mdx',
  'composite/membersWithInvites.mdx',
  'composite/dashboard.mdx',
  'bulk/update.mdx',
  'bulk/import.mdx',
  'passports/templates/delete.mdx',
  'passports/templates/update.mdx',
  'passports/templates/create.mdx',
  'passports/templates/get.mdx',
  'passports/delete.mdx',
  'passports/templates/list.mdx',
  'passports/update.mdx',
  'passports/create.mdx',
  'passports/get.mdx',
  'passports/list.mdx',
  'products/variants/upsert.mdx',
  'products/delete.mdx',
  'products/variants/list.mdx',
  'products/update.mdx',
  'products/create.mdx',
  'products/get.mdx',
  'brand/colors/delete.mdx',
  'products/list.mdx',
  'brand/colors/update.mdx',
  'brand/colors/create.mdx',
  'brand/colors/list.mdx',
  'workflow/invites/respond.mdx',
  'workflow/invites/send.mdx',
  'workflow/invites/list.mdx',
  'workflow/members/update.mdx',
  'workflow/delete.mdx',
  'workflow/members/list.mdx',
  'workflow/create.mdx',
  'user/delete.mdx',
  'user/invites/list.mdx',
  'workflow/list.mdx',
  'user/update.mdx',
]

const basePath = '/home/tr4m0ryp/projects/Avelero/avelero/apps/docs/pages'

for (const file of files) {
  const filePath = `${basePath}/${file}`
  let content = readFileSync(filePath, 'utf-8')

  // Extract the code from the first Tabs.Tab (TypeScript)
  const tabsRegex = /<Tabs items=\{.*?\}>[\s\S]*?<Tabs\.Tab>([\s\S]*?)<\/Tabs\.Tab>[\s\S]*?<\/Tabs>/g

  content = content.replace(tabsRegex, (match, firstTabContent) => {
    // Return just the code block without the tabs
    return firstTabContent.trim()
  })

  // Remove Tabs from import if Callout is still used
  if (content.includes('Callout')) {
    content = content.replace(
      /import \{ Callout, Tabs \} from 'nextra\/components'/,
      "import { Callout } from 'nextra/components'"
    )
  } else {
    // Remove the entire import line if neither are used
    content = content.replace(
      /import \{ Callout, Tabs \} from 'nextra\/components'\n/,
      ''
    )
    content = content.replace(
      /import \{ Tabs, Callout \} from 'nextra\/components'\n/,
      ''
    )
    content = content.replace(
      /import \{ Tabs \} from 'nextra\/components'\n/,
      ''
    )
  }

  writeFileSync(filePath, content, 'utf-8')
  console.log(`✓ Fixed ${file}`)
}

console.log(`\nProcessed ${files.length} files`)
