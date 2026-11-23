// Gravações feitas pelo navegador do visitante, com a chave publishable:
// - métricas (visualização e clique em "Candidatar-se"), pela função
//   registrar_metrica do banco, que só soma +1 em vagas no ar;
// - reports, que o RLS só aceita como "pendente" e para vaga no ar.
// O visitante não consegue ler nem alterar nada disso depois.

import { configSupabase } from "./config";
import { diaEmBrasilia } from "./datas";

export type TipoMetrica = "visualizacao" | "clique_candidatura";

export const MOTIVOS_REPORT = [
  { valor: "golpe_ou_vaga_falsa", nome: "Golpe ou vaga falsa" },
  { valor: "vaga_ja_preenchida", nome: "A vaga já foi preenchida" },
  { valor: "link_quebrado", nome: "O link de candidatura não funciona" },
  { valor: "informacao_errada", nome: "Informação errada na vaga" },
  { valor: "conteudo_discriminatorio", nome: "Conteúdo discriminatório" },
  { valor: "outro", nome: "Outro motivo" },
] as const;

export type MotivoReport = (typeof MOTIVOS_REPORT)[number]["valor"];

export const LIMITE_DESCRICAO_REPORT = 1000;

// Prefixo das marcas guardadas no navegador (localStorage). Não é cookie:
// fica só no aparelho da pessoa e não vai para nenhum servidor.
const PREFIXO = "sudoestetech:metrica:";

/**
 * Conta uma métrica no máximo uma vez por dia por vaga neste navegador,
 * para recarregar a página não inflar o número. Nunca quebra a página:
 * se algo falhar, a métrica só deixa de ser contada.
 */
export async function contarUmaVezPorDia(idVaga: string, tipo: TipoMetrica): Promise<void> {
  const hoje = diaEmBrasilia();
  const marca = `${PREFIXO}${tipo}:${idVaga}`;
  try {
    if (window.localStorage.getItem(marca) === hoje) return;
    window.localStorage.setItem(marca, hoje);
    limparMarcasAntigas(hoje);
  } catch {
    // Navegador sem localStorage (ex.: modo privado restrito): conta mesmo assim.
  }
  try {
    const { url, chave } = configSupabase();
    await fetch(`${url}/rest/v1/rpc/registrar_metrica`, {
      method: "POST",
      headers: { apikey: chave, "Content-Type": "application/json" },
      body: JSON.stringify({ id_vaga: idVaga, tipo }),
      // keepalive: o envio continua mesmo se a pessoa sair da página.
      keepalive: true,
    });
  } catch {
    // Sem internet ou Supabase fora do ar: a métrica não é contada.
  }
}

function limparMarcasAntigas(hoje: string) {
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const chave = window.localStorage.key(i);
    if (chave?.startsWith(PREFIXO) && window.localStorage.getItem(chave) !== hoje) {
      window.localStorage.removeItem(chave);
    }
  }
}

/** Envia um report. Não pede nome nem e-mail de quem reporta (decisão 4). */
export async function enviarReport(idVaga: string, motivo: MotivoReport, descricao: string): Promise<void> {
  const { url, chave } = configSupabase();
  const texto = descricao.trim().slice(0, LIMITE_DESCRICAO_REPORT);
  const resposta = await fetch(`${url}/rest/v1/reports`, {
    method: "POST",
    headers: {
      apikey: chave,
      "Content-Type": "application/json",
      // O visitante não pode ler a tabela de reports, então não pede o registro de volta.
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ vaga_id: idVaga, motivo, descricao: texto || null }),
  });
  if (!resposta.ok) {
    throw new Error(`O Supabase respondeu ${resposta.status}`);
  }
}
