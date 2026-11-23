import { describe, expect, it } from "vitest";
import { jsonParaScript, vagaParaGoogle } from "@/lib/google";
import { paraVagaCompleta } from "@/lib/vagas";
import { HIBRIDO_OU_REMOTO, MAPA_AREAS, SO_REMOTO, linha } from "./exemplos";

const URL_VAGA = "https://site-teste.workers.dev/vagas/desenvolvedor-pleno-empresa-exemplo-pato-branco";
const google = (...args: Parameters<typeof linha>) =>
  vagaParaGoogle(paraVagaCompleta(linha(...args), MAPA_AREAS, "2026-11-23"), URL_VAGA);

describe("dados para o Google para Vagas (decisão 23)", () => {
  it("campos principais", () => {
    const dados = google();
    expect(dados["@type"]).toBe("JobPosting");
    expect(dados.title).toBe("Desenvolvedor Pleno");
    expect(dados.datePosted).toBe("2026-11-20T13:00:00Z");
    // Fica no ar até o fim do dia de encerramento, em Brasília (decisão 11).
    expect(dados.validThrough).toBe("2026-12-20T23:59:59-03:00");
    expect(dados.employmentType).toBe("FULL_TIME");
    expect(dados.directApply).toBe(false);
    expect(dados.hiringOrganization).toEqual({
      "@type": "Organization",
      name: "Empresa Exemplo",
      sameAs: "https://exemplo.com.br",
    });
  });

  const ENDERECO = {
    "@type": "Place",
    address: { "@type": "PostalAddress", addressLocality: "Pato Branco", addressRegion: "PR", addressCountry: "BR" },
  };

  it("vaga presencial ou híbrida tem endereço e não é teletrabalho", () => {
    expect(google().jobLocation).toEqual(ENDERECO);
    expect(google().jobLocationType).toBeUndefined();
  });

  it("vaga remota é marcada como teletrabalho no Brasil", () => {
    const dados = google(SO_REMOTO);
    expect(dados.jobLocationType).toBe("TELECOMMUTE");
    expect(dados.applicantLocationRequirements).toEqual({ "@type": "Country", name: "Brasil" });
    expect(dados.jobLocation).toBeUndefined();
  });

  it("vaga híbrida ou remota leva o endereço e o teletrabalho", () => {
    const dados = google(HIBRIDO_OU_REMOTO);
    expect(dados.jobLocation).toEqual(ENDERECO);
    expect(dados.jobLocationType).toBe("TELECOMMUTE");
  });

  it("sem prazo informado, o Google não recebe data de validade", () => {
    expect(google({ prazo_informado: false }).validThrough).toBeUndefined();
  });

  it("salário mensal em reais só quando informado", () => {
    expect(google().baseSalary).toBeUndefined();
    expect(google({ salario_a_combinar: true }).baseSalary).toBeUndefined();
    expect(google({ salario_min: 5000, salario_max: 7000 }).baseSalary).toEqual({
      "@type": "MonetaryAmount",
      currency: "BRL",
      value: { "@type": "QuantitativeValue", minValue: 5000, maxValue: 7000, unitText: "MONTH" },
    });
  });

  it("estágio e PJ", () => {
    expect(google({ contratos_slugs: ["estagio-nao-obrigatorio"] }).employmentType).toBe("INTERN");
    expect(google({ contratos_slugs: ["pj"] }).employmentType).toBe("CONTRACTOR");
  });

  it("mais de um contrato vira lista, sem repetir", () => {
    expect(google({ contratos_slugs: ["clt", "pj"] }).employmentType).toEqual(["FULL_TIME", "CONTRACTOR"]);
    expect(google({ contratos_slugs: ["estagio-obrigatorio", "estagio-nao-obrigatorio"] }).employmentType).toBe(
      "INTERN",
    );
    expect(google({ contratos_slugs: ["contrato-novo"] }).employmentType).toBe("OTHER");
  });

  it("descrição em HTML com o texto escapado", () => {
    const dados = google({ atividades: "Criar <script>alert(1)</script>\nTestar" });
    expect(dados.description).toContain("<li>Criar &lt;script&gt;alert(1)&lt;/script&gt;</li><li>Testar</li>");
  });
});

describe("jsonParaScript", () => {
  it("não deixa um texto fechar a tag <script>", () => {
    const texto = jsonParaScript({ cargo: "</script><script>alert(1)</script>" });
    expect(texto).not.toContain("</script>");
    expect(JSON.parse(texto)).toEqual({ cargo: "</script><script>alert(1)</script>" });
  });
});
