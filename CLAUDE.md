# Sudoeste Tech — Site de Vagas (v1)

Site de vagas de TI de Francisco Beltrão, Pato Branco e região, no domínio sudoestetech.com.br.
Substitui o site atual, que lê uma planilha do Google Sheets, por um sistema com banco de dados
em que as empresas verificadas cadastram as próprias vagas.

Os requisitos completos estão em `docs/requisitos.md`. Leia o arquivo inteiro antes de mudar
qualquer coisa. Este arquivo é só um resumo; se os dois divergirem, vale `docs/requisitos.md`.

## Stack

- **Supabase** (plano gratuito): PostgreSQL, autenticação, storage para os logos, tarefas
  agendadas (pg_cron) e Row Level Security.
- **Next.js** hospedado na **Cloudflare**, no domínio sudoestetech.com.br (DNS já na Cloudflare).
- **Resend** para os e-mails transacionais.
- Tudo nos planos gratuitos por enquanto.

Referência visual: o site antigo (repositório a ser informado pelo Luan). Usar só a identidade
visual (cores, fontes, estilo dos cards). Não reaproveitar a lógica do Google Sheets.

## Regras de trabalho

1. Construir em fases, uma por vez. Parar no fim de cada fase para o Luan testar.
2. Antes de cada fase, apresentar o plano e esperar aprovação.
3. Se algo não estiver definido nos requisitos, perguntar ao Luan em vez de decidir sozinho.
4. Não implementar nada da seção "Fora da v1".
5. Explicar as decisões técnicas importantes de forma direta, com o porquê (o Luan está estudando).
6. Nunca colocar chaves, senhas ou tokens no código. Usar variáveis de ambiente
   (e um `.env.example` sem valores reais).
7. Atualizar este arquivo ao terminar cada fase.

## Regras principais dos requisitos

**Atores:** admin (Luan, acesso total, login com verificação em duas etapas), empresa (um login
por empresa) e candidato (sem login).

**Empresas**
- Pré-cadastro com CNPJ, razão social, nome fantasia, e-mail e telefone; aceite dos termos de uso
  e da política de privacidade.
- CNPJ consultado na BrasilAPI; o admin vê razão social e situação na Receita.
- Fila de aprovação. Aprovada: e-mail com link (que expira) para criar a senha. Nunca enviar senha.
- A empresa edita logo, descrição, site, redes sociais e telefone. CNPJ e razão social só o admin.
- Empresa suspensa: login bloqueado e todas as vagas saem do ar na hora.
- Exclusão de conta (LGPD): apaga telefone e e-mail; as vagas antigas ficam no histórico só com
  o nome da empresa.

**Vagas**
- Origem: cadastrada pela empresa (vai ao ar sem aprovação, inclusive na edição) ou curada pelo
  admin (empresa vira registro sem login; se depois pedir acesso, ativa-se o login e as vagas
  ficam ligadas a ela).
- Obrigatórios: cargo, área principal, nível, contrato, modalidade, cidade, atividades,
  requisitos, link de candidatura, data de encerramento.
- Opcionais: até 2 áreas secundárias (só para busca), salário (faixa ou "a combinar"), benefícios,
  PcD, como se candidatar, observação. Só curadas: fonte e data de conferência.
- Status: ativa, encerrada pela empresa, expirada, removida pelo admin, suspensa.
  Vagas nunca são apagadas.
- Sai do ar na data de encerramento ou após 30 dias sem confirmação (e-mail com botões de um
  clique + lembretes); vale o que vier primeiro. Curadas: a checagem vai para o admin.
- Candidatura é sempre externa (link da empresa). O site não guarda dados de candidatos.

**Listas fixas** (mantidas pelo admin): contratos, níveis, modalidades, áreas e cidades.

**Busca e filtros:** texto (cargo, empresa, tecnologia); filtros de cidade, modalidade, nível e
área. Vaga remota aparece em qualquer cidade filtrada e é exibida como "Remoto — empresa de [cidade]".

**Card e página:** logo opcional (sem logo, quadrado com iniciais); link próprio e legível
(ex.: `/vagas/analista-de-ti-jr-unimed-pato-branco`) com prévia para WhatsApp e Instagram.

**Planos e limites**
- Tabela de planos com o limite de vagas ativas. Plano gratuito: 2 vagas ativas.
- Vagas curadas não contam no limite.
- Limite personalizado por empresa, com "válido até" opcional e histórico de liberações
  (quem, quando, limite, validade, motivo). Ao vencer, vagas já publicadas continuam no ar; só
  novas publicações ficam bloqueadas.
- Ao bater no limite, mostrar só: "Você atingiu o limite de 2 vagas ativas. Para anunciar mais
  vagas, entre em contato pelo e-mail sudoestevagaspr@gmail.com." Nenhum plano ou preço aparece.
  Registrar quantas vezes cada empresa bateu no limite.

**Reports:** o candidato reporta; o admin avalia; só report procedente gera e-mail à empresa.

**Não funcionais**
- RLS no banco: uma empresa nunca lê nem edita vagas de outra.
- Lista de vagas em cache na Cloudflare, consultando o banco só quando algo muda.
- Métricas (visualizações e cliques para candidatura) somadas por vaga por dia.
- Usuários em tabela separada de empresas; cidades, empresas e áreas reaproveitáveis no futuro.
- Exportação automática do banco uma vez por semana.
- Sem migração automática da planilha: o admin recadastra as vagas atuais como curadas.

**Fora da v1:** cursos e eventos, banco de talentos, vários logins por empresa, desenvolvimento
quebrado em especialidades, planos pagos e vaga em destaque.

## Decisões do Luan (complementam os requisitos)

Respondidas no plano da Fase 1 (23/11/2026):

1. CNPJ obrigatório no pré-cadastro; opcional na empresa de vaga curada (exigido quando ela pedir login).
2. Ao reativar uma empresa suspensa, as vagas voltam ao ar se estiverem no prazo e couberem no limite.
3. Empresa recusada pode fazer novo pré-cadastro com o mesmo CNPJ; o pedido recusado fica guardado.
4. Report: motivo de uma lista (golpe ou vaga falsa, já preenchida, link quebrado, informação errada,
   conteúdo discriminatório, outro) + texto opcional. Não pede e-mail do candidato.
5. Data de encerramento: no máximo 90 dias depois da publicação; a empresa pode adiar dentro desse máximo.
6. Vaga encerrada ou expirada não volta ao ar; a empresa duplica e publica uma nova.
7. O link (slug) da vaga fica fixo depois de publicado.
8. Salário em reais, mensal, com três situações: faixa, "a combinar" ou não informado.
9. Redes sociais da empresa: LinkedIn e Instagram.
10. O admin pode liberar mais vagas para uma empresa pelo limite personalizado, mesmo sem planos pagos.

Confirmadas no fim da Fase 1 (23/11/2026):

11. A vaga fica no ar até o fim do dia de encerramento, no horário de Brasília.
12. Na exclusão de conta ficam nome fantasia, razão social e CNPJ; e-mail e telefone são apagados.
13. Fonte e data de conferência são opcionais nas vagas curadas.
14. O link de candidatura aceita `https://`, `http://` e `mailto:`.

## Banco de dados (Supabase)

Guia da Fase 1 para o Luan: `docs/fase-1-banco.md`.

- **Migrations** em `supabase/migrations/`, em ordem pelo nome. Nunca altere uma migration já
  aplicada: crie outra. Dados das listas fixas ficam em migration; `supabase/seed.sql` é só para o banco local.
- **Testes** em `supabase/tests/testes_seguranca.sql` (roda no SQL Editor do Supabase ou com
  `npm run db:test` no banco local, que sobe com `npm run db:start`). Toda regra nova de acesso
  ganha um teste ali. O script desfaz tudo o que cria.
- **Schema `privado`**: funções auxiliares (não expostas na API). `privado.eh_admin()` exige login
  com duas etapas (`aal2` no token). `privado.minha_empresa_id()` devolve vazio se a empresa não está ativa.
- **Toda tabela nova**: `enable row level security` logo após o `create table`, `grant` explícito
  para `anon`/`authenticated`/`service_role` e políticas. Visitante não lê tabelas internas.
  O projeto foi criado com a liberação automática de tabelas novas para a API desligada, e a
  migration `20261123040900` faz o mesmo no banco local: sem `grant`, nem o servidor acessa a tabela.
- **Projeto do Luan**: as 10 migrations da Fase 1 foram aplicadas em 23/11/2026, provavelmente
  pelo SQL Editor (o guia ensina colar cada arquivo, na ordem), e os testes rodaram lá. Migration
  nova vai para ele com o link do arquivo e o mesmo passo a passo. Antes de usar `supabase db push`
  lá, conferir com `supabase migration list` e marcar as já aplicadas com `supabase migration repair`.
- **Travas por gatilho** (`t10_antes_de_gravar` em `empresas` e `vagas`): admin e empresa usam o
  mesmo papel `authenticated`, então quais colunas a empresa pode mudar é decidido no gatilho, por
  uma lista de colunas permitidas. `privado.tem_acesso_total()` = admin, service_role, SQL Editor ou
  função do banco.
- **Limite de vagas**: gatilho `t20_checar_limite` (erro `ST001`). O site publica por
  `rpc('publicar_vaga', { dados })`, que registra a tentativa em `limite_atingido` e devolve a mensagem.
- **Vitrine**: o site público lê só a visão `vagas_publicas`, que roda com a permissão do dono
  (`security_invoker = false`) de propósito. Não troque para `security_invoker = true`.
- **Datas** sempre com `privado.hoje()` (horário de Brasília). A vaga fica no ar até o fim do dia
  `encerra_em`.
- **Nada é apagado**: sem DELETE em vagas; exclusão de conta é `rpc('excluir_conta_empresa')`, que
  apaga contato e login. Arquivos do Storage são apagados pela API do Storage, não por SQL.

## Fases

- [x] Fase 1: modelagem do banco no Supabase (tabelas, relacionamentos, listas fixas, planos
  com limite personalizado por empresa) e políticas de Row Level Security.
  Concluída em 23/11/2026, depois do teste do Luan no projeto dele.
- [ ] **Fase 2: site público** com listagem, busca, filtros e página de cada vaga com link próprio.
  ← **fase atual: plano em preparação, aguardando a aprovação do Luan**
- [ ] Fase 3: pré-cadastro e painel da empresa.
- [ ] Fase 4: painel do admin.
- [ ] Fase 5: e-mails automáticos e tarefas agendadas.
