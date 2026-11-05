import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Semáforo da Cidadania",
  description:
    "Sorteie uma afirmação, escolha uma cor do semáforo e revele a resposta.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${fredoka.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
