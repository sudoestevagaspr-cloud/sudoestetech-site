// Página de cada vaga: dados, candidatura, compartilhar, prévia para
// WhatsApp, dados para o Google, report e métricas.

import { expect, test } from "@playwright/test";
import { api, metricasDeHoje, vagaPorSlug } from "./banco";

const CIENTISTA = "/vagas/cientista-de-dados-senior-agro-dados-dois-vizinhos";
const QA = "/vagas/analista-de-testes-qa-junior-software-sudoeste-pato-branco";
const ENCERRADA = "/vagas/desenvolvedor-mobile-empresa-exemplo-pato-branco";
const ESTAGIO = "/vagas/estagio-em-infraestrutura-e-redes-cooperativa-exemplo-francisco-beltrao";

test("mostra a vaga inteira e os dados da empresa", async ({ page }) => {
  await page.goto(CIENTISTA);
  await expect(page).toHaveTitle("Cientista de Dados Sênior · Agro Dados | Sudoeste Tech");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cientista de Dados Sênior");
  await expect(page.getByText(/Até R\$\s12\.000 por mês/)).toBeVisible();
  await expect(page.getByText("Criar modelos de previsão de safra")).toBeVisible();
  await expect(page.getByText("Experiência com aprendizado de máquina")).toBeVisible();
  await expect(page.getByText("Vaga com possibilidade de viagens a campo uma vez por mês.")).toBeVisible();
  // "Como se candidatar" separado por ";" vira passos numerados.
  await expect(page.locator(".passos li")).toHaveText([
    "Clique em Candidatar-se",
    "Preencha o formulário da empresa",
    "Anexe seu currículo em PDF",
  ]);
  await expect(page.getByText(/^Publicada em \d{2}\/\d{2}\/\d{4} · Inscrições até \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();

  const empresa = page.getByRole("region", { name: "Sobre a empresa" });
  await expect(empresa.getByText("Startup fictícia de dados para o agronegócio.")).toBeVisible();
  await expect(empresa.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/company/agro-dados-exemplo/",
  );

  const candidatar = page.getByRole("link", { name: "Candidatar-se" }).first();
  await expect(candidatar).toHaveAttribute("href", "https://agro.exemplo.com.br/vagas/cientista-de-dados");
  await expect(candidatar).toHaveAttribute("target", "_blank");
  await expect(candidatar).toHaveAttribute("rel", "noopener noreferrer");
});

test("candidatura por e-mail", async ({ page }) => {
  await page.goto(QA);
  const botao = page.getByRole("link", { name: "Candidatar-se por e-mail" }).first();
  await expect(botao).toHaveAttribute("href", "mailto:vagas@software.exemplo.com.br?subject=Vaga%20QA");
  await expect(page.getByText("vagas@software.exemplo.com.br", { exact: true })).toBeVisible();
});

test("compartilhar no WhatsApp e copiar o link", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(CIENTISTA);
  const whatsapp = page.getByRole("link", { name: "Compartilhar no WhatsApp" });
  const href = (await whatsapp.getAttribute("href")) ?? "";
  expect(href.startsWith("https://wa.me/?text=")).toBe(true);
  const texto = decodeURIComponent(href.replace("https://wa.me/?text=", ""));
  expect(texto).toContain("Cientista de Dados Sênior · Agro Dados (Dois Vizinhos)");
  expect(texto).toContain(`${process.env.NEXT_PUBLIC_SITE_URL ?? baseURL}${CIENTISTA}`);

  await page.getByRole("button", { name: "Copiar link" }).click();
  await expect(page.getByRole("button", { name: "Link copiado!" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(CIENTISTA);
});

test("prévia para WhatsApp e Instagram e dados para o Google", async ({ page, request }) => {
  await page.goto(CIENTISTA);
  const meta = (propriedade: string) => page.locator(`meta[property="${propriedade}"]`).getAttribute("content");
  expect(await meta("og:title")).toBe("Cientista de Dados Sênior · Agro Dados");
  expect(await meta("og:description")).toContain("Dois Vizinhos · Pleno ou Sênior · CLT ou PJ · Presencial.");
  const imagem = (await meta("og:image")) ?? "";
  expect(imagem).toMatch(/\/vagas\/cientista-de-dados-senior-agro-dados-dois-vizinhos\/opengraph-image/);
  expect(await meta("og:image:width")).toBe("1200");

  const resposta = await request.get(new URL(imagem).pathname + new URL(imagem).search);
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()["content-type"]).toBe("image/png");

  const google = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(google["@type"]).toBe("JobPosting");
  expect(google.title).toBe("Cientista de Dados Sênior");
  expect(google.employmentType).toEqual(["FULL_TIME", "CONTRACTOR"]);
  expect(google.validThrough).toMatch(/T23:59:59-03:00$/);

  // Fora do domínio principal, o Google não indexa a versão de teste.
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).not.toHaveCount(0);
});

test("vaga curada sem nível e sem prazo informado", async ({ page }) => {
  await page.goto(ESTAGIO);
  await expect(page.getByRole("list", { name: "Detalhes da vaga" }).locator("li")).toHaveText([
    "Francisco Beltrão",
    "Presencial ou Híbrido",
    "Estágio não obrigatório",
    "Também para PcD",
  ]);
  await expect(page.getByText(/^Publicada em \d{2}\/\d{2}\/\d{4} · Prazo não informado, candidate-se logo$/)).toBeVisible();
  await expect(page.getByText(/Inscrições até/)).toHaveCount(0);

  const descricao = await page.locator('meta[property="og:description"]').getAttribute("content");
  expect(descricao).toContain("Prazo não informado, candidate-se logo.");
  const google = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  // Sem prazo da empresa, o Google não recebe data de validade.
  expect(google.validThrough).toBeUndefined();
  expect(google.employmentType).toBe("INTERN");
  expect(google.jobLocation.address.addressLocality).toBe("Francisco Beltrão");
});

test("vaga fora do ar: aviso e vagas abertas, sem os dados antigos", async ({ page }) => {
  const resposta = await page.goto(ENCERRADA);
  expect(resposta?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Esta vaga não está mais no ar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vagas abertas" })).toBeVisible();
  await expect(page.locator("article[data-vaga]")).toHaveCount(6);
  await expect(page.getByText("Flutter")).toHaveCount(0);
  // Página de erro não entra no Google.
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).not.toHaveCount(0);

  // Link de vaga que nunca existiu: mesmo aviso.
  expect((await page.goto("/vagas/vaga-que-nao-existe"))?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Esta vaga não está mais no ar" })).toBeVisible();
});

test("página que não existe e links antigos do site", async ({ page }) => {
  expect((await page.goto("/pagina-que-nao-existe"))?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();

  // Decisão 16: vaga.html?id=... leva para a lista.
  await page.goto("/vaga.html?id=12");
  await expect(page).toHaveURL(/\/(\?id=12)?$/);
  await expect(page.getByText("6 vagas abertas")).toBeVisible();
});

test("reportar vaga chega ao banco, sem dados de quem reporta", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "computador", "Grava no banco: roda só uma vez.");
  const vaga = await vagaPorSlug("cientista-de-dados-senior-agro-dados-dois-vizinhos");
  const marca = `Teste automático ${Date.now()}`;

  await page.goto(CIENTISTA);
  await page.getByText("Reportar vaga").click();
  await page.getByRole("button", { name: "Enviar report" }).click();
  await expect(page.getByText("Escolha um motivo.")).toBeVisible();

  await page.getByLabel("O link de candidatura não funciona").check();
  await page.getByLabel("Quer explicar? (opcional)").fill(marca);
  await page.getByRole("button", { name: "Enviar report" }).click();
  await expect(page.getByText(/Obrigado! Vamos conferir esta vaga/)).toBeVisible();

  const reports = await api<{ motivo: string; status: string }[]>(
    `reports?select=motivo,status&vaga_id=eq.${vaga.id}&descricao=eq.${encodeURIComponent(marca)}`,
  );
  expect(reports).toEqual([{ motivo: "link_quebrado", status: "pendente" }]);
});

test("conta a visualização e o clique em Candidatar-se uma vez por dia", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "computador", "Grava no banco: roda só uma vez.");
  const vaga = await vagaPorSlug("cientista-de-dados-senior-agro-dados-dois-vizinhos");
  const antes = await metricasDeHoje(vaga.id);
  // O link da empresa é fictício: o teste responde no lugar dele.
  await context.route("https://agro.exemplo.com.br/**", (rota) => rota.fulfill({ body: "Página da empresa" }));

  const metrica = () => page.waitForResponse((r) => r.url().includes("/rpc/registrar_metrica"));
  const primeira = metrica();
  await page.goto(CIENTISTA);
  expect((await primeira).status()).toBeLessThan(300);

  // Abrir de novo no mesmo dia não conta outra vez.
  await page.reload();
  await page.waitForTimeout(1000);

  const clique = metrica();
  const novaAba = context.waitForEvent("page");
  await page.getByRole("link", { name: "Candidatar-se" }).first().click();
  expect((await clique).status()).toBeLessThan(300);
  await (await novaAba).close();

  // Segundo clique no mesmo dia também não conta.
  const outraAba = context.waitForEvent("page");
  await page.getByRole("link", { name: "Candidatar-se" }).first().click();
  await (await outraAba).close();
  await page.waitForTimeout(1000);

  const depois = await metricasDeHoje(vaga.id);
  expect(depois.visualizacoes - antes.visualizacoes).toBe(1);
  expect(depois.cliques - antes.cliques).toBe(1);
});
