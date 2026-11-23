import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Contador } from "@/components/Contador";
import { Rodape } from "@/components/Rodape";
import { Topo } from "@/components/Topo";
import { DESCRICAO_PADRAO, SITE, TITULO_PADRAO, ehProducao, urlDoSite } from "@/lib/config";
import "./globals.css";

// Montserrat guardada no próprio site, como no site antigo (sem Google Fonts).
const montserrat = localFont({
  src: "./fontes/montserrat.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  metadataBase: new URL(urlDoSite()),
  title: { default: TITULO_PADRAO, template: `%s | ${SITE.nome}` },
  description: DESCRICAO_PADRAO,
  applicationName: SITE.nome,
  referrer: "strict-origin-when-cross-origin",
  robots: ehProducao() ? undefined : { index: false, follow: true },
  icons: {
    icon: [
      { url: "/img/logo.svg", type: "image/svg+xml" },
      { url: "/img/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/img/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE.nome,
    title: TITULO_PADRAO,
    description: DESCRICAO_PADRAO,
    url: "/",
    images: [
      {
        url: "/img/previa.png",
        width: 1200,
        height: 630,
        alt: "Sudoeste Tech: vagas de TI no Sudoeste do Paraná",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0B1F3A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <a
          href="#conteudo"
          className="sr-only rounded-lg bg-amarelo px-4 py-2 font-bold text-fundo focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10"
        >
          Pular para o conteúdo
        </a>
        <Topo />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <Rodape />
        <Contador />
      </body>
    </html>
  );
}
