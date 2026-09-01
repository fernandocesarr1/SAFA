import type { Metadata } from "next";
import "./globals.css";

export function generateMetadata(): Metadata {
  const origin = process.env.SITE_ORIGIN;
  const socialImage = origin ? new URL("/og.png", origin).toString() : undefined;

  return {
    title: {
      default: "SAFA — Sistema de Análise de FIIs e Ações",
      template: "%s | SAFA",
    },
    description: "Análise Deep Max, renda sustentável, valuation, risco e comparação de FIIs.",
    other: {
      "codex-preview": "development",
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "SAFA",
      description: "Análise profunda. Decisões comparáveis.",
      type: "website",
      locale: "pt_BR",
      images: socialImage ? [{ url: socialImage, width: 1672, height: 941, alt: "SAFA — Análise profunda. Decisões comparáveis." }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: "SAFA",
      description: "Análise profunda. Decisões comparáveis.",
      images: socialImage ? [socialImage] : [],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-teal-300/25 selection:text-white">{children}</body>
    </html>
  );
}
