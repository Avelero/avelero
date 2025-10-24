/*
  Predefined product categories for apparel industry.
  Single source of truth for category hierarchy and options.
*/

export interface CategoryNode {
  label: string;
  children?: Record<string, CategoryNode>;
}

export type CategoryHierarchy = Record<string, CategoryNode>;

export const categoryHierarchy: CategoryHierarchy = {
  mens: {
    label: "Men's",
    children: {
      bottoms: {
        label: "Bottoms",
        children: {
          casual_pants: { label: "Casual Pants" },
          cropped_pants: { label: "Cropped Pants" },
          denim: { label: "Denim" },
          jumpsuits: { label: "Jumpsuits" },
          leggings: { label: "Leggings" },
          shorts: { label: "Shorts" },
          sweatpants_joggers: { label: "Sweatpants & Joggers" },
          swimwear: { label: "Swimwear" },
        },
      },
      outerwear: {
        label: "Outerwear",
        children: {
          bombers: { label: "Bombers" },
          cloaks_capes: { label: "Cloaks & Capes" },
          denim_jackets: { label: "Denim Jackets" },
          heavy_coats: { label: "Heavy Coats" },
          leather_jackets: { label: "Leather Jackets" },
          light_jackets: { label: "Light Jackets" },
          parkas: { label: "Parkas" },
          raincoats: { label: "Raincoats" },
          vests: { label: "Vests" },
        },
      },
      tops: {
        label: "Tops",
        children: {
          jerseys: { label: "Jerseys" },
          long_sleeve_shirts: { label: "Long Sleeve Shirts" },
          polos: { label: "Polos" },
          button_ups: { label: "Button-Ups" },
          short_sleeve_shirts: { label: "Short Sleeve Shirts" },
          sweaters_knitwear: { label: "Sweaters & Knitwear" },
          sweatshirts_hoodies: { label: "Sweatshirts & Hoodies" },
          sleeveless: { label: "Sleeveless" },
        },
      },
      footwear: {
        label: "Footwear",
        children: {
          sneakers: { label: "Sneakers" },
          dress_shoes: { label: "Dress Shoes" },
          boots: { label: "Boots" },
          loafers: { label: "Loafers" },
          sandals: { label: "Sandals" },
          athletic_shoes: { label: "Athletic Shoes" },
          casual_shoes: { label: "Casual Shoes" },
        },
      },
    },
  },
  womens: {
    label: "Women's",
    children: {
      bottoms: {
        label: "Bottoms",
        children: {
          jeans: { label: "Jeans" },
          joggers: { label: "Joggers" },
          jumpsuits: { label: "Jumpsuits" },
          leggings: { label: "Leggings" },
          maxi_skirts: { label: "Maxi Skirts" },
          midi_skirts: { label: "Midi Skirts" },
          mini_skirts: { label: "Mini Skirts" },
          pants: { label: "Pants" },
          shorts: { label: "Shorts" },
          sweatpants: { label: "Sweatpants" },
        },
      },
      dresses: {
        label: "Dresses",
        children: {
          gowns: { label: "Gowns" },
          maxi: { label: "Maxi" },
          midi: { label: "Midi" },
          mini: { label: "Mini" },
        },
      },
      outerwear: {
        label: "Outerwear",
        children: {
          blazers: { label: "Blazers" },
          bombers: { label: "Bombers" },
          coats: { label: "Coats" },
          denim_jackets: { label: "Denim Jackets" },
          down_jackets: { label: "Down Jackets" },
          fur_faux_fur: { label: "Fur & Faux Fur" },
          jackets: { label: "Jackets" },
          leather_jackets: { label: "Leather Jackets" },
          rain_jackets: { label: "Rain Jackets" },
          vests: { label: "Vests" },
        },
      },
      tops: {
        label: "Tops",
        children: {
          blouses: { label: "Blouses" },
          bodysuits: { label: "Bodysuits" },
          button_ups: { label: "Button-Ups" },
          crop_tops: { label: "Crop Tops" },
          hoodies: { label: "Hoodies" },
          long_sleeve_shirts: { label: "Long Sleeve Shirts" },
          polos: { label: "Polos" },
          short_sleeve_shirts: { label: "Short Sleeve Shirts" },
          sweaters: { label: "Sweaters" },
          sweatshirts: { label: "Sweatshirts" },
          tank_tops: { label: "Tank Tops" },
        },
      },
      footwear: {
        label: "Footwear",
        children: {
          sneakers: { label: "Sneakers" },
          heels: { label: "Heels" },
          boots: { label: "Boots" },
          flats: { label: "Flats" },
          sandals: { label: "Sandals" },
          athletic_shoes: { label: "Athletic Shoes" },
          casual_shoes: { label: "Casual Shoes" },
        },
      },
    },
  },
} as const;

export type CategoryKey = keyof typeof categoryHierarchy;
