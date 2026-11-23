import { revalidatePath } from "next/cache";

// Aviso do banco: "algo mudou, descarte as cópias guardadas".
//
// Quem chama: o gatilho do Supabase (pg_net) quando uma vaga, empresa ou
// lista fixa muda, e a tarefa agendada da meia-noite de Brasília (quando
// vagas encerram sem nenhuma linha mudar). Veja a migration
// supabase/migrations/20261123050000_aviso_ao_site.sql.
//
// Segurança: só aceita quem manda o segredo REVALIDAR_SEGREDO no cabeçalho
// Authorization. O mesmo segredo fica no Vault do Supabase. Sem ele, qualquer
// pessoa poderia forçar o site a remontar todas as páginas.

export const dynamic = "force-dynamic";

/** Compara textos sem "vazar" pelo tempo de resposta quantos caracteres batem. */
function iguais(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diferenca = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diferenca |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diferenca === 0;
}

export async function POST(request: Request) {
  const segredo = process.env.REVALIDAR_SEGREDO ?? "";
  if (segredo.length < 32) {
    return Response.json(
      { ok: false, erro: "O segredo REVALIDAR_SEGREDO não está configurado no site." },
      { status: 503 },
    );
  }
  if (!iguais(request.headers.get("authorization") ?? "", `Bearer ${segredo}`)) {
    return Response.json({ ok: false, erro: "Segredo inválido." }, { status: 401 });
  }

  // Descarta todas as páginas guardadas (lista, vagas, prévias e mapa do site).
  // Cada página é montada de novo na próxima visita, com os dados novos.
  revalidatePath("/", "layout");
  return Response.json({ ok: true, em: new Date().toISOString() });
}
