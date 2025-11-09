import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Avelero - Product passports that engage",
    short_name: "Avelero",
    description: "Launch EU-compliant product passports in days, not months. Built for fashion brands.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAFF",
    theme_color: "#FAFAFF",
    icons: [
      {
        src: "/favicon/FaviconDark16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/favicon/FaviconDark32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/favicon/AppleTouchIconDark.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

