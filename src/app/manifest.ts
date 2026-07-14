import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stawy OS — Stawy u Sikory",
    short_name: "Stawy OS",
    description: "Rezerwacje, kalendarz, sprzątanie i finanse Stawów u Sikory.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f1e7",
    theme_color: "#174d3b",
    lang: "pl",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
