// Global type declarations for static assets
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.webp" {
  const content: string;
  export default content;
}

declare module "*.gif" {
  const content: string;
  export default content;
}

declare module "*.avif" {
  const content: string;
  export default content;
}

declare module "*.ico" {
  const content: string;
  export default content;
}

// For imports from public directory with public/ prefix
declare module "public/*.svg" {
  const content: string;
  export default content;
}

declare module "public/*.png" {
  const content: string;
  export default content;
}

declare module "public/*.webp" {
  const content: string;
  export default content;
}

declare module "public/marketing/*.webp" {
  const content: string;
  export default content;
}
