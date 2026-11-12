import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BouwFlow — Projecten in vertrouwen.",
    short_name: "BouwFlow",
    description: "Platform voor bouw- en installatiebedrijven in Suriname.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#102d50",
    lang: "nl",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
