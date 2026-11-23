# Fase 2: site público na Cloudflare

Este guia coloca o site novo no ar no endereço de teste da Cloudflare (`*.workers.dev`) e mostra
como testar. O sudoestetech.com.br continua com o site antigo até o fim da Fase 4 (decisão 15).

Faça os passos **na ordem**. Leva uns 45 minutos. Em cada passo há o resultado esperado e o que
me mandar se algo sair diferente.

**Sumário**

1. [Banco: aplicar o arquivo novo](#passo-1-banco-aplicar-o-arquivo-novo)
2. [Cloudflare: ligar o R2 e criar o bucket](#passo-2-cloudflare-ligar-o-r2-e-criar-o-bucket)
3. [Cloudflare: criar o banco D1](#passo-3-cloudflare-criar-o-banco-d1)
4. [Anotar os 3 valores do site](#passo-4-anotar-os-3-valores-do-site)
5. [Criar o site na Cloudflare, ligado ao GitHub](#passo-5-criar-o-site-na-cloudflare-ligado-ao-github)
6. [Gerar o segredo do aviso (Supabase)](#passo-6-gerar-o-segredo-do-aviso-supabase)
7. [Colocar o segredo na Cloudflare](#passo-7-colocar-o-segredo-na-cloudflare)
8. [Conferir se o banco consegue avisar o site](#passo-8-conferir-se-o-banco-consegue-avisar-o-site)
9. [Cadastrar 2 ou 3 vagas](#passo-9-cadastrar-2-ou-3-vagas)
10. [Roteiro de teste](#passo-10-roteiro-de-teste)
11. [Depois que você aprovar](#depois-que-você-aprovar)

No fim estão [como o site funciona](#como-o-site-funciona-para-estudar) e
[o que fazer se algo der errado](#se-algo-der-errado).

---

## Passo 1. Banco: aplicar o arquivo novo

A Fase 2 tem um arquivo novo de banco: ele faz o banco **avisar o site** quando uma vaga muda
(explicação em [Como o site funciona](#como-o-site-funciona-para-estudar)).

1. Abra o arquivo [`supabase/migrations/20261123050000_aviso_ao_site.sql`](../supabase/migrations/20261123050000_aviso_ao_site.sql).
   No GitHub, clique no botão de copiar (**Copy raw file**, os dois quadradinhos no alto, à direita do código).
2. Abra o [SQL Editor do Supabase](https://supabase.com/dashboard/project/_/sql/new) (se pedir, escolha o
   projeto do site). Clique em **New query** (o **+** ao lado das abas), se não abrir uma query vazia.
3. Cole com Ctrl+V e clique em **Run** (ou Ctrl+Enter). Se aparecer o aviso de operação destrutiva
   (**destructive operation**), pode confirmar: nada é apagado.
4. **Resultado esperado:** uma tabela com uma coluna `schedule` e um número (por exemplo `1`). É o
   número da tarefa que avisa o site toda meia-noite.

Depois, rode os testes de novo, como na Fase 1: copie
[`supabase/tests/testes_seguranca.sql`](../supabase/tests/testes_seguranca.sql), cole numa query nova
e clique em **Run**. A primeira linha deve ser:

```
RESUMO: 86 de 86 testes passaram
```

Os 6 testes novos conferem o aviso ao site. Como sempre, o script desfaz tudo o que cria.

**Se der erro:** se a mensagem falar de `pg_cron` ou de permissão, ligue a extensão pelo painel e
rode o arquivo de novo: menu da esquerda **Integrations** > **Cron** > **Enable** (ou **Database** >
**Extensions**, procure `pg_cron` e ligue). Qualquer outro erro: me mande o texto da mensagem.

---

## Passo 2. Cloudflare: ligar o R2 e criar o bucket

O R2 é onde a Cloudflare guarda as páginas prontas do site (o cache).

1. Entre no [painel da Cloudflare](https://dash.cloudflare.com/) com a mesma conta que tem o domínio
   sudoestetech.com.br.
2. Abra o [R2](https://dash.cloudflare.com/?to=/:account/r2/overview) (menu da esquerda **Storage &
   databases** > **R2** > **Overview**).
3. Se for a primeira vez, a Cloudflare pede para assinar o R2 (um "checkout"). Complete. Ela pode
   pedir um cartão, mas o plano começa grátis e o cache deste site usa poucos MB, bem abaixo do
   limite grátis (decisão 25).
4. Clique em **Create bucket**.
5. Em nome (**Bucket name**), digite exatamente: `sudoestetech-cache`
6. Deixe a localização (**Location**) e a classe de armazenamento (**Storage class**) como vieram
   (automática e padrão).
7. Clique em **Create bucket**.

**Resultado esperado:** abre a página do bucket `sudoestetech-cache`, vazio. Não precisa enviar nada
para ele: o site preenche sozinho.

---

## Passo 3. Cloudflare: criar o banco D1

O D1 é um banco pequeno da Cloudflare. O site anota nele **quando** cada página ficou velha.
É separado do Supabase e não guarda dado nenhum das vagas.

1. Abra o [D1](https://dash.cloudflare.com/?to=/:account/workers/d1) (menu da esquerda **Storage &
   databases** > **D1 SQL database**).
2. Clique em **Create Database**.
3. Em nome, digite exatamente: `sudoestetech-cache-tags`
4. Deixe a localização como veio e clique em **Create**.

**Resultado esperado:** abre a página do banco `sudoestetech-cache-tags`. Não crie tabelas: a
publicação do site cria a tabela que ele precisa.

---

## Passo 4. Anotar os 3 valores do site

Abra um bloco de notas e anote estes 3 valores. Eles são usados nos passos 5 e 6.

**a) Endereço do Supabase** e **b) chave publishable**

1. No painel do Supabase, abra o projeto do site e clique no botão **Connect**, no alto da página.
2. Escolha a aba de frameworks (**App Frameworks**) e o **Next.js**.
3. Aparecem duas linhas prontas. Anote os valores (o que vem depois do `=`):
   - `NEXT_PUBLIC_SUPABASE_URL` (parece com `https://abcdefgh.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (começa com `sb_publishable_`)

Se não achar pelo **Connect**: a chave está em [Settings > API Keys](https://supabase.com/dashboard/project/_/settings/api-keys)
(a **Publishable key**), e o endereço é `https://` + o código do projeto + `.supabase.co`. O código do
projeto é o pedaço do endereço do navegador depois de `/project/`.

> **Use a chave `sb_publishable_`, nunca a `sb_secret_`.** A publishable foi feita para ficar
> visível no navegador: o que protege os dados é o RLS da Fase 1. A secret passa por cima do RLS e
> nunca pode sair do Supabase.

**c) Endereço do site**

1. Abra [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) na Cloudflare.
2. Do lado direito aparece **Your subdomain** com algo como `seunome.workers.dev`.
3. O endereço do site será: `https://sudoestetech-site.seunome.workers.dev` (troque `seunome` pelo
   que aparece aí). Anote **sem barra no fim**.

Se não aparecer um subdomínio, a Cloudflare pede para escolher um quando você criar o site no
passo 5. Escolha, e monte o endereço do mesmo jeito.

---

## Passo 5. Criar o site na Cloudflare, ligado ao GitHub

Daqui em diante, cada mudança que eu enviar para o GitHub é publicada sozinha.

1. Em [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages), clique em
   **Create application**.
2. Escolha **GitHub**. Se abrir uma janela do GitHub pedindo autorização:
   - escolha a conta **sudoestevagaspr-cloud**;
   - marque **Only select repositories** e escolha `sudoestetech-site`;
   - clique em **Install & Authorize** (ou **Save**).
3. Na lista de repositórios, escolha `sudoestetech-site`.
4. Preencha o formulário assim:

   | Campo | O que colocar |
   | --- | --- |
   | Nome do projeto (**Project name** / nome do Worker) | `sudoestetech-site` (exatamente assim: é o nome que está no `wrangler.jsonc`; com outro nome o build falha) |
   | Branch (**Git branch** / **Production branch**), se aparecer | `claude/project-thread-x7ufao` (a branch do PR; assim você testa antes de juntar no `main`). Se o formulário não tiver esse campo, tudo bem: o item 8 troca a branch depois |
   | **Build command** | `npx opennextjs-cloudflare build` |
   | **Deploy command** | `npx opennextjs-cloudflare deploy` |
   | Comando de prévia (**Preview command** / non-production) | deixe como está (vamos desligar as prévias no passo 7) |
   | **Root directory** / **Path** | deixe vazio |
   | **API token** | deixe a opção de criar um token novo (a Cloudflare cria sozinha) |

5. Em **Build variables and secrets** (se estiver escondido, abra **Advanced settings**), clique em
   **Add variable** três vezes e cadastre, com o tipo texto (**Text**):

   | Variable name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | o valor **a** do passo 4 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | o valor **b** do passo 4 |
   | `NEXT_PUBLIC_SITE_URL` | o valor **c** do passo 4 |

   Confira se não sobrou espaço no começo ou no fim dos valores.
6. Clique em **Save and Deploy** (ou **Deploy**).
7. Abre a tela do build, com o registro (log) rolando. Leva de 3 a 6 minutos.
8. Confira a branch: no Worker `sudoestetech-site`, abra **Settings** > **Build** >
   **Branch control**, clique no lápis ✏️, escolha `claude/project-thread-x7ufao` como branch de
   produção e clique em **Save**. Não mexa no **Root directory**.

   Se a Cloudflare montou o `main` (o formulário pode não perguntar a branch), o primeiro build
   falha com `npm error could not determine executable to run`. É normal: o `main` ainda não tem o
   site. Depois de trocar a branch, o build seguinte começa sozinho na próxima atualização que eu
   mandar para o GitHub (o **Retry build** repete o build antigo, do `main`).

**Resultado esperado:** o build termina com sucesso (✓ verde). Perto do fim do log aparecem linhas
como `OpenNext build complete`, `Populating remote R2 incremental cache`, `Creating D1 table if
necessary` e o endereço `https://sudoestetech-site....workers.dev`. Abra esse endereço: a lista de
vagas aparece (vazia, se o banco ainda não tem vagas, com o aviso "Nenhuma vaga aberta agora").

**Se o build falhar:** clique no build com erro, copie as últimas 30 linhas do log e me mande. Os
erros mais comuns:

- `Faltam as variáveis NEXT_PUBLIC_SUPABASE_URL...`: faltou uma variável do item 5 (corrija em
  **Settings** > **Build** > **Build variables and secrets** e rode de novo: veja abaixo).
- erro com `bucket` ou `sudoestetech-cache`: o nome do bucket do passo 2 está diferente.
- erro com `D1` ou `sudoestetech-cache-tags`: o nome do banco do passo 3 está diferente.
- erro com o nome do Worker: o nome do projeto não é `sudoestetech-site`.
- `could not determine executable to run`, logo depois de `added 9 packages`: o build usou o `main`.
  Troque a branch como no item 8.

**Para rodar o build de novo sem mudar nada no GitHub:** abra o Worker `sudoestetech-site` >
**Deployments** > **View Build History** (no pé da página) > nos três pontinhos do build, **Retry build**.

---

## Passo 6. Gerar o segredo do aviso (Supabase)

O banco avisa o site quando uma vaga muda. Para ninguém mais conseguir mandar esse aviso, os dois
combinam um segredo. Este comando guarda o endereço do site no Vault (o cofre criptografado do
Supabase), cria o segredo e mostra ele para você copiar.

1. Abra uma [query nova no SQL Editor](https://supabase.com/dashboard/project/_/sql/new).
2. Cole o comando abaixo, **trocando o endereço pelo valor c do passo 4** (mantenha as aspas simples):

   ```sql
   select privado.configurar_aviso_ao_site('https://sudoestetech-site.seunome.workers.dev');
   ```

3. Clique em **Run**.

**Resultado esperado:** uma linha com um código de 64 letras e números. Clique no código, copie
(Ctrl+C) e guarde para o passo 7. Não mande esse código para ninguém (nem para mim; eu não preciso).

Se rodar o comando de novo, o código é o mesmo: ele só é criado na primeira vez. Rode de novo
quando precisar trocar o endereço (na Fase 4, com `https://sudoestetech.com.br`).

---

## Passo 7. Colocar o segredo na Cloudflare

1. Em [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages), clique no
   Worker `sudoestetech-site`.
2. Abra **Settings** e, em **Variables and Secrets**, clique em **Add**.
3. Preencha:
   - **Type:** `Secret` (criptografado; ninguém consegue ler depois, nem no painel)
   - **Variable name:** `REVALIDAR_SEGREDO`
   - **Value:** o código do passo 6
4. Clique em **Deploy**.

**Atenção:** este é um segredo de execução, em **Variables and Secrets**. Ele **não** vai em
**Build variables and secrets** (as do passo 5): as variáveis de build não existem enquanto o site
está rodando.

Opcional: em **Settings** > **Build** > **Branch control**, se aparecer uma opção de builds de
outras branches (**non-production branch builds** ou **Preview Builds**), desmarque e salve. Se não
aparecer, deixe como está. Com ela ligada, uma mudança no `main` antes de juntar o PR geraria um
build com erro e um e-mail da Cloudflare, sem afetar o site.

---

## Passo 8. Conferir se o banco consegue avisar o site

1. Numa [query nova do SQL Editor](https://supabase.com/dashboard/project/_/sql/new), rode:

   ```sql
   select privado.avisar_site();
   ```

   **Esperado:** um número (o número do pedido). Se vier `NULL`, o passo 6 não foi feito.

2. Espere uns 5 segundos e rode:

   ```sql
   select status_code, content, error_msg
     from net._http_response
    order by created desc
    limit 1;
   ```

   **Esperado:** `status_code` = `200` e `content` começando com `{"ok":true`.

| O que apareceu | O que fazer |
| --- | --- |
| `401` | O segredo da Cloudflare está diferente do Vault. Rode o comando do passo 6 de novo (ele mostra o mesmo código), e no passo 7 edite o `REVALIDAR_SEGREDO` com esse valor e clique em **Deploy**. |
| `503` | A Cloudflare ainda não tem o segredo. Refaça o passo 7, sem esquecer o **Deploy**. |
| `404` | O endereço no Vault está errado. Rode o passo 6 de novo com o endereço certo. |
| `error_msg` com `resolve`, `timeout` ou `connect` | Endereço errado ou o site ainda não foi publicado. Abra o endereço no navegador; se abrir, rode o passo 6 de novo com ele, exatamente igual. |
| nenhuma linha | Espere mais 10 segundos e rode a consulta de novo. |

---

## Passo 9. Cadastrar 2 ou 3 vagas

O painel do admin só chega na Fase 4. Até lá, as vagas entram pelo SQL Editor, com o modelo abaixo.

**Sugestão:** use 2 ou 3 vagas **reais** que estão no site antigo. Elas ficam valendo como vagas
curadas (os requisitos pedem para o admin recadastrar as vagas atuais assim), e vagas nunca são
apagadas. Se quiser uma vaga de mentira para testar, tudo bem: no fim do teste ela sai do ar
(passo 10, item 7).

1. Abra uma [query nova no SQL Editor](https://supabase.com/dashboard/project/_/sql/new), cole o
   modelo e troque os valores marcados com `<-`.
2. Clique em **Run**. **Esperado:** `Success`. Rode o modelo uma vez para cada vaga.

```sql
-- 1. Cidades (pode rodar de novo: as que já existem ficam como estão)
insert into public.cidades (nome, uf) values
  ('Francisco Beltrão', 'PR'),
  ('Pato Branco', 'PR')
on conflict (nome, uf) do nothing;

-- 2. Empresa (sem login, como nas vagas curadas). Se ela já existir, nada muda.
insert into public.empresas (nome_fantasia, site, descricao)
select 'Nome da Empresa',                      -- <- nome da empresa
       'https://www.site-da-empresa.com.br',   -- <- site (ou null, sem aspas)
       'Uma frase sobre a empresa.'            -- <- descrição (ou null)
where not exists (select 1 from public.empresas where nome_fantasia = 'Nome da Empresa');  -- <- mesmo nome

-- 3. A vaga
insert into public.vagas (
  empresa_id, origem, cargo,
  area_principal_id, nivel_id, contrato_id, modalidade_id, cidade_id,
  atividades, requisitos, link_candidatura, encerra_em,
  salario_min, salario_max, salario_a_combinar, beneficios, fonte, conferida_em
) values (
  (select id from public.empresas where nome_fantasia = 'Nome da Empresa' limit 1),  -- <- mesmo nome
  'curada',
  'Analista de Suporte Júnior',                                            -- <- cargo
  (select id from public.areas where slug = 'suporte-tecnico-e-help-desk'), -- <- área (lista abaixo)
  (select id from public.niveis where slug = 'junior'),                    -- <- nível
  (select id from public.contratos where slug = 'clt'),                    -- <- contrato
  (select id from public.modalidades where slug = 'presencial'),           -- <- modalidade
  (select id from public.cidades where slug = 'pato-branco'),              -- <- cidade
  'Atender chamados dos usuários
Instalar e configurar computadores',            -- <- atividades (uma por linha)
  'Conhecimento em Windows e redes
Vontade de aprender',                           -- <- requisitos (um por linha)
  'https://www.site-da-empresa.com.br/vagas',  -- <- link de candidatura (https:// ou mailto:)
  date '2026-12-20',                           -- <- encerra em (até 90 dias a partir de hoje)
  2500, 3000, false,                           -- <- salário mínimo, máximo, "a combinar"
  'Vale-alimentação',                          -- <- benefícios (ou null)
  'Instagram da empresa',                      -- <- fonte (ou null)
  current_date                                 -- <- data de conferência (ou null)
);
```

Dicas para preencher:

- **Salário:** faixa = `2500, 3000, false`; só "a partir de" = `2500, null, false`; a combinar =
  `null, null, true`; não informado = `null, null, false`.
- **Apóstrofo no texto** (como em "d'água"): escreva dois apóstrofos seguidos (`d''água`).
- **Candidatura por e-mail:** `'mailto:vagas@empresa.com.br'`.
- **Outra cidade:** acrescente no item 1 (por exemplo `('Dois Vizinhos', 'PR'),`) e use o nome
  sem acento, minúsculo e com hífens no item 3 (`'dois-vizinhos'`).
- **Opções das listas** (o valor entre aspas no `slug = '...'`):
  - Níveis: `estagio`, `trainee`, `junior`, `pleno`, `senior`, `especialista`
  - Contratos: `clt`, `pj`, `estagio-obrigatorio`, `estagio-nao-obrigatorio`, `temporario`
  - Modalidades: `presencial`, `hibrido`, `remoto`
  - Áreas: `suporte-tecnico-e-help-desk`, `infraestrutura-e-redes`, `cloud-e-devops`,
    `desenvolvimento`, `dados-e-bi`, `inteligencia-artificial`, `seguranca-da-informacao`,
    `qualidade-e-testes-qa`, `implantacao-e-consultoria-de-sistemas`, `produto-e-gestao`,
    `ux-ui-design`, `banco-de-dados`, `automacao-e-rpa`, `comercial-e-pre-venda-tecnica`

Se der erro, me mande a mensagem. As regras da Fase 1 continuam valendo (por exemplo, a data de
encerramento não pode passar de 90 dias).

---

## Passo 10. Roteiro de teste

Use o celular e o computador. Em cada item, o que deve acontecer:

1. **Lista.** Abra o endereço do site. As vagas aparecem, as mais novas primeiro, com o selo
   **Nova** nas publicadas há menos de 7 dias. Vaga remota aparece como "Remoto — empresa de [cidade]".
2. **Busca e filtros.** Busque por um cargo, uma empresa e uma tecnologia, com e sem acento. No
   celular, os filtros abrem no botão **Filtros**. Filtre por cidade: as vagas remotas aparecem em
   qualquer cidade. Troque a ordem (prazo, A a Z). O endereço da página muda junto: copie e abra
   noutra aba, e a mesma busca aparece.
3. **Página da vaga.** Abra uma vaga. Confira os dados, o bloco "Sobre a empresa" e o botão
   **Candidatar-se** (abre o link da empresa numa aba nova).
4. **WhatsApp.** Toque em **Compartilhar no WhatsApp** e mande para você mesmo. Em alguns segundos
   aparece a prévia com a imagem da vaga (cargo, empresa e cidade). Teste também **Copiar link**.
5. **Mudança aparece sozinha.** No [Table Editor](https://supabase.com/dashboard/project/_/editor),
   abra a tabela `vagas`, mude o `cargo` de uma vaga e salve. Espere uns 5 segundos e recarregue a
   página do site: o cargo novo aparece. O link da vaga continua o mesmo (decisão 7).
6. **Reportar.** Numa vaga, abra **Reportar vaga**, escolha um motivo e envie. No Table Editor, a
   tabela `reports` ganha uma linha nova com status `pendente`.
7. **Vaga fora do ar** (só com uma vaga de teste). No Table Editor, mude o `status` dela para
   `removida_admin`. Ela some da lista, e o link dela mostra "Esta vaga não está mais no ar" com as
   vagas abertas embaixo.
8. **Métricas.** Na tabela `metricas_vaga_dia` aparecem as visualizações e os cliques em
   Candidatar-se do dia. Abrir a mesma vaga de novo no mesmo navegador, no mesmo dia, não soma de novo.
9. **Links antigos.** Abra `[endereço do site]/vaga.html?id=1`: vai para a lista de vagas.
10. **Página que não existe.** Abra `[endereço do site]/vagas/nao-existe`: aparece o aviso de vaga
    fora do ar.
11. **CPU (plano grátis).** Depois de navegar um pouco, abra o Worker `sudoestetech-site` na
    Cloudflare, aba **Metrics** (ou **Observability**). Confira se há erros, principalmente
    "Exceeded CPU" / "CPU time limit". Me conte o que aparecer (explicação em
    [Limite de CPU](#limite-de-cpu-do-plano-grátis)).

**O que me mandar:** "tudo certo" ou, para cada item diferente do esperado, o número do item, o que
aconteceu e, se der, um print.

---

## Depois que você aprovar

Quando o teste estiver ok, faça nesta ordem:

1. Na Cloudflare, abra o Worker `sudoestetech-site` > **Settings** > **Build** > **Branch control**,
   troque a branch de produção para `main` e salve.
2. No GitHub, abra o PR da Fase 2, clique em **Merge pull request** e em **Confirm merge**.
3. A Cloudflare monta o `main` sozinha em alguns minutos (o endereço continua o mesmo). Pronto.

---

## Como o site funciona (para estudar)

### O cache, em uma frase

O site guarda cada página pronta e só consulta o banco quando uma vaga muda.

### O caminho de uma visita

1. Alguém abre o site. A Cloudflare roda o Worker (o "servidor" do site, perto da pessoa).
2. O Worker procura a página pronta no **R2**. Se achar e ela não estiver velha, entrega na hora,
   **sem consultar o Supabase**. No teste no computador: 30 visitas sem mudança, 0 consultas ao banco.
3. Para saber se a página está velha, o Worker olha no **D1** a data do último aviso de mudança.

### O caminho de uma mudança

1. Uma vaga, empresa ou lista muda no Supabase.
2. Um gatilho do banco (`t95_avisar_site`) chama `privado.avisar_site()`, que usa a extensão
   **pg_net** para fazer um pedido ao endereço `/api/revalidar` do site, com o segredo no cabeçalho.
   O pedido só sai **depois** que a gravação é confirmada: se ela falhar, o site não é avisado à toa.
3. O site confere o segredo e anota no D1 que todas as páginas ficaram velhas.
4. A próxima visita de cada página consulta o banco uma vez, monta a página e guarda no R2 de novo.

Por que descartar **todas** as páginas, e não só a da vaga que mudou? Porque uma vaga aparece na
lista, na página dela, no aviso de vaga fora do ar, no mapa do site e na imagem de prévia. Descartar
tudo é simples e nunca esquece nenhuma. Com o volume de vagas da região, isso custa poucas consultas
(no teste: 5 consultas para remontar a lista e uma vaga).

### E a meia-noite?

Vaga que passa do prazo sai do ar sem nenhuma linha mudar no banco, e o selo "Nova" some depois
de 7 dias. Por isso o **pg_cron** chama o mesmo aviso todo dia às 00:00 de Brasília (03:00 no
horário UTC, que é o relógio do pg_cron).

### Por que o segredo?

Sem ele, qualquer pessoa poderia chamar `/api/revalidar` sem parar e obrigar o site a remontar as
páginas o tempo todo. O segredo fica em dois cofres: o Vault do Supabase e os segredos do Worker.
Nunca no código (regra 6).

### Variáveis de build e de execução

As três `NEXT_PUBLIC_...` entram **no código do site** na hora do build (o navegador também
precisa delas, para enviar métricas e reports). Por isso vão em **Build variables**. O
`REVALIDAR_SEGREDO` só existe no servidor, enquanto o site roda, e não pode ir para o navegador:
vai em **Variables and Secrets**, como `Secret`.

### Endereço de teste fora do Google

Fora do sudoestetech.com.br, as páginas pedem para o Google não indexar (`noindex`), para a versão
de teste não competir com o site atual. A prévia do WhatsApp continua funcionando. O contador
GoatCounter também só conta no domínio principal.

### Limite de CPU do plano grátis

O plano grátis da Cloudflare dá 10 milissegundos de processamento por visita, com alguma
tolerância para passar disso de vez em quando. Entregar uma página pronta leva uns 3 ms. Montar uma
página leva uns 30 ms, e a imagem de prévia, uns 70 ms (medido no computador), mas isso só acontece
logo depois de uma mudança, uma vez por página. Por isso o item 11 do roteiro: se aparecer erro de
CPU, as saídas são o plano pago da Cloudflare (US$ 5 por mês; eu pergunto antes de qualquer custo)
ou trocar a imagem de prévia gerada pelo logo da empresa.

### Por que OpenNext

O OpenNext é o adaptador que transforma o site Next.js num Worker da Cloudflare, usando o próprio
Next.js por baixo. Em 2026 a Cloudflare lançou o **vinext** (que reimplementa o Next.js sobre o
Vite) e passou a recomendá-lo para projetos novos. Fiquei no OpenNext, como no plano aprovado: o
site funcionou inteiro nos testes, inclusive no simulador da Cloudflare, e as páginas e componentes
não dependem dele, então dá para trocar no futuro se valer a pena.

### Testes que rodam no computador

- `npm test`: 49 testes das regras (busca, filtros, regra da vaga remota, ordenação, salário, datas,
  selo "Nova", dados do Google).
- `npm run test:e2e`: 35 testes no navegador, no tamanho de celular e de computador, com o banco
  local (lista, filtros, página da vaga, WhatsApp, report, métricas, vaga fora do ar, cache).
- `npm run db:test`: os 86 testes do banco.

---

## Se algo der errado

| Problema | O que fazer |
| --- | --- |
| Build falhou | Copie as últimas 30 linhas do log e me mande (veja o passo 5). |
| Build falhou com `could not determine executable to run` | A Cloudflare montou o `main`. Troque a branch (passo 5, item 8). |
| Site abre com "Não conseguimos carregar as vagas" | Confira as variáveis do passo 5 (endereço e chave do Supabase). Depois de corrigir, rode o build de novo (**Retry build**). |
| Mudei uma vaga e o site não mudou | Rode a conferência do passo 8 e me mande o resultado. |
| A prévia do WhatsApp não aparece | O WhatsApp guarda prévias por um tempo. Teste com uma vaga que você ainda não mandou. Se continuar sem prévia, me mande o link. |
| Erro "Exceeded CPU" no painel | Me avise (veja [Limite de CPU](#limite-de-cpu-do-plano-grátis)). |
