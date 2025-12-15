/**
 * Shopify Category Mappings
 *
 * Maps Shopify Standard Product Taxonomy to Avelero category UUIDs.
 * Uses a tiered fallback system for 100% coverage:
 *
 * 1. SPECIFIC_MAPPINGS - Exact matches for precision
 * 2. BRANCH_DEFAULTS - Fallback for entire Shopify branches
 * 3. Walk up hierarchy until a match is found
 *
 * Shopify Taxonomy Reference: https://shopify.github.io/product-taxonomy/
 *
 * Coverage:
 * - aa-1: Clothing
 * - aa-2: Clothing Accessories
 * - aa-3: Costumes & Accessories
 * - aa-4: Handbag & Wallet Accessories
 * - aa-5: Handbags, Wallets & Cases
 * - aa-6: Jewelry
 * - aa-7: Shoe Accessories
 * - aa-8: Shoes
 */

// =============================================================================
// AVELERO CATEGORY UUIDs
// =============================================================================
// Direct mapping from category name to UUID.
// Categories with the same name but different parents are suffixed with parent.

const CATEGORY_UUIDS = {
  // ─── ROOT CATEGORIES ─────────────────────────────────────────────────────────
  "Accessories": "221a7242-e95b-4821-9e52-fcbebdc74218",
  "Coats": "5059ad41-d92d-4d97-aa39-1afdd86d5a0a",
  "Dresses": "d76856b7-51f7-4334-b83f-4667e438d1b0",
  "Footwear": "c529e0c7-db82-4aff-9c28-ccaeb7de194a",
  "Jackets": "31ba04c3-aa83-4bcf-b0d5-d86969b97651",
  "Jeans": "ef987c64-de12-4da9-8f6a-8c1dc88dc756",
  "Knitwear & Cardigans": "c7e7681d-7fd5-4239-8d68-f92f794cb05e",
  "Loungewear & Sleepwear": "d1ee0ff5-85d0-4ab6-bc9f-626261d4c533",
  "Shirts & Blouses": "3949a6a4-371b-4bc6-8406-06ba3258d0e8",
  "Shorts": "837e75a8-71a6-4cbe-97b1-f3abc2208c31",
  "Skirts": "9f2258d2-08c5-49ab-ab6f-f570ac4d1cc4",
  "Socks & Tights": "69452827-99bf-4d0c-b20b-380011bca1c2",
  "Suits & Tailoring": "08429565-fcef-4671-922e-6822439ba80c",
  "Sweatshirts & Hoodies": "eccef759-1586-4fa6-a6fe-ff3b956b4b44",
  "Swimwear": "39512160-3dec-4702-a7ca-bad9e237f3c4",
  "T-shirts & Polos": "cad2353a-3170-4842-a2bd-fc562b653a29",
  "Tracksuits & Joggers": "3b293d39-e9cf-47b0-86ab-8db3eca7e4b8",
  "Trousers": "62095abd-4e4b-4f01-bc3d-ba7067104bbd",
  "Underwear": "d198558f-b00a-4991-8100-29b8d40cf1a3",

  // ─── FOOTWEAR ────────────────────────────────────────────────────────────────
  "Beach shoes": "025fff76-cf41-42e6-b988-694e08c62c42",
  "Sports shoes": "165850d8-00f9-4ebd-875c-84b6916ec0a1",
  "Mules": "17019387-7e49-48ed-9d4b-1d5435534d34",
  "Flat shoes": "1f95e988-dee1-4ca0-8504-1061d8c98c37",
  "High heels": "243c819e-4ec5-4492-b554-9fd80cf49eae",
  "Ballerinas": "268cef30-d95f-4d1a-991a-0272ba7cdbbc",
  "Business shoes": "2f565889-89fb-4387-ba7b-e880d09ce842",
  "Outdoor shoes": "35f8d5c2-35fe-419a-bebc-9bd3f0838bd4",
  "Ankle boots": "6f0f058d-329a-40b8-9643-78418f518286",
  "Sandals": "7e05b1b0-6dcc-49c7-a4e0-09b58ef87455",
  "Bridal shoes": "7f611d4b-d84f-434e-8865-5cfb386f685f",
  "Slippers": "77b3655c-c951-4ac5-9c6c-21fb899591ab",
  "Loafers": "88deb58a-d595-431c-a5bb-128ee205d72d",
  "Boots": "a81069f7-16b9-4a16-b0ec-1a47aed2bb73",
  "Open shoes": "d9b866d8-8e74-4ccb-be1b-8b30fc77ee29",
  "Pumps": "e0ad2b0a-2ad9-48cc-98c6-434689da79e5",
  "Lace-up shoes": "ef128dc5-2df6-43ae-bdbb-1e8e1a84d0e4",
  "Sneakers": "5e5c4fc3-a66f-4463-b23b-01f3443275bc",

  // ─── DRESSES ─────────────────────────────────────────────────────────────────
  "Maxi Dresses": "03918794-78f6-48e9-8fb8-de7d8bed3f15",
  "Casual Dresses": "15013fd0-727b-4d8f-b897-8e675efb422e",
  "Shirt Dresses": "3538bc16-ab15-4c63-947d-320fc8870449",
  "Occasion Dresses": "3716573e-98dc-4580-9c19-3bb5096bb716",
  "Jersey Dresses": "4b065768-06f0-4a88-9ea4-fba08e7cd72e",
  "Denim Dresses": "64624f80-745d-4bb2-abd4-1af318ba574b",
  "Evening Dresses": "a9a59966-a5f2-415c-8cb8-77ba7c5c066c",
  "Shift Dresses": "e4a18d10-4dfc-4d31-883d-04ee29e9d009",
  "Knitted Dresses": "f51ae124-bd0b-4886-8b2c-945102fcae12",

  // ─── SUITS & TAILORING ───────────────────────────────────────────────────────
  "Suit waistcoats": "04d391b1-7cab-48cc-b4e7-c41cfaa75f7f",
  "Suit jackets": "347460ab-4283-49e6-a58c-97a2b6b2a6a8",
  "Suit trousers": "582cd224-06b9-4b69-b4d4-6c974c347b17",
  "Shirts_SuitsAndTailoring": "7a8ac90e-8f9d-40f6-a5db-3ab51b7db970", // Suits & Tailoring > Shirts
  "Suits": "9c25c082-fd57-4a5b-b6e0-cc238a9e9d32",
  "Ties & accessories": "ade94d9c-7eb2-4b1e-87d4-24280862a9b2",
  "Blazer jackets": "c1d6c8ad-a7df-40cb-9446-b949129d8473",

  // ─── SWEATSHIRTS & HOODIES ───────────────────────────────────────────────────
  "Sweatshirts": "35d13c3c-9293-4b4d-afac-c4cf949d07a1",
  "Hoodies": "4b747870-5e32-49d5-ac09-3ea0085d22b7",
  "Sweat jackets": "4f290a66-d82e-4b84-b670-f110e5724c96",
  "Fleece Jackets & Pullovers": "71bd4640-4d9f-47a1-bc7c-dd6eaf5cee3b",

  // ─── T-SHIRTS & POLOS ────────────────────────────────────────────────────────
  "Sports T-shirts": "34860c13-c102-47a5-b418-e57a5e1926ae",
  "Basic T-shirts": "3cf6d733-d889-427f-adcc-9791b61d853e",
  "Tops": "54e852fa-568d-4c03-b4f7-fd75b28bdaec",
  "Tank Tops": "65ab253b-967e-47a2-8220-4a8192ee07d9",
  "Printed T-shirts": "82f3751b-d3bb-4f59-9e5f-692e2646633d",
  "Long-sleeved Tops": "ad336bfe-3fe5-43c4-aa61-ce64a21d3152",
  "Polo Shirts": "d7e5e0be-58c9-452d-84bc-18d5d4287287",

  // ─── SHIRTS & BLOUSES ────────────────────────────────────────────────────────
  "Shirt blouses": "5fb7de4a-3750-4b96-895c-adf650dd2be1",
  "Business Shirts": "927f3fe0-dec1-4211-99be-b268f6fefc47",
  "Casual Shirts": "a3bc713d-bf59-4bbe-8635-6c859ab7f72e",
  "Blouses": "ab7ed6e4-4b97-4276-a7f1-a60aa78ef6b9",
  "Tunics": "be1c54f9-829f-4bf3-b21b-3e35e81c0e26",

  // ─── KNITWEAR & CARDIGANS ────────────────────────────────────────────────────
  "Cardigans": "a5dfcdba-d850-4c67-adc9-8622b76ec929",
  "Knitted jumper": "b0e86dba-0d02-4585-89d2-7bb513688f71",

  // ─── TROUSERS ────────────────────────────────────────────────────────────────
  "Cargo Trousers": "0bff7e13-c11e-4182-b5ee-17c6b49e2962",
  "Joggers_Trousers": "481050c0-ca83-4164-808e-51f6eeafb83a", // Trousers > Joggers
  "Dungarees": "57296488-4573-447d-8192-7e34432ba83a",
  "Slacks": "5f8c3115-9398-43f1-ab67-2cdfaac9a25c",
  "Chinos": "6e77ebd2-1287-4dac-9a34-b277c8327d64",
  "Leggings_Trousers": "6fd3b465-63dd-4fa7-bdde-22ce64d8174f", // Trousers > Leggings
  "Smart Trousers": "9dd89526-b69d-4ba1-af22-458dd3bf8d73",
  "Leather Trousers": "d0561c17-b571-4243-bcc3-37fd8743ff2f",

  // ─── JEANS ───────────────────────────────────────────────────────────────────
  "Tapered": "1a188022-edd3-4f70-841e-35e5d34443e0",
  "Baggy & Loose": "345fb3b9-dc9d-44ae-970f-5b8a68e238f1",
  "Overalls & Workwear": "431cc730-56ad-4f23-a1aa-f5e00b5b4c4b",
  "Denim Shorts_Jeans": "629074ac-f1a9-4a82-aa63-5c50775eef63", // Jeans > Denim Shorts
  "Jumpsuits & Overalls": "6f6df902-e2a4-454c-916c-17791e45fe3a",
  "Straight": "7ef83cb7-0484-48d1-a3b6-7f5ecbdb1972",
  "Slim": "b83729eb-4ae4-4e02-b110-d05bb0d755d0",
  "Relaxed": "94ba8ee6-a4c1-4ee7-96c5-a39aad941f52",
  "Bootcut & Flared": "96f2fa5b-adec-4d8b-b389-2446226e9621",
  "Skinny": "9fa5caac-c81e-476c-b3c8-99129ad7d597",
  "Wide": "adbeea42-0dc7-4ff3-b81f-f31adb3e3ad2",

  // ─── JACKETS ─────────────────────────────────────────────────────────────────
  "Leather Jackets": "10645011-8326-409f-998f-496d1ff96f54",
  "Outdoor Jackets": "25bb81e8-3d9e-4bef-ae3a-2653404c8385",
  "Denim Jackets": "50bf423c-98f9-4c7f-ab4e-8ffe1818e31f",
  "Capes": "54d132b2-45e8-4b41-a1dc-aa7f68fbf527",
  "Waistcoats": "633da191-d1b8-4fe6-82c3-6c00429509c8",
  "Training Jackets": "74124654-40c1-429f-942e-36d6d97a1813",
  "Blazers": "7a54e8b0-b253-49a4-9fc9-08ed06b98d8b",
  "Gilet": "8d56fbc6-cd5d-47aa-a867-7a966deaa5b5",
  "Bomber Jackets": "9e1a663a-b930-4f2d-8584-46dd2c3e89e3",
  "Winter Jackets": "a1b8af2f-928d-4ad1-8a54-ce1ac47fb4f1",
  "Lightweight jackets": "c056f727-8ed2-4145-901c-0f2e7910a1ce",
  "Down Jackets": "d1f8e846-b2ad-4463-80e7-7a666f797ca3",
  "Fleece Jackets": "e14cb2a1-2e43-4ba2-b89e-a45a55c8c402",
  "Waterproof Jackets": "e47758ed-5030-4f1b-b3f0-d92d9af30209",

  // ─── COATS ───────────────────────────────────────────────────────────────────
  "Down coats": "0c9296f2-9eaf-4d3c-9392-d7ed90385ea4",
  "Winter coats": "2422516c-795a-4603-8983-add1996e34fa",
  "Wool coats": "4faa3688-bd4b-4d5d-90ae-2efa81fc6665",
  "Parkas": "abe48440-92e1-4118-a67b-906e4f7612c3",
  "Short coats": "e237316d-a33c-4370-93c2-373c5a69ef11",
  "Trench coats": "efd2f729-3d20-4ec4-88cf-5b77e0cf2d15",

  // ─── TRACKSUITS & JOGGERS ────────────────────────────────────────────────────
  "Tracksuit Jackets": "2d2b2ce7-49c4-4b73-af89-e836f9e078c3",
  "Joggers_Tracksuits": "c45e7e61-4125-4bdf-95d1-e5b717de94f7", // Tracksuits & Joggers > Joggers
  "Tracksuits": "d85b6bcb-f161-4730-9028-ca8aea6fc804",

  // ─── SHORTS ──────────────────────────────────────────────────────────────────
  "Sport Shorts": "646b270d-a75e-4650-8b7b-34a1204c7d2f",
  "Denim shorts_Shorts": "79cac5b1-4a9e-4c8d-90b7-84f1f058365a", // Shorts > Denim shorts
  "Casual Shorts": "dd05be03-7652-44d4-8593-ee0763b10b16",

  // ─── SKIRTS ──────────────────────────────────────────────────────────────────
  "Denim Skirts": "13637301-1dba-441c-94a2-9d30dc150cd2",
  "A-line Skirts": "3c238712-707f-403f-a581-9fed275b22cb",
  "Maxi Skirts": "45fea8b7-8ade-44b8-83c8-92ed0cfb8d7c",
  "Mini Skirts": "4683254b-5983-4369-8eb0-4860930d618e",
  "Wrap Skirts": "8a9cf564-e9f4-48f1-9d1a-93d366ba7d70",
  "Pencil Skirts": "b9a77777-e8a5-446b-88f8-227ca0ada29d",
  "Pleated Skirts": "95653d69-b07f-4cbd-848b-654efaefcb2f",
  "Leather Skirts": "e421f7be-1580-43b7-961d-2e6ee2b96596",

  // ─── UNDERWEAR ───────────────────────────────────────────────────────────────
  "Shapewear": "14f58501-771d-45bf-a1a9-1e795e161e1f",
  "Bottoms": "19d9d900-0777-4bba-85f8-2e2c23749ea0",
  "Bras": "553c8c8d-7f83-43f7-b517-c05bf473d2a4",
  "Bodysuits & Sets": "640acdcc-6382-4b0d-8c75-af72d3015647",
  "Undershirts": "a5aa121a-f188-49a4-b9b0-2fe9aabf5729",
  "Boxers": "afb70122-34d1-4601-9e9a-17234039fda8",
  "Underpants": "fb035c22-2e77-42b2-a8f8-2c35971677a3",

  // ─── SOCKS & TIGHTS ──────────────────────────────────────────────────────────
  "Stay-ups": "0728960e-044e-47b7-bc71-69353aecb5e8",
  "Sports socks": "1ac38c25-1200-4429-acc9-3fde4ab19ddb",
  "Socks": "7fd7a1a6-b2cf-4e67-83e3-73bba4ccbe6a",
  "Tights": "b55d68b2-08c0-4461-aa18-ee9a8f168f03",
  "Knee high socks": "b59cc926-70ed-47a0-9826-82f7ebdfa06d",
  "Leggings_SocksAndTights": "e0e98583-b4fb-4d0c-9de5-3178682c0684", // Socks & Tights > Leggings

  // ─── SWIMWEAR ────────────────────────────────────────────────────────────────
  "Beach accessories": "27d08468-ff4d-4bdd-9a1e-67ebf188b747",
  "Swimsuits": "5ac64f7b-8b8e-4ab1-9c1b-d56c6ac40847",
  "Swim trunks": "9b168efb-9986-4aac-a515-1b919234c861",
  "Bikinis": "a1557ba7-7884-4ec8-bc1a-febcbff83ae8",

  // ─── LOUNGEWEAR & SLEEPWEAR ──────────────────────────────────────────────────
  "Bathrobes": "0f21ee55-08c8-4691-b49c-741ecf7a29da",
  "Night shirts": "38263e0b-568d-4489-82e7-e9887c20842e",
  "Shirts_Loungewear": "5d644123-74cf-4c78-903e-3da8515031ae", // Loungewear & Sleepwear > Shirts
  "Trousers_Loungewear": "6877f7df-b252-4b36-91b9-cdb870af1d88", // Loungewear & Sleepwear > Trousers
  "Pyjamas": "aac36b1b-debe-4fa0-bd66-32227cc7791b",

  // ─── ACCESSORIES ─────────────────────────────────────────────────────────────
  "Hats & caps": "15dc0f28-9191-4f2b-88bb-7f50d6e6aa5a",
  "Sunglasses": "1eb41ff5-5dad-4c84-bc9c-9d6a671bb771",
  "Wallets & card holders": "311ed0b0-8713-4593-9008-9dd249f98193",
  "Jewellery": "3e0f479c-0d02-47d5-920d-0c19c7cca698",
  "Miscellaneous": "7168fb4d-6abb-4e48-a802-27e3e094b584",
  "Scarves": "8de0b121-79ae-41b1-8bc7-bf9dfa11292c",
  "Bags & cases": "b16f098c-b952-469b-8f0e-583609e4fdb1",
  "Gloves": "dada419e-b964-445c-81a1-2b69d08514c7",
  "Watches": "e3346f5c-7b4a-4178-923a-394b104945ad",
  "Umbrellas": "e74e5000-d2e8-4085-85de-69b95a7a937a",
  "Belts": "f70c9a6b-6535-4eeb-b894-0682bf8c6a13",
  "Blue-light glasses": "afcd78a3-a6cb-45d8-baf4-76ad6bc2f9d8",
} as const;

// Type for the UUID values
type CategoryUuid = (typeof CATEGORY_UUIDS)[keyof typeof CATEGORY_UUIDS];

// =============================================================================
// TIER 1: BRANCH DEFAULTS
// =============================================================================
// Maps Shopify branch prefixes to Avelero category UUIDs.
// Provides 100% coverage - every category falls into at least one branch.
// null = skip this category (e.g., Baby & Toddler items)

// biome-ignore lint/complexity/useLiteralKeys: Using bracket notation for consistency with keys that contain spaces/special characters
const BRANCH_DEFAULTS: Record<string, CategoryUuid | null> = {
  // ─────────────────────────────────────────────────────────────────────────────
  // CLOTHING (aa-1)
  // ─────────────────────────────────────────────────────────────────────────────

  // Activewear - default to Sports T-shirts, with specific overrides below
  "aa-1-1": CATEGORY_UUIDS["Sports T-shirts"],
  "aa-1-1-1": CATEGORY_UUIDS["Joggers_Trousers"], // Activewear Pants
  "aa-1-1-2": CATEGORY_UUIDS["Sports T-shirts"], // Activewear Tops
  "aa-1-1-7": CATEGORY_UUIDS["Hoodies"], // Activewear Sweatshirts & Hoodies
  "aa-1-1-8": CATEGORY_UUIDS["Lightweight jackets"], // Activewear Vests & Jackets

  // Baby & Toddler - skip (most brands don't want these mixed)
  "aa-1-2": null,

  // Boys' Underwear
  "aa-1-3": CATEGORY_UUIDS["Underpants"],

  // Dresses
  "aa-1-4": CATEGORY_UUIDS["Casual Dresses"],

  // Girls' Underwear
  "aa-1-5": CATEGORY_UUIDS["Underpants"],

  // Lingerie
  "aa-1-6": CATEGORY_UUIDS["Bras"],
  "aa-1-6-10": CATEGORY_UUIDS["Shapewear"], // Shapewear
  "aa-1-6-11": CATEGORY_UUIDS["Underpants"], // Women's Underpants

  // Maternity - skip or use general clothing
  "aa-1-7": null,

  // Men's Undergarments
  "aa-1-8": CATEGORY_UUIDS["Boxers"],
  "aa-1-8-2": CATEGORY_UUIDS["Undershirts"], // Men's Undershirts
  "aa-1-8-3": CATEGORY_UUIDS["Boxers"], // Men's Underwear

  // One-Pieces (jumpsuits, rompers)
  "aa-1-9": CATEGORY_UUIDS["Jumpsuits & Overalls"],

  // Outerwear - split between Jackets and Coats
  "aa-1-10": CATEGORY_UUIDS["Lightweight jackets"],
  "aa-1-10-2": CATEGORY_UUIDS["Lightweight jackets"], // Coats & Jackets

  // Outfit Sets - skip
  "aa-1-11": null,

  // Pants
  "aa-1-12": CATEGORY_UUIDS["Chinos"],

  // Clothing Tops
  "aa-1-13": CATEGORY_UUIDS["Basic T-shirts"],

  // Shorts
  "aa-1-14": CATEGORY_UUIDS["Casual Shorts"],

  // Skirts
  "aa-1-15": CATEGORY_UUIDS["A-line Skirts"],

  // Skorts
  "aa-1-16": CATEGORY_UUIDS["A-line Skirts"],

  // Sleepwear & Loungewear
  "aa-1-17": CATEGORY_UUIDS["Pyjamas"],
  "aa-1-17-2": CATEGORY_UUIDS["Trousers_Loungewear"], // Loungewear

  // Socks
  "aa-1-18": CATEGORY_UUIDS["Socks"],

  // Suits
  "aa-1-19": CATEGORY_UUIDS["Suits"],

  // Swimwear
  "aa-1-20": CATEGORY_UUIDS["Swimsuits"],

  // Wedding & Bridal
  "aa-1-22": CATEGORY_UUIDS["Evening Dresses"],

  // Traditional & Ceremonial
  "aa-1-23": CATEGORY_UUIDS["Casual Dresses"],

  // Uniforms & Workwear
  "aa-1-24": CATEGORY_UUIDS["Basic T-shirts"],

  // ─────────────────────────────────────────────────────────────────────────────
  // CLOTHING ACCESSORIES (aa-2)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-2": CATEGORY_UUIDS["Miscellaneous"], // Default for all accessories
  "aa-2-2": null, // Baby & Toddler Accessories - skip
  "aa-2-3": CATEGORY_UUIDS["Hats & caps"], // Balaclavas
  "aa-2-4": CATEGORY_UUIDS["Scarves"], // Bandanas & Headties
  "aa-2-5": CATEGORY_UUIDS["Belts"], // Belt Buckles
  "aa-2-6": CATEGORY_UUIDS["Belts"], // Belts
  "aa-2-12": CATEGORY_UUIDS["Hats & caps"], // Earmuffs
  "aa-2-13": CATEGORY_UUIDS["Gloves"], // Gloves & Mittens
  "aa-2-14": CATEGORY_UUIDS["Miscellaneous"], // Hair Accessories
  "aa-2-17": CATEGORY_UUIDS["Hats & caps"], // Hats
  "aa-2-18": CATEGORY_UUIDS["Hats & caps"], // Headwear
  "aa-2-19": CATEGORY_UUIDS["Socks"], // Leg Warmers
  "aa-2-22": CATEGORY_UUIDS["Scarves"], // Neck Gaiters
  "aa-2-23": CATEGORY_UUIDS["Ties & accessories"], // Neckties
  "aa-2-26": CATEGORY_UUIDS["Scarves"], // Scarves & Shawls
  "aa-2-27": CATEGORY_UUIDS["Sunglasses"], // Sunglasses
  "aa-2-28": CATEGORY_UUIDS["Belts"], // Suspenders

  // ─────────────────────────────────────────────────────────────────────────────
  // COSTUMES & ACCESSORIES (aa-3)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-3": null, // Skip costumes by default

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDBAG & WALLET ACCESSORIES (aa-4)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-4": CATEGORY_UUIDS["Miscellaneous"], // Keychains, lanyards, etc.

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDBAGS, WALLETS & CASES (aa-5)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-5": CATEGORY_UUIDS["Bags & cases"],
  "aa-5-4": CATEGORY_UUIDS["Bags & cases"], // Handbags
  "aa-5-5": CATEGORY_UUIDS["Wallets & card holders"], // Wallets & Money Clips

  // ─────────────────────────────────────────────────────────────────────────────
  // JEWELRY (aa-6)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-6": CATEGORY_UUIDS["Jewellery"],
  "aa-6-10": CATEGORY_UUIDS["Watches"], // Watch Accessories
  "aa-6-11": CATEGORY_UUIDS["Watches"], // Watches
  "aa-6-12": CATEGORY_UUIDS["Watches"], // Smart Watches

  // ─────────────────────────────────────────────────────────────────────────────
  // SHOE ACCESSORIES (aa-7)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-7": CATEGORY_UUIDS["Miscellaneous"], // Shoelaces, insoles, etc.

  // ─────────────────────────────────────────────────────────────────────────────
  // SHOES (aa-8)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-8": CATEGORY_UUIDS["Sneakers"], // Default footwear
  "aa-8-1": CATEGORY_UUIDS["Sports shoes"], // Athletic Shoes
  "aa-8-2": null, // Baby & Toddler Shoes - skip
  "aa-8-3": CATEGORY_UUIDS["Boots"], // Boots
  "aa-8-6": CATEGORY_UUIDS["Sandals"], // Sandals
  "aa-8-7": CATEGORY_UUIDS["Slippers"], // Slippers
  "aa-8-8": CATEGORY_UUIDS["Sneakers"], // Sneakers
  "aa-8-9": CATEGORY_UUIDS["Flat shoes"], // Flats
  "aa-8-10": CATEGORY_UUIDS["High heels"], // Heels
};

// =============================================================================
// TIER 2: SPECIFIC MAPPINGS
// =============================================================================
// Override specific Shopify categories for maximum precision.
// These take precedence over BRANCH_DEFAULTS.

const SPECIFIC_MAPPINGS: Record<string, CategoryUuid | null> = {
  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIVEWEAR (aa-1-1)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-1-1-1": CATEGORY_UUIDS["Joggers_Trousers"], // Activewear Joggers
  "aa-1-1-1-2": CATEGORY_UUIDS["Leggings_Trousers"], // Activewear Leggings
  "aa-1-1-1-3": CATEGORY_UUIDS["Sport Shorts"], // Activewear Shorts
  "aa-1-1-1-4": CATEGORY_UUIDS["Joggers_Trousers"], // Activewear Sweatpants
  "aa-1-1-1-5": CATEGORY_UUIDS["Tights"], // Tights
  "aa-1-1-1-6": CATEGORY_UUIDS["Joggers_Trousers"], // Track Pants
  "aa-1-1-1-7": CATEGORY_UUIDS["Joggers_Trousers"], // Training Pants
  "aa-1-1-2-1": CATEGORY_UUIDS["Tops"], // Crop Tops
  "aa-1-1-2-2": CATEGORY_UUIDS["Sports T-shirts"], // Activewear T-Shirts
  "aa-1-1-2-3": CATEGORY_UUIDS["Tank Tops"], // Activewear Tank Tops
  "aa-1-1-4": CATEGORY_UUIDS["Sport Shorts"], // Boxing Shorts
  "aa-1-1-6": CATEGORY_UUIDS["Bras"], // Sports Bras
  "aa-1-1-7-2": CATEGORY_UUIDS["Hoodies"], // Activewear Hoodies
  "aa-1-1-7-4": CATEGORY_UUIDS["Sweatshirts"], // Activewear Sweatshirts
  "aa-1-1-7-5": CATEGORY_UUIDS["Training Jackets"], // Track Jackets
  "aa-1-1-8-1": CATEGORY_UUIDS["Gilet"], // Activewear Vests
  "aa-1-1-8-2": CATEGORY_UUIDS["Training Jackets"], // Activewear Jackets
  "aa-1-1-9": CATEGORY_UUIDS["Bodysuits & Sets"], // Leotards & Unitards

  // ─────────────────────────────────────────────────────────────────────────────
  // DRESSES (aa-1-4)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-4": CATEGORY_UUIDS["Casual Dresses"], // General Dresses

  // ─────────────────────────────────────────────────────────────────────────────
  // LINGERIE (aa-1-6)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-6-1": CATEGORY_UUIDS["Bodysuits & Sets"], // Lingerie Bodysuits
  "aa-1-6-3": CATEGORY_UUIDS["Bras"], // Bras
  "aa-1-6-4": CATEGORY_UUIDS["Undershirts"], // Camisoles
  "aa-1-6-6": CATEGORY_UUIDS["Tights"], // Hosiery
  "aa-1-6-8-3": CATEGORY_UUIDS["Tights"], // Pantyhose
  "aa-1-6-10-1": CATEGORY_UUIDS["Shapewear"], // Shapewear Bodysuits
  "aa-1-6-11-1": CATEGORY_UUIDS["Underpants"], // Bikinis (underwear)
  "aa-1-6-11-2": CATEGORY_UUIDS["Underpants"], // Boyshorts
  "aa-1-6-11-3": CATEGORY_UUIDS["Underpants"], // Briefs
  "aa-1-6-11-6": CATEGORY_UUIDS["Underpants"], // Thongs
  "aa-1-6-12": CATEGORY_UUIDS["Undershirts"], // Women's Undershirts

  // ─────────────────────────────────────────────────────────────────────────────
  // MEN'S UNDERGARMENTS (aa-1-8)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-8-3-2": CATEGORY_UUIDS["Boxers"], // Boxer Briefs
  "aa-1-8-3-3": CATEGORY_UUIDS["Boxers"], // Boxer Shorts
  "aa-1-8-3-4": CATEGORY_UUIDS["Underpants"], // Briefs
  "aa-1-8-3-8": CATEGORY_UUIDS["Boxers"], // Trunks

  // ─────────────────────────────────────────────────────────────────────────────
  // ONE-PIECES (aa-1-9)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-9": CATEGORY_UUIDS["Jumpsuits & Overalls"], // One-Pieces (jumpsuits, rompers)

  // ─────────────────────────────────────────────────────────────────────────────
  // OUTERWEAR (aa-1-10)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-10-2-1": CATEGORY_UUIDS["Lightweight jackets"], // Bolero Jackets
  "aa-1-10-2-2": CATEGORY_UUIDS["Bomber Jackets"], // Bomber Jackets
  "aa-1-10-2-3": CATEGORY_UUIDS["Capes"], // Capes
  "aa-1-10-2-5": CATEGORY_UUIDS["Winter coats"], // Overcoats
  "aa-1-10-2-6": CATEGORY_UUIDS["Parkas"], // Parkas
  "aa-1-10-2-7": CATEGORY_UUIDS["Wool coats"], // Pea Coats
  "aa-1-10-2-8": CATEGORY_UUIDS["Capes"], // Ponchos
  "aa-1-10-2-9": CATEGORY_UUIDS["Down Jackets"], // Puffer Jackets
  "aa-1-10-2-10": CATEGORY_UUIDS["Waterproof Jackets"], // Rain Coats
  "aa-1-10-2-11": CATEGORY_UUIDS["Training Jackets"], // Sport Jackets
  "aa-1-10-2-12": CATEGORY_UUIDS["Training Jackets"], // Track Jackets
  "aa-1-10-2-13": CATEGORY_UUIDS["Trench coats"], // Trench Coats
  "aa-1-10-2-14": CATEGORY_UUIDS["Denim Jackets"], // Trucker Jackets
  "aa-1-10-2-15": CATEGORY_UUIDS["Bomber Jackets"], // Varsity Jackets
  "aa-1-10-2-16": CATEGORY_UUIDS["Waterproof Jackets"], // Windbreakers
  "aa-1-10-2-17": CATEGORY_UUIDS["Wool coats"], // Wrap Coats
  "aa-1-10-3": CATEGORY_UUIDS["Waterproof Jackets"], // Rain Pants
  "aa-1-10-4": CATEGORY_UUIDS["Waterproof Jackets"], // Rain Suits
  "aa-1-10-5": CATEGORY_UUIDS["Winter Jackets"], // Snow Pants & Suits
  "aa-1-10-6": CATEGORY_UUIDS["Gilet"], // Vests
  "aa-1-10-7": CATEGORY_UUIDS["Leather Jackets"], // Motorcycle Outerwear

  // ─────────────────────────────────────────────────────────────────────────────
  // PANTS (aa-1-12)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-12-2": CATEGORY_UUIDS["Cargo Trousers"], // Cargo Pants
  "aa-1-12-3": CATEGORY_UUIDS["Chinos"], // Chinos
  "aa-1-12-4": CATEGORY_UUIDS["Straight"], // Jeans
  "aa-1-12-5": CATEGORY_UUIDS["Skinny"], // Jeggings
  "aa-1-12-7": CATEGORY_UUIDS["Joggers_Trousers"], // Joggers
  "aa-1-12-8": CATEGORY_UUIDS["Leggings_Trousers"], // Leggings
  "aa-1-12-11": CATEGORY_UUIDS["Smart Trousers"], // Trousers

  // ─────────────────────────────────────────────────────────────────────────────
  // CLOTHING TOPS (aa-1-13)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-13-1": CATEGORY_UUIDS["Blouses"], // Blouses
  "aa-1-13-2": CATEGORY_UUIDS["Bodysuits & Sets"], // Bodysuits
  "aa-1-13-3": CATEGORY_UUIDS["Cardigans"], // Cardigans
  "aa-1-13-5": CATEGORY_UUIDS["Casual Shirts"], // Overshirts
  "aa-1-13-6": CATEGORY_UUIDS["Polo Shirts"], // Polos
  "aa-1-13-7": CATEGORY_UUIDS["Casual Shirts"], // Shirts
  "aa-1-13-8": CATEGORY_UUIDS["Basic T-shirts"], // T-Shirts
  "aa-1-13-9": CATEGORY_UUIDS["Tank Tops"], // Tank Tops
  "aa-1-13-11": CATEGORY_UUIDS["Tunics"], // Tunics
  "aa-1-13-12": CATEGORY_UUIDS["Knitted jumper"], // Sweaters
  "aa-1-13-13": CATEGORY_UUIDS["Hoodies"], // Hoodies
  "aa-1-13-14": CATEGORY_UUIDS["Sweatshirts"], // Sweatshirts

  // ─────────────────────────────────────────────────────────────────────────────
  // SHORTS (aa-1-14)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-14-1": CATEGORY_UUIDS["Casual Shorts"], // Bermudas
  "aa-1-14-2": CATEGORY_UUIDS["Cargo Trousers"], // Cargo Shorts (map to Cargo category)
  "aa-1-14-3": CATEGORY_UUIDS["Casual Shorts"], // Chino Shorts
  "aa-1-14-4": CATEGORY_UUIDS["Smart Trousers"], // Short Trousers
  "aa-1-14-5": CATEGORY_UUIDS["Denim shorts_Shorts"], // Denim Shorts
  "aa-1-14-6": CATEGORY_UUIDS["Skinny"], // Jegging Shorts
  "aa-1-14-7": CATEGORY_UUIDS["Joggers_Trousers"], // Jogger Shorts
  "aa-1-14-8": CATEGORY_UUIDS["Leggings_Trousers"], // Legging Shorts

  // ─────────────────────────────────────────────────────────────────────────────
  // SKIRTS (aa-1-15)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-15": CATEGORY_UUIDS["A-line Skirts"], // General Skirts

  // ─────────────────────────────────────────────────────────────────────────────
  // SLEEPWEAR & LOUNGEWEAR (aa-1-17)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-17-1": CATEGORY_UUIDS["Pyjamas"], // Long Johns
  "aa-1-17-2-1": CATEGORY_UUIDS["Trousers_Loungewear"], // Loungewear Bottoms
  "aa-1-17-2-1-1": CATEGORY_UUIDS["Boxers"], // Loungewear Boxers
  "aa-1-17-2-1-2": CATEGORY_UUIDS["Joggers_Trousers"], // Loungewear Joggers
  "aa-1-17-2-1-3": CATEGORY_UUIDS["Leggings_Trousers"], // Loungewear Leggings
  "aa-1-17-2-1-4": CATEGORY_UUIDS["Casual Shorts"], // Loungewear Shorts
  "aa-1-17-2-2": CATEGORY_UUIDS["Shirts_Loungewear"], // Loungewear Tops
  "aa-1-17-3": CATEGORY_UUIDS["Night shirts"], // Nightgowns
  "aa-1-17-4": CATEGORY_UUIDS["Pyjamas"], // Pajamas
  "aa-1-17-5": CATEGORY_UUIDS["Bathrobes"], // Robes
  "aa-1-17-6": CATEGORY_UUIDS["Pyjamas"], // Onesies

  // ─────────────────────────────────────────────────────────────────────────────
  // SOCKS (aa-1-18)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-18-1": CATEGORY_UUIDS["Socks"], // Ankle Socks
  "aa-1-18-2": CATEGORY_UUIDS["Sports socks"], // Athletic Socks
  "aa-1-18-3": CATEGORY_UUIDS["Socks"], // Crew Socks
  "aa-1-18-8": CATEGORY_UUIDS["Knee high socks"], // Knee Socks

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITS (aa-1-19)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-19-1": CATEGORY_UUIDS["Suits"], // Pant Suits
  "aa-1-19-2": CATEGORY_UUIDS["Suits"], // Skirt Suits
  "aa-1-19-3": CATEGORY_UUIDS["Suits"], // Tuxedos

  // ─────────────────────────────────────────────────────────────────────────────
  // SWIMWEAR (aa-1-20)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-20-2": CATEGORY_UUIDS["Swim trunks"], // Boardshorts
  "aa-1-20-3": CATEGORY_UUIDS["Swim trunks"], // Swim Boxers
  "aa-1-20-4": CATEGORY_UUIDS["Swim trunks"], // Swim Briefs
  "aa-1-20-5": CATEGORY_UUIDS["Swimsuits"], // Burkinis
  "aa-1-20-6": CATEGORY_UUIDS["Bikinis"], // Classic Bikinis
  "aa-1-20-7": CATEGORY_UUIDS["Beach accessories"], // Cover Ups
  "aa-1-20-12": CATEGORY_UUIDS["Swimsuits"], // Rash Guards
  "aa-1-20-17": CATEGORY_UUIDS["Swimsuits"], // Swim Dresses
  "aa-1-20-22": CATEGORY_UUIDS["Swimsuits"], // One-Piece Swimsuits
  "aa-1-20-23": CATEGORY_UUIDS["Swimsuits"], // Surf Tops
  "aa-1-20-24": CATEGORY_UUIDS["Bikinis"], // Swimwear Tops

  // ─────────────────────────────────────────────────────────────────────────────
  // WEDDING & BRIDAL (aa-1-22)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-1-22-1": CATEGORY_UUIDS["Evening Dresses"], // Bridal Party Dresses
  "aa-1-22-2": CATEGORY_UUIDS["Occasion Dresses"], // Wedding Dresses

  // ─────────────────────────────────────────────────────────────────────────────
  // HATS (aa-2-17)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-2-17-1": CATEGORY_UUIDS["Hats & caps"], // Baseball Caps
  "aa-2-17-2": CATEGORY_UUIDS["Hats & caps"], // Beanies
  "aa-2-17-3": CATEGORY_UUIDS["Hats & caps"], // Berets
  "aa-2-17-5": CATEGORY_UUIDS["Hats & caps"], // Bucket Hats
  "aa-2-17-6": CATEGORY_UUIDS["Hats & caps"], // Cowboy Hats
  "aa-2-17-7": CATEGORY_UUIDS["Hats & caps"], // Fedoras
  "aa-2-17-10": CATEGORY_UUIDS["Hats & caps"], // Snapback Caps
  "aa-2-17-11": CATEGORY_UUIDS["Hats & caps"], // Sun Hats
  "aa-2-17-14": CATEGORY_UUIDS["Hats & caps"], // Trucker Hats
  "aa-2-17-15": CATEGORY_UUIDS["Hats & caps"], // Visors
  "aa-2-17-16": CATEGORY_UUIDS["Hats & caps"], // Winter Hats

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDBAGS (aa-5-4)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-5-4-1": CATEGORY_UUIDS["Bags & cases"], // Baguette Handbags
  "aa-5-4-2": CATEGORY_UUIDS["Bags & cases"], // Barrel Bags
  "aa-5-4-3": CATEGORY_UUIDS["Bags & cases"], // Beach Bags
  "aa-5-4-4": CATEGORY_UUIDS["Bags & cases"], // Bucket Bags
  "aa-5-4-5": CATEGORY_UUIDS["Bags & cases"], // Clutch Bags
  "aa-5-4-7": CATEGORY_UUIDS["Bags & cases"], // Cross Body Bags
  "aa-5-4-12": CATEGORY_UUIDS["Bags & cases"], // Hobo Bags
  "aa-5-4-15": CATEGORY_UUIDS["Bags & cases"], // Saddle Bags
  "aa-5-4-16": CATEGORY_UUIDS["Bags & cases"], // Satchel Bags
  "aa-5-4-17": CATEGORY_UUIDS["Bags & cases"], // School Bags
  "aa-5-4-18": CATEGORY_UUIDS["Bags & cases"], // Shopper Bags
  "aa-5-4-19": CATEGORY_UUIDS["Bags & cases"], // Shoulder Bags

  // ─────────────────────────────────────────────────────────────────────────────
  // WALLETS (aa-5-5)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-5-5-2": CATEGORY_UUIDS["Wallets & card holders"], // Card Cases
  "aa-5-5-3": CATEGORY_UUIDS["Wallets & card holders"], // Coin Purses
  "aa-5-5-4": CATEGORY_UUIDS["Wallets & card holders"], // Key Cases
  "aa-5-5-6": CATEGORY_UUIDS["Wallets & card holders"], // Travel Wallets
  "aa-5-5-7": CATEGORY_UUIDS["Wallets & card holders"], // Wallets

  // ─────────────────────────────────────────────────────────────────────────────
  // JEWELRY (aa-6)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-6-1": CATEGORY_UUIDS["Jewellery"], // Anklets
  "aa-6-2": CATEGORY_UUIDS["Jewellery"], // Body Jewelry
  "aa-6-3": CATEGORY_UUIDS["Jewellery"], // Bracelets
  "aa-6-4": CATEGORY_UUIDS["Jewellery"], // Brooches & Lapel Pins
  "aa-6-5": CATEGORY_UUIDS["Jewellery"], // Charms & Pendants
  "aa-6-6": CATEGORY_UUIDS["Jewellery"], // Earrings
  "aa-6-7": CATEGORY_UUIDS["Jewellery"], // Jewelry Sets
  "aa-6-8": CATEGORY_UUIDS["Jewellery"], // Necklaces
  "aa-6-9": CATEGORY_UUIDS["Jewellery"], // Rings
  "aa-6-10-1": CATEGORY_UUIDS["Watches"], // Watch Bands
  "aa-6-11": CATEGORY_UUIDS["Watches"], // Watches
  "aa-6-12": CATEGORY_UUIDS["Watches"], // Smart Watches

  // ─────────────────────────────────────────────────────────────────────────────
  // SHOES (aa-8)
  // ─────────────────────────────────────────────────────────────────────────────
  "aa-8-1": CATEGORY_UUIDS["Sports shoes"], // Athletic Shoes
  "aa-8-3": CATEGORY_UUIDS["Boots"], // Boots
  "aa-8-6": CATEGORY_UUIDS["Sandals"], // Sandals
  "aa-8-7": CATEGORY_UUIDS["Slippers"], // Slippers
  "aa-8-8": CATEGORY_UUIDS["Sneakers"], // Sneakers
  "aa-8-9": CATEGORY_UUIDS["Flat shoes"], // Flats
  "aa-8-10": CATEGORY_UUIDS["High heels"], // Heels
};

// =============================================================================
// CATEGORY RESOLVER
// =============================================================================

/**
 * Extracts the short category ID from a Shopify GID.
 * Example: "gid://shopify/TaxonomyCategory/aa-1-13-8" → "aa-1-13-8"
 */
function extractShortId(shopifyCategoryId: string): string {
  return shopifyCategoryId.replace(
    /^gid:\/\/shopify\/TaxonomyCategory\//,
    ""
  );
}

/**
 * Resolves a Shopify category to an Avelero category UUID.
 *
 * Resolution order:
 * 1. Exact match in SPECIFIC_MAPPINGS
 * 2. Walk up hierarchy looking for matches in both maps
 * 3. Return null if no mapping found (product will have no category)
 *
 * @param shopifyCategory - The category object from Shopify GraphQL response
 * @returns Avelero category UUID (string), or null to skip
 */
export function resolveShopifyCategoryId(
  shopifyCategory: { id: string; name: string; fullName: string } | null | undefined
): string | null {
  if (!shopifyCategory?.id) return null;

  const shortId = extractShortId(shopifyCategory.id);

  // 1. Check specific mapping first (exact match)
  const specificMatch = SPECIFIC_MAPPINGS[shortId];
  if (specificMatch !== undefined) {
    return specificMatch;
  }

  // 2. Walk up the hierarchy looking for branch defaults
  const parts = shortId.split("-");
  while (parts.length > 0) {
    const prefix = parts.join("-");

    // Check specific mappings at this level
    const specificAtLevel = SPECIFIC_MAPPINGS[prefix];
    if (specificAtLevel !== undefined) {
      return specificAtLevel;
    }

    // Check branch defaults at this level
    const branchDefault = BRANCH_DEFAULTS[prefix];
    if (branchDefault !== undefined) {
      return branchDefault;
    }

    parts.pop();
  }

  // 3. No mapping found - return null (category will be skipped)
  return null;
}

// Legacy export for backwards compatibility
export const resolveShopifyCategoryName = resolveShopifyCategoryId;
