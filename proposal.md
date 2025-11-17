# Database Migrations (also update schema in db package)

brand_facilities:
- Drop the 'contact' column. Add 'phone' and 'email' columns.
- Rename 'address' to 'address_line_1' and add 'address_line_2'.
- Add 'state' and 'zip' columns.
- Drop the 'vat_number' column.

brand_sizes:
- Drop the 'category_group' column.

care_codes:
- Drop the entire 'care_codes' table.

passport_module_completion:
- Drop the entire 'passport_module_completion' table.

passports:
- Drop the entire 'passports' table. // We move this logic to products table.

product_care_codes:
- Drop the entire 'product_care_codes' table.

product_identifiers:
- Drop the entire 'product_identifiers' table.

product_variant_identifiers:
- Drop the entire 'product_variant_identifiers' table.

product_variants:
- Drop the 'sku' column.
- Drop the 'product_image_url' column.
- Drop the 'ean' column.
- Drop the 'status' column.

products:
- Drop the 'season' column. // We already have a 'season_id' column
- Drop the 'brand_certification_id' column.
- Drop the 'additional_image_urls' column.
- Drop the 'tags' column. // We already have a 'tags_on_product' table
- Add the 'template_id' column.

staging_product_care_codes:
- Drop the entire 'staging_product_care_codes' table. // We'll also drop the normal 'product_care_codes' table

staging_product_identifiers:
- Drop the entire 'staging_product_identifiers' table. // We'll also drop the normal 'product_identifiers' table

staging_product_variant_identifiers:
- Drop the entire 'staging_product_variant_identifiers' table. // We'll also drop the normal 'product_variant_identifiers' table

staging_product_variants:
- Drop the 'sku' column.
- Drop the 'product_image_url' column.
- Drop the 'ean' column.
- Drop the 'status' column.

staging_products:
- Drop the 'season' column. // We already have a 'season_id' column
- Drop the 'brand_certification_id' column.
- Drop the 'additional_image_urls' column.
- Drop the 'tags' column. // We already have a 'tags_on_product' table

tags_on_product:
- Add 'updated_at' column. // We have 'created_at' and 'updated_at' columns on every table.

users:
- Add RLS policies. // This table is currently not protected.
- Drop 'role' column. // Role is defined in 'users_on_brand' table.

value_mappings:
- What is this table for?

products (bucket):
- Add RLS policies. // We have some, but I manually set them in Supabase, we need to set them in code.

general:
- Add 'service_role' RLS permissions to all protected RLS policies, server-side actions are blocked otherwise.
- Double check RLS policies, some actions are only allowed by role 'owner' that should also be allowed by role 'member'.

# tRPC Router Updates

products.attributes: // Remove this router entirely. Unnecessary since we will
                        add the same attribute set logic to the products.create router.
- materials.set
    - Replaces all materials with the given materials batch for a given product_id.
- careCodes.set // Drop this route, we'll also drop 'care_codes' table.
- ecoClaims.set
    - Replaces all ecoClaims with the given ecoClaims batch for a given product_id.
- environment.upsert
    - Upserts environment value data for a given product_id.
- journey.setSteps
    - Replaces all production steps with the given steps for a given product_id

products.variants: // This router is complete, do not change.
- list
    - Lists all variants for a given product_id.
- upsert
    - Creates variants for a given product_id.
- delete
    - Delete variants for a given product_id, or by variant_id's.

products:
- list
    - Lists all products for a given pagination, search, filter, & sort combination.
    - Optionally includes variants and attributes.
    - Includes an array of all variants.
    - Includes an object with all attributes.
- get
    - Same as list, but for a single product_id.
- create
    - Currently, products.create only takes in the base fields.
    - This requires a follow-up query to set all attributes.
    - products.updates has this native, hence, ensure this is also native for
    - products.create. Then we can drop the entire attributes router.
- update
    - All optional fields, sets both basic and attribute fields.
- delete
    - Deletes a given product_id, cascades to variants and attributes.
- variants
    - Exposes the variant router, but determined to be unnecessary, drop route.

passports:
- list
    - Returns passports with summarized status counts based on filter, search, etc params.
- get
    - Returns passport by upid.
- create
    - Creates passport by product_id, variant_id, template_id, and status.
- update
    - Updates one of the above four values by upid.
- delete
    - Deletes a passport by upid.
- templates
    - Exposes the template router, but determined to become it's own router, so drop route here.

passports.templates: // 'templates' needs to become its own router.
- list
    - Lists all passport templates for a brand.
- get
    - Retrieves a template with full module configuration.
- create
    - Creates a template by theme JSONB and module keys.
- update
    - Updates a template by template_id.
- delete
    - Deletes a template by template_id.

brands: // This endpoint contains basic CRUD operations for all resources below. Keep as is.
- tags
- colors
- sizes
- materials
- seasons
- facilities
- showcaseBrands
- ecoClaims
- certifications

user, workflow, bulk:
- Keep as is. These endpoints are correctly configured and need no update.

composite:
- Composite is meant for on-demand specific bundled query operations. Enrich as needed.

general:
- Add 'summary' router. This router will return summarized data such as completions, status counts, and so on.

# tRPC Schema Updates

products:
- Update base products.list schema to match new table schema.
- Update products.list with variants schema to match new table schema.
- Update products.list with attributes schema to match new table schema.
- Update products.get schema to match new table schema.
- Update products.create schema to match new table schema.
- Update products.update schema to match new table schema.
- This is going to get repetitive, simply align tRPC schemas with the updated table & route logic schemas.

brands:
- Just like 'products', make sure all schemas align the new schemas.

# tRPC Query Updates

brand-catalog: // CRUD query operations for all brand resources. And add seasons here, it is missing.
- colors
- tags
- sizes
- materials
- certifications
- ecoClaims
- facilities
- showcaseBrands

seasons:
- Why is this its own query file? This should be added to the 'brand-catalog' query file.

catalog:
- Remove 'listCareCodes', we don't use care codes anymore.

passports:
- Drop the entire passports.ts query file, it's unnecessary because we don't even have a passports table anymore.

product-passports.ts (I created this temporarily on my branch to circumvent limitations, but we can drop this once all is restructured)

product-attributes.ts:
- Drop this query file as well, we'll be bundling product attribute setting in products, as it's a part of creating / updating a product.

products:
- listProducts
- listProductsWithIncludes // Not sure why we have this, I think we can pass options in the normal listProducts query function.
- getProductWithIncludes // Same as above.
- getProduct
- createProduct
- updateProduct
- deleteProduct
- upsertProductIdentifier // Drop, we don't have individual identifiers anymore.
- listVariants // Move to product-variants.ts query file.
    - Lists all variants for a product.
- createVariant // Move to product-variants.ts query file.
    - Creates a new product variant.
- updateVariant // Move to product-variants.ts query file. Also, do we need an update variant query, realistically we'll only be removing or adding variant records, not updating them?
    - Updates a single product-variant's size or color.
- deleteVariant // Move to product-variants.ts query file.
    - Deletes a single product variant.
- upsertVariantIdentifier // Delete, we don't have a variant_identifier table anymore.
- listProductVariantsForBrand // Move to product-variants.ts query file.
    - We can drop this, basically the same purpose as listVariants
- upsertProductVariantsForBrand // Move to product-variants.ts query file.
    - Perhaps we can also remove createVariant and just leave logic like this. Like, we'll never be cherry-picking removing a variant. Realistically variants should be more of an upsert situation, where we provide the new batch of variants, what's missing will be deleted, what's new will be created, what exists will be left as is. With the createVariant query we'll need to cycle through all variantrs for a product, that makes no sense.
- deleteProductVariantsForBrand // Move to product-variants.ts query file.
    - Same deal here, probably good to have all variant actions be product-level, where they're sort-of bulk. Like, no need to have a function that deletes individual variants. 

general:
- Create a product-variants.ts query file, makes more sense to separate into its own query file.