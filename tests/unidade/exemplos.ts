// Vagas de exemplo para os testes, no formato da visão vagas_publicas.
import type { ItemLista, VagaPublicaLinha } from "@/lib/vagas";

export const AREAS: ItemLista[] = [
  { id: "a-dev", nome: "Desenvolvimento", slug: "desenvolvimento", ordem: 1 },
  { id: "a-dados", nome: "Dados e BI", slug: "dados-e-bi", ordem: 2 },
  { id: "a-suporte", nome: "Suporte Técnico e Help Desk", slug: "suporte-tecnico-e-help-desk", ordem: 3 },
];
export const MAPA_AREAS = new Map(AREAS.map((a) => [a.id, a]));

export const NIVEIS: ItemLista[] = [
  { id: "n-estagio", nome: "Estágio", slug: "estagio", ordem: 1 },
  { id: "n-junior", nome: "Júnior", slug: "junior", ordem: 2 },
  { id: "n-pleno", nome: "Pleno", slug: "pleno", ordem: 3 },
];

export const MODALIDADES: ItemLista[] = [
  { id: "m-presencial", nome: "Presencial", slug: "presencial", ordem: 1 },
  { id: "m-hibrido", nome: "Híbrido", slug: "hibrido", ordem: 2 },
  { id: "m-remoto", nome: "Remoto", slug: "remoto", ordem: 3 },
];

export function linha(mudancas: Partial<VagaPublicaLinha> = {}): VagaPublicaLinha {
  return {
    id: "vaga-1",
    slug: "desenvolvedor-pleno-empresa-exemplo-pato-branco",
    cargo: "Desenvolvedor Pleno",
    empresa_nome: "Empresa Exemplo",
    empresa_logo_path: null,
    empresa_descricao: null,
    empresa_site: "https://exemplo.com.br",
    empresa_linkedin: null,
    empresa_instagram: null,
    cidade_nome: "Pato Branco",
    cidade_uf: "PR",
    cidade_slug: "pato-branco",
    modalidade_nome: "Híbrido",
    modalidade_slug: "hibrido",
    modalidade_remota: false,
    nivel_nome: "Pleno",
    nivel_slug: "pleno",
    contrato_nome: "CLT",
    contrato_slug: "clt",
    area_principal_nome: "Desenvolvimento",
    area_principal_slug: "desenvolvimento",
    todas_areas: ["a-dev"],
    atividades: "Desenvolver sistemas web.",
    requisitos: "TypeScript, React e PostgreSQL",
    link_candidatura: "https://exemplo.com.br/vagas/1",
    como_se_candidatar: null,
    encerra_em: "2026-12-20",
    salario_min: null,
    salario_max: null,
    salario_a_combinar: false,
    beneficios: null,
    pcd: false,
    observacao: null,
    publicada_em: "2026-11-20T13:00:00Z",
    ...mudancas,
  };
}
