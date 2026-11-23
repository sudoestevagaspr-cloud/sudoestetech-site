// Funções de texto usadas no servidor e no navegador. São puras (não leem
// nada de fora), por isso têm testes em tests/unidade/texto.test.ts.

/** Minúsculas, sem acento e com espaços simples: "  Júnior  TI " → "junior ti". */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Palavras que não entram nas iniciais: "Sicredi Vale do Iguaçu" → "SV".
const PALAVRAS_SEM_INICIAL = new Set([
  "a", "o", "e", "de", "da", "do", "das", "dos", "ltda", "me", "sa", "eireli", "epp",
]);

/**
 * Iniciais da empresa para o quadrado que substitui o logo.
 * Uma palavra: as duas primeiras letras ("Unimed" → "UN").
 * Mais palavras: a primeira letra das duas primeiras ("Empresa Exemplo" → "EE").
 */
export function iniciais(nome: string): string {
  const palavras = nome
    .split(/\s+/)
    .map((p) => p.replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ]/g, ""))
    .filter((p) => p && !PALAVRAS_SEM_INICIAL.has(normalizar(p)));
  if (palavras.length === 0) return "?";
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

/**
 * Quebra um texto em itens: um por linha ou separados por ";" (como na
 * planilha antiga). Tira marcadores do começo ("- ", "• ", "* ", "1. ").
 * "Windows; Redes\n- Inglês" → ["Windows", "Redes", "Inglês"]
 */
export function itens(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split(/[\n;]/)
    .map((t) => t.replace(/^\s*(?:[-–—•*▪●]|\d{1,2}[.)])\s+/, "").trim())
    .filter(Boolean);
}

/** Primeiras palavras de um texto, sem cortar no meio de uma palavra. */
export function resumir(texto: string, limite: number): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite - 1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return (ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte).replace(/[\s,;.:-]+$/, "") + "…";
}
