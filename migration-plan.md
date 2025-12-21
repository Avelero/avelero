<database-tables>
- Core
    - users (UPDATE)
        - Drop users.role, why do we have a role column in the users table? Roles are defined in brand_members.role
    - brands (VALID)
- Brands
    - brand_invites (VALID)
    - brand_members (VALID)
    - brand_collections (VALID)
    - brand_tags (VALID)
    - brand_theme (VALID)
- Catalog
    - brand_certifications (MOVE)
        - Create a new folder 'schema/catalog/...' and move brand_certifications here
    - brand_eco-claims (MOVE)
        - Create a new folder 'schema/catalog/...' and move brand_eco_claims here
    - brand_facilities (MOVE)
        - Create a new folder 'schema/catalog/...' and move brand_facilities here
    - brand_manufacturers (MOVE)
        - Create a new folder 'schema/catalog/...' and move brand_manufacturers here
    - brand_materials (MOVE)
        - Create a new folder 'schema/catalog/...' and move brand_materials here
    - brand_seasons (MOVE)
        - Create a new folder 'schema/catalog/...' and move brand_seasons here
    - brand_attributes (CREATE) // Should brand_attributes lives in schema/catalog/... or schema/brands/...?
    - brand_attribute_values (CREATE) // Should brand_attribute_values lives in schema/catalog/... or schema/brands/...?
- Products
    - products (UPDATE)
        - Maybe rename products.primary_image_path to products.image_path (considering there is no secondary image)
        - Maybe move products.weight and products.weight_unit to its own table 'product_weight' (although it doesn't provide any benefit, it's largely for semantic organization, do you think we should do this?)
        - Maybe move products.webshop_url, products.price, products.currency, and products.sales_status to its own table 'product_commercial' (although similarly, it doesn't provide any benefit beyond semantic organization, should we do this?)
        - Drop products.size_order and products.color_order, if necessary we'll store order in 'product_variant_attributes'
    - product_eco_claims (VALID)
    - product_environment (UPDATE)
        - Maybe we should change product_environment.carbon_kg_co2e & product_environment.water_liters to product_environment.value, product_environment.unit, and product_environment.metric where metric is either 'water' or 'carbon' for now
    - product_journey_steps (VALID)
    - product_materials (VALID)
    - product_variants (UPDATE)
        - Drop product_variants.color_id, product_variants.size_id, and product_variants.gender (considering these are attributes)
        - Drop product_variants.ean and product_variants.gtin (considering they are basically barcodes)
    - product_variant_attributes (CREATE)
    - product_tags (RENAME)
        - Was named tags_on_products, should be named to product_tags to follow convention
- Taxonomy
    - categories (MOVE & UPDATE)
        - Create a new folder 'schema/taxonomy/...' and move categories here
        - Maybe we should add a dedicated taxonomy-like id such as 'fo' for 'footwear' and then 'fo-1' for 'footwear > sneakers'
    - attributes (CREATE)
    - attribute_values (CREATE)
- Data
    - file_assets (VALID)
    - import_jobs (VALID)
    - import_rows (VALID)
- Staging // This folder is missing many tables, however due to an upcoming refactor it is not worth updating this right now, all are assigned VALID
    - staging_eco_claims (VALID)
    - staging_product_environment (VALID)
    - staging_product_journey_steps (VALID)
    - staging_product_materials (VALID)
    - staging_product_variants (VALID)
    - staging_products (VALID)
    - value_mappings (VALID)
- Integrations
    - Links
        - Entity links
            - integration_material_links (VALID)
            - integration_facility_links (VALID)
            - integration_manufacturer_links (VALID)
            - integration_season_links (VALID)
            - integration_color_links (DROP)
            - integration_size_links (DROP)
            - integration_tag_links (VALID)
            - integration_eco_claim_links (VALID)
            - integration_certification_links (VALID)
        - product_links (VALID)
        - variant_links (VALID)
    - brand_integrations (VALID)
    - field_configs (VALID)
    - integrations (VALID)
    - oauth_states (VALID)
    - sync_jobs (VALID)
</database-tables>

<schema-design>
products(
    id,
    brand_id,
    name,
    product_handle,
    description,
    manufacturer_id,
    image_path,
    weight,
    weight_unit,
    price,
    currency,
    sales_status,
    category_id,
    season_id,
    status,
    created_at,
    updated_at
)

variants(
    id,
    product_id,
    barcode,
    sku,
    upid,
    created_at,
    updated_at
)

variant_attributes(
    id,
    variant_id,
    value_id,
    semantic_value_id,
    sort_order,
    created_at,
    updated_at
)

attributes(
    id,
    brand_id,
    label,
    norm_label,
    semantic_attribute_id,
    created_at,
    updated_at
)

attribute_values(
    id,
    attribute_id,
    value,
    norm_value,
    semantic_attribute_value_id,
    created_at,
    updated_at
)

semantic_attributes(
    id,
    label,
    norm_label,
    created_at,
    updated_at
)

semantic_attribute_values(
    id,
    semantic_attribute_id,
    value,
    norm_value,
    key,
    key_value,
    created_at,
    updated_at
)
</schema-design>

<sample-variant>
{
  "productVariant": {
    "id": "76c5b151-de62-4209-8478-2f6673e34f5b",
    "productId": "01f1e61c-6fef-4ee0-9da8-647d6ee14ccd",
    "sku": "MOCK-6KDJJL-NVY-36",
    "barcode": "575489953203",
    "upid": "aw8g3j1p1vdv9viq",
    "attributes": [
      {
        "label": "Color",
        "normLabel": "color",
        "value": "Black",
        "normValue": "black",
        "semanticAttribute": {
            "id": "f968b333-fb7f-47b8-8ddf-f48ff6179825",
            "label": "Color",
            "normLabel": "color",
            "value": "Black",
            "normValue": "black",
            "fields": [
            {
                "key": "name",
                "value": "Black"
            },
            {
                "key": "base_color",
                "value": "black"  // ← Taxonomy value
            },
            {
                "key": "swatch",
                "value": "#000000"  // ← Hex code!
            }
            ]
        }
      },
      {
        "label": "Size",
        "normLabel": "size",
        "value": "Large",
        "normValue": "large",
        "semanticAttribute": {
            "id": "32e10752-b496-4668-8747-fcf09aa47e65",
            "label": "Size",
            "normLabel": "size",
            "value": "Large",
            "normValue": "large",
            "fields": [
            {
                "key": "name",
                "value": "Large"
            },
            {
                "key": "base_size",
                "value": "L"  // ← Taxonomy value
            }
            ]
        }
      }
    ]
  }
}
</sample-variant>
