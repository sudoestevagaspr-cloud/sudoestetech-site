// Acesso ao Supabase LOCAL para os testes conferirem o que chegou ao banco.
// A chave vem do "supabase status" (é a chave padrão do banco local, que
// só existe no seu computador); nada fica escrito no código.

import { execSync } from "node:child_process";

let config: { url: string; chave: string } | null = null;

function supabaseLocal() {
  if (!config) {
    const saida = execSync("npx supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, NO_PROXY: "127.0.0.1,localhost" },
    });
    const status = JSON.parse(saida.slice(saida.indexOf("{")));
    config = { url: status.API_URL, chave: status.SECRET_KEY };
  }
  return config;
}

/** Chama a API REST do Supabase local como servidor (sem RLS). */
export async function api<T = unknown>(caminho: string, init: RequestInit = {}): Promise<T> {
  const { url, chave } = supabaseLocal();
  const resposta = await fetch(`${url}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: chave, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers },
  });
  if (!resposta.ok) throw new Error(`Supabase ${resposta.status}: ${await resposta.text()}`);
  const texto = await resposta.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

export async function vagaPorSlug(slug: string): Promise<{ id: string; cargo: string }> {
  const [vaga] = await api<{ id: string; cargo: string }[]>(`vagas?select=id,cargo&slug=eq.${slug}`);
  if (!vaga) throw new Error(`Vaga ${slug} não encontrada. Rode "npm run db:reset" para recriar as vagas de exemplo.`);
  return vaga;
}

export async function metricasDeHoje(idVaga: string): Promise<{ visualizacoes: number; cliques: number }> {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [linha] = await api<{ visualizacoes: number; cliques_candidatura: number }[]>(
    `metricas_vaga_dia?select=visualizacoes,cliques_candidatura&vaga_id=eq.${idVaga}&dia=eq.${hoje}`,
  );
  return { visualizacoes: linha?.visualizacoes ?? 0, cliques: linha?.cliques_candidatura ?? 0 };
}

/** Pede ao site para descartar o cache, como o banco faz depois de uma mudança. */
export async function revalidar(baseURL: string): Promise<Response> {
  const segredo = process.env.REVALIDAR_SEGREDO;
  if (!segredo) throw new Error("Falta REVALIDAR_SEGREDO no .env.local.");
  return fetch(`${baseURL}/api/revalidar`, { method: "POST", headers: { Authorization: `Bearer ${segredo}` } });
}
