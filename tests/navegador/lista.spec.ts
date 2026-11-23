// Lista de vagas: busca, filtros, ordenação e endereço com os filtros.
// Usa as vagas de exemplo de supabase/seed.sql (6 no ar e 1 encerrada).

import { expect, test, type Page } from "@playwright/test";

const cards = (page: Page) => page.locator("article[data-vaga]");
const titulos = (page: Page) => cards(page).locator("h2");
const chips = (card: ReturnType<Page["locator"]>) => card.getByRole("list", { name: "Detalhes da vaga" }).locator("li");

async function abrirFiltros(page: Page) {
  // No celular os filtros ficam recolhidos atrás do botão "Filtros".
  const botao = page.getByRole("button", { name: /^Filtros/ });
  if (await botao.isVisible()) {
    if ((await botao.getAttribute("aria-expanded")) !== "true") await botao.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("mostra as vagas no ar, as mais recentes primeiro", async ({ page }) => {
  await expect(page).toHaveTitle("Vagas de TI no Sudoeste do Paraná | Sudoeste Tech");
  await expect(page.getByText("6 vagas abertas")).toBeVisible();
  await expect(cards(page)).toHaveCount(6);
  await expect(titulos(page).first()).toHaveText("Desenvolvedor Full Stack Pleno");
  // A vaga encerrada pela empresa não aparece.
  await expect(page.getByText("Desenvolvedor Mobile")).toHaveCount(0);
});

test("card mostra local, salário, prazo e selos", async ({ page }) => {
  const remota = page.locator('article[data-vaga="analista-de-suporte-junior-empresa-exemplo-francisco-beltrao"]');
  await expect(remota.getByText("Remoto — empresa de Francisco Beltrão")).toBeVisible();
  await expect(remota.getByText("Salário a combinar")).toBeVisible();
  await expect(remota.getByText("Nova", { exact: true })).toBeVisible();

  // Vaga curada sem nível e sem prazo informado, presencial ou híbrida:
  // sem chip de nível e com o aviso no lugar da data.
  const estagio = page.locator('article[data-vaga="estagio-em-infraestrutura-e-redes-cooperativa-exemplo-francisco-beltrao"]');
  await expect(chips(estagio)).toHaveText([
    "Francisco Beltrão",
    "Presencial ou Híbrido",
    "Estágio não obrigatório",
    "Também para PcD",
  ]);
  await expect(estagio.getByText(/A partir de R\$\s1\.200 por mês/)).toBeVisible();
  await expect(estagio.getByText("Prazo não informado, candidate-se logo")).toBeVisible();
  // Publicada há 10 dias: sem o selo "Nova".
  await expect(estagio.getByText("Nova", { exact: true })).toHaveCount(0);

  // Mais de um nível e mais de um contrato.
  const cientista = page.locator('article[data-vaga="cientista-de-dados-senior-agro-dados-dois-vizinhos"]');
  await expect(chips(cientista)).toHaveText(["Dois Vizinhos", "Presencial", "Pleno ou Sênior", "CLT ou PJ"]);

  const semSalario = page.locator('article[data-vaga="analista-de-seguranca-da-informacao-pleno-software-sudoeste-pato-branco"]');
  await expect(semSalario.getByText(/^Inscrições até \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();
});

test("busca por cargo, empresa e tecnologia, sem acento", async ({ page }) => {
  const busca = page.getByRole("searchbox", { name: "Buscar vagas" });

  await busca.fill("python");
  await expect(titulos(page)).toHaveText(["Cientista de Dados Sênior"]);
  await expect(page.getByText("1 vaga encontrada")).toBeVisible();
  await expect(page).toHaveURL(/\?q=python$/);

  await busca.fill("seguranca");
  await expect(titulos(page)).toHaveText(["Analista de Segurança da Informação Pleno"]);

  await busca.fill("cooperativa");
  await expect(titulos(page)).toHaveText(["Estágio em Infraestrutura e Redes"]);

  await busca.fill("cobol");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Nenhuma vaga com esses filtros" })).toBeVisible();
  await page.getByRole("button", { name: "limpe a busca e os filtros" }).click();
  await expect(cards(page)).toHaveCount(6);
  await expect(page).toHaveURL(/\/$/);
});

test("vaga remota aparece em qualquer cidade filtrada", async ({ page }) => {
  await abrirFiltros(page);
  await page.getByLabel("Cidade").selectOption({ label: "Francisco Beltrão" });
  await expect(cards(page)).toHaveCount(3);
  await expect(titulos(page)).toContainText([
    "Analista de Suporte Júnior",
    "Estágio em Infraestrutura e Redes",
    "Analista de Segurança da Informação Pleno",
  ]);
  await expect(page.getByText("Vagas remotas aparecem em qualquer cidade.")).toBeVisible();
  await expect(page).toHaveURL(/\?cidade=francisco-beltrao$/);

  await page.getByLabel("Cidade").selectOption({ label: "Pato Branco" });
  await expect(cards(page)).toHaveCount(4);
});

test("filtros de modalidade, nível e área (com áreas secundárias)", async ({ page }) => {
  await abrirFiltros(page);
  await page.getByLabel("Modalidade").selectOption({ label: "Remoto" });
  await expect(cards(page)).toHaveCount(2);
  // A vaga "Presencial ou Híbrido" aparece nos dois filtros.
  await page.getByLabel("Modalidade").selectOption({ label: "Presencial" });
  await expect(titulos(page)).toHaveText(["Cientista de Dados Sênior", "Estágio em Infraestrutura e Redes"]);
  await page.getByLabel("Modalidade").selectOption({ label: "Híbrido" });
  await expect(titulos(page)).toHaveText([
    "Desenvolvedor Full Stack Pleno",
    "Analista de Testes (QA) Júnior",
    "Estágio em Infraestrutura e Redes",
  ]);
  await page.getByLabel("Modalidade").selectOption({ label: "Todas as modalidades" });

  await page.getByLabel("Nível").selectOption({ label: "Júnior" });
  await expect(titulos(page)).toHaveText(["Analista de Suporte Júnior", "Analista de Testes (QA) Júnior"]);
  // A vaga "Pleno ou Sênior" aparece no filtro de Pleno.
  await page.getByLabel("Nível").selectOption({ label: "Pleno" });
  await expect(titulos(page)).toHaveText([
    "Desenvolvedor Full Stack Pleno",
    "Cientista de Dados Sênior",
    "Analista de Segurança da Informação Pleno",
  ]);
  // Nenhuma vaga no ar tem o nível Estágio (a de estágio não informa o nível).
  await expect(page.getByLabel("Nível").locator("option")).toHaveText([
    "Todos os níveis",
    "Júnior",
    "Pleno",
    "Sênior",
  ]);
  await page.getByLabel("Nível").selectOption({ label: "Todos os níveis" });

  // "Inteligência artificial" é área secundária da vaga de Cientista de Dados.
  await page.getByLabel("Área").selectOption({ label: "Inteligência artificial" });
  await expect(titulos(page)).toHaveText(["Cientista de Dados Sênior"]);

  await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
  await expect(cards(page)).toHaveCount(6);
});

test("ordenações", async ({ page }) => {
  const ordem = page.getByLabel("Ordenar vagas");
  await ordem.selectOption({ label: "Cargo de A a Z" });
  await expect(titulos(page).first()).toHaveText("Analista de Segurança da Informação Pleno");
  await expect(titulos(page).last()).toHaveText("Estágio em Infraestrutura e Redes");
  await expect(page).toHaveURL(/\?ordem=az$/);

  await ordem.selectOption({ label: "Cargo de Z a A" });
  await expect(titulos(page).first()).toHaveText("Estágio em Infraestrutura e Redes");

  await ordem.selectOption({ label: "Prazo mais próximo" });
  await expect(titulos(page).first()).toHaveText("Analista de Testes (QA) Júnior");
  // Sem prazo informado vai para o fim.
  await expect(titulos(page).last()).toHaveText("Estágio em Infraestrutura e Redes");
});

test("busca pronta no endereço (para mandar no WhatsApp)", async ({ page }) => {
  await page.goto("/?cidade=pato-branco&nivel=junior");
  await expect(titulos(page)).toHaveText(["Analista de Suporte Júnior", "Analista de Testes (QA) Júnior"]);
  await abrirFiltros(page);
  await expect(page.getByLabel("Cidade")).toHaveValue("pato-branco");
  await expect(page.getByLabel("Nível")).toHaveValue("junior");

  // Valor que não existe nas opções é ignorado.
  await page.goto("/?cidade=curitiba");
  await expect(cards(page)).toHaveCount(6);
});

test("celular: filtros recolhidos no botão; computador: sempre visíveis", async ({ page, isMobile }) => {
  const cidade = page.getByLabel("Cidade");
  if (isMobile) {
    await expect(cidade).toBeHidden();
    await page.getByRole("button", { name: /^Filtros/ }).click();
    await expect(cidade).toBeVisible();
    await cidade.selectOption({ label: "Dois Vizinhos" });
    await expect(page.getByRole("button", { name: /^Filtros/ })).toContainText("1");
  } else {
    await expect(page.getByRole("button", { name: /^Filtros/ })).toBeHidden();
    await expect(cidade).toBeVisible();
  }
  // Nenhuma rolagem para o lado.
  const larguraExtra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(larguraExtra).toBeLessThanOrEqual(0);
});

test("chamada para empresas no fim da lista", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Tem vaga de TI na região?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enviar vaga" })).toHaveAttribute("href", /docs\.google\.com\/forms/);
});
