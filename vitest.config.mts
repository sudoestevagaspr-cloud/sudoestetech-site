import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes das regras do site (busca, filtros, datas, salário...), sem navegador.
// Rodar: npm test
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/unidade/**/*.test.ts"],
    environment: "node",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://projeto-teste.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_teste",
      NEXT_PUBLIC_SITE_URL: "https://site-teste.workers.dev",
    },
  },
});
