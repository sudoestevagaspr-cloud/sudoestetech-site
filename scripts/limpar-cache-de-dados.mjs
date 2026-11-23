// Roda sozinho antes de cada "npm run build" (é o script "prebuild" do package.json).
//
// Por quê: o Next.js guarda as respostas do Supabase em .next/cache/fetch-cache
// e, num build novo, reaproveita essas respostas em vez de consultar o banco.
// Se essa pasta sobrar de um build anterior (no seu computador ou no cache de
// build da Cloudflare), a página inicial seria montada com vagas velhas.
// Apagar a pasta garante que todo build lê as vagas atuais do banco.
// Só essa pasta é apagada: o resto do cache do Next.js (que deixa o build mais
// rápido) continua.

import { rmSync } from "node:fs";

rmSync(".next/cache/fetch-cache", { recursive: true, force: true });
