// Como o OpenNext guarda as páginas prontas na Cloudflare.
// Explicação completa em docs/fase-2-site.md, seção "Como o cache funciona".
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  // Cópia de cada página (HTML + dados) no R2.
  incrementalCache: r2IncrementalCache,
  // Registro de quando as páginas foram descartadas, no D1. É o que faz o
  // aviso do banco (revalidatePath) valer na hora para todo mundo.
  tagCache: d1NextTagCache,
  // Fila para remontar páginas em segundo plano (Durable Object).
  queue: doQueue,
  // Entrega a cópia guardada sem carregar o Next.js inteiro: gasta menos
  // tempo de CPU, que é o limite mais apertado do plano gratuito.
  enableCacheInterception: true,
});
