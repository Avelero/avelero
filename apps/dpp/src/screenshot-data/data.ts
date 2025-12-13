import type { DppContent, DppData } from "@v1/dpp-components";

/**
 * Screenshot demo product data for theme preview.
 *
 * Used by the /ahw_preview_jja/ route for screenshot generation.
 * This can differ from demo-data/data.ts used for the homepage demo.
 */
export const screenshotProductData: DppData = {
  productIdentifiers: {
    productId: 1,
    productName: "Sustainable Wool-Blend Jacket",
    productImage:
      "https://ebshgnuavsacpplatsqt.supabase.co/storage/v1/object/public/products/theme-preview/theme-preview-image.webp",
    articleNumber: "8819438821",
  },

  productAttributes: {
    description:
      "Jacket crafted with a blend of virgin wool and recycled polyester. Detailed with an Avelero Apparel logo embroidery at the back. Cut to a loose and comfortable fit, perfect for any occasion.",
    brand: "Avelero Apparel",
    category: { categoryId: 1, category: "Jackets" },
    size: { sizeId: 1, size: "S" },
    color: { colorId: 1, color: "Black" },
    weight: { value: 850, unit: "grams" },
  },

  environmental: {
    carbonEmissions: { value: 8.2, unit: "kgCO2e" },
    waterUsage: { value: 2155, unit: "liters" },
    ecoClaims: [
      { ecoClaimId: 1, ecoClaim: "No harmful chemicals" },
      { ecoClaimId: 2, ecoClaim: "Made with renewable energy" },
      { ecoClaimId: 3, ecoClaim: "85% recycled material" },
    ],
  },

  materials: {
    composition: [
      {
        materialId: 1,
        material: "Recycled Polyester",
        percentage: 85,
        countryOfOrigin: "CN",
        recyclable: true,
        certification: {
          type: "GLOBAL RECYCLED STANDARD",
          code: "GRS-2024-12345",
        },
      },
      {
        materialId: 2,
        material: "Virgin Wool",
        percentage: 15,
        countryOfOrigin: "NZ",
        recyclable: false,
        certification: {
          type: "RESPONSIBLE WOOL STANDARD (RWS)",
          code: "RWS-2024-67890",
        },
      },
    ],
  },

  manufacturing: {
    manufacturer: {
      manufacturerId: 1,
      name: "Avelero Apparel",
      legalName: "Avelero Apparel International B.V.",
      countryCode: "PT",
    },
    supplyChain: [
      {
        processStep: "RAW MATERIAL",
        operator: {
          operatorId: 1,
          legalName: "Sinopec Group",
          city: "Beijing",
          countryCode: "CN",
        },
      },
      {
        processStep: "RAW MATERIAL",
        operator: {
          operatorId: 2,
          legalName: "Indorama Ventures",
          city: "Bangkok",
          countryCode: "TH",
        },
      },
      {
        processStep: "WEAVING",
        operator: {
          operatorId: 3,
          legalName: "Hengli Group",
          city: "Suzhou",
          countryCode: "CN",
        },
      },
      {
        processStep: "ASSEMBLY",
        operator: {
          operatorId: 4,
          legalName: "Hebei Loto Garment Co., Ltd",
          city: "Porto District",
          countryCode: "PT",
        },
      },
      {
        processStep: "WAREHOUSE",
        operator: {
          operatorId: 5,
          legalName: "Avelero Apparel International B.V.",
          city: "Amsterdam",
          countryCode: "NL",
        },
      },
    ],
  },
};

/**
 * Screenshot content (non-compliance data)
 */
export const screenshotContentData: DppContent = {
  similarProducts: [
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937619/ChatGPT_Image_29_apr_2025_16_40_03_trhpro.webp",
      name: "SPECTACULAR ZIPPER JACKET",
      price: 600,
      currency: "€",
      url: "https://avelero.com",
    },
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelTwo_vglkse.webp",
      name: "BOMBER BLACK JACKET",
      price: 550,
      currency: "€",
      url: "https://avelero.com",
    },
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelThree_klgnyi.webp",
      name: "AMAZING ZIPPER JACKET",
      price: 1050,
      currency: "€",
      url: "https://avelero.com",
    },
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelFour_bjqsyy.webp",
      name: "DENIM WONDER JACKET",
      price: 880,
      currency: "€",
      url: "https://avelero.com",
    },
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelFive_l0dh6e.webp",
      name: "HOODED COLORED JACKET",
      price: 1250,
      currency: "€",
      url: "https://avelero.com",
    },
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelSix_btqjzc.webp",
      name: "WASHED DENIM JACKET",
      price: 490,
      currency: "€",
      url: "https://avelero.com",
    },
  ],
};
