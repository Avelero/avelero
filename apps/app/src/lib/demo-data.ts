import type { DppData } from "@v1/dpp-components";

/**
 * Demo DPP data for the theme editor preview.
 * Used when the brand doesn't have products yet, or as a fallback preview.
 */
export const DEMO_DPP_DATA: DppData = {
  title: "Sustainable Wool-Blend Jacket",
  brandName: "Avelero Apparel",
  productImage:
    "https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937619/ChatGPT_Image_29_apr_2025_16_40_03_trhpro.webp",
  description:
    "Jacket crafted with a blend of virgin wool and recycled polyester. Detailed with an Avelero Apparel logo embroidery at the back. Cut to a loose and comfortable fit, perfect for any occasion.",
  size: "S",
  color: "Black",
  category: "Jackets",
  articleNumber: "8819438821",
  manufacturer: "Avelero Apparel",
  countryOfOrigin: "Portugal",

  materials: [
    {
      percentage: 85,
      type: "Recycled Polyester",
      origin: "Multiple origins",
      certification: "Global Recycled Standard",
      certificationUrl: "https://avelero.com",
    },
    {
      percentage: 15,
      type: "Virgin Wool",
      origin: "Multiple origins",
      certification: "Responsible Wool Standard (RWS)",
      certificationUrl: "https://avelero.com",
    },
  ],

  journey: [
    {
      name: "RAW MATERIAL",
      companies: [
        { name: "Sinopec Group", location: "Beijing, China" },
        { name: "Indorama Ventures", location: "Bangkok, Thailand" },
      ],
    },
    {
      name: "WEAVING",
      companies: [{ name: "Hengli Group", location: "Suzhou, China" }],
    },
    {
      name: "ASSEMBLY",
      companies: [
        {
          name: "Hebei Loto Garment Co., Ltd",
          location: "Porto District, Portugal",
        },
      ],
    },
    {
      name: "WAREHOUSE",
      companies: [
        {
          name: "Avelero Apparel International B.V.",
          location: "Amsterdam, The Netherlands",
        },
      ],
    },
  ],

  impactMetrics: [
    {
      type: "Carbon Footprint",
      value: "8.2",
      unit: "kgCO2e",
      icon: "leaf",
    },
    {
      type: "Water Usage",
      value: "2,155",
      unit: "liters",
      icon: "drop",
    },
  ],

  impactClaims: [
    "No harmful chemicals",
    "Made with renewable energy",
    "85% recycled material",
  ],

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

