import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stawy OS — operacje, rezerwacje i wzrost",
  description: "System operacyjny Stawów u Sikory: rezerwacje, kalendarz, sprzątanie, finanse i marketing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
