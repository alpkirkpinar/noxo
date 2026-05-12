import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "noxo Service Management",
    short_name: "noxo",
    description: "noxo servis, teklif, müşteri ve saha operasyon yönetimi",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef3f8",
    theme_color: "#0f172a",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/noxo-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/noxo-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
