import { defineConfig, devices } from "@playwright/test";

// Testes no navegador, no celular e no computador, contra o banco local
// (npm run db:start e npm run db:reset antes). Rodar: npm run test:e2e
//
// Por padrão, o Playwright monta o site (npm run build) e sobe com
// "npm run start". Para testar outro endereço já no ar (por exemplo, a
// prévia da Cloudflare com "npm run cf:preview"), use:
//   ENDERECO_DO_SITE=http://localhost:8787 npm run test:e2e

// Segredo do /api/revalidar e endereço do Supabase local, do .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local: os testes que precisam do segredo avisam o que falta.
}

const endereco = process.env.ENDERECO_DO_SITE ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/navegador",
  // Um teste por vez: alguns mudam vagas no banco e não podem se atrapalhar.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: endereco,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "off",
  },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"] } },
    { name: "computador", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: process.env.ENDERECO_DO_SITE
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: endereco,
        reuseExistingServer: true,
        timeout: 240_000,
      },
});
