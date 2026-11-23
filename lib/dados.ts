// Leitura das vagas no servidor, pela API REST do Supabase (PostgREST).
//
// Só lê a visão vagas_publicas e as listas fixas, com a chave publishable:
// o RLS do banco garante que nada além disso chega ao site.
//
// Cache: cada leitura é guardada junto com a página que a usou. A página
// só é montada de novo quando o banco avisa que algo mudou (rota
// /api/revalidar) ou quando ainda não existe cópia guardada.

import { configSupabase } from "./config";
import { diaEmBrasilia } from "./datas";
import {
  opcoesDeFiltro,
  paraCard,
  paraVagaCompleta,
  type ItemLista,
  type OpcoesDeFiltro,
  type VagaCard,
  type VagaCompleta,
  type VagaPublicaLinha,
} from "./vagas";

/** Etiqueta das leituras guardadas em cache (veja app/api/revalidar). */
export const ETIQUETA_DO_CACHE = "vagas";

const COLUNAS = [
  "id", "slug", "cargo",
  "empresa_nome", "empresa_logo_path", "empresa_descricao", "empresa_site",
  "empresa_linkedin", "empresa_instagram",
  "cidade_nome", "cidade_uf", "cidade_slug",
  "modalidades_nomes", "modalidades_slugs", "aceita_remoto", "somente_remoto",
  "niveis_nomes", "niveis_slugs", "contratos_nomes", "contratos_slugs",
  "area_principal_nome", "area_principal_slug", "todas_areas",
  "atividades", "requisitos", "link_candidatura", "como_se_candidatar",
  "encerra_em", "salario_min", "salario_max", "salario_a_combinar",
  "beneficios", "pcd", "observacao", "publicada_em", "prazo_informado",
].join(",");

async function lerDaApi<T>(caminho: string): Promise<T> {
  const { url, chave } = configSupabase();
  const resposta = await fetch(`${url}/rest/v1/${caminho}`, {
    // Com a chave publishable, o Supabase trata a leitura como visitante (anon).
    headers: { apikey: chave, Accept: "application/json" },
    cache: "force-cache",
    next: { tags: [ETIQUETA_DO_CACHE] },
  });
  if (!resposta.ok) {
    const tabela = caminho.split("?")[0];
    throw new Error(`O Supabase respondeu ${resposta.status} ao ler ${tabela}: ${await resposta.text()}`);
  }
  return (await resposta.json()) as T;
}

function lerLista(tabela: "areas" | "niveis" | "modalidades"): Promise<ItemLista[]> {
  // Inclui itens desativados: uma vaga antiga pode apontar para eles.
  return lerDaApi<ItemLista[]>(`${tabela}?select=id,nome,slug,ordem&order=ordem.asc,nome.asc`);
}

function porId(itens: ItemLista[]): Map<string, ItemLista> {
  return new Map(itens.map((item) => [item.id, item]));
}

export type VagasNoAr = {
  vagas: VagaCard[];
  opcoes: OpcoesDeFiltro;
};

/** Todas as vagas no ar, das mais recentes para as mais antigas, e as opções dos filtros. */
export async function lerVagasNoAr(): Promise<VagasNoAr> {
  const [linhas, areas, niveis, modalidades] = await Promise.all([
    lerDaApi<VagaPublicaLinha[]>(`vagas_publicas?select=${COLUNAS}&order=publicada_em.desc,cargo.asc`),
    lerLista("areas"),
    lerLista("niveis"),
    lerLista("modalidades"),
  ]);
  const hoje = diaEmBrasilia();
  const mapaDeAreas = porId(areas);
  const vagas = linhas.map((linha) => paraCard(linha, mapaDeAreas, hoje));
  return { vagas, opcoes: opcoesDeFiltro(vagas, { areas, niveis, modalidades }) };
}

/** O link da vaga só tem letras minúsculas, números e hífens (gerado pelo banco). */
export function slugValido(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 120;
}

/** Uma vaga no ar pelo link (slug), ou null se ela não existe ou saiu do ar. */
export async function lerVaga(slug: string): Promise<VagaCompleta | null> {
  if (!slugValido(slug)) return null;
  const [linhas, areas] = await Promise.all([
    lerDaApi<VagaPublicaLinha[]>(`vagas_publicas?select=${COLUNAS}&slug=eq.${slug}&limit=1`),
    lerLista("areas"),
  ]);
  if (linhas.length === 0) return null;
  return paraVagaCompleta(linhas[0], porId(areas), diaEmBrasilia());
}
