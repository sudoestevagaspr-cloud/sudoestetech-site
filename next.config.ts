import type { NextConfig } from "next";

// Endereço do Supabase: o navegador precisa poder falar com ele (métricas,
// reports e logos), então ele entra na política de segurança (CSP) abaixo.
const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const siteHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

// Mesmos cabeçalhos de segurança do arquivo _headers do site antigo,
// ajustados para o Next.js e o Supabase.
const politica = [
  "default-src 'self'",
  // 'unsafe-inline': o Next.js coloca pequenos scripts dentro da página com os
  // dados de cada tela. Sem isso a página não funciona.
  "script-src 'self' 'unsafe-inline' https://gc.zgo.at https://static.cloudflareinsights.com",
  `connect-src 'self' ${supabase} https://sudoestetech.goatcounter.com https://cloudflareinsights.com`,
  `img-src 'self' data: ${supabase} https://sudoestetech.goatcounter.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(siteHttps ? ["upgrade-insecure-requests"] : []),
]
  .join("; ")
  .replace(/\s+/g, " ");

const cabecalhos = [
  { key: "Content-Security-Policy", value: politica },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(siteHttps ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // No "npm run dev" a política atrapalharia as ferramentas de desenvolvimento.
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/:caminho*", headers: cabecalhos }];
  },
  async redirects() {
    return [
      // Links antigos já compartilhados (vaga.html?id=...) levam para a lista (decisão 16).
      { source: "/vaga.html", destination: "/", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
