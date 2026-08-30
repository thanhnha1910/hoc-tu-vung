import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Học Từ Vựng",
    short_name: "Học Từ",
    description: "Học và ôn từ vựng đúng lúc với flashcard và FSRS.",
    start_url: "/decks",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#6558d3",
    orientation: "portrait-primary",
    lang: "vi",
    icons: [
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
