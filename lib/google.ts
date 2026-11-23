// Dados estruturados para o Google para Vagas (decisão 23).
// Ficam numa tag <script type="application/ld+json"> invisível na página.
// Referência: https://developers.google.com/search/docs/appearance/structured-data/job-posting

import { SITE } from "./config";
import { itens } from "./texto";
import type { VagaCompleta } from "./vagas";

// Tipo de contrato → tipo de emprego que o Google entende.
const TIPOS_DE_EMPREGO: Record<string, string> = {
  clt: "FULL_TIME",
  pj: "CONTRACTOR",
  "estagio-obrigatorio": "INTERN",
  "estagio-nao-obrigatorio": "INTERN",
  temporario: "TEMPORARY",
};

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function blocoHtml(titulo: string, texto: string | null): string {
  const lista = itens(texto);
  if (lista.length === 0) return "";
  const corpo =
    lista.length === 1
      ? `<p>${escaparHtml(lista[0])}</p>`
      : `<ul>${lista.map((i) => `<li>${escaparHtml(i)}</li>`).join("")}</ul>`;
  return `<p><strong>${escaparHtml(titulo)}</strong></p>${corpo}`;
}

export function vagaParaGoogle(vaga: VagaCompleta, url: string): Record<string, unknown> {
  const dados: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: vaga.cargo,
    description: [
      blocoHtml("O que você vai fazer", vaga.atividades),
      blocoHtml("Requisitos", vaga.requisitos),
      blocoHtml("Benefícios", vaga.beneficios),
      blocoHtml("Como se candidatar", vaga.comoSeCandidatar),
      vaga.observacao ? `<p>${escaparHtml(vaga.observacao)}</p>` : "",
    ].join(""),
    identifier: { "@type": "PropertyValue", name: SITE.nome, value: vaga.id },
    url,
    datePosted: vaga.publicadaEm,
    // A vaga fica no ar até o fim do dia de encerramento, em Brasília.
    validThrough: `${vaga.encerraEm}T23:59:59-03:00`,
    employmentType: TIPOS_DE_EMPREGO[vaga.contratoSlug] ?? "OTHER",
    directApply: false,
    hiringOrganization: {
      "@type": "Organization",
      name: vaga.empresaNome,
      ...(vaga.empresa.site ? { sameAs: vaga.empresa.site } : {}),
      ...(vaga.logoUrl ? { logo: vaga.logoUrl } : {}),
    },
  };

  const endereco = {
    "@type": "PostalAddress",
    addressLocality: vaga.cidadeNome.replace(/ \([A-Z]{2}\)$/, ""),
    addressRegion: vaga.cidadeUf,
    addressCountry: "BR",
  };
  if (vaga.remota) {
    dados.jobLocationType = "TELECOMMUTE";
    dados.applicantLocationRequirements = { "@type": "Country", name: "Brasil" };
  } else {
    dados.jobLocation = { "@type": "Place", address: endereco };
  }

  if (vaga.salarioMin !== null || vaga.salarioMax !== null) {
    dados.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "BRL",
      value: {
        "@type": "QuantitativeValue",
        ...(vaga.salarioMin !== null ? { minValue: vaga.salarioMin } : {}),
        ...(vaga.salarioMax !== null ? { maxValue: vaga.salarioMax } : {}),
        unitText: "MONTH",
      },
    };
  }
  return dados;
}

/**
 * JSON seguro para ir dentro de <script>: troca "<" por "<", para um
 * texto da vaga com "</script>" não conseguir fechar a tag e injetar código.
 */
export function jsonParaScript(dados: unknown): string {
  return JSON.stringify(dados).replace(/</g, "\\u003c");
}
