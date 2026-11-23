// Vagas: o formato que vem do banco (visão vagas_publicas) e o formato que
// as telas usam. A conversão acontece no servidor, quando a página é
// montada; o navegador recebe os textos já prontos (datas, salário,
// "Remoto — empresa de ..."), então servidor e navegador mostram igual.

import { urlDoLogo } from "./config";
import { ehNova, formatarData } from "./datas";
import { iniciais, normalizar } from "./texto";

/** Uma linha da visão public.vagas_publicas (só as colunas que o site usa). */
export type VagaPublicaLinha = {
  id: string;
  slug: string;
  cargo: string;
  empresa_nome: string;
  empresa_logo_path: string | null;
  empresa_descricao: string | null;
  empresa_site: string | null;
  empresa_linkedin: string | null;
  empresa_instagram: string | null;
  cidade_nome: string;
  cidade_uf: string;
  cidade_slug: string;
  /** Nomes e slugs das modalidades, na ordem da lista fixa (pelo menos uma). */
  modalidades_nomes: string[] | null;
  modalidades_slugs: string[] | null;
  /** Alguma modalidade é remota: a vaga aparece no filtro de qualquer cidade. */
  aceita_remoto: boolean;
  /** Todas as modalidades são remotas: o local vira "Remoto — empresa de [cidade]". */
  somente_remoto: boolean;
  /** Nomes e slugs dos níveis, na ordem da lista fixa. Vaga curada pode não ter nenhum. */
  niveis_nomes: string[] | null;
  niveis_slugs: string[] | null;
  /** Nomes e slugs dos contratos, na ordem da lista fixa (pelo menos um). */
  contratos_nomes: string[] | null;
  contratos_slugs: string[] | null;
  area_principal_nome: string;
  area_principal_slug: string;
  todas_areas: string[];
  atividades: string;
  requisitos: string;
  link_candidatura: string;
  como_se_candidatar: string | null;
  encerra_em: string;
  salario_min: number | string | null;
  salario_max: number | string | null;
  salario_a_combinar: boolean;
  beneficios: string | null;
  pcd: boolean;
  observacao: string | null;
  publicada_em: string;
  /** false: vaga curada cuja fonte não informou prazo. */
  prazo_informado: boolean;
};

/** Item de uma lista fixa (área, nível, modalidade, cidade). */
export type ItemLista = { id: string; nome: string; slug: string; ordem: number };

/** O que o card da lista precisa. */
export type VagaCard = {
  id: string;
  slug: string;
  cargo: string;
  empresaNome: string;
  logoUrl: string | null;
  iniciais: string;
  /** "Pato Branco" ou, na vaga só remota, "Remoto — empresa de Pato Branco". */
  local: string;
  /** Todas as modalidades são remotas (o local já diz isso; o chip da modalidade some). */
  somenteRemoto: boolean;
  /** Alguma modalidade é remota: aparece em qualquer cidade filtrada. */
  aceitaRemoto: boolean;
  cidadeSlug: string;
  cidadeNome: string;
  /** "Presencial" ou "Presencial ou Híbrido". */
  modalidadeTexto: string;
  modalidadesSlugs: string[];
  /** "Júnior" ou "Júnior ou Pleno"; null quando a vaga não informa o nível. */
  nivelTexto: string | null;
  niveisSlugs: string[];
  /** "CLT" ou "CLT ou PJ". */
  contratoTexto: string;
  areaPrincipalNome: string;
  /** Área principal e secundárias, para o filtro de área. */
  areasSlugs: string[];
  /** Linha amarela: o salário ou, sem salário, o prazo ("Inscrições até ..."). */
  destaque: string;
  /** O prazo em linha própria quando o salário ocupa o destaque. */
  prazo: string | null;
  /** false: a fonte não informou prazo; o site não mostra a data de encerramento. */
  prazoInformado: boolean;
  pcd: boolean;
  nova: boolean;
  encerraEm: string;
  publicadaEm: string;
  /** Texto sem acento onde a busca procura. */
  busca: string;
};

/** A vaga inteira, para a página da vaga. */
export type VagaCompleta = VagaCard & {
  atividades: string;
  requisitos: string;
  beneficios: string | null;
  comoSeCandidatar: string | null;
  observacao: string | null;
  linkCandidatura: string;
  salario: string | null;
  salarioMin: number | null;
  salarioMax: number | null;
  cidadeUf: string;
  contratosSlugs: string[];
  empresa: {
    descricao: string | null;
    site: string | null;
    linkedin: string | null;
    instagram: string | null;
  };
};

// ---------------------------------------------------------------------
// Salário e local
// ---------------------------------------------------------------------

function numero(valor: number | string | null): number | null {
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function reais(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: Number.isInteger(valor) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

/**
 * Salário mensal em reais, nas três situações da decisão 8:
 * faixa ("R$ 5.000 a R$ 7.000 por mês"), "a combinar" ou não informado (null).
 */
export function formatarSalario(
  min: number | string | null,
  max: number | string | null,
  aCombinar: boolean,
): string | null {
  if (aCombinar) return "Salário a combinar";
  const a = numero(min);
  const b = numero(max);
  if (a !== null && b !== null) {
    return a === b ? `${reais(a)} por mês` : `${reais(a)} a ${reais(b)} por mês`;
  }
  if (a !== null) return `A partir de ${reais(a)} por mês`;
  if (b !== null) return `Até ${reais(b)} por mês`;
  return null;
}

/** Nome da cidade, com o estado só quando não é do Paraná. */
export function nomeDaCidade(nome: string, uf: string): string {
  return uf && uf !== "PR" ? `${nome} (${uf})` : nome;
}

/** Junta nomes como numa frase: "Júnior", "Júnior ou Pleno", "Júnior, Pleno ou Sênior". */
export function juntarComOu(nomes: string[]): string | null {
  if (nomes.length === 0) return null;
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(", ")} ou ${nomes[nomes.length - 1]}`;
}

/** Texto do prazo: a data ou, quando a fonte não informou, o aviso combinado com o Luan. */
export const PRAZO_NAO_INFORMADO = "Prazo não informado, candidate-se logo";

export function textoDoPrazo(encerraEm: string, prazoInformado: boolean): string {
  return prazoInformado ? `Inscrições até ${formatarData(encerraEm)}` : PRAZO_NAO_INFORMADO;
}

/**
 * Regra dos requisitos: a vaga remota aparece como "Remoto — empresa de [cidade]".
 * Vale para a vaga só remota; a que também é presencial ou híbrida mostra a
 * cidade, e o "Remoto" aparece junto das outras modalidades ("Híbrido ou Remoto").
 */
export function textoDoLocal(somenteRemoto: boolean, cidade: string): string {
  return somenteRemoto ? `Remoto — empresa de ${cidade}` : cidade;
}

// ---------------------------------------------------------------------
// Conversão: linha do banco → formato das telas
// ---------------------------------------------------------------------

/**
 * Converte uma linha da vitrine para o card.
 * @param areas todas as áreas (id → nome e slug), para o filtro e a busca
 * @param hoje dia de hoje em Brasília (AAAA-MM-DD), para o selo "Nova"
 */
export function paraCard(linha: VagaPublicaLinha, areas: Map<string, ItemLista>, hoje: string): VagaCard {
  const cidade = nomeDaCidade(linha.cidade_nome, linha.cidade_uf);
  const salario = formatarSalario(linha.salario_min, linha.salario_max, linha.salario_a_combinar);
  const inscricoes = textoDoPrazo(linha.encerra_em, linha.prazo_informado !== false);
  const niveisNomes = linha.niveis_nomes ?? [];
  const modalidadesNomes = linha.modalidades_nomes ?? [];
  const contratosNomes = linha.contratos_nomes ?? [];
  const areasDaVaga = (linha.todas_areas ?? [])
    .map((id) => areas.get(id))
    .filter((a): a is ItemLista => Boolean(a));

  return {
    id: linha.id,
    slug: linha.slug,
    cargo: linha.cargo,
    empresaNome: linha.empresa_nome,
    logoUrl: urlDoLogo(linha.empresa_logo_path),
    iniciais: iniciais(linha.empresa_nome),
    local: textoDoLocal(linha.somente_remoto, cidade),
    somenteRemoto: linha.somente_remoto,
    aceitaRemoto: linha.aceita_remoto,
    cidadeSlug: linha.cidade_slug,
    cidadeNome: cidade,
    modalidadeTexto: juntarComOu(modalidadesNomes) ?? "",
    modalidadesSlugs: linha.modalidades_slugs ?? [],
    nivelTexto: juntarComOu(niveisNomes),
    niveisSlugs: linha.niveis_slugs ?? [],
    contratoTexto: juntarComOu(contratosNomes) ?? "",
    areaPrincipalNome: linha.area_principal_nome,
    areasSlugs: areasDaVaga.length ? areasDaVaga.map((a) => a.slug) : [linha.area_principal_slug],
    destaque: salario ?? inscricoes,
    prazo: salario ? inscricoes : null,
    prazoInformado: linha.prazo_informado !== false,
    pcd: linha.pcd,
    nova: ehNova(linha.publicada_em, hoje),
    encerraEm: linha.encerra_em,
    publicadaEm: linha.publicada_em,
    busca: normalizar(
      [
        linha.cargo,
        linha.empresa_nome,
        cidade,
        ...modalidadesNomes,
        ...niveisNomes,
        ...contratosNomes,
        ...areasDaVaga.map((a) => a.nome),
        linha.area_principal_nome,
        linha.requisitos,
        linha.atividades,
      ].join(" "),
    ),
  };
}

export function paraVagaCompleta(
  linha: VagaPublicaLinha,
  areas: Map<string, ItemLista>,
  hoje: string,
): VagaCompleta {
  return {
    ...paraCard(linha, areas, hoje),
    atividades: linha.atividades,
    requisitos: linha.requisitos,
    beneficios: linha.beneficios,
    comoSeCandidatar: linha.como_se_candidatar,
    observacao: linha.observacao,
    linkCandidatura: linha.link_candidatura,
    salario: formatarSalario(linha.salario_min, linha.salario_max, linha.salario_a_combinar),
    salarioMin: numero(linha.salario_min),
    salarioMax: numero(linha.salario_max),
    cidadeUf: linha.cidade_uf,
    contratosSlugs: linha.contratos_slugs ?? [],
    empresa: {
      descricao: linha.empresa_descricao,
      site: linha.empresa_site,
      linkedin: linha.empresa_linkedin,
      instagram: linha.empresa_instagram,
    },
  };
}

// ---------------------------------------------------------------------
// Filtros, busca e ordenação (rodam no navegador)
// ---------------------------------------------------------------------

export type Filtros = {
  q: string;
  cidade: string;
  modalidade: string;
  nivel: string;
  area: string;
};

export const FILTROS_VAZIOS: Filtros = { q: "", cidade: "", modalidade: "", nivel: "", area: "" };

export const ORDENS = [
  { valor: "recentes", nome: "Mais recentes" },
  { valor: "prazo", nome: "Prazo mais próximo" },
  { valor: "az", nome: "Cargo de A a Z" },
  { valor: "za", nome: "Cargo de Z a A" },
] as const;

export type Ordem = (typeof ORDENS)[number]["valor"];

/**
 * Aplica a busca e os filtros.
 * - Busca: todas as palavras digitadas precisam aparecer (sem acento).
 * - Cidade: vale para presencial e híbrido; a vaga que aceita remoto
 *   aparece em qualquer cidade filtrada (regra dos requisitos).
 * - Modalidade, nível e contrato: qualquer uma das opções da vaga.
 * - Área: principal ou secundária.
 * - Nível: qualquer um dos níveis da vaga. A vaga sem nível aparece só sem
 *   filtro de nível ("Todos os níveis").
 */
export function filtrar(vagas: VagaCard[], filtros: Filtros): VagaCard[] {
  const palavras = normalizar(filtros.q).split(" ").filter(Boolean);
  return vagas.filter(
    (v) =>
      (!filtros.cidade || v.aceitaRemoto || v.cidadeSlug === filtros.cidade) &&
      (!filtros.modalidade || v.modalidadesSlugs.includes(filtros.modalidade)) &&
      (!filtros.nivel || v.niveisSlugs.includes(filtros.nivel)) &&
      (!filtros.area || v.areasSlugs.includes(filtros.area)) &&
      palavras.every((p) => v.busca.includes(p)),
  );
}

function maisRecentesPrimeiro(a: VagaCard, b: VagaCard): number {
  if (a.publicadaEm !== b.publicadaEm) return a.publicadaEm < b.publicadaEm ? 1 : -1;
  return a.cargo.localeCompare(b.cargo, "pt-BR", { sensitivity: "base", numeric: true });
}

/** Ordena sem mudar a lista original. Em qualquer empate, vale "mais recentes". */
export function ordenar(vagas: VagaCard[], ordem: Ordem): VagaCard[] {
  return [...vagas].sort((a, b) => {
    let r = 0;
    if (ordem === "prazo") {
      // Sem prazo informado vai para o fim: a data dela não é o prazo da empresa.
      if (a.prazoInformado !== b.prazoInformado) r = a.prazoInformado ? -1 : 1;
      else r = a.encerraEm === b.encerraEm ? 0 : a.encerraEm < b.encerraEm ? -1 : 1;
    } else if (ordem === "az" || ordem === "za") {
      r = a.cargo.localeCompare(b.cargo, "pt-BR", { sensitivity: "base", numeric: true });
      if (ordem === "za") r = -r;
    }
    return r || maisRecentesPrimeiro(a, b);
  });
}

/** Lê a busca, os filtros e a ordem do endereço (ex.: ?cidade=pato-branco&nivel=junior). */
export function lerDoEndereco(params: URLSearchParams): { filtros: Filtros; ordem: Ordem } {
  const texto = (nome: string) => (params.get(nome) ?? "").trim().slice(0, 100);
  const ordem = params.get("ordem");
  return {
    filtros: {
      q: texto("q"),
      cidade: texto("cidade"),
      modalidade: texto("modalidade"),
      nivel: texto("nivel"),
      area: texto("area"),
    },
    ordem: ORDENS.some((o) => o.valor === ordem) ? (ordem as Ordem) : "recentes",
  };
}

/** Monta o endereço com a busca e os filtros. Campos vazios e a ordem padrão ficam de fora. */
export function paraEndereco(filtros: Filtros, ordem: Ordem): string {
  const params = new URLSearchParams();
  if (filtros.q.trim()) params.set("q", filtros.q.trim());
  for (const campo of ["cidade", "modalidade", "nivel", "area"] as const) {
    if (filtros[campo]) params.set(campo, filtros[campo]);
  }
  if (ordem !== "recentes") params.set("ordem", ordem);
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

export type OpcoesDeFiltro = {
  cidades: { slug: string; nome: string }[];
  modalidades: { slug: string; nome: string }[];
  niveis: { slug: string; nome: string }[];
  areas: { slug: string; nome: string }[];
};

/**
 * Opções de cada filtro: só as que têm vaga no ar, na ordem das listas
 * fixas (cidades em ordem alfabética). Cidade sai só das vagas com alguma
 * modalidade presencial ou híbrida, porque a só remota já aparece em
 * qualquer cidade.
 */
export function opcoesDeFiltro(
  vagas: VagaCard[],
  listas: { areas: ItemLista[]; niveis: ItemLista[]; modalidades: ItemLista[] },
): OpcoesDeFiltro {
  const cidades = new Map<string, string>();
  const usados = { modalidades: new Set<string>(), niveis: new Set<string>(), areas: new Set<string>() };
  for (const v of vagas) {
    if (!v.somenteRemoto) cidades.set(v.cidadeSlug, v.cidadeNome);
    v.modalidadesSlugs.forEach((m) => usados.modalidades.add(m));
    v.niveisSlugs.forEach((n) => usados.niveis.add(n));
    v.areasSlugs.forEach((a) => usados.areas.add(a));
  }
  const daLista = (lista: ItemLista[], usadas: Set<string>) =>
    [...lista]
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))
      .filter((item) => usadas.has(item.slug))
      .map(({ slug, nome }) => ({ slug, nome }));

  return {
    cidades: [...cidades]
      .map(([slug, nome]) => ({ slug, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    modalidades: daLista(listas.modalidades, usados.modalidades),
    niveis: daLista(listas.niveis, usados.niveis),
    areas: daLista(listas.areas, usados.areas),
  };
}
