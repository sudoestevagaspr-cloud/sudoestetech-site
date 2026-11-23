import type { MetadataRoute } from "next";
import { urlDoSite } from "@/lib/config";

// Fora do domínio principal, as páginas levam "noindex" (veja app/layout.tsx).
// Aqui todo robô pode ler o site, inclusive os que montam a prévia do WhatsApp.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${urlDoSite()}/sitemap.xml`,
  };
}
