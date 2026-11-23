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

/** Um tipo só vai como texto; mais de um (ex.: "CLT ou PJ"), como lista, que o Google também aceita. */
function tiposDeEmprego(contratos: string[]): string | string[] {
  const tipos = [...new Set(contratos.map((slug) => TIPOS_DE_EMPREGO[slug] ?? "OTHER"))];
  if (tipos.length === 0) return "OTHER";
  return tipos.length === 1 ? tipos[0] : tipos;
}

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
    // A vaga fica no ar até o fim do dia de encerramento, em Brasília. Sem
    // prazo informado pela fonte, o Google não recebe data (a data da vaga
    // é só quando ela sai do nosso site, não o prazo da empresa).
    ...(vaga.prazoInformado ? { validThrough: `${vaga.encerraEm}T23:59:59-03:00` } : {}),
    employmentType: tiposDeEmprego(vaga.contratosSlugs),
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
  // Para o Google, TELECOMMUTE é trabalho 100% remoto (híbrido não conta).
  // A vaga que pode ser remota ou presencial/híbrida leva os dois: o
  // endereço e o TELECOMMUTE.
  if (!vaga.somenteRemoto) {
    dados.jobLocation = { "@type": "Place", address: endereco };
  }
  if (vaga.aceitaRemoto) {
    dados.jobLocationType = "TELECOMMUTE";
    dados.applicantLocationRequirements = { "@type": "Country", name: "Brasil" };
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
