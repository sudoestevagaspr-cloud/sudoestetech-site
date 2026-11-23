// Datas sempre no horário de Brasília, como no banco (privado.hoje()).
// A vaga fica no ar até o fim do dia de encerramento (decisão 11).

import { SITE } from "./config";

const FUSO = "America/Sao_Paulo";

// "en-CA" escreve as datas como 2026-11-23, o mesmo formato do banco.
const formatoIso = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia (AAAA-MM-DD) em Brasília no instante dado; sem argumento, hoje. */
export function diaEmBrasilia(instante: Date | string = new Date()): string {
  return formatoIso.format(typeof instante === "string" ? new Date(instante) : instante);
}

/** "2026-12-05" → "05/12/2026". Recebe um dia, não um instante: não muda de fuso. */
export function formatarData(dia: string): string {
  const [ano, mes, d] = dia.slice(0, 10).split("-");
  return `${d}/${mes}/${ano}`;
}

/** Quantos dias vão de `de` até `ate` (os dois no formato AAAA-MM-DD). */
export function diasEntre(de: string, ate: string): number {
  const emMs = (dia: string) => {
    const [a, m, d] = dia.slice(0, 10).split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((emMs(ate) - emMs(de)) / 86_400_000);
}

/** Selo "Nova": publicada há menos de 7 dias (contando o dia da publicação). */
export function ehNova(publicadaEm: string, hoje: string, dias: number = SITE.diasNova): boolean {
  const passados = diasEntre(diaEmBrasilia(publicadaEm), hoje);
  return passados >= 0 && passados < dias;
}
