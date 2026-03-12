/**
 * Demo product data for Avelero Apparel.
 *
 * Used by both the public passport.avelero.com demo page and the theme
 * editor preview. Lives here so the data is defined once.
 */

import type { DppData } from "../../types/data";

export const DEMO_DATA: DppData = {
  productIdentifiers: {
    productId: 1,
    productName: "Sustainable Wool-Blend Jacket",
    productImage:
      "https://storage.avelero.com/storage/v1/object/public/products/system/model-demo.webp",
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
        countryOfOrigin: "CN",
        recyclable: true,
        certification: {
          type: "Global Recycled Standard",
          code: "GRS-2024-12345",
          issueDate: "2024-02-15",
          expiryDate: "2027-02-15",
          documentUrl:
            "https://storage.avelero.com/storage/v1/object/public/certifications/demo/grs-2024-12345.pdf",
          testingInstitute: {
            legalName: "Textile Certification Council",
            email: "compliance@textilecouncil.example",
            website: "https://certifications.example.com/grs",
            addressLine1: "12 Observatory Lane",
            addressLine2: "Suite 400",
            city: "Amsterdam",
            state: "Noord-Holland",
            postalCode: "1017 AB",
            country: "NL",
          },
        },
      },
      {
        materialId: 2,
        material: "Virgin Wool",
        percentage: 15,
        countryOfOrigin: "NZ",
        recyclable: false,
        certification: {
          type: "Responsible Wool Standard (RWS)",
          code: "RWS-2024-67890",
          issueDate: "2024-01-10",
          expiryDate: "2027-01-10",
          documentUrl:
            "https://storage.avelero.com/storage/v1/object/public/certifications/demo/rws-2024-67890.pdf",
          testingInstitute: {
            legalName: "New Zealand Fibre Verification Board",
            email: "standards@nzfvb.example",
            website: "https://certifications.example.com/rws",
            addressLine1: "88 Harbour Street",
            addressLine2: "Level 5",
            city: "Wellington",
            state: "Wellington",
            postalCode: "6011",
            country: "NZ",
          },
        },
      },
    ],
  },

  manufacturing: {
    manufacturer: {
      manufacturerId: 1,
      name: "Avelero Apparel",
      legalName: "Avelero Apparel International B.V.",
      email: "hello@avelero.example",
      phone: "+31 20 123 4567",
      website: "https://avelero.example",
      addressLine1: "Strawinskylaan 3051",
      addressLine2: "Level 3",
      city: "Amsterdam",
      state: "Noord-Holland",
      zip: "1077 ZX",
      countryCode: "NL",
    },
    supplyChain: [
      {
        processStep: "RAW MATERIAL",
        operator: {
          operatorId: 1,
          name: "Sinopec Materials",
          legalName: "Sinopec Group Co., Ltd.",
          email: "rawmaterials@sinopec.example",
          phone: "+86 10 5996 0028",
          website: "https://sinopec.example",
          addressLine1: "22 Chaoyangmen North Street",
          addressLine2: "Tower A",
          city: "Beijing",
          state: "Beijing",
          zip: "100728",
          countryCode: "CN",
        },
      },
      {
        processStep: "RAW MATERIAL",
        operator: {
          operatorId: 2,
          name: "Indorama Polymer Supply",
          legalName: "Indorama Ventures Public Company Limited",
          email: "sourcing@indorama.example",
          phone: "+66 2 661 6661",
          website: "https://indorama.example",
          addressLine1: "75/102 Ocean Tower 2",
          addressLine2: "Asoke Road",
          city: "Bangkok",
          state: "Bangkok",
          zip: "10110",
          countryCode: "TH",
        },
      },
      {
        processStep: "WEAVING",
        operator: {
          operatorId: 3,
          name: "Hengli Weaving Division",
          legalName: "Hengli Group Co., Ltd.",
          email: "manufacturing@hengli.example",
          phone: "+86 512 6383 8888",
          website: "https://hengli.example",
          addressLine1: "88 Silk Avenue",
          addressLine2: "Wujiang District",
          city: "Suzhou",
          state: "Jiangsu",
          zip: "215200",
          countryCode: "CN",
        },
      },
      {
        processStep: "ASSEMBLY",
        operator: {
          operatorId: 4,
          name: "Loto Porto Atelier",
          legalName: "Hebei Loto Garment Co., Ltd",
          email: "assembly@loto.example",
          phone: "+351 22 456 7800",
          website: "https://loto.example",
          addressLine1: "Rua das Industrias 144",
          addressLine2: "Maia",
          city: "Porto",
          state: "Porto District",
          zip: "4470-174",
          countryCode: "PT",
        },
      },
      {
        processStep: "WAREHOUSE",
        operator: {
          operatorId: 5,
          name: "Avelero Distribution",
          legalName: "Avelero Apparel International B.V.",
          email: "logistics@avelero.example",
          phone: "+31 20 555 0199",
          website: "https://avelero.example/logistics",
          addressLine1: "Atlasstraat 14",
          addressLine2: "Warehouse 2",
          city: "Amsterdam",
          state: "Noord-Holland",
          zip: "1033 AZ",
          countryCode: "NL",
        },
      },
    ],
  },
};
