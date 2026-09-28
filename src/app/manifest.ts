import type { MetadataRoute } from "next";
import { strings } from "@/frame/strings";

// Lets players add Plimp to their home screen. No service worker yet.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: strings.site.name,
    short_name: strings.site.name,
    description: strings.site.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
