/*
  Predefined certifications database for textile and apparel industry.
  Single source of truth for certification options.
*/

export interface Certification {
  id: string;
  title: string;
  code: string;
  logo?: string;
  website?: string;
  description?: string;
}

export const certifications: Record<string, Certification> = {
  GOTS: {
    id: "gots",
    title: "Global Organic Textile Standard",
    code: "GOTS",
    website: "https://www.global-standard.org",
    description: "Leading textile processing standard for organic fibers",
  },
  RWS: {
    id: "rws",
    title: "Responsible Wool Standard",
    code: "RWS",
    website: "https://textileexchange.org/standards/responsible-wool",
    description: "Animal welfare and land management standard for wool",
  },
  LWG: {
    id: "lwg",
    title: "Leather Working Group",
    code: "LWG",
    website: "https://www.leatherworkinggroup.com",
    description: "Environmental audit protocol for leather manufacturers",
  },
  FAIR_TRADE: {
    id: "fair-trade",
    title: "Fair Trade Certified",
    code: "Fair Trade",
    website: "https://www.fairtradecertified.org",
    description: "Social sustainability and fair labor practices",
  },
  OEKO_TEX: {
    id: "oeko-tex",
    title: "OEKO-TEX Standard 100",
    code: "OEKO-TEX",
    website: "https://www.oeko-tex.com",
    description: "Independent testing for harmful substances in textiles",
  },
  BLUESIGN: {
    id: "bluesign",
    title: "bluesign",
    code: "bluesign",
    website: "https://www.bluesign.com",
    description: "Sustainable textile production system standard",
  },
  CRADLE_TO_CRADLE: {
    id: "cradle-to-cradle",
    title: "Cradle to Cradle Certified",
    code: "C2C",
    website: "https://www.c2ccertified.org",
    description: "Product safety and circularity certification",
  },
  BCI: {
    id: "bci",
    title: "Better Cotton Initiative",
    code: "BCI",
    website: "https://bettercotton.org",
    description: "Sustainable cotton production standard",
  },
  GRS: {
    id: "grs",
    title: "Global Recycled Standard",
    code: "GRS",
    website: "https://textileexchange.org/standards/global-recycled-standard",
    description: "Verification of recycled content in products",
  },
  FSC: {
    id: "fsc",
    title: "Forest Stewardship Council",
    code: "FSC",
    website: "https://fsc.org",
    description: "Responsible forest management certification",
  },
  SA8000: {
    id: "sa8000",
    title: "SA8000 Social Accountability",
    code: "SA8000",
    website: "https://sa-intl.org",
    description: "Social accountability in workplaces",
  },
  ISO14001: {
    id: "iso14001",
    title: "ISO 14001",
    code: "ISO 14001",
    website: "https://www.iso.org",
    description: "Environmental management systems standard",
  },
  REACH: {
    id: "reach",
    title: "REACH Compliance",
    code: "REACH",
    website: "https://echa.europa.eu",
    description: "EU chemical safety regulation compliance",
  },
  PETA: {
    id: "peta",
    title: "PETA-Approved Vegan",
    code: "PETA Vegan",
    website: "https://www.peta.org",
    description: "Vegan and cruelty-free product certification",
  },
  WRAP: {
    id: "wrap",
    title: "Worldwide Responsible Accredited Production",
    code: "WRAP",
    website: "https://wrapcompliance.org",
    description: "Ethical manufacturing certification for apparel",
  },
};

export const allCertifications = Object.values(certifications);

export type CertificationId = keyof typeof certifications;
