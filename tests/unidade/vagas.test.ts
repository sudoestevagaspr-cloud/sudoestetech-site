import { describe, expect, it } from "vitest";
import {
  FILTROS_VAZIOS,
  filtrar,
  formatarSalario,
  juntarComOu,
  lerDoEndereco,
  opcoesDeFiltro,
  ordenar,
  paraCard,
  paraEndereco,
  type VagaCard,
} from "@/lib/vagas";
import { AREAS, HIBRIDO_OU_REMOTO, MAPA_AREAS, MODALIDADES, NIVEIS, SO_REMOTO, linha } from "./exemplos";

const HOJE = "2026-11-23";
const card = (...args: Parameters<typeof linha>) => paraCard(linha(...args), MAPA_AREAS, HOJE);

// Espaço "duro" que o Intl coloca entre "R$" e o número.
const sem = (texto: string | null) => texto?.replace(/\s/g, " ") ?? null;

describe("salário (decisão 8)", () => {
  it("faixa", () => {
    expect(sem(formatarSalario(5000, 7000, false))).toBe("R$ 5.000 a R$ 7.000 por mês");
  });
  it("só mínimo ou só máximo", () => {
    expect(sem(formatarSalario("1200", null, false))).toBe("A partir de R$ 1.200 por mês");
    expect(sem(formatarSalario(null, 12000, false))).toBe("Até R$ 12.000 por mês");
  });
  it("mínimo igual ao máximo vira um valor só", () => {
    expect(sem(formatarSalario(3500, 3500, false))).toBe("R$ 3.500 por mês");
  });
  it("centavos só quando existem", () => {
    expect(sem(formatarSalario(1518.5, null, false))).toBe("A partir de R$ 1.518,50 por mês");
  });
  it("a combinar e não informado", () => {
    expect(formatarSalario(null, null, true)).toBe("Salário a combinar");
    expect(formatarSalario(null, null, false)).toBeNull();
  });
});

describe("card da vaga", () => {
  it("vaga remota aparece como 'Remoto — empresa de [cidade]'", () => {
    const v = card(SO_REMOTO);
    expect(v.local).toBe("Remoto — empresa de Pato Branco");
    expect(v.somenteRemoto).toBe(true);
    expect(v.aceitaRemoto).toBe(true);
  });

  it("vaga híbrida ou remota mostra a cidade e as duas modalidades", () => {
    const v = card(HIBRIDO_OU_REMOTO);
    expect(v.local).toBe("Pato Branco");
    expect(v.modalidadeTexto).toBe("Híbrido ou Remoto");
    expect(v.somenteRemoto).toBe(false);
    expect(v.aceitaRemoto).toBe(true);
  });

  it("mais de um nível, contrato ou modalidade vira 'ou'", () => {
    const v = card({
      niveis_nomes: ["Júnior", "Pleno"],
      niveis_slugs: ["junior", "pleno"],
      contratos_nomes: ["CLT", "PJ"],
      contratos_slugs: ["clt", "pj"],
      modalidades_nomes: ["Presencial", "Híbrido"],
      modalidades_slugs: ["presencial", "hibrido"],
    });
    expect(v.nivelTexto).toBe("Júnior ou Pleno");
    expect(v.contratoTexto).toBe("CLT ou PJ");
    expect(v.modalidadeTexto).toBe("Presencial ou Híbrido");
    expect(juntarComOu(["Estágio", "Júnior", "Pleno"])).toBe("Estágio, Júnior ou Pleno");
  });

  it("vaga curada sem nível não mostra nível", () => {
    expect(card({ niveis_nomes: [], niveis_slugs: [] }).nivelTexto).toBeNull();
    expect(card({ niveis_nomes: null, niveis_slugs: null }).nivelTexto).toBeNull();
  });

  it("prazo não informado no lugar da data", () => {
    const semSalario = card({ prazo_informado: false });
    expect(semSalario.destaque).toBe("Prazo não informado, candidate-se logo");
    expect(semSalario.prazoInformado).toBe(false);
    const comSalario = card({ prazo_informado: false, salario_a_combinar: true });
    expect(comSalario.destaque).toBe("Salário a combinar");
    expect(comSalario.prazo).toBe("Prazo não informado, candidate-se logo");
  });

  it("cidade de fora do Paraná mostra o estado", () => {
    expect(card({ cidade_nome: "Chapecó", cidade_uf: "SC" }).local).toBe("Chapecó (SC)");
  });

  it("com salário: salário em destaque e prazo embaixo", () => {
    const v = card({ salario_min: 5000, salario_max: 7000 });
    expect(sem(v.destaque)).toBe("R$ 5.000 a R$ 7.000 por mês");
    expect(v.prazo).toBe("Inscrições até 20/12/2026");
  });

  it("sem salário: o destaque vira o prazo", () => {
    const v = card();
    expect(v.destaque).toBe("Inscrições até 20/12/2026");
    expect(v.prazo).toBeNull();
  });

  it("logo do Storage ou iniciais", () => {
    expect(card().logoUrl).toBeNull();
    expect(card().iniciais).toBe("EE");
    expect(card({ empresa_logo_path: "abc/logo 1.png" }).logoUrl).toBe(
      "https://projeto-teste.supabase.co/storage/v1/object/public/logos/abc/logo%201.png",
    );
  });

  it("selo Nova pelos 7 dias", () => {
    expect(card().nova).toBe(true);
    expect(card({ publicada_em: "2026-11-10T13:00:00Z" }).nova).toBe(false);
  });
});

describe("busca e filtros", () => {
  const vagas: VagaCard[] = [
    card({
      id: "1",
      cargo: "Desenvolvedor Júnior",
      niveis_nomes: ["Júnior"],
      niveis_slugs: ["junior"],
      requisitos: "Java e Spring",
    }),
    card({
      id: "2",
      cargo: "Analista de Suporte",
      empresa_nome: "Cooperativa Exemplo",
      cidade_nome: "Francisco Beltrão",
      cidade_slug: "francisco-beltrao",
      modalidades_nomes: ["Presencial"],
      modalidades_slugs: ["presencial"],
      area_principal_slug: "suporte-tecnico-e-help-desk",
      todas_areas: ["a-suporte"],
      requisitos: "Windows e redes",
    }),
    card({
      id: "3",
      cargo: "Cientista de Dados",
      cidade_nome: "Dois Vizinhos",
      cidade_slug: "dois-vizinhos",
      ...SO_REMOTO,
      todas_areas: ["a-dados", "a-dev"],
      requisitos: "Python",
    }),
  ];
  const ids = (lista: VagaCard[]) => lista.map((v) => v.id);

  it("sem filtros mostra todas", () => {
    expect(ids(filtrar(vagas, FILTROS_VAZIOS))).toEqual(["1", "2", "3"]);
  });

  it("busca por cargo, empresa e tecnologia, sem ligar para acento e maiúsculas", () => {
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, q: "junior" }))).toEqual(["1"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, q: "COOPERATIVA" }))).toEqual(["2"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, q: "python" }))).toEqual(["3"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, q: "beltrao" }))).toEqual(["2"]);
  });

  it("todas as palavras da busca precisam aparecer", () => {
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, q: "java suporte" }))).toEqual([]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, q: "spring desenvolvedor" }))).toEqual(["1"]);
  });

  it("vaga remota aparece em qualquer cidade filtrada", () => {
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, cidade: "francisco-beltrao" }))).toEqual(["2", "3"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, cidade: "pato-branco" }))).toEqual(["1", "3"]);
  });

  it("filtro de área inclui as áreas secundárias", () => {
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, area: "desenvolvimento" }))).toEqual(["1", "3"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, area: "dados-e-bi" }))).toEqual(["3"]);
  });

  it("filtros de modalidade e nível", () => {
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, modalidade: "presencial" }))).toEqual(["2"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, nivel: "junior" }))).toEqual(["1"]);
  });

  it("opções dos filtros: só o que tem vaga, cidade só de vaga não remota", () => {
    const opcoes = opcoesDeFiltro(vagas, { areas: AREAS, niveis: NIVEIS, modalidades: MODALIDADES });
    expect(opcoes.cidades.map((c) => c.slug)).toEqual(["francisco-beltrao", "pato-branco"]);
    expect(opcoes.niveis.map((n) => n.slug)).toEqual(["junior", "pleno"]);
    expect(opcoes.modalidades.map((m) => m.slug)).toEqual(["presencial", "hibrido", "remoto"]);
    expect(opcoes.areas.map((a) => a.slug)).toEqual(["desenvolvimento", "dados-e-bi", "suporte-tecnico-e-help-desk"]);
  });
});

describe("vagas com mais de uma opção", () => {
  const vagas: VagaCard[] = [
    card({
      id: "1",
      niveis_nomes: ["Júnior", "Pleno"],
      niveis_slugs: ["junior", "pleno"],
      modalidades_nomes: ["Presencial", "Híbrido"],
      modalidades_slugs: ["presencial", "hibrido"],
    }),
    card({ id: "2", cidade_nome: "Dois Vizinhos", cidade_slug: "dois-vizinhos", ...HIBRIDO_OU_REMOTO }),
    card({ id: "3", niveis_nomes: [], niveis_slugs: [] }),
  ];
  const ids = (lista: VagaCard[]) => lista.map((v) => v.id);

  it("filtros de nível e modalidade valem para qualquer opção da vaga", () => {
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, nivel: "junior" }))).toEqual(["1"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, nivel: "pleno" }))).toEqual(["1", "2"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, modalidade: "presencial" }))).toEqual(["1"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, modalidade: "hibrido" }))).toEqual(["1", "2", "3"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, modalidade: "remoto" }))).toEqual(["2"]);
  });

  it("vaga sem nível aparece só sem filtro de nível", () => {
    expect(ids(filtrar(vagas, FILTROS_VAZIOS))).toContain("3");
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, nivel: "estagio" }))).toEqual([]);
  });

  it("vaga que também aceita remoto aparece em qualquer cidade e põe a cidade dela no filtro", () => {
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, cidade: "pato-branco" }))).toEqual(["1", "2", "3"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, cidade: "dois-vizinhos" }))).toEqual(["2"]);
    const opcoes = opcoesDeFiltro(vagas, { areas: AREAS, niveis: NIVEIS, modalidades: MODALIDADES });
    expect(opcoes.cidades.map((c) => c.slug)).toEqual(["dois-vizinhos", "pato-branco"]);
    expect(opcoes.niveis.map((n) => n.slug)).toEqual(["junior", "pleno"]);
    expect(opcoes.modalidades.map((m) => m.slug)).toEqual(["presencial", "hibrido", "remoto"]);
  });

  it("busca encontra qualquer uma das opções", () => {
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, q: "junior" }))).toEqual(["1"]);
    expect(ids(filtrar(vagas, { ...FILTROS_VAZIOS, q: "remoto" }))).toEqual(["2"]);
  });
});

describe("ordenação (decisão 21)", () => {
  const vagas: VagaCard[] = [
    card({ id: "b", cargo: "Banco de Dados", publicada_em: "2026-11-20T10:00:00Z", encerra_em: "2026-12-10" }),
    card({ id: "a", cargo: "Analista", publicada_em: "2026-11-22T10:00:00Z", encerra_em: "2026-12-30" }),
    card({ id: "c", cargo: "Ciência de Dados", publicada_em: "2026-11-21T10:00:00Z", encerra_em: "2026-12-10" }),
  ];
  const ids = (lista: VagaCard[]) => lista.map((v) => v.id);

  it("mais recentes primeiro (padrão)", () => {
    expect(ids(ordenar(vagas, "recentes"))).toEqual(["a", "c", "b"]);
  });
  it("prazo mais próximo; empate vai para a mais recente", () => {
    expect(ids(ordenar(vagas, "prazo"))).toEqual(["c", "b", "a"]);
  });
  it("prazo mais próximo: vaga sem prazo informado vai para o fim", () => {
    const comSemPrazo = [...vagas, card({ id: "d", cargo: "Dados", encerra_em: "2026-11-25", prazo_informado: false })];
    expect(ids(ordenar(comSemPrazo, "prazo"))).toEqual(["c", "b", "a", "d"]);
  });
  it("cargo de A a Z e de Z a A", () => {
    expect(ids(ordenar(vagas, "az"))).toEqual(["a", "b", "c"]);
    expect(ids(ordenar(vagas, "za"))).toEqual(["c", "b", "a"]);
  });
  it("não muda a lista original", () => {
    ordenar(vagas, "az");
    expect(ids(vagas)).toEqual(["b", "a", "c"]);
  });
});

describe("busca no endereço da página", () => {
  it("lê filtros e ordem do endereço", () => {
    const lido = lerDoEndereco(new URLSearchParams("?cidade=pato-branco&nivel=junior&q=java&ordem=az"));
    expect(lido.filtros).toEqual({ q: "java", cidade: "pato-branco", modalidade: "", nivel: "junior", area: "" });
    expect(lido.ordem).toBe("az");
  });

  it("ordem desconhecida vira a padrão", () => {
    expect(lerDoEndereco(new URLSearchParams("?ordem=preco")).ordem).toBe("recentes");
  });

  it("monta o endereço só com o que está preenchido", () => {
    expect(paraEndereco({ ...FILTROS_VAZIOS, cidade: "pato-branco", nivel: "junior" }, "recentes")).toBe(
      "?cidade=pato-branco&nivel=junior",
    );
    expect(paraEndereco({ ...FILTROS_VAZIOS, q: " banco de dados " }, "prazo")).toBe("?q=banco+de+dados&ordem=prazo");
    expect(paraEndereco(FILTROS_VAZIOS, "recentes")).toBe("");
  });
});
