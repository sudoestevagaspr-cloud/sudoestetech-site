import type { MetadataRoute } from "next";
import { urlDoSite } from "@/lib/config";
import { lerVagasNoAr } from "@/lib/dados";

// Mapa do site para o Google: a lista e cada vaga no ar. Fica em cache e é
// descartado junto com as páginas quando o banco avisa uma mudança.
export const revalidate = false;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = urlDoSite();
  const { vagas } = await lerVagasNoAr();
  return [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    ...vagas.map((vaga) => ({
      url: `${site}/vagas/${vaga.slug}`,
      lastModified: vaga.publicadaEm,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
