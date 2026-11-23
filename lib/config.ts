// Endereços e textos fixos do site. Nada aqui é segredo: chaves e senhas
// ficam nas variáveis de ambiente (veja .env.example).

export const SITE = {
  nome: "Sudoeste Tech",
  perfil: "@sudoestetechpr",
  instagram: "https://www.instagram.com/sudoestetechpr/",
  direct: "https://ig.me/m/sudoestetechpr",
  // Até a Fase 3, as empresas mandam vagas por este formulário (decisão 18).
  formularioEmpresas:
    "https://docs.google.com/forms/d/e/1FAIpQLSdrJC9svuXizVMNhkHapBApEBNYe-bqqFJYwQx15sDE28wVZw/viewform",
  email: "sudoestevagaspr@gmail.com",
  // Contador de visitas sem cookies (decisão 19). Só conta no domínio
  // principal, para os testes no endereço da Cloudflare não entrarem na conta.
  goatcounter: "sudoestetech",
  dominioPrincipal: "sudoestetech.com.br",
  // Selo "Nova" nos primeiros 7 dias depois da publicação (decisão 20).
  diasNova: 7,
} as const;

export const TITULO_PADRAO = "Vagas de TI no Sudoeste do Paraná | Sudoeste Tech";
export const DESCRICAO_PADRAO =
  "Vagas de TI em Francisco Beltrão, Pato Branco e região, num lugar só, com o link oficial de cada vaga.";

/**
 * Endereço público do site, sem barra no fim. Usado nos links da prévia do
 * WhatsApp, no mapa do site e nos dados para o Google.
 * Até a Fase 4 é o endereço de teste da Cloudflare (*.workers.dev).
 */
export function urlDoSite(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

/**
 * O site está no domínio principal? Fora dele (endereço de teste da
 * Cloudflare, computador), as páginas pedem para o Google não indexar,
 * para a versão de teste não competir com o site atual na busca.
 */
export function ehProducao(): boolean {
  try {
    return new URL(urlDoSite()).hostname === SITE.dominioPrincipal;
  } catch {
    return false;
  }
}

/** Configuração do Supabase lida das variáveis de ambiente. */
export function configSupabase(): { url: string; chave: string } {
  // As variáveis NEXT_PUBLIC_ são copiadas para o código no momento do
  // build, por isso precisam ser escritas assim, por extenso.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) {
    throw new Error(
      "Faltam as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "No computador, copie .env.example para .env.local e preencha. " +
        "Na Cloudflare, cadastre as duas em Settings > Build > Variables and secrets " +
        "(passo a passo em docs/fase-2-site.md).",
    );
  }
  return { url: url.replace(/\/+$/, ""), chave };
}

/** Endereço público de um arquivo do bucket "logos" do Supabase Storage. */
export function urlDoLogo(caminho: string | null): string | null {
  if (!caminho) return null;
  const { url } = configSupabase();
  const partes = caminho.split("/").map(encodeURIComponent).join("/");
  return `${url}/storage/v1/object/public/logos/${partes}`;
}
