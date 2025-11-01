/**
 * Mock brand data for development
 * Maps brand slugs to brand names
 */
export const mockBrands: Record<string, { name: string; vanityUrl: string }> = {
  'acme': {
    name: 'Acme Studios',
    vanityUrl: 'acme',
  },
  'verde': {
    name: 'Verde Collective',
    vanityUrl: 'verde',
  },
  'luxora': {
    name: 'Luxora Fashion',
    vanityUrl: 'luxora',
  },
};
