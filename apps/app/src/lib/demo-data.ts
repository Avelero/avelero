import type { DppContent, DppData } from "@v1/dpp-components";

/**
 * Demo DPP data for the theme editor preview.
 * Used when the brand doesn't have products yet, or as a fallback preview.
 */
export const DEMO_DPP_DATA: DppData = {
  productIdentifiers: {
    productId: 1,
    productName: "Sustainable Wool-Blend Jacket",
    productImage:
      "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937619/ChatGPT_Image_29_apr_2025_16_40_03_trhpro.webp",
    articleNumber: "8819438821",
  },

  productAttributes: {
    description:
      "Jacket crafted with a blend of virgin wool and recycled polyester. Detailed with an Avelero Apparel logo embroidery at the back. Cut to a loose and comfortable fit, perfect for any occasion.",
    brand: "Avelero Apparel",
    category: { categoryId: 1, category: "Jackets" },
    attributes: [
      { name: "Size", value: "S" },
      { name: "Color", value: "Black" },
    ],
    weight: { value: 850, unit: "grams" },
  },

  environmental: {
    carbonEmissions: { value: 8.2, unit: "kgCO2e" },
    waterUsage: { value: 2155, unit: "liters" },
  },

  materials: {
    composition: [
      {
        materialId: 1,
        material: "Recycled Polyester",
        percentage: 85,
        countryOfOrigin: "Multiple origins",
        recyclable: true,
        certification: {
          type: "Global Recycled Standard",
          code: "GRS-2024-12345",
        },
      },
      {
        materialId: 2,
        material: "Virgin Wool",
        percentage: 15,
        countryOfOrigin: "Multiple origins",
        recyclable: false,
        certification: {
          type: "Responsible Wool Standard (RWS)",
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
 * Demo content (non-compliance data) for the theme editor preview.
 */
const DEMO_DPP_CONTENT: DppContent = {
  similarProducts: [
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937619/ChatGPT_Image_29_apr_2025_16_40_03_trhpro.webp",
      name: "Spectacular Zipper Jacket",
      price: 600,
      currency: "€",
      url: "https://avelero.com",
    },
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelTwo_vglkse.webp",
      name: "Bomber Black Jacket",
      price: 550,
      currency: "€",
      url: "https://avelero.com",
    },
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelThree_klgnyi.webp",
      name: "Amazing Zipper Jacket",
      price: 1050,
      currency: "€",
      url: "https://avelero.com",
    },
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelFour_bjqsyy.webp",
      name: "Denim Wonder Jacket",
      price: 880,
      currency: "€",
      url: "https://avelero.com",
    },
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelFive_l0dh6e.webp",
      name: "Hooded Colored Jacket",
      price: 1250,
      currency: "€",
      url: "https://avelero.com",
    },
    {
      image:
        "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelSix_btqjzc.webp",
      name: "Washed Denim Jacket",
      price: 490,
      currency: "€",
      url: "https://avelero.com",
    },
  ],
};
