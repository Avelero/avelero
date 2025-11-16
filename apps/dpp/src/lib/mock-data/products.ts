import type { DppData } from '@/types/dpp-data';

/**
 * Mock product data for development
 * This will be replaced with real API data in the future
 */
export const mockProducts: Record<string, DppData> = {
  'ABC123': {
    title: 'Classic Wool Jacket',
    brandName: 'Acme Studios',
    productImage: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937619/ChatGPT_Image_29_apr_2025_16_40_03_trhpro.webp',
    description: 'A timeless wool jacket crafted with sustainable materials and ethical manufacturing practices. This piece combines traditional craftsmanship with modern sustainability standards, ensuring both quality and environmental responsibility. Perfect for those who value style without compromise.',
    size: 'M',
    color: 'Navy Blue',
    category: 'Outerwear',
    articleNumber: 'ACM-WJ-001',
    manufacturer: 'Sustainable Textiles Co.',
    countryOfOrigin: 'Italy',
    materials: [
      {
        percentage: 80,
        type: 'Merino Wool',
        origin: 'New Zealand',
        certification: 'ZQ Merino',
        certificationUrl: '#',
      },
      {
        percentage: 20,
        type: 'Recycled Polyester',
        origin: 'Spain',
        certification: 'GRS Certified',
        certificationUrl: '#',
      },
    ],
    journey: [
      {
        name: 'Fiber Production',
        companies: [
          { name: 'NZ Wool Co.', location: 'Wellington, New Zealand' },
        ],
      },
      {
        name: 'Spinning & Dyeing',
        companies: [
          { name: 'Textile Mills Ltd.', location: 'Prato, Italy' },
        ],
      },
      {
        name: 'Manufacturing',
        companies: [
          { name: 'Sustainable Textiles Co.', location: 'Milan, Italy' },
        ],
      },
    ],
    impactMetrics: [
      {
        type: 'Carbon Footprint',
        value: '12.5',
        unit: 'kg CO2',
        icon: 'leaf',
      },
      {
        type: 'Water Usage',
        value: '2,100',
        unit: 'liters',
        icon: 'drop',
      },
    ],
    impactClaims: [
      'Carbon Neutral',
      'Ethically Sourced',
      'Biodegradable',
      'Fair Trade',
    ],
    similarProducts: [
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelTwo_vglkse.webp',
        name: 'Wonderful Jacket Black',
        price: 240.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelThree_klgnyi.webp',
        name: 'Rocking Jacket Green',
        price: 180.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelFour_bjqsyy.webp',
        name: 'Rocking Jacket Black',
        price: 209.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelFive_l0dh6e.webp',
        name: 'Wonderful Jacket Black',
        price: 240.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelSix_btqjzc.webp',
        name: 'Rocking Jacket Green',
        price: 180.00,
        currency: '€',
        url: '#',
      },
    ],
  },
  'DEF456': {
    title: 'Organic Cotton T-Shirt',
    brandName: 'Acme Studios',
    productImage: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelOne_rdcgve.webp',
    description: 'A premium organic cotton t-shirt that sets the standard for sustainable basics. Made from 100% GOTS certified organic cotton and manufactured in facilities powered by renewable energy. Soft, durable, and kind to the planet.',
    size: 'L',
    color: 'White',
    category: 'Tops',
    articleNumber: 'ACM-TS-002',
    manufacturer: 'EcoTextile Factory',
    countryOfOrigin: 'Portugal',
    materials: [
      {
        percentage: 100,
        type: 'Organic Cotton',
        origin: 'Turkey',
        certification: 'GOTS Certified',
        certificationUrl: '#',
      },
    ],
    journey: [
      {
        name: 'Cotton Farming',
        companies: [
          { name: 'Organic Farms Co.', location: 'Izmir, Turkey' },
        ],
      },
      {
        name: 'Spinning & Weaving',
        companies: [
          { name: 'Cotton Mills Ltd.', location: 'Istanbul, Turkey' },
        ],
      },
      {
        name: 'Garment Production',
        companies: [
          { name: 'EcoTextile Factory', location: 'Porto, Portugal' },
        ],
      },
    ],
    impactMetrics: [
      {
        type: 'Carbon Footprint',
        value: '3.2',
        unit: 'kg CO2',
        icon: 'leaf',
      },
      {
        type: 'Water Usage',
        value: '890',
        unit: 'liters',
        icon: 'drop',
      },
      {
        type: 'Recyclability',
        value: '95',
        unit: '%',
        icon: 'recycle',
      },
    ],
    impactClaims: [
      'GOTS Certified',
      'Renewable Energy',
      'Zero Waste',
      'Plastic Free Packaging',
    ],
    similarProducts: [
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelFour_bjqsyy.webp',
        name: 'Wonderful Jacket Black',
        price: 240.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelFive_l0dh6e.webp',
        name: 'Rocking Jacket Green',
        price: 180.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelSix_btqjzc.webp',
        name: 'Rocking Jacket Black',
        price: 209.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937619/ChatGPT_Image_29_apr_2025_16_40_03_trhpro.webp',
        name: 'Wonderful Jacket Black',
        price: 240.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelTwo_vglkse.webp',
        name: 'Rocking Jacket Green',
        price: 180.00,
        currency: '€',
        url: '#',
      },
    ],
  },
  'GHI789': {
    title: 'Sustainable Denim Jeans',
    brandName: 'Acme Studios',
    productImage: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelTwo_vglkse.webp',
    description: 'Premium denim crafted with water-saving techniques and organic materials.',
    size: 'XL',
    color: 'Indigo',
    category: 'Bottoms',
    articleNumber: 'ACM-DN-003',
    manufacturer: 'Eco Denim Works',
    countryOfOrigin: 'Japan',
    materials: [
      {
        percentage: 85,
        type: 'Organic Cotton Denim',
        origin: 'Japan',
        certification: 'GOTS Certified',
        certificationUrl: '#',
      },
      {
        percentage: 15,
        type: 'Recycled Cotton',
        origin: 'Japan',
        certification: 'GRS Certified',
        certificationUrl: '#',
      },
    ],
    journey: [
      {
        name: 'Cotton Farming',
        companies: [
          { name: 'Organic Fields Ltd.', location: 'Hiroshima, Japan' },
        ],
      },
      {
        name: 'Denim Weaving',
        companies: [
          { name: 'Traditional Mills Co.', location: 'Okayama, Japan' },
        ],
      },
    ],
    impactMetrics: [
      {
        type: 'Water Saved',
        value: '1,800',
        unit: 'liters',
        icon: 'drop',
      },
    ],
    impactClaims: [
      'Water Saving Process',
      'Organic Certified',
    ],
    similarProducts: [
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelThree_klgnyi.webp',
        name: 'Slim Fit Jeans',
        price: 165.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelFour_bjqsyy.webp',
        name: 'Classic Denim',
        price: 155.00,
        currency: '€',
        url: '#',
      },
    ],
  },
  'MRM001': {
    title: 'The Fine Cords: Baristas',
    brandName: 'Mr. Marvis',
    productImage: 'https://cdn.mrmarvis.com/images/yb9xf4jc/production/7a1e4f348f55cbaa51647f3330679d10ad12a4d0-2000x3000.jpg?w=1000&h=1500&q=80&fit=min&auto=format',
    description: 'Ontdek The Fine Cords Baristas: MR MARVIS’ five-pocket design in fijn donkerbeige corduroy, gemaakt van biologisch katoen met een vleugje stretch. Deze broek combineert de rijke look van corduroy met de fit van je favoriete jeans.',
    size: '32 / 34',
    color: 'Dark Beige',
    category: 'Trousers',
    articleNumber: 'MRM-FC-001',
    manufacturer: 'MR MARVIS Netherlands B.V.',
    countryOfOrigin: 'Portugal',
    materials: [
      {
        percentage: 97,
        type: 'Organic Cotton',
        origin: 'Portugal',
        certification: 'Global Organic Textile Standard (GOTS)',
        certificationUrl: 'https://www.global-standard.org',
      },
      {
        percentage: 3,
        type: 'Elastane',
        origin: 'Germany',
      },
    ],
    journey: [
      {
        name: 'Bamboo Harvesting',
        companies: [
          { name: 'Sustainable Bamboo Farms', location: 'Kerala, India' },
        ],
      },
      {
        name: 'Silk Processing',
        companies: [
          { name: 'Heritage Silk Mills', location: 'Bangalore, India' },
        ],
      },
      {
        name: 'Garment Manufacturing',
        companies: [
          { name: 'Artisan Textiles Studio', location: 'Mumbai, India' },
        ],
      },
    ],
    impactMetrics: [
      {
        type: 'Carbon Footprint',
        value: '15.65',
        unit: 'kgCO2e',
        icon: 'leaf',
      },
      {
        type: 'Water Scarcity Impact',
        value: '6,746',
        unit: 'liters',
        icon: 'drop',
      },
    ],
    impactClaims: [
      'Made in Portugal',
      'Organic Cotton',
      'Greening Project in Tanzania',
    ],
    similarProducts: [
      {
        image: 'https://cdn.mrmarvis.com/images/yb9xf4jc/production/3ceb8d245dcea9c09ff68b7198e49edca79bfdfa-2000x3000.jpg?w=1000&h=1500&q=80&fit=min&auto=format',
        name: 'The Fine Cords: Cosmics',
        price: 139.00,
        currency: '€',
        url: 'https://www.mrmarvis.com/nl/products/cosmics-the-fine-cords',
      },
      {
        image: 'https://cdn.mrmarvis.com/images/yb9xf4jc/production/f3eafa6adfd14feed4e80d81e5cd575c990d97fa-2000x3000.jpg?w=1000&h=1500&q=80&fit=min&auto=format',
        name: 'The Fine Cords: Newmans',
        price: 139.00,
        currency: '€',
        url: 'https://www.mrmarvis.com/nl/products/newmans-the-fine-cords',
      },
      {
        image: 'https://cdn.mrmarvis.com/images/yb9xf4jc/production/adc7274e1a6bf55c65189ad67c6ea8c30ab53b35-2000x3000.jpg?w=1000&h=1500&q=80&fit=min&auto=format',
        name: 'The Fine Cords: Reserves',
        price: 139.00,
        currency: '€',
        url: 'https://www.mrmarvis.com/nl/products/reserves-the-fine-cords',
      },
      {
        image: 'https://cdn.mrmarvis.com/images/yb9xf4jc/production/300f37fb4813e7594a7acd752341ec6795d092d8-2000x3000.jpg?w=1000&h=1500&q=80&fit=min&auto=format',
        name: 'The Fine Cords: Baristas',
        price: 139.00,
        currency: '€',
        url: 'https://www.mrmarvis.com/nl/products/baristas-the-cords',
      },
      {
        image: 'https://cdn.mrmarvis.com/images/yb9xf4jc/production/42caa90973059ccb0c2aceafb5c6485a00183e68-2000x3000.jpg?w=1000&h=1500&q=80&fit=min&auto=format',
        name: 'The Cords: Jones',
        price: 129.00,
        currency: '€',
        url: 'https://www.mrmarvis.com/nl/products/jones-the-cords',
      },
      {
        image: 'https://cdn.mrmarvis.com/images/yb9xf4jc/production/82679f7e664487026dd374c8aa1a046ddc671d38-2000x3000.jpg?w=1000&h=1500&q=80&fit=min&auto=format',
        name: 'The Cords: Gazettes',
        price: 129.00,
        currency: '€',
        url: 'https://www.mrmarvis.com/nl/products/gazettes-the-cords',
      },
    ],
  },
  'MRM002': {
    title: 'Recycled Cashmere Sweater',
    brandName: 'Mr. Marvis',
    productImage: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelFour_bjqsyy.webp',
    description: 'Luxuriously soft cashmere sweater made entirely from recycled materials. By choosing recycled cashmere, we save precious resources while maintaining the highest quality standards.',
    size: 'M',
    color: 'Charcoal Gray',
    category: 'Knitwear',
    articleNumber: 'VRD-CS-002',
    manufacturer: 'Northern Knit Works',
    countryOfOrigin: 'Scotland',
    materials: [
      {
        percentage: 100,
        type: 'Recycled Cashmere',
        origin: 'Scotland',
        certification: 'RWS Certified',
        certificationUrl: '#',
      },
    ],
    journey: [
      {
        name: 'Material Collection',
        companies: [
          { name: 'Reclaim Textiles Ltd.', location: 'Edinburgh, Scotland' },
        ],
      },
      {
        name: 'Reprocessing',
        companies: [
          { name: 'Heritage Mills', location: 'Highlands, Scotland' },
        ],
      },
      {
        name: 'Knitting & Finishing',
        companies: [
          { name: 'Northern Knit Works', location: 'Aberdeen, Scotland' },
        ],
      },
    ],
    impactMetrics: [
      {
        type: 'Carbon Saved',
        value: '15.2',
        unit: 'kg CO2',
        icon: 'leaf',
      },
      {
        type: 'Water Saved',
        value: '3,400',
        unit: 'liters',
        icon: 'drop',
      },
    ],
    impactClaims: [
      'Circular Economy',
      'Zero Virgin Materials',
      'Carbon Negative',
    ],
    similarProducts: [
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937619/ChatGPT_Image_29_apr_2025_16_40_03_trhpro.webp',
        name: 'Wool Cardigan',
        price: 285.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelOne_rdcgve.webp',
        name: 'Cotton Pullover',
        price: 125.00,
        currency: '€',
        url: '#',
      },
    ],
  },
  'MRM003': {
    title: 'Hemp Canvas Backpack',
    brandName: 'Mr. Marvis',
    productImage: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelFive_l0dh6e.webp',
    description: 'Durable and stylish backpack crafted from organic hemp canvas with recycled leather accents.',
    size: 'One Size',
    color: 'Natural Beige',
    category: 'Accessories',
    articleNumber: 'VRD-BP-003',
    manufacturer: 'Ethical Goods Co.',
    countryOfOrigin: 'Nepal',
    materials: [
      {
        percentage: 85,
        type: 'Organic Hemp Canvas',
        origin: 'Nepal',
        certification: 'Organic Certified',
        certificationUrl: '#',
      },
      {
        percentage: 15,
        type: 'Recycled Leather',
        origin: 'Italy',
        certification: 'LWG Gold',
        certificationUrl: '#',
      },
    ],
    journey: [
      {
        name: 'Hemp Cultivation',
        companies: [
          { name: 'Mountain Hemp Farms', location: 'Kathmandu Valley, Nepal' },
        ],
      },
      {
        name: 'Weaving & Assembly',
        companies: [
          { name: 'Ethical Goods Co.', location: 'Pokhara, Nepal' },
        ],
      },
    ],
    impactMetrics: [
      {
        type: 'Carbon Footprint',
        value: '4.2',
        unit: 'kg CO2',
        icon: 'leaf',
      },
    ],
    impactClaims: [
      'Fair Wages',
      'Organic Materials',
      'Biodegradable',
    ],
    similarProducts: [
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelSix_btqjzc.webp',
        name: 'Tote Bag',
        price: 89.00,
        currency: '€',
        url: '#',
      },
    ],
  },
  'FP001': {
    title: 'Loafer Bonsai Black',
    brandName: 'Filling Pieces',
    productImage: 'https://www.fillingpieces.com/cdn/shop/files/8720133225652-2_96ce2c02-3aa5-44da-9eec-5ee8bc4fcff1.jpg',
    description: 'Embrace nature with the Loafer Bonsai Black, a seasonal version of our iconic Patch-Loafer line. Adorned with a chenille and embroidery patch featuring the Bonsai graphic, it reflects love and care for this special tree. Crafted from luxury polido leather with a cow-leather lining, this loafer offers exceptional quality and comfort for every occasion.',
    size: '43',
    color: 'Black',
    category: 'Loafers',
    articleNumber: 'FP-LB-001',
    manufacturer: 'Filling Pieces',
    countryOfOrigin: 'Portugal',
    materials: [
      {
        percentage: 90,
        type: 'Polido Leather',
        origin: 'Portugal',
        certification: 'Leather Working Group (LWG)',
        certificationUrl: 'https://www.leatherworkinggroup.com',
      },
      {
        percentage: 10,
        type: 'Organic Cotton',
        origin: 'Portugal',
        certification: 'Global Organic Textile Standard (GOTS)',
        certificationUrl: 'https://www.global-standard.org',
      },
    ],
    journey: [
      {
        name: 'Weaving',
        companies: [
          { name: 'Artisan Weavers', location: 'Porto, Portugal' },
        ],
      },
      {
        name: 'Manufacturing',
        companies: [
          { name: 'Magical Factory Inc.', location: 'Porto, Portugal' },
        ],
      },
      {
        name: 'Packaging',
        companies: [
          { name: 'Innovative Packaging Lab', location: 'Amsterdam, Netherlands' },
        ],
      },
    ],
    impactMetrics: [
      {
        type: 'Carbon Footprint',
        value: '13.6',
        unit: 'kg CO2e',
        icon: 'leaf',
      },
      {
        type: 'Water Usage',
        value: '650',
        unit: 'liters',
        icon: 'drop',
      },
    ],
    impactClaims: [
      'Made in Portugal',
      'Leather and rubber sole for durability',
      'Luxury polido leather construction',
    ],
    similarProducts: [
      {
        image: 'https://www.fillingpieces.com/cdn/shop/files/8720133500117-2.jpg?v=1756217452&width=2120',
        name: 'Loafer Speaker Wall Black',
        price: 350.00,
        currency: '€',
        url: 'https://www.fillingpieces.com/products/loafer-speaker-wall-black',
      },
      {
        image: 'https://www.fillingpieces.com/cdn/shop/files/8720133499725-1_1.jpg?v=1758276875&width=2120',
        name: 'Derby Football Black',
        price: 320.00,
        currency: '€',
        url: 'https://www.fillingpieces.com/products/derby-football-black',
      },
      {
        image: 'https://www.fillingpieces.com/cdn/shop/files/8720133591917.jpg?v=1757320785&width=2120',
        name: 'Prism Peak Grey',
        price: 250.00,
        currency: '€',
        url: 'https://www.fillingpieces.com/products/prism-peak-grey',
      },
      {
        image: 'https://www.fillingpieces.com/cdn/shop/files/8720133499626-2_2f01ae5c-eda3-4b8d-ade5-dd61d73eba4b.jpg?v=1756226633&width=2120',
        name: 'Loafer Vinyl Black',
        price: 350.00,
        currency: '€',
        url: 'https://www.fillingpieces.com/nl/products/loafer-vinyl-black',
      },
      {
        image: 'https://www.fillingpieces.com/cdn/shop/files/8720133503149.jpg?v=1757320675&width=2120',
        name: 'Prism Peak Green',
        price: 250.00,
        currency: '€',
        url: 'https://www.fillingpieces.com/nl/products/prism-peak-green',
      },
      {
        image: 'https://www.fillingpieces.com/cdn/shop/files/74927892057-1.jpg?v=1749652657&width=2120',
        name: 'Derby Gradient Cognac',
        price: 280.00,
        currency: '€',
        url: 'https://www.fillingpieces.com/nl/products/derby-gradient-cognac',
      },
    ],
  },
  'FP002': {
    title: 'Merino Wool Blazer',
    brandName: 'Filling Pieces',
    productImage: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937619/ChatGPT_Image_29_apr_2025_16_40_03_trhpro.webp',
    description: 'A sophisticated blazer tailored from premium merino wool with sustainable practices throughout the entire production chain.',
    size: 'L',
    color: 'Deep Burgundy',
    category: 'Outerwear',
    articleNumber: 'LXR-BZ-002',
    manufacturer: 'Luxury Tailors Co.',
    countryOfOrigin: 'Australia',
    materials: [
      {
        percentage: 95,
        type: 'Merino Wool',
        origin: 'Australia',
        certification: 'ZQ Merino',
        certificationUrl: '#',
      },
      {
        percentage: 5,
        type: 'Recycled Elastane',
        origin: 'Germany',
      },
    ],
    journey: [
      {
        name: 'Wool Production',
        companies: [
          { name: 'Southern Wool Co.', location: 'Tasmania, Australia' },
        ],
      },
    ],
    impactMetrics: [
      {
        type: 'Carbon Footprint',
        value: '18.5',
        unit: 'kg CO2',
        icon: 'leaf',
      },
    ],
    impactClaims: [
      'Premium Merino',
      'Ethically Sourced',
    ],
    similarProducts: [
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelFour_bjqsyy.webp',
        name: 'Tweed Jacket',
        price: 395.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelFive_l0dh6e.webp',
        name: 'Wool Coat',
        price: 450.00,
        currency: '€',
        url: '#',
      },
    ],
  },
  'FP003': {
    title: 'Tencel Midi Skirt',
    brandName: 'Filling Pieces',
    productImage: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelOne_rdcgve.webp',
    description: 'Elegant midi skirt made from sustainably sourced Tencel lyocell fibers.',
    size: 'S',
    color: 'Champagne',
    category: 'Skirts',
    articleNumber: 'LXR-SK-003',
    manufacturer: 'European Fashion House',
    countryOfOrigin: 'Austria',
    materials: [
      {
        percentage: 100,
        type: 'Tencel Lyocell',
        origin: 'Austria',
        certification: 'FSC Certified',
        certificationUrl: '#',
      },
    ],
    journey: [
      {
        name: 'Fiber Production',
        companies: [
          { name: 'European Fashion House', location: 'Vienna, Austria' },
        ],
      },
    ],
    impactMetrics: [
      {
        type: 'Water Usage',
        value: '420',
        unit: 'liters',
        icon: 'drop',
      },
      {
        type: 'Biodegradability',
        value: '100',
        unit: '%',
        icon: 'leaf',
      },
    ],
    impactClaims: [
      'FSC Certified',
      'Closed Loop Production',
    ],
    similarProducts: [
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937033/AIModelSix_btqjzc.webp',
        name: 'Pleated Skirt',
        price: 135.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelTwo_vglkse.webp',
        name: 'Wrap Skirt',
        price: 98.00,
        currency: '€',
        url: '#',
      },
      {
        image: 'https://res.cloudinary.com/dcdam15xy/image/upload/f_auto,q_auto/v1745937032/AIModelThree_klgnyi.webp',
        name: 'A-Line Skirt',
        price: 115.00,
        currency: '€',
        url: '#',
      },
    ],
  },
};


