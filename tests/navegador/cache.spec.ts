// Cache das páginas e aviso de mudança (/api/revalidar).
//
// O teste muda uma vaga direto no banco e confere que o site continua
// mostrando a página guardada (sem consultar o banco) até receber o aviso.
// No banco local recém-criado (npm run db:reset) o Vault não tem o endereço
// do site, então quem manda o aviso aqui é o próprio teste.

import { expect, test } from "@playwright/test";
import { api, revalidar, vagaPorSlug } from "./banco";

const SLUG = "analista-de-seguranca-da-informacao-pleno-software-sudoeste-pato-branco";

test.describe("aviso ao site", () => {
  test.skip(({ isMobile }) => isMobile, "Muda dados: roda só uma vez, no computador.");

  test("/api/revalidar só aceita o segredo certo", async ({ request }) => {
    expect((await request.get("/api/revalidar")).status()).toBe(405);
    expect((await request.post("/api/revalidar")).status()).toBe(401);
    expect(
      (await request.post("/api/revalidar", { headers: { Authorization: "Bearer segredo-errado-com-mais-de-32-letras" } })).status(),
    ).toBe(401);
  });

  test("mudança só aparece depois do aviso, e aí aparece na lista e na página da vaga", async ({ page, baseURL }) => {
    const vaga = await vagaPorSlug(SLUG);
    const cargoNovo = `${vaga.cargo} (alterada no teste)`;
    // Garante que as duas páginas já estão no cache antes da mudança.
    await page.goto("/");
    await page.goto(`/vagas/${SLUG}`);

    try {
      await api(`vagas?id=eq.${vaga.id}`, { method: "PATCH", body: JSON.stringify({ cargo: cargoNovo }) });

      await page.goto(`/vagas/${SLUG}`);
      await expect(
        page.getByRole("heading", { level: 1 }),
        "A página deveria continuar no cache até o aviso. Se o Vault do banco local tiver o endereço " +
          "do site, o próprio banco avisa na hora: rode npm run db:reset antes dos testes.",
      ).toHaveText(vaga.cargo);

      const resposta = await revalidar(baseURL!);
      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toMatchObject({ ok: true });

      await page.goto(`/vagas/${SLUG}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(cargoNovo);
      // O link (slug) não muda depois de publicado (decisão 7).
      await expect(page).toHaveURL(new RegExp(`/vagas/${SLUG}$`));
      await page.goto("/");
      await expect(page.locator(`article[data-vaga="${SLUG}"] h2`)).toHaveText(cargoNovo);
    } finally {
      await api(`vagas?id=eq.${vaga.id}`, { method: "PATCH", body: JSON.stringify({ cargo: vaga.cargo }) });
      await revalidar(baseURL!);
    }
  });

  test("vaga que sai do ar vira o aviso de vaga fora do ar", async ({ page, baseURL }) => {
    const vaga = await vagaPorSlug(SLUG);
    expect((await page.goto(`/vagas/${SLUG}`))?.status()).toBe(200);
    try {
      await api(`vagas?id=eq.${vaga.id}`, { method: "PATCH", body: JSON.stringify({ status: "removida_admin" }) });
      await revalidar(baseURL!);
      expect((await page.goto(`/vagas/${SLUG}`))?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "Esta vaga não está mais no ar" })).toBeVisible();
      await page.goto("/");
      await expect(page.getByText("5 vagas abertas")).toBeVisible();
    } finally {
      await api(`vagas?id=eq.${vaga.id}`, { method: "PATCH", body: JSON.stringify({ status: "ativa" }) });
      await revalidar(baseURL!);
    }
  });
});
